import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from ops.research_pipeline import assess, digest, InvalidResearch, validate_brief


def example():
    brief = dict(schemaVersion='research-brief.v1', issue='SHE-207',
                 question='Does the synthetic adapter preserve units?', hypothesis='Units are preserved',
                 dataSources=[dict(reference='fixture:units', revision='v1', kind='synthetic', limitations='No empirical calibration')],
                 intendedUse='experiments', acceptanceCriteria=['Exact unit round trip'],
                 verification='Round-trip tests', validation='Compare with held-out fixture',
                 uncertainty='Report fixture coverage and missing observations')
    model = dict(id='example-only', version='1.0.0', codeRevision='a' * 40, author='author',
                 briefDigest=validate_brief(brief), reproduction=dict(environment='Python 3',
                 command=['python3', '-m', 'unittest'], seeds=[42], inputs=['fixture:units@v1'],
                 rulesVersion='v1', evidence='example only, no experiment executed'),
                 errorAnalysis='Example residual analysis', uncertainty='Uncalibrated', limitations=['Synthetic example'])
    subject = digest(dict(brief=brief, model=model))
    return dict(schemaVersion='research-release.v1', brief=brief, model=model,
                engineeringGate=dict(status='NOT_EVALUATED', reviewer='engineer', subjectDigest=subject, evidence=['Example only']),
                researchGate=dict(status='NOT_EVALUATED', reviewer='scientist', subjectDigest=subject, evidence=['Example only']))


class PipelineTests(unittest.TestCase):
    def test_both_gates_required(self):
        for engineering in ('PASS', 'FAIL', 'NOT_EVALUATED'):
            for research in ('PASS', 'FAIL', 'NOT_EVALUATED'):
                bundle = example()
                bundle['engineeringGate']['status'] = engineering
                bundle['researchGate']['status'] = research
                self.assertEqual(assess(bundle)['status'], 'ACCEPTED' if engineering == research == 'PASS' else 'HELD')
                self.assertFalse(assess(bundle)['dispatchAuthorized'])

    def test_stale_or_self_review_held(self):
        for mutation in ('revision', 'reviewer', 'author'):
            bundle = example()
            for gate in ('engineeringGate', 'researchGate'):
                bundle[gate]['status'] = 'PASS'
            if mutation == 'revision':
                bundle['model']['codeRevision'] = 'b' * 40
            else:
                bundle['researchGate']['reviewer'] = ' AUTHOR ' if mutation == 'author' else ' Engineer '
            self.assertEqual(assess(bundle)['status'], 'HELD')

    def test_invalid_contracts(self):
        for key, value in [('intendedUse', 'production'), ('verification', ''), ('dataSources', []), ('unexpected', True)]:
            brief = copy.deepcopy(example()['brief'])
            brief[key] = value
            with self.assertRaises(InvalidResearch):
                validate_brief(brief)
        bundle = example()
        bundle['model']['reproduction']['seeds'] = [True]
        with self.assertRaises(InvalidResearch):
            assess(bundle)

    def test_brief_revision_and_stable_hash(self):
        bundle = example()
        self.assertEqual(validate_brief(bundle['brief']), digest(dict(reversed(list(bundle['brief'].items())))))
        bundle['brief']['hypothesis'] = 'Changed claim'
        with self.assertRaises(InvalidResearch):
            assess(bundle)

    def test_cli_no_execution_and_duplicate_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'input.json'
            path.write_text(json.dumps(example()))
            result = subprocess.run([sys.executable, '-m', 'ops.research_pipeline', '--input', str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stdout)['status'], 'HELD')
            self.assertEqual(list(Path(directory).iterdir()), [path])
            path.write_text('{"schemaVersion":1,"schemaVersion":2}')
            result = subprocess.run([sys.executable, '-m', 'ops.research_pipeline', '--input', str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
