import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from ops.improvement.inbox import database, ingest
from ops.improvement.proposal import InvalidProposal
from ops.improvement.test_intake import FIXTURE, batch, report


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'state'

    def run_cli(self, input_path=FIXTURE, *options):
        return subprocess.run([sys.executable, '-m', 'ops.improvement', '--input', str(input_path),
                               '--state-dir', str(self.state), *options], capture_output=True, text=True, timeout=20,
                              env={**os.environ, 'GH_TOKEN': 'fixture-do-not-log', 'LINEAR_API_KEY': 'fixture-do-not-log'})

    def test_real_cli_default_dry_run_and_local_record_replay(self):
        first = self.run_cli()
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertTrue(json.loads(first.stdout)['dryRun'])
        self.assertFalse(self.state.exists())
        written = self.run_cli(FIXTURE, '--record')
        replay = self.run_cli(FIXTURE, '--record')
        self.assertEqual(written.returncode, 0, written.stderr)
        self.assertEqual(json.loads(written.stdout)['recordedProposals'], 1)
        self.assertEqual(json.loads(replay.stdout)['newProposals'], 0)
        self.assertNotIn('fixture-do-not-log', written.stdout + written.stderr)

    def test_duplicate_keys_nonfinite_deep_and_oversized_json_are_rejected(self):
        path = self.root / 'input.json'
        for data in ('{"schemaVersion":1,"schemaVersion":2}', '{"x":NaN}', '[' * 2000 + '0' + ']' * 2000,
                     ' ' * (1024 * 1024 + 1)):
            path.write_text(data)
            result = self.run_cli(path)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stdout)['status'], 'HELD')
            self.assertFalse(self.state.exists())

    def test_no_apply_or_dispatch_command_exists(self):
        result = self.run_cli(FIXTURE, '--apply')
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.state.exists())

    def test_busy_lock_has_bounded_retries_and_preserves_state(self):
        with database(self.state, True):
            result = self.run_cli(FIXTURE, '--record')
        self.assertEqual(result.returncode, 2)
        self.assertIn('bounded retries exhausted', json.loads(result.stdout)['error'])

    def test_invalid_late_proposal_rejects_whole_batch_before_creation(self):
        value = batch()
        value['proposals'] += [{**value['proposals'][0], 'labels': ['symphony-pilot']}]
        with self.assertRaises(InvalidProposal):
            ingest(value, self.state, record=True)
        self.assertFalse(self.state.exists())

    def test_source_argument_is_data_even_when_it_looks_like_a_command(self):
        value = batch()
        value['proposals'][0]['testCommands'] = [['sh', '-c', 'exit 99']]
        result = ingest(value, self.state, coordinator_report=report())
        self.assertEqual(result['operation']['modelCalls'], 0)
        self.assertEqual(result['operation']['networkRequests'], 0)


if __name__ == '__main__':
    unittest.main()
