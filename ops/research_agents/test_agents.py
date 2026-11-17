import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from ops.improvement.proposal import InvalidProposal
from ops.research_agents import prepare, proposals, run_agent, submit, triage


def fixture():
    source = {'type': 'repository', 'id': 'world/evidence-registry.js',
              'revision': 'a' * 40, 'evidence': 'repository-inspection',
              'url': 'https://github.com/adnanwahab/happybearlandia/blob/' + 'a' * 40 + '/world/evidence-registry.js'}
    return {'schemaVersion': 'research-context.v1',
            'library': [{'id': 'registry', 'title': 'Synthetic test reference', 'source': source}],
            'rules': [{'id': 'rule-1', 'description': 'Synthetic rule',
                       'source': source, 'libraryIds': []}]}


def output(activity='experiment'):
    return {'schemaVersion': 'research-output.v1', 'drafts': [{
        'activity': activity, 'ruleId': 'rule-1', 'title': 'Investigate evidence',
        'claims': [{'text': 'Synthetic assumption', 'libraryIds': []}],
        'hypothesis': 'Matched seeds preserve baseline replay.', 'dataSources': ['registry'],
        'acceptanceCriteria': ['All 10 matched seeds replay identically.'],
        'testCommands': [['bun', 'test', 'test/evidence-registry.test.js']]}]}


class ResearchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state = Path(self.tmp.name) / 'state'

    def test_prompt_gaps_and_injected_agent(self):
        seen = []
        result = run_agent(fixture(), lambda prompt: seen.append(prompt) or output(), self.state)
        self.assertEqual(seen[0]['evidenceGaps'][0]['ruleId'], 'rule-1')
        self.assertTrue(result['dryRun'])
        self.assertFalse(self.state.exists())

    def test_all_activities_durable_drafts_replay(self):
        for activity in ('missing-evidence', 'compare-models', 'experiment', 'implementation-issue'):
            first = submit(fixture(), output(activity), self.state, record=True)
            self.assertEqual(first['recordedProposals'], 1)
            again = submit(fixture(), output(activity), self.state, record=True)
            self.assertEqual(again['newProposals'], 0)
        saved = triage(self.state)['drafts']
        self.assertEqual(len(saved), 4)
        for row in saved:
            self.assertFalse(row['executionApproved'])
            self.assertEqual(row['evidenceStatus'], 'NOT_EVALUATED')
            self.assertEqual(row['draft']['status'], 'draft')
            self.assertEqual(row['draft']['claims'][0]['status'], 'unsupported')
            self.assertTrue(row['draft']['contextRevision'])

    def test_citations_metadata_and_source_text(self):
        ctx = fixture()
        ctx['library'][0]['source'] = {'type': 'paper', 'id': 'doi:10.1234/test',
                                     'revision': 'b' * 64, 'url': 'https://doi.org/10.1234/test',
                                     'evidence': 'metadata-only'}
        raw = output()
        raw['drafts'][0]['claims'][0]['libraryIds'] = ['registry']
        claim = json.loads(proposals(ctx, raw)[0]['hypothesis'])['claims'][0]
        self.assertEqual(claim['status'], 'unsupported')
        self.assertEqual(claim['sources'][0]['libraryId'], 'registry')
        ctx['library'][0]['source']['evidence'] = 'source-text'
        ctx['rules'][0]['libraryIds'] = ['registry']
        self.assertEqual(prepare(ctx)['evidenceGaps'], [])
        claim = json.loads(proposals(ctx, raw)[0]['hypothesis'])['claims'][0]
        self.assertEqual(claim['status'], 'source-linked')

    def test_rejections_leave_no_state(self):
        cases = []
        for field, value in [('hypothesis', ''), ('acceptanceCriteria', []),
                             ('testCommands', []), ('dataSources', []),
                             ('ruleId', 'invented'), ('activity', 'dispatch'),
                             ('claims', []), ('title', 'x' * 161)]:
            raw = output()
            raw['drafts'][0][field] = value
            cases.append(raw)
        raw = output()
        raw['drafts'][0]['claims'][0]['libraryIds'] = ['invented']
        cases.append(raw)
        raw = output()
        raw['drafts'][0]['executionApproved'] = True
        cases.append(raw)
        raw = output()
        raw['drafts'][0]['claims'][0]['text'] = 'x' * 2000
        cases.append(raw)
        for raw in cases:
            with self.subTest(raw=raw), self.assertRaises(InvalidProposal):
                submit(fixture(), raw, self.state, record=True)
        self.assertFalse(self.state.exists())

    def test_empty_triage_is_read_only(self):
        self.assertEqual(triage(self.state)['drafts'], [])
        self.assertFalse(self.state.exists())

    def test_cli_prepare_record_and_triage_never_execute_argv(self):
        ctx_path = Path(self.tmp.name) / 'context.json'
        output_path = Path(self.tmp.name) / 'output.json'
        marker = Path(self.tmp.name) / 'executed'
        ctx_path.write_text(json.dumps(fixture()))
        raw = output()
        raw['drafts'][0]['testCommands'] = [['touch', str(marker)]]
        output_path.write_text(json.dumps(raw))
        base = [sys.executable, '-m', 'ops.research_agents', '--state-dir', str(self.state)]
        def cli(*args):
            result = subprocess.run(base + list(args), capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.loads(result.stdout)
        self.assertEqual(cli('--context', str(ctx_path))['role'], 'research')
        self.assertTrue(cli('--context', str(ctx_path), '--output', str(output_path))['dryRun'])
        self.assertFalse(self.state.exists())
        cli('--context', str(ctx_path), '--output', str(output_path), '--record')
        self.assertEqual(len(cli('--triage')['drafts']), 1)
        self.assertFalse(marker.exists())

    def test_changed_output_is_related_for_triage(self):
        submit(fixture(), output(), self.state, record=True)
        revised = output()
        revised['drafts'][0]['hypothesis'] = 'A revised synthetic hypothesis.'
        result = submit(fixture(), revised, self.state, record=True)
        self.assertEqual(result['newProposals'], 1)
        self.assertFalse(result['proposals'][0]['executionApproved'])
        self.assertEqual(len(triage(self.state)['drafts']), 2)


if __name__ == '__main__':
    unittest.main()
