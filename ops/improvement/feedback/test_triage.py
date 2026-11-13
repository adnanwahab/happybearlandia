import copy
import json
from pathlib import Path
import unittest

from ops.improvement.feedback import InvalidAggregate, triage
from ops.improvement.proposal import validate_proposal


class TriageTests(unittest.TestCase):
    def setUp(self):
        self.batch = json.loads((Path(__file__).parent / 'fixtures/consented.json').read_text())
        self.sent = []

    def run_batch(self, batch=None, now=150):
        return triage(self.batch if batch is None else batch, now=now, sink=self.sent.append)

    def reject(self, batch):
        with self.assertRaises(InvalidAggregate):
            self.run_batch(batch)
        self.assertEqual(self.sent, [])

    def test_contract_and_missing_context(self):
        report = self.run_batch()
        self.assertEqual(report['proposals'], 1)
        proposal = validate_proposal(self.sent[0])
        self.assertIn('3 observations; 2 fixture-deduplicated votes', proposal['hypothesis'])
        self.assertIn('seed=unavailable', proposal['hypothesis'])
        self.assertIsNone(proposal['sources'][0]['url'])
        self.assertEqual(report['retention'][0]['deleteAt'], 200)

    def test_consent_fail_closed(self):
        for consent in (None, {}, False, {'granted': False, 'scope': 'aggregate-triage', 'version': 1},
                        {'granted': 1, 'scope': 'aggregate-triage', 'version': 1},
                        {'granted': True, 'scope': 'collection', 'version': 1}):
            with self.subTest(consent=consent):
                batch = copy.deepcopy(self.batch)
                batch['aggregates'][0]['consent'] = consent
                self.reject(batch)
        del self.batch['aggregates'][0]['consent']
        self.reject(self.batch)

    def test_sensitive_and_oversized_fields(self):
        for field in ('email', 'playerId', 'url', 'authorization', 'text'):
            batch = copy.deepcopy(self.batch)
            batch['aggregates'][0][field] = 'synthetic-rejected-value'
            self.reject(batch)
        for field in ('surface', 'symptom'):
            for value in ('https://example.invalid/private', 'fixture@example.invalid', 'x' * 100000):
                batch = copy.deepcopy(self.batch)
                batch['aggregates'][0][field] = value
                self.reject(batch)

    def test_unsupported_reproduction(self):
        for field, value in (('scenario', 'https://example.invalid'), ('seed', True),
                             ('modelVersion', 'unsupported'), ('playerId', 'fixture')):
            batch = copy.deepcopy(self.batch)
            batch['aggregates'][0]['reproduction'][field] = value
            self.reject(batch)

    def test_duplicate_retry_votes_and_order(self):
        other = copy.deepcopy(self.batch['aggregates'][0])
        other.update(ordinal=2, observations=4, voteOrdinals=[2, 3, 3])
        self.batch['aggregates'] += [other, copy.deepcopy(other)]
        self.run_batch()
        first = self.sent.pop()
        self.assertIn('7 observations; 3 fixture-deduplicated votes', first['hypothesis'])
        self.batch['aggregates'].reverse()
        self.run_batch()
        self.assertEqual(first, self.sent[0])
        self.sent.clear()
        self.batch['aggregates'][0]['observations'] = 5
        self.reject(self.batch)

    def test_retention_deletion_boundaries(self):
        for now, count in ((199, 1), (200, 0), (201, 0)):
            self.sent.clear()
            self.assertEqual(self.run_batch(now=now)['proposals'], count)
        self.batch['aggregates'][0]['deletedAt'] = 150
        self.assertEqual(self.run_batch()['proposals'], 0)
        for field, value in (('deleteAt', 100), ('deleteAt', 100 + 7 * 86400 + 1),
                             ('deletedAt', 151), ('createdAt', 151)):
            self.sent.clear()
            batch = copy.deepcopy(self.batch)
            batch['aggregates'][0][field] = value
            self.reject(batch)

    def test_full_validation_before_sink_and_failure(self):
        self.batch['aggregates'].append({})
        self.reject(self.batch)
        self.batch['aggregates'].pop()
        def fail(proposal):
            raise RuntimeError('sink unavailable')
        with self.assertRaises(RuntimeError):
            triage(self.batch, now=150, sink=fail)

    def test_bounds_and_distinct_clusters(self):
        for field, value in (('observations', True), ('observations', 0), ('voteOrdinals', [True]),
                             ('voteOrdinals', list(range(1001)))):
            batch = copy.deepcopy(self.batch)
            batch['aggregates'][0][field] = value
            self.reject(batch)
        other = copy.deepcopy(self.batch['aggregates'][0])
        other.update(ordinal=2, symptom='navigation-blocked')
        self.batch['aggregates'].append(other)
        self.assertEqual(self.run_batch()['proposals'], 2)
        for proposal in self.sent:
            validate_proposal(proposal)


if __name__ == '__main__':
    unittest.main()
