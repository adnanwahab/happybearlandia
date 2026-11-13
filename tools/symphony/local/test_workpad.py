"""Offline host lifecycle tests; never contacts Linear or starts Codex."""
import json
import io
import os
import stat
import subprocess
import sys
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import workpad as w
import publish as p


class WorkpadTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.state = Path(temporary.name) / 'private-state'
        state_patch = patch.object(p, 'STATE', self.state)
        state_patch.start()
        self.addCleanup(state_patch.stop)
        network_patch = patch.object(p.urllib.request, 'urlopen', side_effect=AssertionError('Offline tests prohibit network'))
        network_patch.start()
        self.addCleanup(network_patch.stop)
        self.data = dict(id='issue-id', identifier='SHE-179', state={'name': 'In Progress'},
                         labels={'nodes': [{'id': 'pilot', 'name': 'symphony-pilot'}, {'id': 'ready', 'name': 'hbl-agent-ready'}, {'id': 'approved', 'name': 'hbl-coordinator-approved'}], 'pageInfo': {'hasNextPage': False}})
        self.pads = []
        self.creates = []
        self.fail = False

    def api(self, query, variables, **options):
        if 'commentCreate' in query:
            self.assertEqual(options, {'attempts': 1})
            self.creates.append(variables['input']['id'])
            self.pads = [dict(id=self.creates[-1], body=variables['input']['body'])]
            if self.fail:
                raise p.PublicationError('ambiguous timeout')
            return {'commentCreate': {'success': True}}
        if 'comments(' in query:
            return {'issue': {'comments': {'nodes': self.pads, 'pageInfo': {'hasNextPage': False}}}}
        raise AssertionError(query)

    def test_new_existing_and_ambiguous_create_no_duplicates(self):
        for ambiguous in (False, True):
            self.pads, self.creates, self.fail = [], [], ambiguous
            with patch.object(p, 'linear', self.api), patch.object(w.time, 'sleep'):
                pad = w.ensure(self.data)
                self.assertEqual(w.ensure(self.data), pad)
            self.assertEqual(len(self.creates), 1)

    def test_duplicate_existing_fails_without_mutation(self):
        self.pads = [dict(id='one', body=w.HEADER), dict(id='two', body=w.HEADER)]
        with patch.object(p, 'linear', self.api):
            with self.assertRaisesRegex(p.PublicationError, 'multiple'):
                w.ensure(self.data)
        self.assertEqual(self.creates, [])

    def test_create_failures_retry_same_uuid(self):
        def api(query, variables, **options):
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                raise p.PublicationError('failure')
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api), patch.object(w.time, 'sleep'):
            with self.assertRaises(p.PublicationError):
                w.ensure(self.data)
        self.assertEqual(len(self.creates), 3)
        self.assertEqual(len(set(self.creates)), 1)

    def test_transport_retries_and_redacts(self):
        with patch.dict(p.os.environ, {'LINEAR_API_KEY': 'fixture'}), patch.object(p.urllib.request, 'urlopen', side_effect=OSError('secret')), patch.object(p.time, 'sleep') as sleep:
            with self.assertRaisesRegex(p.PublicationError, 'after 3 attempts') as error:
                p.linear('query{}', {})
            self.assertNotIn('secret', str(error.exception))
            self.assertEqual(sleep.call_count, 2)

    def test_pagination_reuses_later_comment(self):
        pages = [
            {'issue': {'comments': {'nodes': [], 'pageInfo': {'hasNextPage': True, 'endCursor': 'next'}}}},
            {'issue': {'comments': {'nodes': [dict(id='old', body=w.HEADER)], 'pageInfo': {'hasNextPage': False}}}}
        ]
        with patch.object(p, 'linear', side_effect=pages) as api:
            self.assertEqual(w.ensure(self.data)['id'], 'old')
            self.assertEqual(api.call_args_list[1].args[1]['after'], 'next')

    def identity_file(self):
        paths = list((self.state / 'workpad-identities').glob('*.json'))
        self.assertEqual(len(paths), 1)
        return paths[0]

    def test_uuid4_durable_before_create_and_private_permissions(self):
        def api(query, variables, **options):
            if 'commentCreate' in query:
                saved = json.loads(self.identity_file().read_text())
                self.assertEqual(saved['commentId'], variables['input']['id'])
                self.assertEqual(uuid.UUID(saved['commentId']).version, 4)
                self.assertEqual(stat.S_IMODE(self.state.stat().st_mode), 0o700)
                self.assertEqual(stat.S_IMODE(self.identity_file().parent.stat().st_mode), 0o700)
                for item in self.identity_file().parent.iterdir():
                    self.assertEqual(stat.S_IMODE(item.stat().st_mode), 0o600)
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api):
            w.ensure(self.data)

    def test_existing_and_duplicates_are_read_before_local_identity_writes(self):
        for pads in ([dict(id='legacy', body=w.HEADER)],
                     [dict(id='one', body=w.HEADER), dict(id='two', body=w.HEADER)]):
            self.pads = pads
            with patch.object(p, 'linear', self.api), patch.object(w, '_identity_lock', side_effect=AssertionError('No state writes')):
                if len(pads) == 1:
                    self.assertEqual(w.ensure(self.data)['id'], 'legacy')
                else:
                    with self.assertRaises(p.PublicationError):
                        w.ensure(self.data)
        self.assertFalse(self.state.exists())

    def test_failed_process_retry_reuses_identity_without_regeneration(self):
        def failed(query, variables, **options):
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                raise p.PublicationError('ambiguous offline create')
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', failed), patch.object(w.time, 'sleep'):
            with self.assertRaises(p.PublicationError):
                w.ensure(self.data)
        first = self.creates[0]
        with patch.object(p, 'linear', self.api), patch.object(w.uuid, 'uuid4', side_effect=AssertionError('Must reuse persisted ID')):
            self.assertEqual(w.ensure(self.data)['id'], first)
        self.assertEqual(len(set(self.creates)), 1)

    def test_identity_is_reused_by_fresh_python_process(self):
        with patch.object(p, 'linear', self.api):
            w.ensure(self.data)
        expected = self.creates[0]
        script = ('import pathlib,sys,workpad as w; w.p.STATE=pathlib.Path(sys.argv[1]); '
                  'identity=sys.argv[2]; '
                  'lock=w._identity_lock(identity); path=lock.__enter__(); '
                  'print(w._creation_id(path,identity)); lock.__exit__(None,None,None)')
        result = subprocess.run([sys.executable, '-c', script, str(self.state), self.data['id']],
                                cwd=Path(w.__file__).parent, capture_output=True, text=True, check=True,
                                env={'PATH': os.environ.get('PATH', ''), 'PYTHONDONTWRITEBYTECODE': '1'})
        self.assertEqual(result.stdout.strip(), expected)

    def test_interrupted_replace_never_creates_or_leaves_partial_identity(self):
        with patch.object(p, 'linear', self.api), patch.object(w.os, 'replace', side_effect=OSError('private failure')):
            with self.assertRaises(p.PublicationError) as error:
                w.ensure(self.data)
        self.assertNotIn('private failure', str(error.exception))
        self.assertEqual(self.creates, [])
        self.assertEqual(list((self.state / 'workpad-identities').glob('*.json')), [])
        self.assertEqual(list((self.state / 'workpad-identities').glob('*.tmp')), [])
        with patch.object(p, 'linear', self.api):
            w.ensure(self.data)
        self.assertEqual(len(self.creates), 1)

    def test_interruption_after_rename_reuses_persisted_identity(self):
        original = os.fsync
        def interrupted(fd):
            if stat.S_ISDIR(os.fstat(fd).st_mode):
                raise KeyboardInterrupt()
            original(fd)
        with patch.object(p, 'linear', self.api), patch.object(w.os, 'fsync', interrupted):
            with self.assertRaises(KeyboardInterrupt):
                w.ensure(self.data)
        saved = json.loads(self.identity_file().read_text())['commentId']
        self.assertEqual(self.creates, [])
        with patch.object(p, 'linear', self.api), patch.object(w.uuid, 'uuid4', side_effect=AssertionError('No regeneration')):
            self.assertEqual(w.ensure(self.data)['id'], saved)

    def test_corrupt_or_non_v4_identity_fails_closed(self):
        with patch.object(p, 'linear', self.api):
            w.ensure(self.data)
        path = self.identity_file()
        self.pads = []
        for content in ('{', json.dumps(dict(schemaVersion=1, issueId=self.data['id'],
                                            commentId=str(uuid.uuid5(uuid.NAMESPACE_URL, 'old'))))):
            path.write_text(content)
            before = len(self.creates)
            with patch.object(p, 'linear', self.api), patch.object(w.uuid, 'uuid4', side_effect=AssertionError('No regeneration')):
                with self.assertRaises(p.PublicationError):
                    w.ensure(self.data)
            self.assertEqual(len(self.creates), before)
            self.assertEqual(path.read_text(), content)

    def test_identity_symlink_refused_without_touching_target(self):
        with patch.object(p, 'linear', self.api):
            w.ensure(self.data)
        path = self.identity_file()
        target = self.state / 'unrelated'
        target.write_text('preserve')
        path.unlink(); path.symlink_to(target)
        self.pads = []
        with patch.object(p, 'linear', self.api):
            with self.assertRaises(p.PublicationError):
                w.ensure(self.data)
        self.assertEqual(target.read_text(), 'preserve')

    def test_two_bootstraps_serialize_after_both_initial_reads_miss(self):
        barrier = threading.Barrier(2)
        local = threading.local()
        def api(query, variables, **options):
            if 'comments(' in query and not getattr(local, 'started', False):
                local.started = True
                barrier.wait(timeout=5)
                return {'issue': {'comments': {'nodes': [], 'pageInfo': {'hasNextPage': False}}}}
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api), ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(w.ensure, self.data) for _ in range(2)]
            pads = [future.result(timeout=10) for future in futures]
        self.assertEqual(pads[0], pads[1])
        self.assertEqual(len(self.creates), 1)

    def test_duplicate_after_ambiguous_create_is_not_chosen_or_retried(self):
        def api(query, variables, **options):
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                self.pads = [dict(id=self.creates[-1], body=w.HEADER), dict(id='external', body=w.HEADER)]
                raise p.PublicationError('ambiguous timeout')
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api):
            with self.assertRaisesRegex(p.PublicationError, 'multiple'):
                w.ensure(self.data)
        self.assertEqual(len(self.creates), 1)
        self.assertEqual(len(self.pads), 2)

    def test_last_ambiguous_create_is_reconciled(self):
        calls = 0
        def api(query, variables, **options):
            nonlocal calls
            if 'commentCreate' in query:
                calls += 1
                if calls < 3:
                    raise p.PublicationError('temporary')
                self.fail = True
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api), patch.object(w.time, 'sleep'):
            self.assertEqual(w.ensure(self.data)['id'], self.creates[0])
        self.assertEqual(calls, 3)

    def test_validation_failure_reconciles_once_and_does_not_repeat_create(self):
        def api(query, variables, **options):
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                raise p.PublicationError('Argument Validation Error (HTTP 400)', retryable=False)
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api):
            with self.assertRaisesRegex(p.PublicationError, 'HTTP 400'):
                w.ensure(self.data)
        self.assertEqual(len(self.creates), 1)

    def test_real_transport_reconciles_lost_create_before_resending(self):
        class Response(io.BytesIO):
            status = 200
        def transport(request, timeout):
            variables = json.loads(request.data)['variables']
            query = json.loads(request.data)['query']
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                self.assertEqual(uuid.UUID(self.creates[-1]).version, 4)
                self.pads = [dict(id=self.creates[-1], body=variables['input']['body'])]
                raise TimeoutError('private transport data')
            self.assertIn('comments(', query)
            payload = {'data': {'issue': {'comments': {'nodes': self.pads, 'pageInfo': {'hasNextPage': False}}}}}
            return Response(json.dumps(payload).encode())
        with patch.dict(p.os.environ, {'LINEAR_API_KEY': 'offline-fixture'}), patch.object(p.urllib.request, 'urlopen', transport):
            pad = w.ensure(self.data)
        self.assertEqual(len(self.creates), 1)
        self.assertEqual(pad['id'], self.creates[0])

    def test_failed_initial_read_performs_no_state_or_remote_write(self):
        with patch.object(p, 'linear', side_effect=p.PublicationError('read unavailable')):
            with self.assertRaises(p.PublicationError):
                w.ensure(self.data)
        self.assertFalse(self.state.exists())
        self.assertEqual(self.creates, [])

    def test_failed_reconciliation_stops_create_retries_and_preserves_id(self):
        def api(query, variables, **options):
            if 'commentCreate' in query:
                self.creates.append(variables['input']['id'])
                raise p.PublicationError('ambiguous create')
            if self.creates:
                raise p.PublicationError('comment read unavailable')
            return self.api(query, variables, **options)
        with patch.object(p, 'linear', api):
            with self.assertRaisesRegex(p.PublicationError, 'read unavailable'):
                w.ensure(self.data)
        self.assertEqual(len(self.creates), 1)
        self.assertEqual(json.loads(self.identity_file().read_text())['commentId'], self.creates[0])

    def test_before_bootstraps_and_transitions_before_snapshot(self):
        data = dict(self.data, state={'name': 'Todo'}, team={'states': {'nodes': [{'id': 'running', 'name': 'In Progress'}]}})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / '.git').mkdir()
            with patch.object(p, 'validate', return_value='SHE-179'), patch.object(w, 'issue_data', return_value=data), patch.object(w, 'ensure', return_value=dict(id='pad', body=w.HEADER)), patch.object(w, 'success') as api:
                self.assertEqual(w.sync(path, 'before'), 'running')
                self.assertEqual(api.call_args_list[1].args[2], 'issueUpdate')
                self.assertTrue((path / '.git/hbl-workpad.md').exists())

    def test_update_preserves_evidence_and_failed_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / '.git').mkdir()
            request = path / '.git/hbl-workpad.json'
            request.write_text(json.dumps(dict(status='blocked', notes='actual failure')))
            with patch.object(p, 'validate', return_value='SHE-179'), patch.object(w, 'issue_data', return_value=self.data), patch.object(w, 'ensure', return_value=dict(id='pad', body=w.HEADER+'\nprior evidence')), patch.object(w, 'success', side_effect=p.PublicationError('offline')):
                with self.assertRaises(p.PublicationError):
                    w.sync(path, 'after')
                self.assertTrue(request.exists())
            with patch.object(p, 'validate', return_value='SHE-179'), patch.object(w, 'issue_data', return_value=self.data), patch.object(w, 'ensure', return_value=dict(id='pad', body=w.HEADER+'\nprior evidence')), patch.object(w, 'success') as api:
                self.assertEqual(w.sync(path, 'after'), 'blocked')
                self.assertIn('prior evidence', api.call_args_list[0].args[1]['body'])
                self.assertEqual(api.call_args_list[1].args[2], 'issueRemoveLabel')
                self.assertFalse(request.exists())


if __name__ == '__main__':
    unittest.main()
