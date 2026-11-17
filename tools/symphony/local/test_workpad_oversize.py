"""Offline regression for oversized pending updates; no live issue/workspace writes."""
import copy
import hashlib
import io
import json
import os
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import workpad as w
import publish as p


class OversizedWorkpadTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.path = self.root / 'SHE-141'
        (self.path / '.git').mkdir(parents=True)
        self.request = self.path / '.git/hbl-workpad.json'
        self.publisher = self.path / '.git/hbl-publish.json'
        self.publisher.write_bytes(b'{"commit":"fixture-preserved-publication-request"}\n')
        self.history = w.HEADER + '\nOriginal plan and actual evidence.\n\n### Host Symphony status\nStatus: running\nEarlier evidence.'
        self.pad = dict(id='pad', body=self.history)
        self.data = dict(id='immutable-issue-id', identifier='SHE-141', state={'name': 'In Progress'},
                         labels={'nodes': [{'id': 'pilot', 'name': 'symphony-pilot'}], 'pageInfo': {'hasNextPage': False}})
        self.state = self.root / 'private'
        self.calls = []
        self.fail = None
        for patcher in [patch.object(p, 'STATE', self.state),
                        patch.object(p, 'validate', return_value='SHE-141'),
                        patch.object(w, 'issue_data', side_effect=lambda _: copy.deepcopy(self.data)),
                        patch.object(w, 'ensure', side_effect=lambda _: dict(self.pad)),
                        patch.object(w, 'success', side_effect=self.success),
                        patch.object(p.urllib.request, 'urlopen', side_effect=AssertionError('No network'))]:
            patcher.start()
            self.addCleanup(patcher.stop)

    def success(self, query, variables, field):
        self.calls.append((field, dict(variables)))
        if field == self.fail:
            raise p.PublicationError('fixture API failure')
        if field == 'issueRemoveLabel':
            self.data['labels']['nodes'] = [label for label in self.data['labels']['nodes'] if label['id'] != variables['label']]
        elif field == 'commentUpdate':
            self.pad['body'] = variables['body']
        else:
            self.failTest('Unexpected remote mutation')

    def pending(self, size=42212, notes=None):
        # Deliberately preserve formatting, Unicode and CRLF rather than reserialize.
        value = dict(status='handoff', notes=notes if notes is not None else 'x' * size)
        raw = (json.dumps(value, ensure_ascii=False, indent=3) + '\r\n').encode()
        self.request.write_bytes(raw)
        return raw

    def archives(self):
        return list((self.state / 'rejected-workpads').glob('*.json'))

    def assert_preserved(self, raw):
        archives = self.archives()
        self.assertEqual(len(archives), 1)
        self.assertEqual(archives[0].read_bytes(), raw)
        self.assertEqual(archives[0].stat().st_mode & 0o777, 0o600)
        self.assertEqual(archives[0].parent.stat().st_mode & 0o777, 0o700)
        self.assertEqual(self.request.read_bytes(), raw)
        self.assertEqual(self.publisher.read_bytes(), b'{"commit":"fixture-preserved-publication-request"}\n')
        self.assertIn(self.history, self.pad['body'])
        self.assertIn(hashlib.sha256(raw).hexdigest(), archives[0].name)

    def test_observed_42212_after_run_parks_preserves_and_blocks_publication(self):
        raw = self.pending()
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assert_preserved(raw)
        self.assertEqual([field for field, _ in self.calls], ['issueRemoveLabel', 'commentUpdate'])
        self.assertIn('42212 characters; limit is 40000', self.pad['body'])
        self.assertIn('Publication was not attempted', self.pad['body'])
        self.assertEqual(self.data['state']['name'], 'In Progress')
        self.assertEqual(self.data['labels']['nodes'], [])
        receipt = self.pad['body'][len(self.history):]
        self.assertLess(len(receipt), 1200)

    def test_parking_preserves_pressure_guard_and_other_labels(self):
        self.pending()
        self.data['labels']['nodes'].extend([
            {'id': 'pressure', 'name': 'symphony-pressure-release'},
            {'id': 'other', 'name': 'unrelated-label'}])
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assertEqual(self.data['labels']['nodes'], [
            {'id': 'pressure', 'name': 'symphony-pressure-release'},
            {'id': 'other', 'name': 'unrelated-label'}])
        self.assertEqual(self.calls[0][1], {'id': self.data['id'], 'label': 'pilot'})

    def test_before_run_handles_pending_oversize_instead_of_retrying_bootstrap(self):
        raw = self.pending(40001)
        self.assertEqual(w.sync(self.path, 'before'), 'blocked')
        self.assert_preserved(raw)
        self.assertNotIn('issueUpdate', [field for field, _ in self.calls])
        self.assertEqual(self.data['labels']['nodes'], [])

    def test_main_nonzero_exit_short_circuits_existing_after_run_publisher(self):
        self.pending()
        with patch.object(w.Path, 'cwd', return_value=self.path), patch.object(w.sys, 'argv', ['workpad.py', 'after']), patch.object(w.sys, 'stderr', new_callable=io.StringIO) as err:
            code = w.main()
        self.assertEqual(code, 2)
        self.assertIn('publication not attempted', err.getvalue())

    def test_actual_shell_hook_stops_before_publisher_in_fresh_process(self):
        raw = self.pending()
        wrapper = self.root / 'host_after.py'
        mutations = self.root / 'mutations.txt'
        wrapper.write_text(
            'import sys\nfrom pathlib import Path\nimport workpad as w\n'
            f'w.p.STATE = Path({str(self.state)!r})\n'
            "w.p.validate = lambda path: 'SHE-141'\n"
            f'w.issue_data = lambda issue: {self.data!r}\n'
            f'w.ensure = lambda data: {self.pad!r}\n'
            f'mutations = Path({str(mutations)!r})\n'
            "def success(query, variables, field):\n"
            "    with mutations.open('a') as stream: stream.write(field + '\\n')\n"
            'w.success = success\n'
            "sys.argv = ['workpad.py', 'after']\n"
            'sys.exit(w.main())\n')
        marker = self.root / 'publisher-ran'
        publisher = self.root / 'publisher_spy.py'
        publisher.write_text(f'from pathlib import Path; Path({str(marker)!r}).touch()\n')
        result = subprocess.run(
            ['/bin/sh', '-c', '"$1" "$2" || exit 1\n"$1" "$3"',
             'host-hook-test', sys.executable, str(wrapper), str(publisher)],
            cwd=self.path, capture_output=True, text=True,
            env={'PATH': os.environ.get('PATH', ''), 'PYTHONPATH': str(Path(w.__file__).parent),
                 'PYTHONDONTWRITEBYTECODE': '1'}, timeout=10)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertFalse(marker.exists())
        self.assertEqual(mutations.read_text().splitlines(), ['issueRemoveLabel', 'commentUpdate'])
        self.assert_preserved(raw)

    def test_retry_reuses_one_archive_and_one_receipt_even_without_pilot_label(self):
        raw = self.pending(notes='é' * 42212)
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assertEqual(w.sync(self.path, 'before'), 'blocked')
        self.assert_preserved(raw)
        self.assertEqual([field for field, _ in self.calls], ['issueRemoveLabel', 'commentUpdate'])
        self.assertEqual(self.pad['body'].count('### Host rejected workpad update'), 1)

    def test_exact_limit_follows_normal_handoff_and_consumes_pending(self):
        self.pending(40000)
        self.assertEqual(w.sync(self.path, 'after'), 'handoff')
        self.assertEqual([field for field, _ in self.calls], ['commentUpdate'])
        self.assertFalse(self.request.exists())
        self.assertEqual(self.archives(), [])
        self.assertEqual(self.data['labels']['nodes'][0]['id'], 'pilot')

    def test_archive_write_failure_never_parks_or_loses_pending(self):
        raw = self.pending()
        with patch.object(w.os, 'replace', side_effect=OSError('fixture disk failure')):
            with self.assertRaises(OSError):
                w.sync(self.path, 'after')
        self.assertEqual(self.request.read_bytes(), raw)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.archives(), [])
        self.assertEqual(list((self.state / 'rejected-workpads').glob('*.tmp')), [])

    def test_interrupt_after_archive_rename_reuses_exact_original_on_retry(self):
        raw = self.pending()
        original = w.os.fsync
        import stat
        def interrupted(fd):
            if stat.S_ISDIR(w.os.fstat(fd).st_mode):
                raise KeyboardInterrupt()
            original(fd)
        with patch.object(w.os, 'fsync', side_effect=interrupted):
            with self.assertRaises(KeyboardInterrupt):
                w.sync(self.path, 'after')
        self.assertEqual(self.calls, [])
        self.assert_preserved(raw)
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assert_preserved(raw)

    def test_label_failure_keeps_input_and_archive_without_false_park_or_comment(self):
        raw = self.pending()
        self.fail = 'issueRemoveLabel'
        with self.assertRaises(p.PublicationError):
            w.sync(self.path, 'after')
        self.assert_preserved(raw)
        self.assertEqual([field for field, _ in self.calls], ['issueRemoveLabel'])
        self.assertTrue(self.data['labels']['nodes'])

    def test_comment_failure_still_parks_and_can_repair_receipt_later(self):
        raw = self.pending()
        self.fail = 'commentUpdate'
        with self.assertRaises(p.PublicationError):
            w.sync(self.path, 'after')
        self.assert_preserved(raw)
        self.assertEqual(self.data['labels']['nodes'], [])
        self.fail = None
        self.assertEqual(w.sync(self.path, 'after'), 'blocked')
        self.assert_preserved(raw)
        self.assertEqual(sum(field == 'issueRemoveLabel' for field, _ in self.calls), 1)

    def test_changed_handoff_before_parking_is_preserved_and_not_parked(self):
        raw = self.pending()
        original = w._archive_rejected_update
        replacement = b'{"status":"handoff","notes":"new bounded evidence"}\n'
        def archive(*args):
            result = original(*args)
            self.request.write_bytes(replacement)
            return result
        with patch.object(w, '_archive_rejected_update', side_effect=archive):
            with self.assertRaisesRegex(p.PublicationError, 'changed during rejection'):
                w.sync(self.path, 'after')
        self.assertEqual(self.request.read_bytes(), replacement)
        self.assertEqual(self.archives()[0].read_bytes(), raw)
        self.assertEqual(self.calls, [])

    def test_corrupt_existing_archive_fails_closed_without_overwriting(self):
        raw = self.pending()
        w._archive_rejected_update(self.data['id'], raw)
        archive = self.archives()[0]
        archive.write_bytes(b'preserve corrupt state for reconciliation')
        with self.assertRaisesRegex(p.PublicationError, 'archive mismatch'):
            w.sync(self.path, 'after')
        self.assertEqual(archive.read_bytes(), b'preserve corrupt state for reconciliation')
        self.assertEqual(self.request.read_bytes(), raw)
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()
