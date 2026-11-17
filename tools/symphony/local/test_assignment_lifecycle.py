"""Disposable admission/renewal/crash fixtures; no live labels or workers."""
import copy
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import assignment_lifecycle as a
import backlog_coordinator as c
import coordinator_host as host
from test_backlog_coordinator import FakeServices, issue, review, pr


class LifecycleTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.directory = self.root / 'coordinator'
        self.issue = issue(83)
        self.services = FakeServices([self.issue])
        self.config = {'version': 1, 'projectId': c.PROJECT, 'cap': 1, 'enableApprovals': True,
                       'overlapReconciledBy': 'fixture operator', 'reviews': {self.issue['id']: review(self.issue)}}
        self.review = self.config['reviews'][self.issue['id']]
        self.path = self.root / 'assignments/SHE-83.json'

    def cycle(self, apply=True, maintain=False):
        with c.locked(self.directory):
            return c.cycle(self.services, self.config, self.directory, apply, maintain=maintain)

    def policy(self):
        return json.loads(self.path.read_text())

    def standing(self):
        self.review['standingAuthorization'] = {'authorizationId': 'fixture human exact grant',
            'reviewDigest': a.checksum(self.review), 'authorizedBy': self.review['reviewedBy'],
            'revoked': False, 'validUntil': time.time() + 20000, 'leaseSeconds': 3600}

    def test_shared_validator_rejects_oversize_policy_and_unsafe_identifier(self):
        self.review['reviewedBy'] = 'r' * 70000
        self.assertFalse(self.cycle()['selected'])
        self.assertFalse(self.path.exists())
        with self.assertRaises(a.host_git.p.PublicationError):
            a.host_git.assignment('../../outside-private-state')

    def test_more_than_host_limit_is_held_before_label(self):
        self.review['files'] = [f'owned/file-{n}.js' for n in range(101)]
        result = self.cycle()
        self.assertFalse(result['selected'])
        self.assertFalse(self.path.exists())
        self.assertEqual(self.services.calls, [])

    def test_label_lookup_expiry_or_policy_change_cannot_escape_final_check(self):
        for mutation in ['expiry', 'publish']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                self.directory = Path(temporary).resolve()/'coordinator'
                self.path = self.directory.parent/'assignments/SHE-83.json'
                self.issue['labels'].pop(c.APPROVAL_LABEL, None)
                now = time.time()
                clock = [now]
                def label(team):
                    if mutation == 'expiry': clock[0] = now + 3601
                    else:
                        value = self.policy(); value['publishEnabled'] = True; c.atomic(self.path, value)
                    return 'pilot'
                self.services.approval_label = label
                with patch('time.time', side_effect=lambda: clock[0]):
                    with self.assertRaises(host.PublicationError): self.cycle()
                self.assertNotIn(c.APPROVAL_LABEL, self.issue['labels'])
                self.assertEqual(self.services.calls, [])

    def test_public_projection_contains_only_closed_codes(self):
        result = self.cycle(False)
        result['assignmentMaintenance'] = [{'identifier': 'SHE-83', 'action': 'hold',
            'reasons': ['unknown ownership at /private/secret-context', 'ASSIGNMENT_MISSING: private detail']}]
        text = json.dumps(a.projection(result))
        self.assertNotIn('/private', text)
        self.assertNotIn('detail', text)
        self.assertIn('ASSIGNMENT_MISSING', text)
        self.assertEqual(result['queue']['approved'], 0)
        self.assertIsNone(result['queue']['awaiting_review'])

    def test_policy_exists_privately_before_remote_label(self):
        original = self.services.approve
        def approve(i):
            self.assertFalse(self.policy()['publishEnabled'])
            self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.path.parent.stat().st_mode & 0o777, 0o700)
            self.assertEqual(c.load_state(self.directory)['leases'][i['id']]['admission']['status'], 'assignment-created')
            original(i)
        self.services.approve = approve
        self.cycle()
        before = self.path.stat().st_mtime_ns
        self.cycle(); self.cycle()
        self.assertEqual(self.path.stat().st_mtime_ns, before)
        self.assertEqual(self.services.calls, [self.issue['id']])

    def test_assignment_creation_crash_recovery_before_and_after_replace(self):
        for after in [False, True]:
            with self.subTest(after=after), tempfile.TemporaryDirectory() as tmp:
                self.directory = Path(tmp).resolve() / 'coordinator'
                self.path = self.directory.parent / 'assignments/SHE-83.json'
                self.issue['labels'].pop(c.APPROVAL_LABEL, None)
                original = c.atomic
                def interrupted(path, value):
                    if path == self.path:
                        if after: original(path, value)
                        raise RuntimeError('fixture power loss')
                    original(path, value)
                with patch.object(c, 'atomic', side_effect=interrupted):
                    with self.assertRaises(RuntimeError): self.cycle()
                self.assertNotIn(c.APPROVAL_LABEL, self.issue['labels'])
                self.assertEqual(c.load_state(self.directory)['leases'][self.issue['id']]['status'], 'pending')
                self.cycle()
                self.assertTrue(self.path.exists())
                self.assertIn(c.APPROVAL_LABEL, self.issue['labels'])

    def test_ambiguous_label_success_recovers_without_second_add(self):
        self.services.failure = 'after'
        with self.assertRaises(host.PublicationError): self.cycle()
        stamp = self.path.stat().st_mtime_ns
        self.services.failure = None
        self.cycle()
        self.assertEqual(self.services.calls, [self.issue['id']])
        self.assertEqual(stamp, self.path.stat().st_mtime_ns)

    def test_already_labeled_missing_policy_uses_real_review(self):
        self.issue['labels'][c.APPROVAL_LABEL] = 'pilot'
        result = self.cycle(False)
        self.assertEqual(result['assignmentMaintenance'][0]['action'], 'ready')
        self.assertFalse(self.path.exists())
        self.cycle()
        self.assertTrue(self.path.exists())
        self.assertEqual(self.services.calls, [])

    def test_ready_text_or_label_cannot_replace_operator_review(self):
        self.issue['labels'][c.APPROVAL_LABEL] = 'pilot'
        self.config['reviews'] = {}
        result = self.cycle()
        self.assertIn('missing trusted operator', result['assignmentMaintenance'][0]['reasons'][0])
        self.assertFalse(self.path.exists())

    def test_explicit_standing_grant_renews_exact_unchanged_scope(self):
        self.standing(); self.cycle()
        first = self.policy()
        later = time.time() + 3500
        with patch('time.time', return_value=later): self.cycle()
        second = self.policy()
        self.assertGreater(second['expiresAt'], first['expiresAt'])
        self.assertEqual(second['files'], first['files'])
        self.assertFalse(second['publishEnabled'])
        self.assertEqual(len(self.services.calls), 1)

    def test_no_silent_renewal_or_publication_flag_overwrite(self):
        self.cycle(); first = self.path.read_bytes()
        with patch('time.time', return_value=self.review['expiresAt'] + 1):
            result = self.cycle()
        self.assertEqual(self.path.read_bytes(), first)
        self.assertTrue(result['assignmentMaintenance'][0]['reasons'])
        value = self.policy(); value['publishEnabled'] = True
        c.atomic(self.path, value); changed = self.path.read_bytes()
        self.cycle()
        self.assertEqual(self.path.read_bytes(), changed)

    def test_revoked_changed_and_expired_authorizations_hold(self):
        self.standing(); self.cycle(); first = self.path.read_bytes()
        for key, value in [('revoked', True), ('validUntil', time.time()-1), ('reviewDigest', 'bad')]:
            original = copy.deepcopy(self.review['standingAuthorization'])
            self.review['standingAuthorization'][key] = value
            result = self.cycle()
            self.assertTrue(result['assignmentMaintenance'][0]['reasons'])
            self.assertEqual(self.path.read_bytes(), first)
            self.review['standingAuthorization'] = original
        self.review['files'] = ['unexpected/file.js']
        self.assertTrue(self.cycle()['assignmentMaintenance'][0]['reasons'])
        self.assertEqual(self.path.read_bytes(), first)

    def test_changed_baseline_review_or_missing_reviewer_blocks(self):
        self.services.snapshot['baseSha'] = 'f'*40
        self.assertEqual(self.cycle()['selected'], [])
        self.services.snapshot['baseSha'] = 'a'*40
        self.review['reviewedBy'] = ''
        self.assertEqual(self.cycle()['selected'], [])
        self.assertFalse(self.path.exists())

    def test_runtime_worktree_and_retained_assignment_conflicts(self):
        inventory = self.services.admission_inventory()
        inventory['claims'] = [{'id': self.issue['id'], 'status': 'running'}]
        self.services.admission_inventory = lambda: inventory
        self.assertEqual(self.cycle()['selected'], [])
        inventory['claims'] = []
        inventory['worktrees'] = [{'path': '/unknown/active', 'head': 'a'*40}]
        self.assertEqual(self.cycle()['selected'], [])
        inventory['worktrees'] = []
        inventory['assignments'] = [{'name': 'SHE-142', 'policy': {'files': self.review['files']}}]
        self.assertEqual(self.cycle()['selected'], [])
        self.assertFalse(self.path.exists())

    def test_symlink_permission_and_newer_policy_preservation(self):
        self.directory.mkdir(mode=0o700)
        outside = self.root / 'retained'; outside.mkdir()
        self.path.parent.symlink_to(outside)
        with self.assertRaises(host.PublicationError): self.cycle()
        self.assertEqual(list(outside.iterdir()), [])
        self.path.parent.unlink(); self.cycle()
        value = self.policy(); value['reviewedBy'] = 'new independent operator'
        c.atomic(self.path, value); prior = self.path.read_bytes()
        self.cycle(); self.assertEqual(self.path.read_bytes(), prior)
        os.chmod(self.path, 0o644)
        self.assertTrue(self.cycle()['assignmentMaintenance'][0]['reasons'])

    def test_renewal_crash_before_and_after_assignment_replace(self):
        self.standing(); self.cycle()
        initial = self.path.read_bytes()
        original_state = (self.directory / 'leases.json').read_bytes()
        self.services.admission_inventory = lambda: {'at': time.time(), 'claims': [{'id': self.issue['id'], 'identifier': 'SHE-83', 'status': 'running'}], 'worktrees': [], 'assignments': [{'name': 'SHE-83', 'policy': self.policy()}], 'handoffs': []}
        later = time.time() + 3500
        original = c.atomic
        for after in [False, True]:
            with self.subTest(after=after):
                self.path.write_bytes(initial); self.path.chmod(0o600)
                (self.directory / 'leases.json').write_bytes(original_state)
                def interrupted(path, value):
                    if path == self.path:
                        if after: original(path, value)
                        raise RuntimeError('fixture renewal power loss')
                    original(path, value)
                with patch('time.time', return_value=later), patch.object(c, 'atomic', side_effect=interrupted):
                    with self.assertRaises(RuntimeError): self.cycle()
                with patch('time.time', return_value=later):
                    result = self.cycle(False, maintain=True)
                self.assertFalse(result['assignmentMaintenance'][0]['reasons'])
                self.assertGreater(self.policy()['expiresAt'], json.loads(initial)['expiresAt'])
                self.assertEqual(len(self.services.calls), 1)

    def test_revocation_during_fresh_scan_preserves_policy(self):
        self.standing(); self.cycle(); first = self.path.read_bytes()
        expected = copy.deepcopy(self.config)
        def verify():
            if self.config != expected:
                raise host.PublicationError('fixture operator revoked during scan')
        self.services.verify_assignment_maintenance = verify
        later = time.time()+3500
        def change(services):
            if services.reads >= 2:
                self.config['reviews'][self.issue['id']]['standingAuthorization']['revoked'] = True
        self.services.reads = 0
        self.services.change = change
        with patch('time.time', return_value=later): result = self.cycle()
        self.assertEqual(self.path.read_bytes(), first)
        self.assertTrue(result['assignmentMaintenance'][0]['reasons'])

    def test_unknown_other_runtime_and_dirty_worktree_hold(self):
        inventory = self.services.admission_inventory()
        inventory['claims'] = [{'id': 'unknown', 'identifier': 'SHE-999', 'status': 'running'}]
        self.services.admission_inventory = lambda: inventory
        self.assertEqual(self.cycle()['selected'], [])
        inventory['claims'] = []
        tree = self.root / 'another-chat'; tree.mkdir(); (tree/'tracked.js').write_text('retained')
        fingerprint = a.source_fingerprint(tree)
        inventory['worktrees'] = [{'path': str(tree), 'head': 'a'*40, 'sourceDigest': fingerprint}]
        self.config['worktreeReviews'] = {str(tree): {'head': 'a'*40, 'sourceDigest': fingerprint,
            'files': [], 'interfaces': [], 'reviewedBy': 'operator', 'expiresAt': time.time()+3600}}
        self.assertTrue(self.cycle(False)['selected'])
        (tree/'new-ownership.js').write_text('new local task')
        inventory['worktrees'][0]['sourceDigest'] = a.source_fingerprint(tree)
        self.assertEqual(self.cycle()['selected'], [])

    def test_stale_runtime_is_not_retimestamped_as_fresh(self):
        from datetime import datetime, timezone
        runtime = {'generated_at': datetime.fromtimestamp(time.time()-120, timezone.utc).isoformat()}
        with self.assertRaises(host.PublicationError): a.validate_runtime(runtime, time.time())

    def test_draft_without_verified_host_receipt_or_link_retains_lease(self):
        self.cycle(); self.issue['labels'].pop(c.APPROVAL_LABEL)
        self.services.snapshot['prs'] = [pr(83, self.issue)]
        inventory = self.services.admission_inventory(); inventory['handoffs'] = []
        self.services.admission_inventory = lambda: inventory
        self.cycle()
        self.assertEqual(c.load_state(self.directory)['leases'][self.issue['id']]['status'], 'held')

    def test_scheduler_renews_under_new_grant_hold_without_label_or_repair(self):
        import throughput_scheduler as scheduler
        from test_throughput_scheduler import resources, runtime
        self.standing(); self.cycle(); first = self.policy()
        later = time.time() + 3500
        def inventory():
            return {'at': later, 'claims': [{'id': self.issue['id'], 'identifier': 'SHE-83', 'status': 'running'}],
                    'assignments': [{'name': 'SHE-83', 'policy': self.policy()}], 'worktrees': [], 'handoffs': []}
        self.services.admission_inventory = inventory
        from datetime import datetime, timezone
        def healthy_runtime():
            value = runtime()
            value['generated_at'] = datetime.fromtimestamp(later, timezone.utc).isoformat()
            value['counts']['running'] = 1
            value['running'] = [{'issue_id': self.issue['id']}]
            return value
        with patch('time.time', return_value=later):
            reports = scheduler.run_loop(self.services, lambda: copy.deepcopy(self.config), self.directory,
                1, healthy_runtime, resources, apply=True, refresh=lambda: None, clock=lambda: later)
        self.assertGreater(self.policy()['expiresAt'], first['expiresAt'])
        self.assertEqual(len(self.services.calls), 1)
        self.assertFalse(reports[0]['scheduler']['apply_effective'])
        self.assertTrue(reports[0]['assignmentMaintenanceEnabled'])
        self.assertEqual(reports[0]['scheduler']['new_grants'], 0)

    def test_changed_pending_review_cannot_reinterpret_crash(self):
        self.services.failure = 'before'
        with self.assertRaises(host.PublicationError): self.cycle()
        prior = self.path.read_bytes()
        self.review['acceptance'] = ['new operator scope']
        self.services.failure = None
        self.assertEqual(self.cycle()['selected'], [])
        self.assertEqual(self.path.read_bytes(), prior)
