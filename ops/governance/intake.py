"""Trusted host-only feedback intake. All user text is data; no dispatch authority."""
import argparse
import fcntl
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import time
import unicodedata
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

CONTRACT = 'hbl-governance.v1'
REPOSITORY = 'adnanwahab/happybearlandia'
REPOSITORY_ID = 1364565814
PROJECT_SLUG = 'hbl-1m-player-launch-week-1-da57f913e8aa'
# Exact FeedbackEnvelope fields from DC src/shared/hbl-governance.ts.
FIELDS = {'contract', 'repository', 'repositoryId', 'feedbackId', 'number', 'version',
          'headSha', 'base', 'commentId', 'commentUrl', 'alias', 'text', 'choice', 'createdAt'}

class Held(Exception):
    """A bounded, credential-free error exposed to the caller."""


def canonical_body(e):
    choice = e['choice'] if e['choice'] is not None else 'Not cast'
    return (f'Civic Synthesis - public ballot feedback\nPR: {REPOSITORY}#{e["number"]}\n'
            f'Revision: {e["headSha"]}; target: {e["base"]}\n'
            f'Choice when posted: {choice} (historical; not the current tally)\n'
            f'Feedback ID: {e["feedbackId"]}\nPublic participant: {e["alias"]}\n\n{e["text"]}')


def validate(e):
    if not isinstance(e, dict) or set(e) != FIELDS:
        raise Held('invalid_envelope')
    if (e['contract'] != CONTRACT or e['repository'] != REPOSITORY or
            e['repositoryId'] != REPOSITORY_ID):
        raise Held('wrong_repository_or_contract')
    for key in ('number', 'commentId', 'createdAt'):
        if type(e[key]) is not int or e[key] <= 0:
            raise Held('invalid_envelope')
    for key, limit in [('version', 512), ('base', 256), ('headSha', 40), ('alias', 60), ('text', 10000)]:
        if not isinstance(e[key], str) or not e[key].strip() or len(e[key]) > limit:
            raise Held('invalid_envelope')
    if not re.fullmatch(r'[a-fA-F0-9]{40}', e['headSha']):
        raise Held('invalid_head')
    if e['version'] != f'{REPOSITORY_ID}:{e["number"]}:{e["headSha"]}:{e["base"]}':
        raise Held('invalid_version')
    try:
        if str(uuid.UUID(e['feedbackId'])) != e['feedbackId']:
            raise ValueError()
    except (ValueError, AttributeError, TypeError):
        raise Held('invalid_feedback_id') from None
    if e['choice'] not in ('yes', 'no', None):
        raise Held('invalid_choice')
    expected = f'https://github.com/{REPOSITORY}/pull/{e["number"]}#issuecomment-{e["commentId"]}'
    if e['commentUrl'] != expected:
        raise Held('invalid_comment_url')


def authenticate(body, timestamp, signature, secret, now):
    if not secret or not re.fullmatch(r'[0-9]{13}', timestamp or ''):
        raise Held('unauthorized')
    if abs(now * 1000 - int(timestamp)) > 300000:
        raise Held('expired_signature')
    expected = 'sha256=' + hmac.new(secret.encode(), timestamp.encode() + b'.' + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature or ''):
        raise Held('unauthorized')


