"""Durable observation tests; no integrations, model, process inventory or approval."""
import json
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from throughput_metrics import MetricsStore, sample_resources


def runtime(running=0, tokens=100):
    return {'counts': {'running': running, 'retrying': 0, 'blocked': 0},
            'running': [{'issue_identifier': 'SHE-11', 'started_at': 90, 'session_id': 'PRIVATE SESSION', 'last_codex_message': 'PRIVATE PROMPT'}] if running else [],
            'codex_totals': {'total_tokens': tokens, 'input_tokens': tokens-5, 'output_tokens': 5}}


def pr(n, branch='codex/manual', created=100, merged=150):
    return {'number': n, 'html_url': f'https://github.com/adnanwahab/happybearlandia/pull/{n}',
            'created_at': created, 'merged_at': merged, 'title': 'PRIVATE TITLE', 'body': 'PRIVATE DESCRIPTION',
            'head': {'ref': branch, 'sha': 'a'*40, 'repo': {'full_name': 'adnanwahab/happybearlandia'}}}


def report(prs=None):
    return {'max_workers': 2, 'issues': [{'identifier': 'SHE-11', 'state': 'Todo', 'eligible': True, 'description': 'PRIVATE ISSUE'},
                                       {'identifier': 'SHE-12', 'state': 'In Progress', 'eligible': False, 'reasons': ['unknown ownership PRIVATE ERROR']}],
            'pullRequests': prs or [], 'scanMetrics': {'linear_reads': 4, 'github_reads': 2, 'scan_seconds': .25}}


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = MetricsStore(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_restart_deduplicates_pr_lifecycle_and_separates_manual_from_symphony(self):
        r = report([pr(27), pr(31, 'symphony/SHE-11')])
        self.store.observe(runtime(), r, {}, now=200)
        again = MetricsStore(self.root)
        snapshot = again.observe(runtime(), r, {}, now=210)
        self.assertEqual(snapshot['rates']['prs_merged_per_hour'], 2)
        self.assertEqual(snapshot['rates']['symphony_prs_merged_per_hour'], 1)
        self.assertEqual(snapshot['cycle_times'], {'scope': 'pr_creation_to_merge', 'median_seconds': 50.0,
                         'p95_seconds': 50.0, 'samples': 2, 'small_sample': True})
        self.assertEqual(len(snapshot['timeline']), 4)
        self.assertEqual(os.stat(self.store.path).st_mode & 0o777, 0o600)

    def test_durable_redaction_never_stores_comments_messages_arbitrary_errors_or_credentials(self):
        r = report([pr(27)])
        r['comments'] = [{'body': 'PRIVATE COMMENT'}]
        r['watchdog'] = [{'code': 'authentication', 'issue': 'SHE-11', 'message': 'PRIVATE TOKEN'},
                         {'code': 'PRIVATE ERROR', 'message': 'PRIVATE TOKEN'}]
        snap = self.store.observe(runtime(1), r, {'PRIVATE RESOURCE': 'PRIVATE TOKEN'}, now=200)
        self.assertEqual(snap['queue']['blocking_reasons'], [{'reason': 'ownership', 'count': 1}])
        self.assertEqual(snap['watchdog'], [{'code': 'authentication', 'issue': 'SHE-11', 'severity': 'warning'}])
        self.assertNotIn(b'PRIVATE', self.store.path.read_bytes())
        self.assertNotIn('PRIVATE', json.dumps(snap))

    def test_all_current_scheduler_hold_codes_reach_redacted_dashboard(self):
        r=report()
        codes=['operator-approvals-disabled','review-capacity-reserved','operator-evidence-changed-during-scan','scheduler-stopped']
        r['scheduler']={'watchdog':[dict(code=code,severity='hold',issue='SHE-11',message='PRIVATE SECRET') for code in codes]}
        snap=self.store.observe(runtime(),r,{},now=200)
        self.assertEqual([a['code'] for a in snap['watchdog']],[code.replace('-','_') for code in codes])
        self.assertTrue(all(a['severity']=='hold' for a in snap['watchdog']))
        self.assertNotIn('PRIVATE',json.dumps(snap))

    def test_blocking_breakdown_counts_affected_issues_not_repeated_reasons(self):
        r=report()
        r['issues']=[dict(identifier='SHE-11',state='Todo',eligible=False,
                         reasons=['unknown ownership A','ownership conflict B','scope conflict C','prerequisite A','prerequisite B']),
                     dict(identifier='SHE-12',state='Todo',eligible=False,reasons=['ownership conflict D'])]
        snap=self.store.observe(runtime(),r,{},now=200)
        self.assertEqual(snap['queue']['blocking_reasons'],[dict(reason='dependency',count=1),dict(reason='ownership',count=2)])
        self.assertTrue(all(item['count']<=2 for item in snap['queue']['blocking_reasons']))

    def test_sampled_utilization_and_tokens_do_not_claim_time_before_observation(self):
        self.store.observe(runtime(1, 100), report(), {}, now=100)
        snap = self.store.observe(runtime(0, 160), report(), {}, now=110)
        self.assertEqual(snap['utilization']['observed_seconds'], 10)
        self.assertEqual(snap['utilization']['capacity_seconds'], 20)
        self.assertEqual(snap['utilization']['fraction'], .5)
        self.assertEqual(snap['tokens']['tokens_per_second'], 6)
        self.assertEqual(snap['tokens']['delta_total'], 60)
        reset = self.store.observe(runtime(0, 10), report(), {}, now=120)
        self.assertTrue(reset['tokens']['counter_reset'])
        self.assertIsNone(reset['tokens']['tokens_per_second'])
        self.assertIsNone(reset['quality']['first_pass_ci_success_rate'])

    def test_unknown_is_not_zero_and_long_gaps_do_not_invent_utilization(self):
        empty = self.store.snapshot(now=100)
        self.assertIsNone(empty['runtime']['running'])
        self.assertIsNone(empty['rates']['prs_opened_per_hour'])
        self.assertIsNone(empty['utilization']['fraction'])
        self.store.observe(runtime(1), report(), {}, now=100)
        gap = self.store.observe(runtime(0), report(), {}, now=500)
        self.assertEqual(gap['utilization']['observed_seconds'], 0)
        self.assertIsNone(gap['utilization']['fraction'])
        self.assertIsNone(gap['resources']['swap_used_bytes'])
        known_empty = self.store.observe({}, {'issues': [], 'pullRequests': []}, {}, now=510)
        self.assertEqual(known_empty['queue']['ready'], 0)
        self.assertEqual(known_empty['rates']['prs_opened_per_hour'], 0)

    def test_failed_inventory_is_unknown_instead_of_empty(self):
        failure = {'issues': None, 'pullRequests': None, 'scheduler': {'error': 'upstream-unavailable'}}
        snapshot = self.store.observe(runtime(), failure, {}, now=200)
        self.assertIsNone(snapshot['queue']['ready'])
        self.assertIsNone(snapshot['queue']['remaining_estimate'])
        self.assertIsNone(snapshot['rates']['prs_opened_per_hour'])

    def test_untrusted_pr_origins_invalid_times_and_future_observations_are_excluded(self):
        wrong = pr(28)
        wrong['html_url'] = 'https://evil.invalid/private'
        future = pr(29, created=300, merged=400)
        snap = self.store.observe(runtime(), report([wrong, future]), {}, now=200)
        self.assertEqual(snap['rates']['prs_opened_per_hour'], 0)
        self.assertEqual(snap['timeline'], [])
        self.assertIsNone(snap['cycle_times']['median_seconds'])
        self.assertIsNone(self.store.snapshot(now=50)['runtime']['running'])

    def test_fixed_hour_window_nearest_rank_percentile_and_one_sample_idempotence(self):
        prs = [pr(1, created=100, merged=110), pr(2, created=100, merged=120), pr(3, created=100, merged=190)]
        r = report(prs)
        a = self.store.observe(runtime(), r, {}, now=200)
        self.store.observe(runtime(1), r, {}, now=200)
        self.assertEqual(a['cycle_times']['median_seconds'], 20)
        self.assertEqual(a['cycle_times']['p95_seconds'], 90)
        self.assertEqual(self.store.snapshot(now=200)['utilization']['samples'], 1)
        self.assertEqual(self.store.snapshot(now=4000)['rates']['prs_opened_per_hour'], 0)

    def test_explicit_host_lifecycle_events_are_whitelisted_and_never_guessed(self):
        r = report()
        r['events'] = [{'issue': 'SHE-11', 'at': 80, 'stage': 'commit', 'source': 'git', 'body': 'PRIVATE BODY'},
                       {'issue': 'SHE-11', 'at': 100, 'stage': 'ci_passed', 'source': 'github'},
                       {'issue': 'SHE-11', 'at': 100, 'stage': 'PRIVATE STAGE', 'source': 'github'},
                       {'issue': 'PRIVATE ISSUE', 'at': 100, 'stage': 'commit', 'source': 'git'}]
        snap = self.store.observe(runtime(), r, {}, now=200)
        self.assertEqual([x['stage'] for x in snap['timeline']], ['commit', 'ci_passed'])
        self.assertNotIn('PRIVATE', json.dumps(snap))

    def test_pr_creation_does_not_invent_a_historical_draft_transition(self):
        p = pr(11)
        p['draft'] = False
        snap = self.store.observe(runtime(), report([p]), {}, now=200)
        self.assertEqual([x['stage'] for x in snap['timeline']], ['pr_opened', 'merged'])
        self.assertNotIn('draft', [x['stage'] for x in snap['timeline']])

    def test_real_scanner_metric_names_and_scheduler_hold_alarms_integrate(self):
        r = report()
        r['scanMetrics'] = {'linearQueryCalls': 19, 'githubCommandCalls': 22,
                            'githubRetries': 2, 'nestedContinuationCalls': 1, 'elapsedSeconds': 3.5}
        r['scheduler'] = {'watchdog': [
            {'code': 'stale-runtime', 'severity': 'hold', 'message': 'PRIVATE ERROR'},
            {'code': 'retained-lease-needs-reconciliation', 'severity': 'hold', 'issue': 'SHE-11'},
            {'code': 'commit-without-draft-pr', 'severity': 'hold', 'issue': 'SHE-12'},
            {'code': 'stalled-ci', 'severity': 'notice', 'pr': 31},
            {'code': 'upstream-or-auth-failure', 'severity': 'hold'},
            {'code': 'runtime-refresh-unavailable', 'severity': 'notice'},
        ]}
        snap = self.store.observe(runtime(), r, {}, now=200)
        self.assertEqual(snap['api']['linear_reads'], 19)
        self.assertEqual(snap['api']['github_reads'], 22)
        self.assertEqual(snap['api']['github_retries'], 2)
        self.assertEqual(snap['api']['nested_continuation_calls'], 1)
        self.assertEqual(snap['api']['scan_seconds'], 3.5)
        for key in ('linear_retries', 'throttles', 'retries'):
            self.assertIsNone(snap['api'][key])
        self.assertEqual(snap['watchdog'][0]['code'], 'stale_runtime')
        self.assertEqual(snap['watchdog'][0]['severity'], 'hold')
        self.assertEqual(snap['watchdog'][2]['code'], 'missing_draft')
        self.assertEqual(snap['watchdog'][3]['pr_number'], 31)
        self.assertEqual(snap['watchdog'][3]['severity'], 'notice')
        self.assertEqual(snap['watchdog'][4]['code'], 'upstream_or_auth_failure')
        self.assertNotIn('PRIVATE', json.dumps(snap))
        self.assertNotIn(b'PRIVATE', self.store.path.read_bytes())

    def test_remaining_queue_excludes_terminal_and_known_archived_rows(self):
        r = report()
        r['issues'] = [
            {'state': 'Todo', 'eligible': True},
            {'state': 'In Progress', 'eligible': False},
            {'state': 'Backlog', 'eligible': False},
            *[{'state': state, 'eligible': False} for state in ['Done', 'Closed', 'Canceled', 'Cancelled', 'Duplicate']],
            {'state': 'Todo', 'archivedAt': '2026-11-11T00:00:00Z'},
            {'state': 'Todo', 'archived': True},
            {'state': 'Todo', 'reasons': ['archived issue']},
        ]
        queue = self.store.observe(runtime(), r, {}, now=200)['queue']
        self.assertEqual(queue['remaining_estimate'], 3)
        self.assertEqual(queue['total_project_issues'], 11)
        self.assertEqual(queue['ready'], 1)
        self.assertEqual(queue['remaining_estimate_scope'], 'nonterminal_project_issues_including_unapproved')

    def test_missing_state_retains_unknown_remaining_estimate_not_total_or_zero(self):
        r = report()
        r['issues'].append({'eligible': False})
        queue = self.store.observe(runtime(), r, {}, now=200)['queue']
        self.assertIsNone(queue['remaining_estimate'])
        self.assertEqual(queue['total_project_issues'], 3)
        self.assertEqual(queue['ready'], 1)
        empty = self.store.observe(runtime(), report() | {'issues': []}, {}, now=210)['queue']
        self.assertEqual(empty['remaining_estimate'], 0)
        absent = self.store.observe(runtime(), {}, {}, now=220)['queue']
        self.assertIsNone(absent['remaining_estimate'])
        self.assertIsNone(absent['total_project_issues'])

    def test_failed_event_transaction_does_not_leave_partial_sample(self):
        before = self.store.snapshot(now=100)['utilization']['samples']
        with patch('throughput_metrics.json.dumps', side_effect=ValueError('fixture crash')):
            with self.assertRaises(ValueError):
                self.store.observe(runtime(), report([pr(1)]), {}, now=100)
        self.assertEqual(self.store.snapshot(now=100)['utilization']['samples'], before)
        self.assertEqual(self.store.snapshot(now=100)['timeline'], [])

    def test_unsafe_database_symlink_hardlink_and_permissions_fail_closed(self):
        for mode in ['symlink', 'hardlink', 'world-readable']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as d:
                root = Path(d)
                outside = root/'other'
                outside.touch(mode=0o600)
                target = root/'throughput.sqlite'
                if mode == 'symlink': target.symlink_to(outside)
                elif mode == 'hardlink': os.link(outside, target)
                else: target.touch(mode=0o644);target.chmod(0o644)
                with self.assertRaises((ValueError, OSError)):
                    MetricsStore(root)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/'link';path.symlink_to(self.root, target_is_directory=True)
            with self.assertRaises(ValueError): MetricsStore(path)

    def test_unknown_schema_preserves_database_instead_of_resetting(self):
        with closing(sqlite3.connect(self.store.path)) as db, db:
            db.execute('UPDATE meta SET version=99')
        with self.assertRaises(ValueError): MetricsStore(self.root)
        with closing(sqlite3.connect(self.store.path)) as db, db:
            self.assertEqual(db.execute('SELECT version FROM meta').fetchone()[0], 99)

    def test_resource_unavailability_does_not_claim_zero_memory_or_swap(self):
        with patch('throughput_metrics._run', return_value=''), patch('throughput_metrics.os.uname') as uname:
            uname.return_value.sysname = 'Darwin'
            sample = sample_resources(self.root)
        self.assertIsNone(sample['available_memory_bytes'])
        self.assertIsNone(sample['swap_used_bytes'])
        self.assertGreater(sample['disk_free_bytes'], 0)
        self.assertGreater(sample['cpu_count'], 0)


if __name__ == '__main__':
    unittest.main()
