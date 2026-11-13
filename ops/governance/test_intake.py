import hashlib
import hmac
import json
from pathlib import Path
import tempfile
import unittest
import uuid
from intake import Intake, Held, CONTRACT, REPOSITORY, REPOSITORY_ID, PROJECT_SLUG, canonical_body

NOW = 1800000000

def envelope(text='Please add keyboard navigation', identity=None):
    head = 'a' * 40
    return dict(contract=CONTRACT, repository=REPOSITORY, repositoryId=REPOSITORY_ID,
                feedbackId=identity or str(uuid.uuid4()), number=7,
                version=f'{REPOSITORY_ID}:7:{head}:main', headSha=head, base='main',
                commentId=91, commentUrl=f'https://github.com/{REPOSITORY}/pull/7#issuecomment-91',
                alias='public-user', text=text, choice='yes', createdAt=NOW * 1000 - 10000)

class Services:
    def __init__(self):
        self.current = None
        self.issues, self.comments, self.mutations = {}, {}, []
        self.uncertain = False
        self.forge = False
    def github(self, path):
        e = self.current
        if path == '': return {'id': REPOSITORY_ID, 'full_name': REPOSITORY}
        if path == '/issues/7': return {'number': 7, 'pull_request': {'url': 'canonical'}}
        return {'id': 91, 'body': canonical_body(e), 'user': {'id': 123 if not self.forge else 321, 'type': 'Bot'},
                'issue_url': f'https://api.github.com/repos/{REPOSITORY}/issues/7', 'html_url': e['commentUrl'],
                'created_at': '2026-11-12T01:00:00Z', 'updated_at': '2026-11-12T01:00:00Z'}
    def linear(self, query, variables):
        if 'workflowState' in query:
            return {'project': {'id': 'project', 'slugId': PROJECT_SLUG.rsplit('-', 1)[-1], 'teams': {'nodes': [{'id': 'team'}]}},
                    'workflowState': {'id': 'backlog', 'type': 'backlog', 'team': {'id': 'team'}}}
        if query.startswith('query') and 'issues(filter' in query: return {'issues': {'nodes': [self.issues[variables['id']]] if variables['id'] in self.issues else [], 'pageInfo': {'hasNextPage': False}}}
        if query.startswith('query') and 'comments(filter' in query: return {'comments': {'nodes': [self.comments[variables['id']]] if variables['id'] in self.comments else [], 'pageInfo': {'hasNextPage': False}}}
        self.mutations.append((query, variables))
        value = variables['input']
        if 'issueCreate' in query:
            issue = dict(id=value['id'], description=value['description'], project={'id': 'project'}, url='https://linear.app/team/issue/HBL-7/proposal')
            self.issues[value['id']] = issue
            if self.uncertain:
                self.uncertain = False
                raise OSError('ambiguous HTTP result secret')
            return {'issueCreate': {'success': True, 'issue': issue}}
        comment = {'id': value['id'], 'body': value['body'], 'issue': {'id': value['issueId']}}
        self.comments[value['id']] = comment
        return {'commentCreate': {'success': True, 'comment': comment}}

