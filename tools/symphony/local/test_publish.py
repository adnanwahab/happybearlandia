"""Offline publication integration tests: real Git, fake GitHub/Linear only."""
import json
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import time
import sys
from unittest.mock import patch
import publish as p


class PublisherTest(unittest.TestCase):
    def test_actual_cli_preserves_safe_cross_module_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory).resolve()
            workspace = home / 'code/symphony-source-only/SHE-123'
            (workspace / '.git').mkdir(parents=True)
            (workspace / '.hbl-handoff').mkdir()
            (workspace / '.hbl-handoff/publish.json').write_text('{"version":2}')
            status = home / '.local/state/hbl-publisher/workpad-status'
            status.mkdir(parents=True)
            (status / 'SHE-123.json').write_text('{"status":"handoff"}')
            result = subprocess.run([sys.executable, str(Path(p.__file__).resolve())],
                                    cwd=workspace, env=dict(os.environ, HOME=str(home),
                                                           PYTHONDONTWRITEBYTECODE='1'),
                                    capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(json.loads(result.stdout), {
                'status': 'error', 'action': 'Invalid source-only handoff identity or body'})

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.path = self.root / 'SHE-123'
        self.path.mkdir()
        self.env = dict(os.environ, GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1',
                        GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='test@example.invalid',
                        GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='test@example.invalid')
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=self.path, env=self.env, stderr=subprocess.DEVNULL).decode().strip()
        self.git = git
        git('init', '-b', p.BASE)
        (self.path / 'file').write_text('base')
        git('add', '.')
        git('commit', '-m', 'base')
        self.base = git('rev-parse', 'HEAD')
        state = self.root / 'host-state'
        (state / 'assignments').mkdir(parents=True, mode=0o700)
        state_patch = patch.object(p, 'STATE', state)
        state_patch.start()
        self.addCleanup(state_patch.stop)
        policy = state / 'assignments/SHE-123.json'
        policy.write_text(json.dumps(dict(version=1, issue='SHE-123', repository=p.REPO,
                                         base=p.BASE, baseCommit=self.base, files=['file'],
                                         reviewedBy='fixture', publishEnabled=True, expiresAt=time.time() + 3600)))
        policy.chmod(0o600)
        git('switch', '-c', 'symphony/SHE-123')
        git('remote', 'add', 'origin', 'https://github.com/' + p.REPO + '.git')
        (self.path / 'file').write_text('issue')
        git('commit', '-am', 'issue')
        self.sha = git('rev-parse', 'HEAD')
        self.request = dict(issue='SHE-123', repository=p.REPO, branch='symphony/SHE-123',
                            base=p.BASE, commit=self.sha, body='Evidence: fixture passed')
        self.write_request()
        self.items = []
        self.creates = self.pushes = 0
        self.timeout_create = False
        self.fail_push = False
        self.original = p.command

    def write_request(self):
        (self.path / '.git/hbl-publish.json').write_text(json.dumps(self.request))

    def command(self, args, cwd, env=None):
        if args[0] == '/trusted/gh':
            if args[1:3] == ['pr', 'list']:
                return json.dumps(self.items)
            if args[1] == 'api':
                return json.dumps({'object': {'sha': self.base}})
            if args[1:3] == ['pr', 'create']:
                self.creates += 1
                self.items = [dict(url='https://github.com/'+p.REPO+'/pull/1', state='OPEN',
                                   isDraft=True, baseRefName=p.BASE, headRefOid=self.sha, isCrossRepository=False)]
                if self.timeout_create:
                    raise p.PublicationError('create timed out')
                return self.items[0]['url']
            self.fail('Unexpected gh command')
        if 'push' in args:
            self.pushes += 1
            self.assertEqual(args[-1], self.sha + ':refs/heads/symphony/SHE-123')
            if self.fail_push:
                raise p.PublicationError('push failed')
            return ''
        if 'fetch' in args:
            # Base already available through validated local objects.
            (Path(cwd) / 'FETCH_HEAD').write_text(self.base + '\n')
            return ''
        return self.original(args, cwd, env)

    def publish(self):
        with patch.object(p, 'command', self.command), patch.object(p.shutil, 'which', return_value='/trusted/gh'), patch.object(p, 'workpad', return_value={}), patch.object(p, 'link') as link:
            result = p.publish(self.path, self.root)
            link.assert_called_once_with('SHE-123', self.items[0]['url'], self.sha)
            return result

    def test_publish_retry_no_duplicate(self):
        self.assertEqual(self.publish()['status'], 'published')
        self.publish()
        self.assertEqual(self.creates, 1)

    def test_ambiguous_create_reconciles(self):
        self.timeout_create = True
        self.publish()
        self.publish()
        self.assertEqual(self.creates, 1)

    def test_push_failure_retry(self):
        self.fail_push = True
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.assertEqual(self.creates, 0)
        self.fail_push = False
        self.publish()
        self.assertEqual(self.creates, 1)

    def test_link_failure_retry_reuses_pr(self):
        with patch.object(p, 'command', self.command), patch.object(p.shutil, 'which', return_value='/trusted/gh'), patch.object(p, 'workpad', return_value={}), patch.object(p, 'link', side_effect=p.PublicationError('Linear unavailable')):
            with self.assertRaises(p.PublicationError):
                p.publish(self.path, self.root)
        self.publish()
        self.assertEqual(self.creates, 1)

    def test_invalid_contract(self):
        for key, value in [('branch', 'main'), ('branch', p.BASE), ('base', 'main'), ('repository', 'other/repo'), ('issue', 'SHE-456'), ('commit', 'HEAD')]:
            with self.subTest(key=key, value=value):
                original = self.request[key]
                self.request[key] = value
                self.write_request()
                with self.assertRaises(p.PublicationError):
                    self.publish()
                self.request[key] = original
        self.assertEqual(self.pushes, 0)

    def test_dirty_index_and_worktree(self):
        (self.path / 'file').write_text('dirty')
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.git('add', '.')
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.assertEqual(self.pushes, 0)

    def test_workpad_link_preserves_content_and_parks_only_pilot(self):
        pad = dict(id='pad-id', body='## Codex Workpad\nExisting evidence\n\n### Host GitHub publication\nold PR\n\n### Host Symphony status\nlatest validation',
                   issue_id='issue-id', pilot_label_id='pilot-label')
        with patch.object(p, 'workpad', return_value=pad), patch.object(p, 'linear', side_effect=[
            {'commentUpdate': {'success': True}}, {'issueRemoveLabel': {'success': True}}
        ]) as api:
            p.link('SHE-123', 'https://github.com/example/pr/1', self.sha)
            self.assertIn('Existing evidence', api.call_args_list[0].args[1]['body'])
            self.assertIn('latest validation', api.call_args_list[0].args[1]['body'])
            self.assertEqual(api.call_args_list[1].args[1], {'id': 'issue-id', 'label': 'pilot-label'})

    def test_wrong_checked_out_branch_and_origin(self):
        self.git('switch', p.BASE)
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.git('switch', 'symphony/SHE-123')
        self.git('remote', 'set-url', 'origin', 'https://github.com/other/repo.git')
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.assertEqual(self.pushes, 0)

    def test_untrusted_workspace_config_not_executed(self):
        marker = self.root / 'unsafe-hook'
        self.git('config', 'core.fsmonitor', 'touch ' + str(marker))
        self.git('config', 'credential.helper', '!touch ' + str(marker))
        self.publish()
        self.assertFalse(marker.exists())

    def test_host_credential_guard(self):
        spec = importlib.util.spec_from_file_location('host_auth', Path(__file__).with_name('check-host-auth.py'))
        guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guard)
        config = self.root / '.config/gh'
        config.mkdir(parents=True)
        hosts = config / 'hosts.yml'
        with patch.object(guard.Path, 'home', return_value=self.root), patch.dict(os.environ, {'GH_CONFIG_DIR': str(config)}):
            hosts.write_text('github.com:\n  user: fixture\n')
            self.assertEqual(guard.check(), 0)
            hosts.write_text('github.com:\n  oauth_token: synthetic-test-only\n')
            self.assertEqual(guard.check(), 1)

    def test_workflow_host_handoff(self):
        workflow = Path(__file__).parent.parent / 'elixir/WORKFLOW.md'
        text = workflow.read_text()
        self.assertRegex(text, r'required_labels: \["hbl-agent-ready", "hbl-coordinator-approved", "symphony-pilot"(?:, "symphony-pressure-release")?\]')
        self.assertRegex(text, r'max_turns: (?:1|20)\b')
        self.assertIn('after_run: |', text)
        self.assertIn('/local/publish.py', text)
        self.assertIn('thread_sandbox: workspace-write', text)
        self.assertIn('shell_environment_policy.inherit=none', text)

    def test_paths(self):
        self.assertEqual(p.validate(self.path, self.root), 'SHE-123')
        for path in [self.root, self.root / '../SHE-123', self.root / 'main']:
            with self.assertRaises(p.PublicationError):
                p.validate(path, self.root)
        alias = self.root / 'SHE-456'
        alias.symlink_to(self.path)
        with self.assertRaises(p.PublicationError):
            p.validate(alias, self.root)

    def test_existing_closed_pr_blocks_push(self):
        self.items = [dict(state='CLOSED', isDraft=True, baseRefName=p.BASE)]
        with self.assertRaises(p.PublicationError):
            self.publish()
        self.assertEqual(self.pushes, 0)

    def test_legacy_host_publication_hold_is_enforced(self):
        policy = p.STATE / 'assignments/SHE-123.json'
        value = json.loads(policy.read_text())
        value['publishEnabled'] = False
        policy.write_text(json.dumps(value))
        with self.assertRaisesRegex(p.PublicationError, 'held'):
            self.publish()
        self.assertEqual(self.pushes, 0)
        self.assertTrue((self.path / '.git/hbl-publish.json').exists())


if __name__ == '__main__':
    unittest.main()
