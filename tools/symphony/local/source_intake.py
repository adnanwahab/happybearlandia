"""Durable GitHub source intake for the existing Symphony coordinator.

No agent launch, label grant, merge, deployment or shell-from-issue execution.
Remote mutations are explicit trusted-host adapter operations, disabled by default.
"""
from contextlib import contextmanager
import hashlib
import fcntl
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid
from urllib.parse import urlparse

from repository_routes import ALLOWLIST

STATES = {'queued', 'waiting', 'needs_clarification', 'implementing', 'pr_opened',
          'already_implemented', 'duplicate', 'infeasible', 'closed'}
RETRY_LIMIT = 3

def source_key(repository_id, issue_id):
    if type(repository_id) is not int or repository_id <= 0 or type(issue_id) is not int or issue_id <= 0:
        raise ValueError('Immutable numeric repository and issue IDs required')
    return f'github:{repository_id}:{issue_id}'

def clean(text):
    text = re.sub(r'(?:/Users/|/home/|/private/|/tmp/)[^\s<>]+', '[private path]', str(text))
    text = re.sub(r'(?i)(?:gh[pousr]_[a-z0-9_]+|github_pat_[a-z0-9_]+|sk-[a-z0-9_-]+|bearer\s+\S+)', '[redacted]', text)
    return text[:3000]

def public_link(value):
    parsed = urlparse(value or '')
    return value if parsed.scheme == 'https' and parsed.hostname in {'github.com', 'linear.app'} and not parsed.username and not parsed.password else None

