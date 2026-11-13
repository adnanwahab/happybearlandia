"""Disposable launchd supervision tests; never install/start a service."""
import json
import os
from pathlib import Path
import plistlib
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

import coordinator_host as host
import backlog_coordinator as c
import supervisor as s


class SupervisorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        process_patch = patch.object(s, 'existing_coordinator', return_value=False)
        process_patch.start(); self.addCleanup(process_patch.stop)
        self.state = self.root / 'host-state'; self.state.mkdir(mode=0o700)
        for obj, name, value in [(host, 'STATE', self.state), (c, 'STATE', self.state/'backlog-coordinator')]:
            patcher = patch.object(obj, name, value); patcher.start(); self.addCleanup(patcher.stop)
        self.directory = self.state/'supervisor'; self.directory.mkdir(mode=0o700)
        self.path = self.directory/'config.json'
        self.workflow = Path(__file__).parents[1]/'elixir/WORKFLOW.md'
        self.key = self.directory/'linear.key'; self.key.write_text('fixture-not-a-production-key'); self.key.chmod(0o600)
        self.config = {'version': 1, 'coordinatorApply': False, 'toolchainDirectories': [], 'code': str(self.state/'code'),
                       'workflow': str(self.state/'WORKFLOW.md'), 'evidence': str(c.STATE/'readiness.json'),
                       'linearKeyFile': str(self.key), 'symphonyExecutable': str(self.state/'symphony')}
        self.path.write_text(json.dumps(self.config)); self.path.chmod(0o600)

    def test_rendered_two_jobs_contain_no_credentials_and_use_existing_scheduler(self):
        output = s.render(self.path, self.root/'plists')
        paths = list(output.glob('*.plist')); self.assertEqual(len(paths), 2)
        for path in paths:
            value = plistlib.loads(path.read_bytes())
            self.assertEqual(value['KeepAlive'], {'SuccessfulExit': False}); self.assertEqual(value['ThrottleInterval'], 60)
            self.assertNotIn('EnvironmentVariables', value)
            self.assertNotIn('fixture-not-a-production-key', path.read_text())
        argv = s.command('coordinator', self.config)
        self.assertIn('--watch', argv); self.assertNotIn('--apply', argv)
        self.config['coordinatorApply'] = True
        self.assertIn('--apply', s.command('coordinator', self.config))

    def test_existing_runtime_is_held_without_spawning_or_stopping(self):
        with patch.object(s, 'port_in_use', return_value=True), patch.object(s.subprocess, 'Popen') as spawn:
            self.assertEqual(s.run('symphony', self.config), 0)
        spawn.assert_not_called()

    def test_restart_attempts_are_bounded_and_private_environment(self):
        child = Mock(); child.pid = 12345; child.poll.return_value = 1; child.returncode = 1
        stop = Mock(); stop.is_set.return_value = False; stop.wait.return_value = False
        with patch.object(s, 'validate_workflow'), patch.object(s.subprocess, 'Popen', return_value=child) as spawn:
            self.assertEqual(s.run('coordinator', self.config, stop), 0)
        self.assertEqual(spawn.call_count, 3)
        env = spawn.call_args.kwargs['env']
        self.assertEqual(env['LINEAR_API_KEY'], 'fixture-not-a-production-key')
        self.assertNotIn('GH_TOKEN', env)
        self.assertLessEqual(max(call.args[0] for call in stop.wait.call_args_list), 60)

    def test_restart_budget_survives_launchd_reinvocation(self):
        child = Mock(); child.pid = 12345; child.poll.return_value = 1; child.returncode = 1
        stop = Mock(); stop.is_set.return_value = False; stop.wait.return_value = False
        with patch.object(s, 'validate_workflow'), patch.object(s.subprocess, 'Popen', return_value=child) as spawn:
            self.assertEqual(s.run('coordinator', self.config, stop), 0)
            self.assertEqual(spawn.call_count, 3)
            self.assertEqual(s.run('coordinator', self.config, stop), 0)
            self.assertEqual(spawn.call_count, 3)
        budget = c.read_private(self.directory/'coordinator-restart.json')
        self.assertEqual(budget['attempts'], 3)

    def test_public_or_symlink_credential_is_rejected(self):
        self.key.chmod(0o644)
        with self.assertRaises(ValueError): s.environment(self.config)
        self.key.chmod(0o600)
        other = self.directory/'alias'; other.symlink_to(self.key)
        self.config['linearKeyFile'] = str(other)
        with self.assertRaises(ValueError): s.environment(self.config)

    def test_workflow_boundary_and_metadata_exception(self):
        s.validate_workflow(self.workflow)
        copy = self.root/'workflow'; copy.write_text(self.workflow.read_text().replace('    type: workspaceWrite', '    type: workspaceWrite\n    writableRoots: [/tmp]'))
        with self.assertRaises(ValueError): s.validate_workflow(copy)
        copy.write_text(self.workflow.read_text().replace(', "symphony-pressure-release"', ''))
        with self.assertRaises(ValueError): s.validate_workflow(copy)

    def test_config_permissions_and_worker_owned_paths_rejected(self):
        self.path.chmod(0o644)
        with self.assertRaises(host.PublicationError): s.configuration(self.path)
        self.path.chmod(0o600)
        self.config['code'] = str(Path.home()/'code/symphony-source-only/SHE-83')
        self.path.write_text(json.dumps(self.config))
        with self.assertRaises(ValueError): s.configuration(self.path)


if __name__ == '__main__': unittest.main()
