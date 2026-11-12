"""Integrated approval policy, durable lane fairness and unchanged lease gates."""
import tempfile
from pathlib import Path
import unittest

import backlog_coordinator as c
from test_backlog_coordinator import issue, review, pr, FakeServices


class IntegratedLanes(unittest.TestCase):
    def test_six_single_capacity_grants_advance_lanes_from_durable_lease_history(self):
        issues = [issue(n) for n in range(1, 15)]
        reviews = {i['id']: review(i) for i in issues}
        lanes = {}
        for i in issues:
            n = int(i['identifier'].split('-')[1])
            lane = 'fast' if n <= 9 else 'feature' if n <= 12 else 'research'
            lanes[i['id']] = lane
            reviews[i['id']]['scheduling'] = {'lane': lane, 'gameplayImpact': 2}
        config = {'version': 1, 'projectId': c.PROJECT, 'cap': 1, 'reviews': reviews,
                  'enableApprovals': True, 'overlapReconciledBy': 'fixture-coordinator'}
        services = FakeServices(issues)
        selected = []
        with tempfile.TemporaryDirectory() as directory:
            for n in range(6):
                result = c.cycle(services, config, Path(directory), True)
                self.assertEqual(len(result['selected']), 1)
                ident = result['selected'][0]
                task = next(x for x in services.snapshot['issues'] if x['identifier'] == ident)
                selected.append(lanes[task['id']])
                task['labels'].pop(c.APPROVAL_LABEL)
                services.snapshot['prs'].append(pr(n + 1, task))
            state = c.load_state(Path(directory))
            self.assertEqual(len(state['leases']), 6)
        self.assertEqual(selected, ['fast', 'fast', 'fast', 'feature', 'feature', 'research'])


if __name__ == '__main__': unittest.main()
