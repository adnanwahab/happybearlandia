"""Transactional local proposal inbox, not an experiment store or dispatcher."""
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import stat
import time
from urllib.parse import quote
from .proposal import InvalidProposal, canonical, digest, proposal_id, require, validate_batch
from .coordinator import project, validate_report

DDL = '''
CREATE TABLE proposals(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE proposal_keys(proposal_id TEXT NOT NULL REFERENCES proposals(id), key TEXT NOT NULL,
 PRIMARY KEY(proposal_id,key));
CREATE TABLE streams(id TEXT PRIMARY KEY, cursor TEXT NOT NULL);
CREATE TABLE receipts(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
CREATE TABLE budgets(day TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count>=0));
PRAGMA user_version=1;
'''


def saved_receipt(raw, batch):
    try:
        saved = json.loads(raw)
    except (ValueError, TypeError, RecursionError):
        raise InvalidProposal('corrupt intake receipt; preserve and reconcile') from None
    fields = set('schemaVersion dryRun replayed stream cursorBefore cursorAfter newProposals recordedProposals duplicates proposals budget'.split())
    require(isinstance(saved, dict) and set(saved) == fields and saved['schemaVersion'] == 'improvement-intake-report.v1' and
            saved['dryRun'] is False and saved['replayed'] is False and
            all(saved[k] == batch[k] for k in ('stream', 'cursorBefore', 'cursorAfter')),
            'corrupt intake receipt; preserve and reconcile')
    require(all(type(saved[k]) is int and saved[k] >= 0 for k in ('newProposals', 'recordedProposals', 'duplicates')) and
            saved['recordedProposals'] == saved['newProposals'] and
            saved['newProposals'] + saved['duplicates'] == len(batch['proposals']) and
            isinstance(saved['proposals'], list) and len(saved['proposals']) == len(batch['proposals']) and
            isinstance(saved['budget'], dict) and set(saved['budget']) == {'dayUTC', 'limit', 'remainingAfterPlan'},
            'corrupt intake receipt; preserve and reconcile')
    for row, proposal in zip(saved['proposals'], batch['proposals']):
        require(isinstance(row, dict) and row.get('id') == proposal_id(proposal) and
                row.get('executionApproved') is False and row.get('evidenceStatus') == 'NOT_EVALUATED' and
                row.get('trackingLabel') == 'hbl-symphony-queue', 'corrupt intake receipt; preserve and reconcile')
    return saved


def private_file(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and info.st_nlink == 1 and
            not info.st_mode & 0o077, 'state must be a private host-owned regular file')


def related_ids(db, proposal, identity):
    related = {r[0] for key in proposal['deduplicationKeys'] for r in db.execute(
        'SELECT proposal_id FROM proposal_keys WHERE key=? AND proposal_id<>?', (key, identity))}
    require(all(isinstance(item, str) and re.fullmatch(r'[0-9a-f]{64}', item) for item in related),
            'corrupt proposal relation; preserve and reconcile')
    return related


@contextmanager
def database(directory, record):
    directory = Path(directory)
    path = directory / 'proposals.sqlite'
    lock = None
    db = None
    try:
        if record:
            directory.mkdir(parents=True, mode=0o700, exist_ok=True)
        if directory.exists() or directory.is_symlink():
            info = directory.lstat()
            require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid() and not info.st_mode & 0o077,
                    'state directory must be private and host-owned')
        if record:
            lock = os.open(directory / 'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            private_file(directory / 'lock')
            for attempt in range(3):
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    require(attempt < 2, 'intake lock busy; bounded retries exhausted')
                    time.sleep(0.05 * (attempt + 1))
        if not path.exists() and not path.is_symlink():
            if not record:
                db = sqlite3.connect(':memory:')
            else:
                fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600)
                os.close(fd)
        if db is None:
            private_file(path)
            mode = 'rw' if record else 'ro'
            db = sqlite3.connect(f'file:{quote(str(path.resolve()))}?mode={mode}', uri=True, timeout=5)
        version = db.execute('PRAGMA user_version').fetchone()[0]
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if version == 0 and not tables:
            # A brand-new DB is initialized only in record mode or private memory.
            require(record or str(db.execute('PRAGMA database_list').fetchone()[2]) == '', 'unsupported empty state database')
            db.executescript(DDL)
        else:
            require(version == 1 and tables == {'proposals', 'proposal_keys', 'streams', 'receipts', 'budgets'},
                    'unsupported state schema; preserve and reconcile')
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE' if record else 'BEGIN')
        yield db
        if record:
            db.commit()
    except sqlite3.Error:
        raise InvalidProposal('state database unavailable or corrupt; preserve and reconcile') from None
    except OSError:
        raise InvalidProposal('private state unavailable; preserve and reconcile') from None
    finally:
        if db is not None:
            db.close()  # Uncommitted transactions roll back on every failure.
        if lock is not None:
            os.close(lock)