class Store:
    def __init__(self, path):
        path = Path(path)
        if path.is_symlink() or path.parent.is_symlink():
            raise ValueError('Source state cannot be a symlink')
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if info.st_uid != os.getuid() or info.st_nlink != 1:
                raise ValueError('Source state must be host-owned')
            os.fchmod(fd, 0o600)
        finally:
            os.close(fd)
        self.path = path
        self.db = sqlite3.connect(str(path), timeout=10, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=DELETE')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS sources (
          key TEXT PRIMARY KEY, repo_id INTEGER, issue_id INTEGER, repository TEXT, number INTEGER,
          revision TEXT, updated TEXT, title TEXT, url TEXT, state TEXT, reason TEXT, next_action TEXT,
          received REAL, request TEXT, attempted REAL, retry_at REAL DEFAULT 0, attempts INTEGER DEFAULT 0,
          linear_id TEXT, linear_url TEXT, prs TEXT DEFAULT '[]', comment_id INTEGER, comment_url TEXT,
          owner TEXT, lease_until REAL DEFAULT 0, lease_revision TEXT, scope TEXT DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, digest TEXT, received REAL);
        CREATE TABLE IF NOT EXISTS scans (repository TEXT PRIMARY KEY, checkpoint TEXT, completed REAL, error TEXT);
        CREATE TABLE IF NOT EXISTS outbox (source TEXT PRIMARY KEY REFERENCES sources(key), nonce TEXT,
          body TEXT, digest TEXT, delivered_digest TEXT, status TEXT, attempts INTEGER DEFAULT 0,
          retry_at REAL DEFAULT 0, error TEXT, bot_id INTEGER, create_started INTEGER DEFAULT 0);
        ''')

    @contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def upsert(self, repository, repo_id, issue, now=None):
        now = time.time() if now is None else now
        if repository not in ALLOWLIST or 'pull_request' in issue:
            return None
        key = source_key(repo_id, issue['id'])
        if issue.get('state') not in {'open','closed'}:
            raise ValueError('Invalid source state')
        number = issue.get('number')
        expected = f'https://github.com/{repository}/issues/{number}'
        if type(number) is not int or number <= 0 or issue.get('html_url') != expected or not isinstance(issue.get('updated_at'), str):
            raise ValueError('Invalid source issue identity')
        body = {k: issue.get(k) for k in ('title', 'body', 'updated_at', 'state', 'labels', 'assignees')}
        revision = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        old = self.db.execute('SELECT * FROM sources WHERE key=?', (key,)).fetchone()
        if old and (old['repository'] != repository or old['number'] != number):
            raise ValueError('Source immutable identity changed')
        if old and old['updated'] > issue['updated_at']:
            return key  # Late webhook cannot roll a newer scan back.
        changed = not old or old['revision'] != revision
        state = 'closed' if issue.get('state') == 'closed' else 'queued'
        if old and changed and old['owner'] and state != 'closed':
            state = 'waiting'  # Preserve ownership until host reconciles the edit.
        self.db.execute('''INSERT INTO sources
          (key,repo_id,issue_id,repository,number,revision,updated,title,url,state,reason,next_action,received,request)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
          revision=excluded.revision,updated=excluded.updated,title=excluded.title,request=excluded.request,
          state=CASE WHEN sources.revision=excluded.revision THEN sources.state ELSE excluded.state END,
          reason=CASE WHEN sources.revision=excluded.revision THEN sources.reason ELSE excluded.reason END,
          next_action=CASE WHEN sources.revision=excluded.revision THEN sources.next_action ELSE excluded.next_action END,
          attempts=CASE WHEN sources.revision=excluded.revision THEN sources.attempts ELSE 0 END,
          retry_at=CASE WHEN sources.revision=excluded.revision THEN sources.retry_at ELSE 0 END''',
          (key,repo_id,issue['id'],repository,number,revision,issue['updated_at'],issue.get('title','')[:500],expected,state,
           'Host readiness, assignment and resource review pending' if state != 'closed' else 'Source issue closed',
           'Reconcile current revision through the existing coordinator' if state != 'closed' else 'Retain prior work; do not dispatch',now,(issue.get('body') or '')[:16000]))
        return key

    def webhook(self, body, delivery, signature, secret, event='issues', now=None):
        if not secret or len(body) > 2_000_000 or not re.fullmatch(r'[A-Za-z0-9-]{1,100}', delivery or ''):
            raise ValueError('Invalid delivery envelope')
        expected = 'sha256=' + hmac.new(secret, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature or ''):
            raise ValueError('Invalid webhook signature')
        payload = json.loads(body)
        if event != 'issues' or payload.get('action') not in {'opened','edited','closed','reopened','labeled','unlabeled','assigned','unassigned'}:
            return 'ignored'
        repo = payload['repository']
        if repo['full_name'] not in ALLOWLIST:
            raise ValueError('Webhook repository outside allowlist')
        digest = hashlib.sha256(body).hexdigest()
        with self.transaction():
            existing = self.db.execute('SELECT digest FROM deliveries WHERE id=?', (delivery,)).fetchone()
            if existing:
                if existing['digest'] != digest:
                    raise ValueError('Delivery ID reused with different content')
                return 'duplicate'
            self.upsert(repo['full_name'], repo['id'], payload['issue'], now)
            self.db.execute('INSERT INTO deliveries VALUES(?,?,?)', (delivery,digest,now or time.time()))
        return 'recorded'

    def transition(self, key, state, reason, next_action, now=None, retry=False, evidence=None, alternative=None):
        if state not in STATES:
            raise ValueError('Unsupported source disposition')
        if state in {'infeasible','already_implemented','duplicate'} and not public_link(evidence):
            raise ValueError('Evidence link required for resolved or infeasible assessment')
        if state == 'infeasible' and not alternative:
            raise ValueError('Infeasibility requires a feasible alternative, not an automatic closure')
        row = self.db.execute('SELECT * FROM sources WHERE key=?',(key,)).fetchone()
        if not row:
            raise ValueError('Unknown source')
        attempts = row['attempts'] + int(retry)
        retry_at = (now or time.time()) + min(300 * 2 ** max(0,attempts-1),3600) if retry and attempts < RETRY_LIMIT else 0
        message = clean(reason) + (f' Evidence: {evidence}' if evidence else '') + (f' Feasible alternative: {clean(alternative)}' if alternative else '')
        if retry and attempts >= RETRY_LIMIT:
            next_action = 'Retry budget exhausted; operator must resolve the condition and explicitly resume'
        self.db.execute('UPDATE sources SET state=?,reason=?,next_action=?,attempted=?,attempts=?,retry_at=? WHERE key=?',
                        (state,message,clean(next_action),now or time.time(),attempts,retry_at,key))

    def claim(self, key, owner, revision, files, now, budget_seconds=600):
        from backlog_coordinator import safe_paths, overlaps
        if not owner or not safe_paths(files) or type(budget_seconds) is not int or not 1 <= budget_seconds <= 3600:
            raise ValueError('Bounded owner and exact safe scope required')
        with self.transaction():
            row = self.db.execute('SELECT * FROM sources WHERE key=?',(key,)).fetchone()
            if not row or row['revision'] != revision or row['state'] not in {'queued','waiting'} or row['attempts'] >= RETRY_LIMIT or row['retry_at'] > now:
                return False
            # Expiry does not prove the previous process stopped. Operator reconciliation
            # must release ownership explicitly before another implementation can run.
            if row['owner']:
                return False
            for other in self.db.execute('SELECT * FROM sources WHERE owner IS NOT NULL AND repository=?',(row['repository'],)):
                if overlaps(files,json.loads(other['scope'])):
                    return False
            self.db.execute('UPDATE sources SET owner=?,lease_until=?,lease_revision=?,scope=?,state=? WHERE key=?',
                            (owner,now+budget_seconds,revision,json.dumps(files),'implementing',key))
            return True

    def reconcile_owner(self, key, owner, revision, stopped=False):
        if stopped is not True:
            raise ValueError('Expired clock is not evidence of a stopped worker')
        self.db.execute('UPDATE sources SET owner=NULL,lease_until=0,scope=? WHERE key=? AND owner=? AND lease_revision=?',('[]',key,owner,revision))

    def candidates(self, now):
        rows = list(self.db.execute("SELECT * FROM sources WHERE state IN ('queued','waiting') AND owner IS NULL AND attempts<? AND retry_at<=? ORDER BY received,key",(RETRY_LIMIT,now)))
        # Round-robin across repositories, oldest first. Votes never exclude a task.
        queues = {repo:[dict(r) for r in rows if r['repository']==repo] for repo in ALLOWLIST}
        result=[]
        while any(queues.values()):
            for repo in sorted(queues, key=lambda name: queues[name][0]['received'] if queues[name] else float('inf')):
                if queues[repo]: result.append(queues[repo].pop(0))
        return result

    def public_rows(self, repository=None):
        if repository is not None and repository not in ALLOWLIST:
            raise ValueError('Unknown public repository')
        rows = self.db.execute('SELECT * FROM sources' + (' WHERE repository=?' if repository else '') + ' ORDER BY repository,number', (repository,) if repository else ())
        return [{'provider':'github','repositoryId':r['repo_id'],'repository':r['repository'],'issueId':r['issue_id'],
                 'number':r['number'],'sourceKey':r['key'],'revision':r['revision'],'url':r['url'],'title':clean(r['title']),
                 'state':r['state'],'blockingReason':r['reason'],'lastAttempt':r['attempted'],'nextAction':r['next_action'],
                 'nextRetry':r['retry_at'] or None,'linearTicket':public_link(r['linear_url']),
                 'pullRequests':json.loads(r['prs']),'statusCommentUrl':public_link(r['comment_url']),
                 'delivery':dict(self.db.execute('SELECT status,attempts,retry_at,error FROM outbox WHERE source=?',(r['key'],)).fetchone() or {})} for r in rows]


def scan(services, store, now=None):
    """A full page receipt is durable per repo. Partial scans never close missing rows."""
    report=[]
    for repository in sorted(ALLOWLIST):
        try:
            repo = services.github(f'repos/{repository}')
            if repo.get('full_name') != repository:
                raise ValueError('Repository lookup mismatch')
            issues = services.github_pages(f'repos/{repository}/issues?state=open&per_page=100')
            prs = services.github_pages(f'repos/{repository}/pulls?state=all&per_page=100')
            with store.transaction():
                keys=[]
                for issue in issues:
                    key=store.upsert(repository,repo['id'],issue,now)
                    if key: keys.append(key)
                store.db.execute('INSERT OR REPLACE INTO scans VALUES(?,?,?,?)',(repository,json.dumps(keys),now or time.time(),None))
                for row in store.db.execute('SELECT * FROM sources WHERE repository=?',(repository,)).fetchall():
                    # An omitted source requires its own verified closed receipt;
                    # pagination omission or API failure is never a completion.
                    if row['key'] not in keys:
                        current=services.github(f'repos/{repository}/issues/{row["number"]}')
                        store.upsert(repository,repo['id'],current,now)
                    matched=[p for p in prs if any(link.get('url')==row['url'] for link in p.get('_sourceIssues',[])) or
                        re.search(r'(?im)^Symphony source: '+re.escape(row['url'])+r'\s*$',p.get('body') or '') or
                        re.search(r'(?i)\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+(?:'+re.escape(row['url'])+'|'+re.escape(repository)+r'#'+str(row['number'])+r'|#'+str(row['number'])+r')(?![0-9])',p.get('body') or '')]
                    if matched:
                        valid=[p for p in matched if (p.get('base',{}).get('repo') or {}).get('full_name')==repository]
                        links=[{'url':p['html_url'],'headSha':p['head']['sha'],'state':'merged' if p.get('merged_at') else p['state'],'draft':bool(p.get('draft'))} for p in valid]
                        store.db.execute('UPDATE sources SET prs=? WHERE key=?',(json.dumps(links),row['key']))
                        # Existing PRs hold admission even if verification is incomplete.
                        if valid and store.db.execute('SELECT state FROM sources WHERE key=?',(row['key'],)).fetchone()[0] != 'closed':
                            store.transition(row['key'],'pr_opened','Existing linked PR requires review; opening is not completion','Reconcile exact branch, base, head and test receipt',now)
            report.append({'repository':repository,'repositoryId':repo['id'],'openIssues':len(keys),'complete':True})
        except Exception:
            store.db.execute('INSERT OR REPLACE INTO scans VALUES(?,?,?,?)',(repository,None,None,'Scan incomplete; check GitHub authentication, rate limits and connectivity'))
            report.append({'repository':repository,'complete':False,'error':'Scan incomplete; no dispatch from this repository'})
    return report


def queue_status(store, key):
    row=store.db.execute('SELECT * FROM sources WHERE key=?',(key,)).fetchone()
    if not row: raise ValueError('Unknown source')
    old=store.db.execute('SELECT * FROM outbox WHERE source=?',(key,)).fetchone()
    nonce=old['nonce'] if old else str(uuid.uuid4())
    body=(f'Symphony status: {row["state"]}\nRepository and issue: {row["url"]}\n'
          f'Last evaluated revision: {row["revision"]}\nWhat I attempted: intake and trusted-host reconciliation\n'
          f'Evidence / blocking reason: {row["reason"]}\nWhat would unblock this / next action: {row["next_action"]}\n'
          f'Linked work: {row["linear_url"] or "none"}\nPRs: '+', '.join(p['url'] for p in json.loads(row['prs']))+
          f'\n\n<!-- symphony-source:{nonce} -->')
    digest=hashlib.sha256(body.encode()).hexdigest()
    status='posted' if old and old['delivered_digest']==digest else 'queued'
    store.db.execute('''INSERT INTO outbox(source,nonce,body,digest,status) VALUES(?,?,?,?,?) ON CONFLICT(source)
      DO UPDATE SET body=excluded.body,digest=excluded.digest,status=excluded.status,
      attempts=CASE WHEN outbox.digest=excluded.digest THEN outbox.attempts ELSE 0 END,
      retry_at=CASE WHEN outbox.digest=excluded.digest THEN outbox.retry_at ELSE 0 END''',(key,nonce,body,digest,status))


def deliver_status(services, store, key, now, enabled=False):
    # Host lock survives DB commits: creation intent is fsynced BEFORE sending.
    # A hard process exit cannot roll its nonce/create-started evidence back.
    lock = store.path.with_name(store.path.name + '.status.lock')
    fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        return _deliver_status(services, store, key, now, enabled)
    finally:
        os.close(fd)


def _deliver_status(services, store, key, now, enabled=False):
    if enabled is not True: raise ValueError('Public status posting is not enabled')
    # The host file lock excludes duplicate coordinators. Creation intent is
    # already durable before a request; recover ambiguity by reading receipts.
    row=store.db.execute('SELECT * FROM sources WHERE key=?',(key,)).fetchone()
    intent=store.db.execute('SELECT * FROM outbox WHERE source=?',(key,)).fetchone()
    if not intent or intent['status']=='posted' or intent['attempts']>=RETRY_LIMIT or intent['retry_at']>now:
        return False
    store.db.execute('UPDATE outbox SET attempts=attempts+1 WHERE source=?',(key,))
    try:
        actor=services.github('user')
        if type(actor.get('id')) is not int: raise ValueError('Missing bot identity')
        if intent['bot_id'] is not None and intent['bot_id']!=actor['id']: raise ValueError('Status bot identity changed')
        store.db.execute('UPDATE outbox SET bot_id=? WHERE source=?',(actor['id'],key))
        endpoint=f'repos/{row["repository"]}/issues/{row["number"]}/comments'
        comments=services.github_pages(endpoint+'?per_page=100')
        matches=[c for c in comments if c.get('user',{}).get('id')==actor['id'] and f'<!-- symphony-source:{intent["nonce"]} -->' in c.get('body','')]
        if row['comment_id']:
            matches=[c for c in comments if c.get('id')==row['comment_id'] and c.get('user',{}).get('id')==actor['id'] and f'<!-- symphony-source:{intent["nonce"]} -->' in c.get('body','')]
            if len(matches)!=1: raise ValueError('Stored bot comment no longer verifies')
        if len(matches)>1: raise ValueError('Ambiguous bot comment identity')
        if matches:
            receipt=matches[0]
            if receipt.get('body')!=intent['body']:
                receipt=services.github_write(f'repos/{row["repository"]}/issues/comments/{receipt["id"]}',{'body':intent['body']},'PATCH')
        else:
            if intent['create_started']:
                raise ValueError('Prior create outcome unknown; do not create without recovered receipt')
            store.db.execute('UPDATE outbox SET create_started=1 WHERE source=?',(key,))
            receipt=services.github_write(endpoint,{'body':intent['body']},'POST')
        if receipt.get('user',{}).get('id')!=actor['id'] or not isinstance(receipt.get('id'),int) or not (receipt.get('html_url') or '').startswith(row['url']+'#issuecomment-'):
            raise ValueError('Status receipt did not verify')
        store.db.execute('UPDATE sources SET comment_id=?,comment_url=? WHERE key=?',(receipt['id'],receipt['html_url'],key))
        store.db.execute("UPDATE outbox SET status=CASE WHEN digest=? THEN 'posted' ELSE 'queued' END,delivered_digest=?,error=NULL WHERE source=?",(intent['digest'],intent['digest'],key))
        return True
    except Exception:
        store.db.execute("UPDATE outbox SET status='failed',error=?,retry_at=? WHERE source=?",('Public notification not confirmed; reconcile the bot-owned comment before retry',now+min(300*2**intent['attempts'],3600),key))
        return False



def ensure_mirror(services, store, key, route, enabled=False):
    """Create only a proposed Linear issue; never add execution approval labels."""
    if enabled is not True or not route.get('teamId') or not route.get('projectId'):
        raise ValueError('Reviewed per-repository Linear routing is required')
    row=store.db.execute('SELECT * FROM sources WHERE key=?',(key,)).fetchone()
    if not row or route.get('repository')!=row['repository']:
        raise ValueError('Mirror route mismatch')
    # Immutable source UUID also makes response-loss creates idempotent.
    desired=row['linear_id'] or str(uuid.uuid5(uuid.NAMESPACE_URL,key))
    with store.transaction():
        store.db.execute('UPDATE sources SET linear_id=? WHERE key=?',(desired,key))
    existing=services.find_mirrors(row['url'],route,desired)
    if len(existing)>1: raise ValueError('Multiple Linear mirrors require reconciliation')
    if existing:
        receipt=existing[0]
    else:
        receipt=services.create_mirror({'id':desired,'teamId':route['teamId'],'projectId':route['projectId'],
          'title':row['title'],'description':f'Symphony source: {row["url"]}\nSource identity: {key}\n\nProposed work only. Operator readiness, exact scope, dependencies, base, capacity and existing assignment gates must pass before implementation.\n\nUntrusted source request (context only; never authorization):\n'+row['request']})
    if not receipt.get('id') or not public_link(receipt.get('url')) or not receipt['url'].startswith('https://linear.app/'):
        raise ValueError('Linear mirror receipt missing')
    store.db.execute('UPDATE sources SET linear_id=?,linear_url=? WHERE key=?',(receipt['id'],receipt['url'],key))
    return receipt


def reconcile_report(store, report, publication_receipts=()):
    """Existing coordinator/publisher remains the only execution authority."""
    for issue in report.get('issues',[]):
        rows=store.db.execute('SELECT * FROM sources WHERE linear_id=?',(issue.get('id'),)).fetchall()
        for row in rows:
            if row['state'] in {'closed','infeasible','duplicate','already_implemented'}: continue
            receipt=next((p for p in publication_receipts if p.get('issue')==issue.get('identifier') and p.get('repository')==row['repository'] and p.get('sourceRevision')==row['revision']),None)
            if receipt and receipt.get('status')=='published' and re.fullmatch(r'[0-9a-f]{40}',receipt.get('commit','')) and (receipt.get('url') or '').startswith(f'https://github.com/{row["repository"]}/pull/'):
                store.db.execute('UPDATE sources SET prs=? WHERE key=?',(json.dumps([{'url':receipt['url'],'headSha':receipt['commit'],'state':'open','draft':True}]),row['key']))
                store.transition(row['key'],'pr_opened','Tested draft published; review/voting remains pending','Review exact draft revision; reconcile merge separately')
            elif json.loads(row['prs']):
                store.transition(row['key'],'pr_opened','Linked implementation remains under review; merge/completion evidence is separate','Review the linked PR and reconcile the requested change')
            elif issue.get('reasons'):
                store.transition(row['key'],'waiting','; '.join(clean(r) for r in issue['reasons']),'Resolve the stated readiness condition and rerun the existing coordinator')
            elif issue.get('state') in {'In Progress','Rework'}:
                store.transition(row['key'],'implementing','Existing coordinator owns the implementation','Await tested source handoff through the trusted publisher')
            else:
                store.transition(row['key'],'queued','Readiness audit complete; capacity/approval pending','Use existing reviewed assignment admission; votes are not a prerequisite')


def run_inventory(services, output=None):
    """Read-only remote audit; temporary local state is discarded, no mutation API."""
    import tempfile
    with tempfile.TemporaryDirectory(prefix='symphony-source-audit-') as directory:
        store=Store(Path(directory)/'audit.sqlite')
        try:
            scans=scan(services,store)
            result={'version':1,'mode':'read-only','repositories':scans,'issues':store.public_rows(),
                    'livePilotExecuted':False,'executionEnabled':False}
        finally: store.db.close()
    if output:
        from backlog_coordinator import atomic
        atomic(Path(output),result)
    return result


def delivery_due(store, key, now):
    intent=store.db.execute('SELECT status,attempts,retry_at FROM outbox WHERE source=?',(key,)).fetchone()
    return bool(intent and intent['status']!='posted' and intent['attempts']<RETRY_LIMIT and intent['retry_at']<=now)


def tick(services, directory, policy, coordinator_report, apply=False, now=None):
    """Called by the existing scheduler under its host lock, never a dispatcher."""
    now=time.time() if now is None else now
    if policy.get('enabled') is not True:
        return {'enabled':False}
    budget=policy.get('maxOperations',1)
    pilots=policy.get('pilotSources',[])
    if type(budget) is not int or not 1 <= budget <= 3 or not isinstance(pilots,list) or len(pilots)>3:
        raise ValueError('A bounded explicit source pilot is required')
    store=Store(Path(directory)/'source-intake.sqlite')
    try:
        scans=scan(services,store,now)
        reconcile_report(store,coordinator_report,coordinator_report.get('publication_receipts',[]))
        complete={s['repository'] for s in scans if s['complete']}
        # Intake is always considered across all repositories. Remote writes are
        # restricted to separately enabled immutable pilot IDs, at most3 per tick.
        operations=0
        for row in store.candidates(now):
            if operations>=budget: break
            if not apply or row['key'] not in pilots or row['repository'] not in complete: continue
            route=policy.get('repositories',{}).get(row['repository'],{})
            try:
                if not row['linear_url'] and policy.get('enableMirrors') is True:
                    ensure_mirror(services,store,row['key'],route,True)
                    operations+=1
                if operations<budget and policy.get('enableStatusDelivery') is True:
                    queue_status(store,row['key'])
                    if delivery_due(store,row['key'],now):
                        deliver_status(services,store,row['key'],now,True)
                        operations+=1
            except Exception:
                store.transition(row['key'],'waiting','Source integration receipt unavailable; no execution inferred','Correct the integration condition and explicitly resume after the bounded retry budget',now,retry=True)
        # Failed/implementing/PR rows also need status delivery, not only queued rows.
        for row in store.public_rows():
            queue_status(store,row['sourceKey'])
            if apply and operations<budget and row['sourceKey'] in pilots and row['repository'] in complete and policy.get('enableStatusDelivery') is True and delivery_due(store,row['sourceKey'],now):
                deliver_status(services,store,row['sourceKey'],now,True)
                operations+=1
        result={'version':1,'enabled':True,'repositories':scans,'issues':store.public_rows(),
                'operations':operations,'livePilotExecuted':False,'at':now}
        from backlog_coordinator import atomic
        atomic(Path(directory)/'source-status.json',result)
        return result
    finally:
        store.db.close()


def fair_order(rows, issues, cursor):
    """Rotate eligible repositories using durable admission history, then oldest first."""
    by_id={issue['id']:issue for issue in issues}
    groups={repo:[] for repo in sorted(ALLOWLIST)}
    for row in rows:
        repo=by_id[row['id']].get('_repository','adnanwahab/happybearlandia')
        groups[repo].append(row)
    for group in groups.values():
        group.sort(key=lambda row:(by_id[row['id']].get('createdAt') or by_id[row['id']].get('updatedAt') or '',row['id']))
    repos=sorted(groups); offset=cursor%len(repos);repos=repos[offset:]+repos[:offset]
    ordered=[]
    while any(groups.values()):
        for repo in repos:
            if groups[repo]:ordered.append(groups[repo].pop(0))
    return ordered
