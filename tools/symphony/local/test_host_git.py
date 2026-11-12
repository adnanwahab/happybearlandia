"""Real Git, private host state, fake remote APIs: source-only publication."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

import host_git as h
import publish as p


class HostGitTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.path = self.root / 'SHE-123'
        self.path.mkdir()
        self.env = h.environment()
        self.git('init', '-b', p.BASE)
        (self.path / '.gitignore').write_text('ignored/\n')
        (self.path / '.gitattributes').write_text('source.js filter=attack diff=attack\n')
        (self.path / 'source.js').write_text('export const result = 1;\n')
        self.git('add', '.')
        self.git('commit', '-m', 'baseline')
        self.base = self.git('rev-parse', 'HEAD')
        self.git('switch', '-c', 'symphony/SHE-123')
        self.git('remote', 'add', 'origin', 'https://github.com/' + p.REPO + '.git')
        self.state = self.root / 'host-private'
        self.state.mkdir(mode=0o700)
        (self.state / 'assignments').mkdir(mode=0o700)
        self.policy = {'version': 1, 'issue': 'SHE-123', 'repository': p.REPO, 'base': p.BASE,
                       'baseCommit': self.base, 'files': ['source.js', 'new.test.js'],
                       'reviewedBy': 'fixture operator', 'expiresAt': time.time() + 3600}
        self.policy['publishEnabled'] = True
        self.policy_path = self.state / 'assignments/SHE-123.json'
        self.write_policy()
        self.patch_state = patch.object(p, 'STATE', self.state)
        self.patch_state.start()
        self.addCleanup(self.patch_state.stop)
        (self.path / 'source.js').write_text('export const result = 2;\n')
        self.original_head = (self.path / '.git/HEAD').read_bytes()
        self.original_index = (self.path / '.git/index').read_bytes()
        self.items = []
        self.pushed = self.created = 0
        self.fail_fetch = self.fail_commit = self.fail_push = self.fail_link = False
        self.fail_auth = self.ambiguous_create = False
        self.approved = True
        self.revoke_during_fetch = False
        self.original_command = p.command

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.path, env=self.env, stderr=subprocess.DEVNULL).decode().strip()

    def write_policy(self):
        self.policy_path.write_text(json.dumps(self.policy))
        self.policy_path.chmod(0o600)

    def request(self):
        repo = h.Repository(self.path, 'SHE-123')
        names = repo.changes()
        return dict(version=2, issue='SHE-123', repository=p.REPO, base=p.BASE,
                    branch='symphony/SHE-123', baseCommit=self.base, files=names,
                    fileHashes={n: hashlib.sha256((self.path / n).read_bytes()).hexdigest() if (self.path / n).exists() else None for n in names},
                    fileModes={n: repo.source(n)['mode'] if (self.path / n).exists() else None for n in names},
                    body='Real fixture edit and tests passed; no deployment.')

    def command(self, args, cwd, env=None):
        if args[0] == '/trusted/gh':
            if args[1:3] == ['auth', 'status']:
                if self.fail_auth:
                    raise p.PublicationError('missing GitHub authentication')
                return ''
            if args[1:3] == ['pr', 'list']:
                return json.dumps(self.items)
            if args[1] == 'api':
                if '/contents/' in args[2]:
                    name = args[2].split('/contents/')[1].split('?')[0]
                    repo = h.Repository(self.path, 'SHE-123')
                    return json.dumps({'sha': repo.git('rev-parse', self.sha + ':' + name)})
                return json.dumps({'object': {'sha': self.base}})
            if args[1:3] == ['pr', 'create']:
                self.created += 1
                self.pr_body = Path(args[args.index('--body-file') + 1]).read_text()
                self.items = [dict(url='https://github.com/' + p.REPO + '/pull/1', state='OPEN',
                                   isDraft=True, baseRefName=p.BASE, headRefOid=self.sha, isCrossRepository=False)]
                if self.ambiguous_create:
                    raise p.PublicationError('timeout after accepted create')
                return self.items[0]['url']
            if args[1:3] == ['pr', 'edit']:
                return ''
            self.fail('Unexpected authenticated command')
        if 'fetch' in args:
            if self.fail_fetch:
                raise p.PublicationError('fetch failed')
            (Path(env['GIT_DIR']) / 'FETCH_HEAD').write_text(self.base + '\n')
            if self.revoke_during_fetch:
                self.policy['publishEnabled'] = False
                self.write_policy()
            return ''
        if 'commit-tree' in args and self.fail_commit:
            raise p.PublicationError('commit failed')
        if 'push' in args:
            self.pushed += 1
            self.assertNotIn('--force', args)
            self.assertEqual(args[-1].split(':')[1], 'refs/heads/symphony/SHE-123')
            self.sha = args[-1].split(':')[0]
            if self.fail_push:
                raise p.PublicationError('push failed')
            for item in self.items:
                item['headRefOid'] = self.sha
            return ''
        return self.original_command(args, cwd, env)

    def publish(self, request=None):
        request = request or self.request()
        def workpad(issue, require_approval=True):
            if require_approval and not self.approved:
                raise p.PublicationError('Issue lacks symphony-pilot approval')
            return {}
        def link(*args):
            if self.fail_link:
                raise p.PublicationError('link failed')
            self.approved = False
        with patch.object(p, 'command', self.command), patch('shutil.which', return_value='/trusted/gh'), patch.object(p, 'workpad', side_effect=workpad), patch.object(p, 'link', side_effect=link):
            return h.publish_source(self.path, request, self.root)

    def test_real_host_commit_no_worker_metadata_write_and_idempotent_retry(self):
        result = self.publish()
        self.assertEqual(result['status'], 'published')
        self.assertEqual((self.path / '.git/HEAD').read_bytes(), self.original_head)
        self.assertEqual((self.path / '.git/index').read_bytes(), self.original_index)
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.base)
        self.assertIn('2', (self.path / 'source.js').read_text())
        again = self.publish()
        self.assertEqual(result['commit'], again['commit'])
        self.assertEqual(self.created, 1)
        self.assertEqual(self.pushed, 1)

    def test_review_revision_and_return_to_older_source_are_fast_forward(self):
        first = self.publish()['commit']
        self.approved = True
        (self.path / 'source.js').write_text('export const result = 3;\n')
        second = self.publish()['commit']
        repo = h.Repository(self.path, 'SHE-123')
        repo.git('merge-base', '--is-ancestor', first, second)
        self.approved = True
        (self.path / 'source.js').write_text('export const result = 2;\n')
        third = self.publish()['commit']
        repo.git('merge-base', '--is-ancestor', second, third)
        self.assertNotEqual(first, third)
        self.assertEqual(self.created, 1)

    def test_revoked_assignment_during_fetch_never_commits_or_pushes(self):
        self.revoke_during_fetch = True
        with self.assertRaisesRegex(p.PublicationError, 'revoked'):
            self.publish()
        self.assertEqual(self.pushed, 0)
        self.assertFalse(list((self.state / 'host-git/SHE-123').glob('*/commit.json')))

    def test_worker_path_cannot_select_host_git_or_gh(self):
        fake = self.path / 'bin'
        fake.mkdir()
        marker = self.root / 'unsafe-path'
        for name in ['git', 'gh']:
            f = fake / name
            f.write_text('#!/bin/sh\ntouch ' + str(marker) + '\nexit 99\n')
            f.chmod(0o755)
        with patch.dict(os.environ, {'PATH': str(fake)}):
            env = h.environment()
            self.assertNotIn(str(fake), env['PATH'])
            self.assertEqual(p.command(['git', '--version'], self.root, env).split()[0], 'git')
        self.assertFalse(marker.exists())

    def test_host_git_never_runs_repository_hooks_filters_or_fsmonitor(self):
        marker = self.root / 'hook-ran'
        hook = self.path / '.git/hooks/pre-commit'
        hook.write_text('#!/bin/sh\ntouch ' + str(marker))
        hook.chmod(0o755)
        self.git('config', 'core.fsmonitor', 'touch ' + str(marker))
        self.git('config', 'core.hooksPath', str(hook.parent))
        self.git('config', 'filter.attack.clean', 'touch ' + str(marker))
        self.git('config', 'credential.helper', '!touch ' + str(marker))
        self.publish()
        self.assertFalse(marker.exists())

    def test_unassigned_changes_rejected_and_ignored_useful_state_preserved(self):
        ignored = self.path / 'ignored'
        ignored.mkdir()
        (ignored / 'useful.json').write_text('retained private state')
        self.publish()
        self.assertEqual((ignored / 'useful.json').read_text(), 'retained private state')
        (self.path / 'unexpected.js').write_text('not assigned')
        with self.assertRaisesRegex(p.PublicationError, 'assignment'):
            self.publish()
        self.assertEqual(self.created, 1)

    def test_missing_or_workspace_writable_assignment_fails_closed(self):
        self.policy_path.chmod(0o644)
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.policy_path.unlink()
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.assertEqual(self.pushed, 0)

    def test_publication_gate_cannot_be_enabled_by_worker(self):
        self.policy['publishEnabled'] = False
        self.write_policy()
        request = self.request()
        request['publishEnabled'] = True
        with self.assertRaisesRegex(p.PublicationError, 'revoked|held'):
            self.publish(request)
        self.assertEqual(self.pushed, 0)

    def test_failed_fetch_auth_and_commit_preserve_source_and_snapshot(self):
        for failure in ['fail_fetch', 'fail_auth', 'fail_commit']:
            with self.subTest(failure=failure):
                setattr(self, failure, True)
                with self.assertRaises(p.PublicationError):
                    self.publish()
                setattr(self, failure, False)
                self.assertEqual((self.path / 'source.js').read_text(), 'export const result = 2;\n')
                self.assertEqual(self.created, 0)
        self.assertTrue(list((self.state / 'host-git/SHE-123').glob('*/snapshot.json')))
        self.publish()

    def test_partial_push_and_link_recovery_never_duplicate_pr(self):
        self.fail_push = True
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.fail_push, self.fail_link = False, True
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.fail_link = False
        self.publish()
        self.assertEqual(self.created, 1)

    def test_corrupt_preserved_snapshot_never_becomes_a_commit(self):
        self.fail_commit = True
        with self.assertRaises(p.PublicationError):
            self.publish()
        snapshot = next((self.state / 'host-git/SHE-123').glob('*/snapshot.json'))
        (snapshot.parent / '0').write_bytes(b'corrupt snapshot')
        self.fail_commit = False
        with self.assertRaisesRegex(p.PublicationError, 'snapshot bytes'):
            self.publish()
        self.assertEqual(self.pushed, 0)

    def test_ambiguous_create_and_outdated_test_hashes(self):
        self.ambiguous_create = True
        self.publish()
        self.publish()
        self.assertEqual(self.created, 1)
        request = self.request()
        (self.path / 'source.js').write_text('changed after test')
        with self.assertRaisesRegex(p.PublicationError, 'hashes'):
            self.publish(request)

    def test_secrets_symlinks_and_new_scope_cannot_be_self_authorized(self):
        request = self.request()
        (self.path / 'source.js').write_text('-----BEGIN PRIVATE KEY-----\nfixture only\n')
        with self.assertRaisesRegex(p.PublicationError, 'credential'):
            self.publish(request)
        (self.path / 'source.js').unlink()
        (self.path / 'source.js').symlink_to('/etc/hosts')
        with self.assertRaises((p.PublicationError, OSError)):
            self.publish(request)
        self.assertFalse(h.safe_name('../outside'))
        self.assertFalse(h.safe_name('.git/config'))
        self.assertFalse(h.safe_name('.env.production'))

    def test_symlink_parent_cannot_import_external_data(self):
        self.policy['files'].append('nested/result.js')
        self.write_policy()
        (self.path / 'nested').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises((p.PublicationError, OSError)):
            h.Repository(self.path, 'SHE-123').source('nested/result.js')

    def test_source_permission_probe_does_not_require_git_write(self):
        import source_preflight
        from io import StringIO
        from contextlib import redirect_stdout
        (self.path / '.hbl-handoff').mkdir()
        original = Path.write_text
        def write(target, *args, **kwargs):
            if target.name == 'hbl-permission-probe':
                raise PermissionError('fixture protected metadata')
            return original(target, *args, **kwargs)
        with patch.object(Path, 'write_text', write), redirect_stdout(StringIO()):
            self.assertEqual(source_preflight.probe(self.path), 0)

    def test_prepare_rejects_pending_handoff_without_losing_partial_work(self):
        import prepare
        (self.path / '.hbl-handoff').mkdir()
        request = self.path / '.hbl-handoff/publish.json'
        request.write_text('{}')
        with self.assertRaisesRegex(p.PublicationError, 'another model'):
            prepare.prepare(self.path, self.root)
        self.assertEqual(request.read_text(), '{}')
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.base)

    def test_prepare_never_overwrites_missing_artifact_terminal_handoff(self):
        import prepare
        status = self.state / 'workpad-status'
        status.mkdir()
        terminal = status / 'SHE-123.json'
        terminal.write_text(json.dumps({'status': 'handoff'}))
        with self.assertRaisesRegex(p.PublicationError, 'Terminal'):
            prepare.prepare(self.path, self.root)
        self.assertEqual(json.loads(terminal.read_text())['status'], 'handoff')

    def test_deletion_and_added_file_are_exactly_staged(self):
        (self.path / 'source.js').unlink()
        (self.path / 'new.test.js').write_text('assert true')
        result = self.publish()
        repo = h.Repository(self.path, 'SHE-123')
        names = repo.git('diff-tree', '--no-commit-id', '--name-only', '-r', result['commit']).splitlines()
        self.assertEqual(names, ['new.test.js', 'source.js'])

    def test_media_uses_verified_host_commit_url_after_upload(self):
        self.policy['files'].append('evidence.png')
        self.write_policy()
        (self.path / 'evidence.png').write_bytes(b'fixture image bytes')
        request = self.request()
        request['artifacts'] = ['evidence.png']
        result = self.publish(request)
        self.assertIn('/blob/' + result['commit'] + '/evidence.png?raw=true', self.pr_body)


if __name__ == '__main__':
    unittest.main()
