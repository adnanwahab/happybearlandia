import copy
import json
import unittest
from pathlib import Path

from ops.improvement.evaluation import evaluate, submit_rework
from ops.improvement.proposal import validate_proposal

FIXTURES = Path(__file__).parent / 'fixtures'


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.meta = {'headSha': 'a'*40, 'buildSha': 'a'*40,
                     'recordedAt': '2026-11-12T00:00:00Z', 'modelVersion': 'city-systems.1.0.0',
                     'recipeVersion': 'future-machine.v1', 'seeds': [42],
                     'environment': {'hardware': 'sanitized CPU', 'os': 'Linux', 'browser': 'Chromium', 'renderer': 'webgl', 'supported': True},
                     'conditions': {'warmupFrames': 30, 'people': 500, 'adaptiveQuality': False}}
        self.expected = copy.deepcopy(self.meta)
        self.now = '2026-11-12T00:10:00Z'

    def artifact(self, kind):
        content = (FIXTURES / ('bun.xml' if kind == 'bun' else kind + '.json')).read_text()
        return {'kind': kind, 'content': content if kind == 'bun' else json.loads(content),
                'provenance': copy.deepcopy(self.meta), 'url': 'https://github.com/adnanwahab/happybearlandia/actions/runs/123/artifacts/456'}

    def run_eval(self, artifact, **kwargs):
        return evaluate(artifact, expected=self.expected, now=self.now, max_age_seconds=3600, **kwargs)

    def statuses(self, result):
        return [c['status'] for c in result['checks']]

    def test_unit_formats(self):
        for kind in ('bun', 'playwright'):
            self.assertEqual(self.statuses(self.run_eval(self.artifact(kind))), ['PASS'])

    def test_failed_skipped_and_retry(self):
        a = self.artifact('bun')
        for tag, expected in [('failure', 'FAIL'), ('error', 'FAIL'), ('skipped', 'NOT_EVALUATED')]:
            b = copy.deepcopy(a)
            b['content'] = a['content'].replace('time="0.012" />', f'time="0.012"><{tag}/></testcase>')
            self.assertEqual(self.statuses(self.run_eval(b)), [expected])
        a = self.artifact('playwright')
        a['content']['suites'][0]['suites'][0]['specs'][0]['tests'][0]['results'].insert(0, {'status': 'failed'})
        self.assertEqual(self.statuses(self.run_eval(a)), ['FAIL'])

    def test_missing_stale_mismatched_and_unsupported(self):
        self.assertEqual(self.statuses(self.run_eval(None)), ['NOT_EVALUATED'])
        for key, value in [('headSha', 'b'*40), ('buildSha', 'b'*40), ('seeds', [43]), ('modelVersion', 'other'), ('recipeVersion', None), ('recordedAt', '2025-01-01T00:00:00Z'), ('recordedAt', '2027-01-01T00:00:00Z'), ('environment', {})]:
            a = self.artifact('bun')
            a['provenance'][key] = value
            self.assertEqual(self.statuses(self.run_eval(a)), ['NOT_EVALUATED'])

    def test_renderer_budget_and_unknown_metrics(self):
        a = self.artifact('renderer')
        base = copy.deepcopy(a)
        base['provenance']['buildSha'] = 'b'*40
        base['content']['p95FrameMs'] = 16
        budgets = {'p95FrameMs': {'maxRegressionFraction': .15, 'source': 'scripts/benchmark-renderer.js reviewed policy'}}
        self.assertEqual(self.statuses(self.run_eval(a, baseline=base, budgets=budgets)), ['PASS', 'NOT_EVALUATED', 'NOT_EVALUATED'])
        a['content']['p95FrameMs'] = 19
        self.assertEqual(self.run_eval(a, baseline=base, budgets=budgets)['checks'][0]['status'], 'FAIL')
        self.assertTrue(all(s == 'NOT_EVALUATED' for s in self.statuses(self.run_eval(a))))
        base['provenance']['environment']['hardware'] = 'other'
        self.assertEqual(self.run_eval(a, baseline=base, budgets=budgets)['checks'][0]['status'], 'NOT_EVALUATED')

    def test_baseline_pins_and_measurement_conditions(self):
        a = self.artifact('renderer')
        budgets = {'p95FrameMs': {'maxRegressionFraction': 0, 'source': 'review'}}
        mutations = [
            ('provenance', 'seeds', [7]),
            ('provenance', 'recordedAt', '2025-01-01T00:00:00Z'),
            ('provenance', 'conditions', {'warmupFrames': 0}),
            ('content', 'viewport', {'width': 320, 'height': 640}),
            ('content', 'settings', {'scale': .5}),
            ('content', 'frames', 0),
        ]
        for section, field, value in mutations:
            base = copy.deepcopy(a)
            base[section][field] = value
            self.assertEqual(self.run_eval(a, baseline=base, budgets=budgets)['checks'][0]['status'], 'NOT_EVALUATED')
        a['content']['gpuP95Ms'] = 10
        base = copy.deepcopy(a)
        self.assertEqual(self.run_eval(a, baseline=base, budgets={'gpuP95Ms': {'maxRegressionFraction': 0, 'source': 'review'}})['checks'][1]['status'], 'NOT_EVALUATED')

    def test_gpu_and_nonfinite(self):
        for value in (None, float('nan'), float('inf'), -1):
            a = self.artifact('renderer')
            a['content']['p95FrameMs'] = value
            self.assertEqual(self.run_eval(a, baseline=self.artifact('renderer'), budgets={'p95FrameMs': {'maxRegressionFraction': 1, 'source': 'review'}})['checks'][0]['status'], 'NOT_EVALUATED')
        a = self.artifact('renderer')
        a['provenance']['environment']['renderer'] = 'webgpu'
        self.assertEqual(set(self.statuses(self.run_eval(a))), {'NOT_EVALUATED'})

    def test_visual_pass(self):
        a = self.artifact('visual-pass')
        self.assertEqual(self.statuses(self.run_eval(a, baseline=copy.deepcopy(a), budgets={'totalMs': {'maxRegressionFraction': 0, 'source': 'explicit fixture policy'}})), ['PASS'])

    def test_malformed(self):
        for kind in ('bun', 'playwright', 'renderer', 'visual-pass'):
            a = self.artifact(kind)
            a['content'] = 'invalid'
            self.assertEqual(self.statuses(self.run_eval(a)), ['NOT_EVALUATED'])

    def test_repeat_sink_and_contract(self):
        a = self.artifact('renderer')
        a['command'] = ['sh', '-c', 'exit 99']
        stored = {}
        def sink(key, proposal):
            validate_proposal(proposal)
            stored.setdefault(key, proposal)
            return key
        result = self.run_eval(a)
        self.assertEqual(submit_rework(result, a, sink), submit_rework(result, a, sink))
        self.assertEqual(len(stored), 1)
        self.assertNotIn('exit 99', json.dumps(stored))
        def broken(*args):
            raise RuntimeError('sink unavailable')
        with self.assertRaises(RuntimeError):
            submit_rework(result, a, broken)
        self.assertIsNone(submit_rework(self.run_eval(self.artifact('bun')), self.artifact('bun'), sink))


if __name__ == '__main__':
    unittest.main()
