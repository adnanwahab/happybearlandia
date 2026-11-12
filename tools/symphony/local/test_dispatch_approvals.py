"""Fail-closed approval regressions; no remote services or workers."""
import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import backlog_coordinator as c
import publish as p
import workpad as w
from dispatch_policy import REQUIRED_APPROVALS
import test_backlog_coordinator as fixtures


class CoordinatorApprovals(unittest.TestCase):
    setUp = fixtures.CoordinatorTest.setUp
    # Reuse the coordinator fixture without rerunning its inherited tests.
    def test_each_missing_label_holds_even_with_trusted_review(self):
        for label in REQUIRED_APPROVALS:
            with self.subTest(label=label):
                snapshot = copy.deepcopy(self.services.snapshot)
                snapshot['issues'][0]['labels'].pop(label)
                rows = c.classify(snapshot, self.config, {'leases': {}})
                row = next(row for row in rows if row['id'] == 'id-1')
                self.assertIn('missing required dispatch approval: ' + label, row['reasons'])


    def test_revocation_during_scan_retains_pending_lease_without_approval(self):
        for label in REQUIRED_APPROVALS:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                services = fixtures.FakeServices([fixtures.issue(1)])
                def revoke(service):
                    if service.reads == 2:
                        service.snapshot['issues'][0]['labels'].pop(label)
                services.change = revoke
                state_dir = Path(directory) / 'state'
                with c.locked(state_dir):
                    with self.assertRaisesRegex(c.host.PublicationError, 'pending lease retained'):
                        c.cycle(services, self.config, state_dir, True)
                self.assertEqual(services.calls, [])
                self.assertEqual(c.load_state(state_dir)['leases']['id-1']['status'], 'pending')


class HostApprovals(unittest.TestCase):
    def data(self, absent):
        return dict(id='uuid', identifier='SHE-182', state={'name': 'In Progress'},
                    labels={'nodes': [{'id': x, 'name': x} for x in
                            ['symphony-pilot', *sorted(REQUIRED_APPROVALS)] if x != absent],
                            'pageInfo': {'hasNextPage': False}},
                    comments={'nodes': [{'id': 'pad', 'body': '## Codex Workpad'}],
                              'pageInfo': {'hasNextPage': False}})

    def test_revoked_approval_blocks_publisher(self):
        for label in REQUIRED_APPROVALS:
            with self.subTest(label=label), patch.object(p, 'linear', return_value={'issue': self.data(label)}):
                with self.assertRaisesRegex(p.PublicationError, 'required dispatch approvals'):
                    p.workpad('SHE-182')

    def test_both_approvals_allow_publication_preflight(self):
        with patch.object(p, 'linear', return_value={'issue': self.data(None)}):
            self.assertEqual(p.workpad('SHE-182')['issue_id'], 'uuid')

    def test_revoked_approval_blocks_before_workpad_or_status_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            for label in REQUIRED_APPROVALS:
                with self.subTest(label=label), patch.object(p, 'validate', return_value='SHE-182'), \
                     patch.object(w, 'issue_data', return_value=self.data(label)), \
                     patch.object(w, 'ensure') as ensure, patch.object(w, 'success') as mutate:
                    with self.assertRaisesRegex(p.PublicationError, 'required dispatch approvals'):
                        w.sync(Path(directory), 'before')
                    ensure.assert_not_called()
                    mutate.assert_not_called()
