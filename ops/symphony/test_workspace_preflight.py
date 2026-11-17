import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('preflight', Path(__file__).with_name('workspace_preflight.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PreflightTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.git('init', '-b', p.BASE)
        (self.source / 'example').write_text('preserve me\n')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'base')
        self.before = self.git('rev-parse', 'HEAD')

    def git(self, *args):
        return p.command(['git', *args], self.source)

    def probe(self, **kwargs):
        with patch.object(p.shutil, 'which', return_value='/fixture/executable'):
            return p.probe(self.root, repository=str(self.source), sandbox=False,
                           install=False, host_auth=False, min_free_bytes=0, **kwargs)

    def test_disposable_clone_commit_and_source_preservation(self):
        report = self.probe()
        self.assertNotIn('blockedAt', report)
        self.assertTrue(report['disposableCloneRemoved'])
        self.assertFalse(report['ready'])  # Fixture never claims a real capability pass.
        self.assertNotEqual(report['probeCommit'], self.before)
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.before)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(sorted(x.name for x in self.root.iterdir()), ['source'])

    def test_disk_failure_occurs_before_network_or_clone(self):
        with patch.object(p.shutil, 'disk_usage') as disk:
            disk.return_value.free = 0
            result = p.probe(self.root, min_free_bytes=1)
        self.assertEqual(result['blockedAt'], 'disk')
        self.assertEqual(result['checks'], [])
        self.assertEqual(sorted(x.name for x in self.root.iterdir()), ['source'])

    def test_cache_copies_objects_and_uses_fetched_baseline(self):
        # Dirty cache data must never enter the probe checkout.
        (self.source / 'private-uncommitted').write_text('preserve')
        report = self.probe(object_cache=self.source)
        self.assertNotIn('blockedAt', report)
        self.assertTrue(report['objectCacheUsed'])
        self.assertEqual(report['baseSha'], self.before)
        self.assertEqual(self.git('status', '--porcelain'), '?? private-uncommitted')

    def test_shared_metadata_and_alternates_rejected(self):
        linked = self.root / 'linked'
        self.git('worktree', 'add', '-b', 'linked', str(linked))
        with self.assertRaisesRegex(p.Blocked, 'independent'):
            p.verify_isolation(linked)
        (self.source / '.git/objects/info/alternates').write_text('/outside/objects\n')
        with self.assertRaisesRegex(p.Blocked, 'external'):
            p.verify_isolation(self.source)

    def test_symlink_metadata_rejected(self):
        (self.source / '.git/unsafe').symlink_to('/tmp')
        with self.assertRaisesRegex(p.Blocked, 'symlink'):
            p.verify_isolation(self.source)

    def test_fetch_failure_is_sanitized_and_clone_removed(self):
        def fail_fetch(argv, cwd, **kwargs):
            if argv[1] == 'fetch':
                raise p.Blocked('command exited 128; remote output omitted')
            return p.command(argv, cwd, **kwargs)
        result = self.probe(run=fail_fetch)
        self.assertEqual(result['blockedAt'], 'host-baseline-fetch')
        self.assertTrue(result['disposableCloneRemoved'])
        self.assertNotIn('probeCommit', result)

    def test_external_errors_never_leak_tokens(self):
        with self.assertRaises(p.Blocked) as error:
            p.command([sys.executable, '-c', 'import sys; print("secret-token"); sys.exit(1)'], self.root)
        self.assertNotIn('secret-token', str(error.exception))

    def test_timeout_kills_own_descendants_before_cleanup(self):
        marker = self.root / 'late-write'
        child = 'import time,pathlib; time.sleep(.4); pathlib.Path('+repr(str(marker))+').write_text("late")'
        script = 'import subprocess,sys,time; subprocess.Popen([sys.executable,"-c",'+repr(child)+']); time.sleep(20)'
        with self.assertRaisesRegex(p.Blocked, 'timed out'):
            p.command([sys.executable, '-c', script], self.root, timeout=.1)
        import time
        time.sleep(.5)
        self.assertFalse(marker.exists())

    def test_worker_environment_removes_credentials_and_git_redirection(self):
        with patch.dict(os.environ, {'GH_TOKEN': 'sensitive', 'LINEAR_API_KEY': 'sensitive', 'GIT_DIR': '/outside', 'GIT_CONFIG_COUNT': '1'}):
            env = p.worker_environment()
        for key in ('GH_TOKEN', 'LINEAR_API_KEY', 'GIT_DIR', 'GIT_CONFIG_COUNT'):
            self.assertNotIn(key, env)
        self.assertEqual(env['GIT_CONFIG_GLOBAL'], '/dev/null')

    def test_push_permission_denial_stops_before_clone(self):
        def fake(argv, cwd, **kwargs):
            return 'false' if argv[:2] == ['gh', 'api'] else ''
        with patch.object(p.shutil, 'which', return_value='/fixture/executable'):
            result = p.probe(self.root, run=fake, min_free_bytes=0)
        self.assertEqual(result['blockedAt'], 'host-authentication')
        self.assertFalse(result['ready'])
        self.assertNotIn('isolated-clone', result['checks'])

    def test_plaintext_credential_guard_precedes_sandbox(self):
        home = self.root / 'home'
        (home / '.config/gh').mkdir(parents=True)
        secret = 'never-print-this'
        (home / '.config/gh/hosts.yml').write_text('github.com:\n  oauth_token: ' + secret)
        with patch.dict(os.environ, {'GH_CONFIG_DIR': str(home / '.config/gh')}):
            with self.assertRaises(p.Blocked) as error:
                p.credential_guard(home)
        self.assertNotIn(secret, str(error.exception))


if __name__ == '__main__':
    unittest.main()
