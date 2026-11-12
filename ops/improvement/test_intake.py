import copy
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from ops.improvement.proposal import InvalidProposal, digest, proposal_id, validate_proposal
from ops.improvement.inbox import database, ingest
from ops.improvement.coordinator import PROJECT

FIXTURE = Path(__file__).with_name('fixtures') / 'example-batch.json'


def batch():
    return json.loads(FIXTURE.read_text())


def report():
    return {'dryRun': True, 'projectId': PROJECT, 'baseSha': 'a' * 40, 'scannedAt': time.time(), 'issues': [
        {'identifier': 'SHE-141', 'title': 'Agent metric contract', 'state': 'Done', 'reasons': [], 'existingPRs': [34, 35]},
        {'identifier': 'SHE-7', 'title': 'First-play events', 'state': 'Backlog', 'reasons': ['ownership review required'], 'existingPRs': []}]}


class IntakeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'state'

    def ingest(self, value=None, **options):
        return ingest(value or batch(), self.state, coordinator_report=options.pop('coordinator_report', report()), **options)

    def counts(self):
        with closing(sqlite3.connect(self.state / 'proposals.sqlite')) as db:
            return {name: db.execute('SELECT count(*) FROM ' + name).fetchone()[0]
                    for name in ('proposals', 'streams', 'receipts', 'budgets')}

    def test_dry_run_creates_no_state_and_preserves_terminal_pr_holds(self):
        result = self.ingest()
        self.assertFalse(self.state.exists())
        self.assertEqual(result['newProposals'], 1)
        self.assertEqual(result['recordedProposals'], 0)
        self.assertEqual(result['storedCursor'], None)
        row = result['proposals'][0]
        self.assertEqual(row['disposition'], 'HELD')
        self.assertIn('TARGET_ALREADY_TERMINAL', row['holdReasons'])
        self.assertIn('EXISTING_PR_REQUIRES_RECONCILIATION', row['holdReasons'])
        self.assertFalse(row['executionApproved'])
        self.assertEqual(row['evidenceStatus'], 'NOT_EVALUATED')

    def test_record_restart_replay_and_private_state(self):
        first = self.ingest(record=True)
        second = self.ingest(record=True)
        self.assertEqual(first['recordedProposals'], 1)
        self.assertEqual(second['newProposals'], 0)
        self.assertEqual(second['duplicates'], 1)
        self.assertTrue(second['replayed'])
        self.assertEqual(second['storedCursor'], batch()['cursorAfter'])
        self.assertEqual(self.counts(), dict(proposals=1, streams=1, receipts=1, budgets=1))
        self.assertEqual(self.state.stat().st_mode & 0o777, 0o700)
        self.assertEqual((self.state / 'proposals.sqlite').stat().st_mode & 0o777, 0o600)

    def test_dry_run_existing_database_does_not_change_files(self):
        self.ingest(record=True)
        before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.state.iterdir()}
        self.ingest()
        after = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.state.iterdir()}
        self.assertEqual(before, after)

    def test_failed_checkpoint_rolls_back_all_proposals_and_budget(self):
        with database(self.state, True) as db:
            db.execute("CREATE TRIGGER fail_checkpoint BEFORE INSERT ON streams BEGIN SELECT RAISE(ABORT,'fixture'); END")
        with self.assertRaisesRegex(InvalidProposal, 'state database'):
            self.ingest(record=True)
        self.assertEqual(self.counts(), dict(proposals=0, streams=0, receipts=0, budgets=0))

    def test_receipt_and_identity_conflicts_preserve_original(self):
        self.ingest(record=True)
        original = (self.state / 'proposals.sqlite').read_bytes()
        changed = batch()
        changed['proposals'][0]['hypothesis'] = 'Different content under the same source revision.'
        with self.assertRaisesRegex(InvalidProposal, 'receipt conflicts'):
            self.ingest(changed, record=True)
        changed['cursorBefore'], changed['cursorAfter'] = batch()['cursorAfter'], 'next'
        with self.assertRaisesRegex(InvalidProposal, 'identity conflicts'):
            self.ingest(changed, record=True)
        self.assertEqual(original, (self.state / 'proposals.sqlite').read_bytes())

    def test_same_key_new_revision_is_stored_but_held_for_review(self):
        first = self.ingest(record=True)
        changed = batch()
        changed['cursorBefore'], changed['cursorAfter'] = batch()['cursorAfter'], 'next'
        source = changed['proposals'][0]['sources'][0]
        old = source['revision']
        source['revision'] = 'b' * 40
        source['url'] = source['url'].replace(old, source['revision'])
        second = self.ingest(changed, record=True)
        self.assertEqual(second['newProposals'], 1)
        row = second['proposals'][0]
        self.assertIn(first['proposals'][0]['id'], row['relatedProposals'])
        self.assertIn('RELATED_PROPOSAL_REQUIRES_REVIEW', row['holdReasons'])
        replay = self.ingest(changed)
        self.assertEqual(replay['proposals'][0]['relatedProposals'], row['relatedProposals'])

    def test_duplicate_inside_batch_is_counted_once(self):
        value = batch()
        value['proposals'] *= 2
        for record in (False, True):
            result = self.ingest(value, record=record)
            self.assertEqual(result['newProposals'], 1)
            self.assertEqual(result['duplicates'], 1)

    def test_daily_budget_and_cursor_compare_are_transactional(self):
        self.ingest(record=True, daily_limit=1)
        changed = batch()
        changed['cursorBefore'], changed['cursorAfter'] = batch()['cursorAfter'], 'next'
        changed['proposals'][0]['deduplicationKeys'] = ['another:proposal']
        with self.assertRaisesRegex(InvalidProposal, 'budget exceeded'):
            self.ingest(changed, record=True, daily_limit=1)
        self.assertEqual(self.counts()['proposals'], 1)
        changed['cursorBefore'] = 'wrong'
        with self.assertRaisesRegex(InvalidProposal, 'cursor mismatch'):
            self.ingest(changed, record=True)

    def test_receipt_replay_reports_current_budget_and_checkpoint(self):
        self.ingest(record=True)
        changed = batch()
        changed['cursorBefore'], changed['cursorAfter'] = batch()['cursorAfter'], 'later'
        changed['proposals'][0]['deduplicationKeys'] = ['another:proposal']
        self.ingest(changed, record=True)
        result = self.ingest()
        self.assertEqual(result['storedCursor'], 'later')
        self.assertEqual(result['budget']['remainingAfterPlan'], 18)

    def test_missing_stale_foreign_and_duplicate_reports_fail_closed(self):
        result = self.ingest(coordinator_report=None)
        self.assertEqual(result['proposals'][0]['holdReasons'], ['COORDINATOR_REPORT_REQUIRED'])
        for mutate in (lambda r: r.update(scannedAt=0), lambda r: r.update(projectId='other'),
                       lambda r: r.update(dryRun=False), lambda r: r['issues'].append(r['issues'][0])):
            value = report()
            mutate(value)
            with self.assertRaises(InvalidProposal):
                self.ingest(coordinator_report=value, record=True)
            self.assertFalse(self.state.exists())

    def test_review_projection_never_authorizes_or_executes(self):
        value = batch()
        proposal = value['proposals'][0]
        proposal['targetIssue'] = None
        proposal['dependencies'] = ['SHE-141']
        marker = self.root / 'must-not-exist'
        proposal['testCommands'] = [[sys.executable, '-c', 'open(' + repr(str(marker)) + ',"w").write("bad")']]
        with patch('socket.create_connection', side_effect=AssertionError('network forbidden')):
            result = self.ingest(value, record=True)
        self.assertFalse(marker.exists())
        self.assertEqual(result['proposals'][0]['disposition'], 'REVIEW')
        self.assertFalse(result['proposals'][0]['executionApproved'])
        self.assertEqual(result['operation']['remoteWrites'], 0)
        value['proposals'][0]['dependencies'] = ['SHE-7']
        value['cursorBefore'], value['cursorAfter'] = batch()['cursorAfter'], 'second'
        value['proposals'][0]['deduplicationKeys'] = ['dependent:proposal']
        self.assertIn('UNVERIFIED_DEPENDENCY:SHE-7', self.ingest(value)['proposals'][0]['holdReasons'])

    def test_corrupt_or_unsupported_state_is_never_reset(self):
        self.ingest(record=True)
        path = self.state / 'proposals.sqlite'
        with closing(sqlite3.connect(path)) as db:
            db.execute('PRAGMA user_version=99')
        original = path.read_bytes()
        with self.assertRaisesRegex(InvalidProposal, 'unsupported state'):
            self.ingest(record=True)
        self.assertEqual(path.read_bytes(), original)
        path.write_bytes(b'corrupt-fixture')
        with self.assertRaisesRegex(InvalidProposal, 'corrupt'):
            self.ingest(record=True)
        self.assertEqual(path.read_bytes(), b'corrupt-fixture')

    def test_corrupt_saved_receipt_is_held_without_advancing_or_resetting(self):
        self.ingest(record=True)
        path = self.state / 'proposals.sqlite'
        for corrupt in ('not-json', '[]', '{}', '{"schemaVersion":"other"}'):
            with closing(sqlite3.connect(path)) as db:
                db.execute('UPDATE receipts SET result=?', (corrupt,))
                db.commit()
            original = path.read_bytes()
            with self.assertRaisesRegex(InvalidProposal, 'corrupt intake receipt'):
                self.ingest(record=True)
            self.assertEqual(path.read_bytes(), original)

    def test_symlink_hardlink_and_public_state_rejected(self):
        self.ingest(record=True)
        path = self.state / 'proposals.sqlite'
        os.link(path, self.root / 'hardlink')
        with self.assertRaises(InvalidProposal):
            self.ingest(record=True)
        (self.root / 'hardlink').unlink()
        path.rename(self.state / 'preserved.sqlite')
        path.symlink_to(self.state / 'preserved.sqlite')
        with self.assertRaises(InvalidProposal):
            self.ingest()
        path.unlink()
        (self.state / 'preserved.sqlite').rename(path)
        self.state.chmod(0o755)
        with self.assertRaises(InvalidProposal):
            self.ingest()

    def test_real_process_concurrency_creates_one_record(self):
        command = [sys.executable, '-m', 'ops.improvement', '--input', str(FIXTURE), '--state-dir', str(self.state), '--record']
        processes = [subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        results = [p.communicate(timeout=20) for p in processes]
        self.assertTrue(all(p.returncode == 0 for p in processes), results)
        self.assertEqual(sum(json.loads(out)['newProposals'] for out, _ in results), 1)
        self.assertEqual(self.counts()['proposals'], 1)


class ContractTest(unittest.TestCase):
    def test_unknown_fields_types_versions_and_approval_injection(self):
        original = batch()['proposals'][0]
        for field, value in [('schemaVersion', 'v2'), ('kind', []), ('title', ''), ('sources', []),
                             ('testCommands', ['bun test']), ('dependencies', ['unknown']),
                             ('deduplicationKeys', ['UPPER']), ('hypothesis', 'x' * 2001), ('title', 'hidden\u202e')]:
            proposal = copy.deepcopy(original)
            proposal[field] = value
            with self.subTest(field=field, value=repr(value)[:40]), self.assertRaises(InvalidProposal):
                validate_proposal(proposal)
        for key in ('labels', 'executionApproved', 'consent', 'rawFeedback'):
            proposal = {**original, key: True}
            with self.assertRaises(InvalidProposal):
                validate_proposal(proposal)

    def test_source_revision_url_and_query_are_validated_without_echoing_secrets(self):
        for mutate in (lambda s: s.update(url=s['url']+'?token=do-not-log'),
                       lambda s: s.update(url='https://user:do-not-log@github.com/x'),
                       lambda s: s.update(revision='b'*40), lambda s: s.update(evidence='measured')):
            proposal = batch()['proposals'][0]
            mutate(proposal['sources'][0])
            with self.assertRaises(InvalidProposal) as error:
                validate_proposal(proposal)
            self.assertNotIn('do-not-log', str(error.exception))

    def test_paper_and_feedback_provenance_are_explicit(self):
        value = batch()['proposals'][0]
        value['kind'] = 'research'
        value['sources'] = [{'type':'paper','id':'doi:10.1234/EXAMPLE','revision':'a'*64,
                             'url':'https://doi.org/10.1234/example','evidence':'metadata-only'}]
        self.assertEqual(validate_proposal(value)['sources'][0]['id'], 'doi:10.1234/example')
        value['sources'][0].update(id='openalex:W2741809807', url='https://openalex.org/works/W2741809807')
        self.assertEqual(validate_proposal(value)['sources'][0]['url'], 'https://openalex.org/W2741809807')
        value['sources'][0]['evidence'] = 'measured'
        with self.assertRaises(InvalidProposal):
            validate_proposal(value)
        value['kind'] = 'feedback'
        value['sources'] = batch()['proposals'][0]['sources']
        with self.assertRaises(InvalidProposal):
            validate_proposal(value)
        value['sources'] = [{'type':'feedback-aggregate','id':'a'*64,'revision':'b'*64,
                             'url':None,'evidence':'consented-aggregate'}]
        validate_proposal(value)  # An assertion in input, not proof of collected consent.

    def test_canonical_order_deduplicates_and_revision_changes_identity(self):
        value = batch()['proposals'][0]
        value['dependencies'] = ['SHE-7', 'SHE-141']
        value['deduplicationKeys'] = ['topic:two', 'topic:one']
        other = copy.deepcopy(value)
        other['dependencies'].reverse()
        other['deduplicationKeys'].reverse()
        self.assertEqual(digest(validate_proposal(value)), digest(validate_proposal(other)))
        old = proposal_id(validate_proposal(value))
        other['sources'][0]['url'] = other['sources'][0]['url'].replace(other['sources'][0]['revision'], 'b'*40)
        other['sources'][0]['revision'] = 'b'*40
        self.assertNotEqual(old, proposal_id(validate_proposal(other)))


if __name__ == '__main__':
    unittest.main()