class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.services = Services()
        self.config = {'enabled': True, 'secret': 'trusted-test-secret', 'botId': 123,
                       'propose': False, 'approvedBy': '', 'projectId': 'project', 'teamId': 'team',
                       'backlogId': 'backlog', 'activeTasks': {}}
        self.now = NOW
        self.adapter = Intake(self.temp.name, self.config, self.services.github, self.services.linear, lambda: self.now)
    def tearDown(self):
        self.adapter.close()
        self.temp.cleanup()
    def send(self, e, timestamp=None, signature=None):
        self.services.current = e
        body = json.dumps(e).encode()
        timestamp = timestamp or str(self.now * 1000)
        signature = signature or 'sha256=' + hmac.new(self.config['secret'].encode(), timestamp.encode() + b'.' + body, hashlib.sha256).hexdigest()
        return self.adapter.receive(body, timestamp, signature)
    def enable(self):
        self.config.update(propose=True, approvedBy='operator-review-reference')
    def test_default_off_and_no_linear_mutations(self):
        e = envelope()
        receipt = self.send(e)
        self.assertEqual(receipt, {'contract': CONTRACT, 'feedbackId': e['feedbackId'], 'status': 'received'})
        self.adapter.process(e['feedbackId'])
        self.assertEqual(self.services.mutations, [])
        self.assertEqual(self.adapter.db.execute('SELECT holding FROM feedback').fetchone()[0], 'operator_approval_required')
        self.config['enabled'] = False
        with self.assertRaisesRegex(Held, 'intake_disabled'): self.send(e)
    def test_forged_signature_and_expired_replay(self):
        with self.assertRaisesRegex(Held, 'unauthorized'): self.send(envelope(), signature='sha256=' + '0' * 64)
        with self.assertRaisesRegex(Held, 'expired_signature'): self.send(envelope(), timestamp=str((NOW - 301) * 1000))
        self.assertEqual(self.adapter.db.execute('SELECT COUNT(*) FROM feedback').fetchone()[0], 0)
    def test_noncanonical_bot_comment_is_rejected(self):
        self.services.forge = True
        with self.assertRaisesRegex(Held, 'canonical_comment_unverified'): self.send(envelope())
        self.assertEqual(self.services.mutations, [])
    def test_replay_is_idempotent_but_conflicting_record_rejected(self):
        e = envelope()
        self.assertEqual(self.send(e), self.send(e))
        self.assertEqual(self.adapter.db.execute('SELECT COUNT(*) FROM feedback').fetchone()[0], 1)
        changed = dict(e, text='different action')
        with self.assertRaisesRegex(Held, 'feedback_identity_conflict'): self.send(changed)
    def test_grouped_feedback_reuses_task_without_dispatch(self):
        self.enable()
        first = self.send(envelope())
        second = self.send(envelope(' PLEASE add  keyboard navigation '))
        self.assertEqual(first['status'], 'task-linked')
        self.assertEqual(first['taskUrl'], second['taskUrl'])
        self.assertEqual(len(self.services.issues), 1)
        self.assertEqual(len(self.services.comments), 2)
        for query, variables in self.services.mutations:
            self.assertNotIn('labelIds', variables['input'])
            self.assertNotIn('assigneeId', variables['input'])
            if 'issueCreate' in query: self.assertEqual(variables['input']['stateId'], 'backlog')
    def test_ambiguous_issue_create_reconciles_same_client_uuid(self):
        self.enable()
        self.services.uncertain = True
        e = envelope()
        self.assertEqual(self.send(e)['status'], 'received')
        self.now += 120
        self.assertEqual(self.send(e)['status'], 'task-linked')
        self.assertEqual(len(self.services.issues), 1)
        self.assertEqual(sum('issueCreate' in query for query, _ in self.services.mutations), 1)
    def test_configured_existing_task_receives_comment_only(self):
        self.enable()
        self.config['activeTasks'] = {'7': 'existing'}
        self.services.issues['existing'] = {'id': 'existing', 'project': {'id': 'project'}, 'url': 'https://linear.app/team/issue/HBL-1/active'}
        self.assertEqual(self.send(envelope())['status'], 'task-linked')
        self.assertFalse(any('issueCreate' in q for q, _ in self.services.mutations))
    def test_wrong_project_holds_without_mutation(self):
        self.enable()
        self.config['projectId'] = 'wrong'
        self.assertEqual(self.send(envelope())['status'], 'received')
        self.assertEqual(self.services.mutations, [])
    def test_private_state_modes(self):
        self.assertEqual((Path(self.temp.name) / 'intake.sqlite').stat().st_mode & 0o777, 0o600)

if __name__ == '__main__': unittest.main()