def ingest(batch, directory, *, coordinator_report=None, record=False, daily_limit=20, now=None):
    started = time.monotonic()
    now = time.time() if now is None else now
    require(type(record) is bool and type(now) in (int, float) and math.isfinite(now) and 0 <= now <= 253402300799,
            'invalid intake mode or clock')
    require(type(daily_limit) is int and 1 <= daily_limit <= 100, 'invalid daily intake budget')
    batch = validate_batch(batch)
    issues = validate_report(coordinator_report, now)
    receipt_id = digest({k: batch[k] for k in ('stream', 'cursorBefore', 'cursorAfter')})
    fingerprint = digest(batch)
    day = datetime.fromtimestamp(now, timezone.utc).date().isoformat()
    with database(directory, record) as db:
        used = db.execute('SELECT count FROM budgets WHERE day=?', (day,)).fetchone()
        used = used[0] if used else 0
        require(type(used) is int and 0 <= used <= 100, 'corrupt intake budget; preserve and reconcile')
        receipt = db.execute('SELECT fingerprint,result FROM receipts WHERE id=?', (receipt_id,)).fetchone()
        if receipt:
            require(receipt[0] == fingerprint, 'batch receipt conflicts with prior content')
            saved = saved_receipt(receipt[1], batch)
            rows = []
            for p in batch['proposals']:
                identity = proposal_id(p)
                related = related_ids(db, p, identity)
                rows.append({'id': identity, 'intake': 'DUPLICATE', **project(p, issues, related)})
            result = {**saved, 'dryRun': not record, 'replayed': True, 'newProposals': 0,
                      'recordedProposals': 0, 'duplicates': len(rows), 'proposals': rows}
        else:
            cursor = db.execute('SELECT cursor FROM streams WHERE id=?', (batch['stream'],)).fetchone()
            require((cursor[0] if cursor else None) == batch['cursorBefore'], 'source cursor mismatch; no advancement')
            rows, pending = [], {}
            for p in batch['proposals']:
                identity, payload_hash = proposal_id(p), digest(p)
                old = db.execute('SELECT fingerprint FROM proposals WHERE id=?', (identity,)).fetchone()
                old_hash = old[0] if old else pending.get(identity)
                require(old_hash is None or old_hash == payload_hash, 'proposal identity conflicts with prior content')
                related = related_ids(db, p, identity)
                for previous in rows:
                    if previous['id'] != identity and set(previous['_keys']) & set(p['deduplicationKeys']):
                        related.add(previous['id'])
                fresh = old_hash is None
                rows.append({'id': identity, 'intake': 'NEW' if fresh else 'DUPLICATE', '_keys': p['deduplicationKeys'],
                             **project(p, issues, related)})
                if fresh:
                    pending[identity] = payload_hash
                    if record:
                        db.execute('INSERT INTO proposals VALUES(?,?,?,?)', (identity, payload_hash, canonical(p), p['kind']))
                        db.executemany('INSERT INTO proposal_keys VALUES(?,?)', [(identity, k) for k in p['deduplicationKeys']])
            require(used + len(pending) <= daily_limit, 'daily intake budget exceeded; no advancement')
            for row in rows:
                row.pop('_keys')
            result = {'schemaVersion': 'improvement-intake-report.v1', 'dryRun': not record, 'replayed': False,
                      'stream': batch['stream'], 'cursorBefore': batch['cursorBefore'], 'cursorAfter': batch['cursorAfter'],
                      'newProposals': len(pending), 'recordedProposals': len(pending) if record else 0,
                      'duplicates': len(rows) - len(pending), 'proposals': rows,
                      'budget': {'dayUTC': day, 'limit': daily_limit, 'remainingAfterPlan': daily_limit - used - len(pending)}}
            if record:
                db.execute('INSERT INTO streams VALUES(?,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor',
                           (batch['stream'], batch['cursorAfter']))
                db.execute('INSERT INTO budgets VALUES(?,?) ON CONFLICT(day) DO UPDATE SET count=excluded.count', (day, used + len(pending)))
                db.execute('INSERT INTO receipts VALUES(?,?,?)', (receipt_id, fingerprint, canonical(result)))
        cursor = db.execute('SELECT cursor FROM streams WHERE id=?', (batch['stream'],)).fetchone()
        require(cursor is None or isinstance(cursor[0], str) and 0 < len(cursor[0]) <= 256,
                'corrupt stored cursor; preserve and reconcile')
        result['storedCursor'] = cursor[0] if cursor else None
        result['budget'] = {'dayUTC': day, 'limit': daily_limit,
                            'remainingAfterPlan': max(0, daily_limit - used - result['newProposals'])}
    result['held'] = sum(row['disposition'] == 'HELD' for row in result['proposals'])
    result['summary'] = f"{'LOCAL RECORD' if record else 'DRY RUN'}: {result['newProposals']} new, {result['duplicates']} duplicate, {result['held']} held; no remote writes or execution approval"
    result['operation'] = {'attempts': 1, 'networkRequests': 0, 'modelCalls': 0, 'remoteWrites': 0,
                           'maxLockAttempts': 3,
                           'scope': 'this local intake invocation', 'elapsedSeconds': time.monotonic() - started}
    return result