def github(path):
    headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    if os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    try:
        request = urllib.request.Request(f'https://api.github.com/repos/{REPOSITORY}{path}', headers=headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except Exception:
        raise Held('github_verification_unavailable') from None


def host_linear(query, variables):
    # Reuse the existing trusted publisher's sanitized transport; never worker hooks.
    source = Path(__file__).resolve().parents[2] / 'tools/symphony/local/coordinator_host.py'
    spec = importlib.util.spec_from_file_location('hbl_existing_host_transport', source)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
        return module.linear(query, variables, attempts=1)
    except Exception:
        raise Held('linear_unavailable') from None


def env_config():
    return {'enabled': os.environ.get('HBL_INTAKE_ENABLED') == 'true',
            'secret': os.environ.get('HBL_INTAKE_SECRET', ''),
            'botId': os.environ.get('HBL_BOT_USER_ID', ''),
            'propose': os.environ.get('HBL_INTAKE_PROPOSE_TASKS') == 'true',
            'approvedBy': os.environ.get('HBL_INTAKE_APPROVED_BY', ''),
            'projectId': os.environ.get('HBL_INTAKE_PROJECT_ID', ''),
            'teamId': os.environ.get('HBL_INTAKE_TEAM_ID', ''),
            'backlogId': os.environ.get('HBL_INTAKE_BACKLOG_STATE_ID', ''),
            'activeTasks': json.loads(os.environ.get('HBL_INTAKE_ACTIVE_TASKS', '{}'))}


class Intake:
    def __init__(self, directory, config=None, github_read=github, linear=host_linear, clock=time.time):
        self.config = config if config is not None else env_config()
        self.github, self.linear, self.clock = github_read, linear, clock
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise Held('private_state_required')
        self.lock = os.open(path / 'intake.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        lock_info = os.fstat(self.lock)
        if lock_info.st_uid != os.getuid() or lock_info.st_nlink != 1 or not stat.S_ISREG(lock_info.st_mode) or lock_info.st_mode & 0o077:
            os.close(self.lock)
            raise Held('private_state_required')
        dbpath = path / 'intake.sqlite'
        fd = os.open(dbpath, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        info = os.fstat(fd)
        if info.st_uid != os.getuid() or info.st_nlink != 1 or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
            os.close(fd)
            raise Held('private_state_required')
        os.close(fd)
        self.db = sqlite3.connect(dbpath)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000;
          CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,digest TEXT NOT NULL,envelope TEXT NOT NULL,
            group_key TEXT NOT NULL,comment_uuid TEXT NOT NULL,status TEXT NOT NULL,task_url TEXT,holding TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_retry REAL NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS groups(group_key TEXT PRIMARY KEY,issue_id TEXT NOT NULL,task_url TEXT);
          CREATE TABLE IF NOT EXISTS cursors(name TEXT PRIMARY KEY,value TEXT NOT NULL);
        ''')
        self.db.commit()

    def close(self):
        self.db.close()
        os.close(self.lock)

    def verify_comment(self, e):
        try:
            bot = int(self.config.get('botId', ''))
        except (TypeError, ValueError):
            raise Held('bot_identity_unconfigured') from None
        repo = self.github('')
        issue = self.github(f'/issues/{e["number"]}')
        comment = self.github(f'/issues/comments/{e["commentId"]}')
        if (repo.get('id') != REPOSITORY_ID or repo.get('full_name') != REPOSITORY or
            not issue.get('pull_request') or issue.get('number') != e['number'] or
            comment.get('id') != e['commentId'] or comment.get('user', {}).get('id') != bot or
            comment.get('user', {}).get('type') != 'Bot' or comment.get('body') != canonical_body(e) or
            comment.get('html_url') != e['commentUrl'] or
            comment.get('issue_url') != f'https://api.github.com/repos/{REPOSITORY}/issues/{e["number"]}' or
            not comment.get('created_at') or comment.get('updated_at') != comment.get('created_at')):
            raise Held('canonical_comment_unverified')

    def receipt(self, identity):
        row = self.db.execute('SELECT * FROM feedback WHERE id=?', (identity,)).fetchone()
        value = {'contract': CONTRACT, 'feedbackId': identity, 'status': row['status']}
        if row['task_url']:
            value['taskUrl'] = row['task_url']
        return value

    def receive(self, body, timestamp, signature):
        if not self.config.get('enabled'):
            raise Held('intake_disabled')
        if len(body) > 65536:
            raise Held('request_too_large')
        authenticate(body, timestamp, signature, self.config.get('secret'), self.clock())
        try:
            e = json.loads(body)
        except (ValueError, UnicodeError):
            raise Held('invalid_json') from None
        validate(e)
        digest = hashlib.sha256(json.dumps(e, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        fcntl.flock(self.lock, fcntl.LOCK_EX)
        try:
            old = self.db.execute('SELECT * FROM feedback WHERE id=?', (e['feedbackId'],)).fetchone()
            if old and old['digest'] != digest:
                raise Held('feedback_identity_conflict')
            # Revalidate canonical GitHub evidence even on a replay or retry.
            self.verify_comment(e)
            normalized = ' '.join(unicodedata.normalize('NFKC', e['text']).casefold().split())
            group = hashlib.sha256(f'{REPOSITORY_ID}:{e["number"]}:{normalized}'.encode()).hexdigest()
            self.db.execute('INSERT OR IGNORE INTO feedback(id,digest,envelope,group_key,comment_uuid,status,holding) VALUES(?,?,?,?,?,?,?)',
                            (e['feedbackId'], digest, json.dumps(e), group, str(uuid.uuid4()), 'received', 'operator_approval_required'))
            self.db.execute('INSERT OR REPLACE INTO cursors VALUES(?,?)', ('last_received', e['feedbackId']))
            self.db.commit()
            if self.config.get('propose') and self.config.get('approvedBy'):
                self.process(e['feedbackId'])
            return self.receipt(e['feedbackId'])
        finally:
            fcntl.flock(self.lock, fcntl.LOCK_UN)

    def lookup(self, kind, identity):
        fields = 'id url description project{id}' if kind == 'issues' else 'id body issue{id}'
        result = self.linear('query($id:ID!){' + kind + '(filter:{id:{eq:$id}},first:2,includeArchived:true){nodes{' + fields + '} pageInfo{hasNextPage}}}', {'id': identity})
        connection = result.get(kind)
        if not isinstance(connection, dict) or not isinstance(connection.get('nodes'), list) or connection.get('pageInfo', {}).get('hasNextPage') is not False or len(connection['nodes']) > 1:
            raise Held('remote_identity_lookup_incomplete')
        return connection['nodes'][0] if connection['nodes'] else None

    def verified_project(self):
        c = self.config
        if not all(c.get(k) for k in ('projectId', 'teamId', 'backlogId')):
            raise Held('verified_backlog_configuration_required')
        result = self.linear('query($p:String!,$s:String!){project(id:$p){id slugId teams{nodes{id}}} workflowState(id:$s){id type team{id}}}', {'p': c['projectId'], 's': c['backlogId']})
        p, s = result.get('project') or {}, result.get('workflowState') or {}
        if (p.get('id') != c['projectId'] or p.get('slugId') != PROJECT_SLUG.rsplit('-', 1)[-1] or
            c['teamId'] not in [t.get('id') for t in p.get('teams', {}).get('nodes', [])] or
            s.get('id') != c['backlogId'] or s.get('type') != 'backlog' or s.get('team', {}).get('id') != c['teamId']):
            raise Held('verified_backlog_configuration_required')

    def drain(self, limit=20):
        fcntl.flock(self.lock, fcntl.LOCK_EX)
        try:
            rows = self.db.execute("SELECT id FROM feedback WHERE status='received' AND next_retry<=? ORDER BY rowid LIMIT ?", (self.clock(), min(100, max(0, limit)))).fetchall()
            for row in rows:
                self.process(row['id'])
            return {'processed': len(rows), 'taskLinked': self.db.execute("SELECT count(*) FROM feedback WHERE status='task-linked'").fetchone()[0]}
        finally:
            fcntl.flock(self.lock, fcntl.LOCK_UN)

    def process(self, identity):
        if not (self.config.get('enabled') and self.config.get('propose') and self.config.get('approvedBy')):
            return
        row = self.db.execute('SELECT * FROM feedback WHERE id=?', (identity,)).fetchone()
        if row['status'] == 'task-linked' or self.clock() < row['next_retry']:
            return
        e = json.loads(row['envelope'])
        try:
            self.verify_comment(e)
            self.verified_project()
            prior = self.db.execute('SELECT * FROM groups WHERE group_key=?', (row['group_key'],)).fetchone()
            mapped = self.config.get('activeTasks', {}).get(str(e['number']))
            issue_id = prior['issue_id'] if prior else mapped or str(uuid.uuid4())
            # Persist stable client-supplied issue identity BEFORE a potentially ambiguous create.
            self.db.execute('INSERT OR IGNORE INTO groups VALUES(?,?,NULL)', (row['group_key'], issue_id))
            self.db.commit()
            issue = self.lookup('issues', issue_id)
            marker = 'hbl-governance-group:' + row['group_key']
            if not issue:
                if mapped:
                    raise Held('existing_task_mapping_unverified')
                description = f'Proposed community feedback; requires ordinary human triage.\n\n{e["text"]}\n\nSource: {e["commentUrl"]}\n\n{marker}'
                issue = self.linear('mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id url description project{id}}}}', {'input': {'id': issue_id, 'teamId': self.config['teamId'], 'projectId': self.config['projectId'], 'stateId': self.config['backlogId'], 'title': f'Community proposal for PR #{e["number"]}', 'description': description}}).get('issueCreate', {}).get('issue')
            if (not issue or issue.get('id') != issue_id or issue.get('project', {}).get('id') != self.config['projectId'] or
                (not mapped and marker not in (issue.get('description') or '')) or
                not re.fullmatch(r'https://linear\.app/[A-Za-z0-9/_-]+', issue.get('url', ''))):
                raise Held('task_identity_unverified')
            comment_id = row['comment_uuid']
            existing = self.lookup('comments', comment_id)
            body = f'Community feedback (data for human triage):\n\n{e["text"]}\n\nSource: {e["commentUrl"]}\n\nhbl-governance-feedback:{identity}'
            if existing:
                if existing.get('issue', {}).get('id') != issue_id or existing.get('body') != body:
                    raise Held('comment_identity_unverified')
            else:
                created = self.linear('mutation($input:CommentCreateInput!){commentCreate(input:$input){success comment{id body issue{id}}}}', {'input': {'id': comment_id, 'issueId': issue_id, 'body': body}}).get('commentCreate', {}).get('comment')
                if not created or created.get('id') != comment_id or created.get('body') != body or created.get('issue', {}).get('id') != issue_id:
                    raise Held('comment_identity_unverified')
            self.db.execute('UPDATE groups SET task_url=? WHERE group_key=?', (issue['url'], row['group_key']))
            self.db.execute("UPDATE feedback SET status='task-linked',task_url=?,holding=NULL WHERE id=?", (issue['url'], identity))
            self.db.execute('INSERT OR REPLACE INTO cursors VALUES(?,?)', ('last_linked', identity))
        except Exception as error:
            code = str(error) if isinstance(error, Held) else 'intake_delivery_unavailable'
            attempts = row['attempts'] + 1
            self.db.execute('UPDATE feedback SET holding=?,attempts=?,next_retry=? WHERE id=?', (code, attempts, self.clock() + min(3600, 30 * 2 ** min(attempts, 7)), identity))
        self.db.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', default=str(Path.home() / '.local/state/hbl-publisher/governance-intake'))
    parser.add_argument('--port', type=int, default=8769)
    parser.add_argument('--drain', action='store_true', help='One host-only retry cycle; no server or scheduler installed')
    args = parser.parse_args()
    intake = Intake(args.state)
    if not intake.config.get('enabled'):
        raise Held('intake_disabled')
    if args.drain:
        try:
            print(json.dumps(intake.drain()))
        finally:
            intake.close()
        return
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Neither headers, URLs nor public text enter host logs.
        def do_POST(self):
            self.connection.settimeout(20)
            try:
                length = int(self.headers.get('Content-Length', '-1'))
                if self.path != '/feedback' or not 0 <= length <= 65536:
                    raise Held('invalid_request')
                body = self.rfile.read(length)
                receipt = intake.receive(body, self.headers.get('X-HBL-Timestamp'), self.headers.get('X-HBL-Signature'))
                payload, status = json.dumps(receipt).encode(), 200
            except Exception as error:
                payload, status = json.dumps({'error': str(error) if isinstance(error, Held) else 'intake_unavailable'}).encode(), 503
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
    server = HTTPServer(('127.0.0.1', args.port), Handler)
    server.socket.settimeout(30)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        intake.close()

if __name__ == '__main__':
    try:
        main()
    except Held as error:
        raise SystemExit(str(error)) from None
