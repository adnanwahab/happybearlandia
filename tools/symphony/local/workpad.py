#!/usr/bin/env python3
"""Trusted host workpad lifecycle; workspace input is data, never executable policy."""
from contextlib import contextmanager
import fcntl
import hashlib
import os
import stat
import tempfile
import json
import re
from pathlib import Path
import sys
import time
import uuid
import handoff
import publish as p

HEADER = '## Codex Workpad'
SECTION = '\n\n### Host Symphony status\n'
MAX_NOTES = 40000


def issue_data(issue):
    data = p.linear('''query($id:String!){issue(id:$id){id identifier state{id name}
      team{states{nodes{id name}}} labels{nodes{id name} pageInfo{hasNextPage}}}}''', {'id': issue})['issue']
    if (not data or data['identifier'] != issue or
        data['state']['name'] not in ('Todo', 'In Progress', 'Rework') or
        data['labels']['pageInfo']['hasNextPage']):
        raise p.PublicationError('Workpad: issue missing, inactive or labels incomplete; reconcile before retry')
    return data


def comments(issue_id):
    result, cursor, seen = [], None, set()
    while True:
        page = p.linear('''query($id:String!,$after:String){issue(id:$id){comments(first:100,after:$after){
          nodes{id body} pageInfo{hasNextPage endCursor}}}}''', {'id': issue_id, 'after': cursor})['issue']['comments']
        result.extend(x for x in page['nodes'] if x['body'].startswith(HEADER))
        if not page['pageInfo']['hasNextPage']:
            return result
        next_cursor = page['pageInfo']['endCursor']
        if not next_cursor or next_cursor in seen:
            raise p.PublicationError('Workpad: invalid comment pagination; retry after API recovery')
        seen.add(next_cursor)
        cursor = next_cursor


def success(query, variables, field):
    if not p.linear(query, variables)[field]['success']:
        raise p.PublicationError(f'Workpad: {field} rejected; check host permissions and retry')


def _private_directory(path):
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if os.fstat(fd).st_uid != os.getuid():
            raise p.PublicationError('Workpad: private state must belong to the host user')
        os.fchmod(fd, 0o700)
    finally:
        os.close(fd)


def _private_file(fd):
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
        raise p.PublicationError('Workpad: invalid private identity file; reconcile host state')
    os.fchmod(fd, 0o600)


@contextmanager
def _identity_lock(issue_id):
    # Separate from the publisher's outer identifier lock: ensure() also needs
    # serialization when called directly, without recursively acquiring flock.
    directory = p.STATE / 'workpad-identities'
    _private_directory(p.STATE)
    _private_directory(directory)
    key = hashlib.sha256(issue_id.encode('utf-8')).hexdigest()
    fd = os.open(directory / (key + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        _private_file(fd)
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield directory / (key + '.json')
    finally:
        os.close(fd)


def _creation_id(path, issue_id):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        fd = None
    if fd is not None:
        with os.fdopen(fd, 'r', encoding='utf-8') as stream:
            _private_file(stream.fileno())
            if os.fstat(stream.fileno()).st_size > 4096:
                raise p.PublicationError('Workpad: oversized persisted creation identity; reconcile host state')
            record = json.loads(stream.read(4096))
        try:
            value = record['commentId']
            parsed = uuid.UUID(value)
            valid = (record['schemaVersion'] == 1 and record['issueId'] == issue_id and
                     parsed.version == 4 and parsed.variant == uuid.RFC_4122 and str(parsed) == value)
        except (KeyError, TypeError, ValueError, AttributeError):
            valid = False
        if not valid:
            raise p.PublicationError('Workpad: invalid persisted creation identity; preserve state and reconcile')
        return value

    value = str(uuid.uuid4())
    record = dict(schemaVersion=1, issueId=issue_id, commentId=value)
    # No remote create is allowed until both the file and replacement directory
    # entry have been synced. A failed write never authorizes a new API call.
    fd, temporary = tempfile.mkstemp(prefix='.' + path.stem + '-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(record, stream, sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
    return value


def _one_workpad(issue_id):
    pads = comments(issue_id)
    if len(pads) > 1:
        raise p.PublicationError('Workpad: multiple existing workpads; preserve all and reconcile manually')
    return pads[0] if pads else None


def ensure(data):
    issue_id = data['id']
    if not isinstance(issue_id, str) or not issue_id or len(issue_id) > 256:
        raise p.PublicationError('Workpad: invalid issue identity')
    # Read complete live workpads first. Existing comments (including older IDs)
    # are authoritative; never replace one merely to upgrade the creation UUID.
    existing = _one_workpad(issue_id)
    if existing:
        return existing
    try:
        with _identity_lock(issue_id) as path:
            comment_id, last_error = None, None
            for attempt in range(3):
                existing = _one_workpad(issue_id)
                if existing:
                    return existing
                if comment_id is None:
                    comment_id = _creation_id(path, issue_id)
                last_error = None
                try:
                    # The bootstrap owns create retries so transport cannot
                    # blindly resend after an ambiguous mutation response.
                    result = p.linear('mutation($input:CommentCreateInput!){commentCreate(input:$input){success}}',
                                      {'input': {'id': comment_id, 'issueId': issue_id, 'body': HEADER +
                                       '\n\nHost initialized. Plan, ownership, acceptance and validation pending implementation preflight.'}},
                                      attempts=1)
                    if not result['commentCreate']['success']:
                        raise p.PublicationError('Workpad: commentCreate rejected; check host permissions and retry', retryable=False)
                except p.PublicationError as error:
                    last_error = error
                # A success, timeout or validation response can all be ambiguous
                # about visibility. Re-read before any subsequent mutation.
                existing = _one_workpad(issue_id)
                if existing:
                    return existing
                if last_error is not None and not last_error.retryable:
                    raise last_error
                if attempt < 2:
                    time.sleep(attempt + 1)
            if last_error is not None:
                raise last_error
            raise p.PublicationError('Workpad: created comment not visible; retry host initialization (same persisted UUIDv4)')
    except (OSError, ValueError):
        raise p.PublicationError('Workpad: private creation state unavailable or invalid; preserve host state and retry; no credentials logged') from None


def _archive_rejected_update(issue_id, raw):
    """Durably retain exact bytes before any remote rejection/parking mutation."""
    directory = p.STATE / 'rejected-workpads'
    _private_directory(p.STATE)
    _private_directory(directory)
    identity = hashlib.sha256(issue_id.encode('utf-8')).hexdigest()
    checksum = hashlib.sha256(raw).hexdigest()
    target = directory / f'{identity}-{checksum}.json'
    try:
        fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        fd = None
    if fd is not None:
        with os.fdopen(fd, 'rb') as stream:
            _private_file(stream.fileno())
            if stream.read() != raw:
                raise p.PublicationError('Workpad: rejected-update archive mismatch; preserve pending input and reconcile')
            os.fsync(stream.fileno())
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        return checksum
    fd, temporary = tempfile.mkstemp(prefix='.rejected-', suffix='.tmp', dir=directory)
    try:
        with os.fdopen(fd, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
    return checksum


def _reject_oversized_update(path, data, request, raw, notes, pilot):
    checksum = _archive_rejected_update(data['id'], raw)
    # Another operator may have replaced the handoff while archiving. Never
    # overwrite it or park an attempt based on an already superseded request.
    if request.read_bytes() != raw:
        raise p.PublicationError('Workpad: pending update changed during rejection; original archived, current input preserved; retry current state')
    if pilot:
        # Park before comment IO: even a comment API failure must not keep this
        # known-invalid input eligible for unattended Codex retries.
        success('mutation($id:String!,$label:String!){issueRemoveLabel(id:$id,labelId:$label){success}}',
                {'id': data['id'], 'label': pilot}, 'issueRemoveLabel')
    pad = ensure(data)
    p.archive_workpad(path.name, pad['body'])
    marker = f'\n\n### Host rejected workpad update `{checksum}`\n'
    receipt = (f'Blocked: pending notes contain {len(notes)} characters; limit is {MAX_NOTES}. '
               'Dispatch approval is absent. Full original JSON bytes are retained in the '
               f'host-private rejected-workpads archive (SHA256 `{checksum}`) and the pending file. '
               'No notes/history were truncated; implementation commits and publisher handoff '
               'are unchanged. Publication was not attempted. Inspect the archive and provide '
               'a bounded update before explicitly reapproving.')
    body = pad['body']
    if marker not in body:
        # Do not replace a previous evidence/status section to make room.
        body += marker + receipt
        success('mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success}}',
                {'id': pad['id'], 'body': body}, 'commentUpdate')
    (path / '.git/hbl-workpad.md').write_text(body + '\n')
    # Keep the rejected pending input, byte-for-byte. Main returns2 so the host
    # after_run shell short-circuits instead of calling the GitHub publisher.
    return 'blocked'


def sync(path, phase):
    issue = p.validate(path)
    data = issue_data(issue)
    pilot = next((x['id'] for x in data['labels']['nodes'] if x['name'] == 'symphony-pilot'), None)
    request = handoff.pending(path, 'workpad')
    update = None
    if request.exists():
        raw, identity = handoff.read_raw(request, limit=2 * 1024 * 1024)
        update = json.loads(raw)
        if (isinstance(update, dict) and update.get('status') in ('progress', 'blocked', 'handoff') and
                isinstance(update.get('notes'), str) and len(update['notes']) > MAX_NOTES):
            return _reject_oversized_update(path, data, request, raw, update['notes'], pilot)
    if phase == 'before' and p.missing_approvals(x['name'] for x in data['labels']['nodes']):
        raise p.PublicationError('Workpad: missing required dispatch approvals; operator must reconcile')
    if not pilot and phase == 'before':
        raise p.PublicationError('Workpad: missing symphony-pilot approval; operator must reconcile')
    pad = ensure(data)
    p.archive_workpad(issue, pad['body'])
    if phase == 'before':
        # Consume only after a successful update; never replay a stale blocker next attempt.
        if request.exists():
            raise p.PublicationError('Workpad: pending update; run host after phase before resuming Codex')
        status, notes = 'running', 'Host initialization complete; implementation preflight is pending.'
    else:
        if not request.exists():
            return
        status, notes = update.get('status'), update.get('notes')
        if status not in ('progress', 'blocked', 'handoff') or not isinstance(notes, str) or not notes.strip() or len(notes) > MAX_NOTES:
            raise p.PublicationError('Workpad: invalid update; expected status progress/blocked/handoff and notes (1–40000 characters)')
    previous = re.sub(r'\n\n### Host Symphony status\n.*?(?=\n\n### |\Z)', '', pad['body'], flags=re.S)
    body = previous + SECTION + f'Status: {status}\n\n{notes}'
    if body != pad['body']:
        success('mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success}}',
                {'id': pad['id'], 'body': body}, 'commentUpdate')
    if phase == 'before' and data['state']['name'] == 'Todo':
        state = next((x['id'] for x in data['team']['states']['nodes'] if x['name'] == 'In Progress'), None)
        if not state:
            raise p.PublicationError('Workpad: team has no In Progress state; operator must reconcile')
        success('mutation($id:String!,$state:String!){issueUpdate(id:$id,input:{stateId:$state}){success}}',
                {'id': data['id'], 'state': state}, 'issueUpdate')
    if status == 'blocked' and pilot:
        success('mutation($id:String!,$label:String!){issueRemoveLabel(id:$id,labelId:$label){success}}',
                {'id': data['id'], 'label': pilot}, 'issueRemoveLabel')
    handoff.snapshot(path / '.git', 'hbl-workpad.md', body + '\n')
    handoff.snapshot(handoff.directory(path), 'workpad.md', body + '\n')
    from host_git import atomic
    status_directory = p.STATE / 'workpad-status'
    _private_directory(status_directory)
    atomic(status_directory / (issue + '.json'), {'issue': issue, 'status': status})
    if phase == 'after':
        current, current_identity = handoff.read_raw(request, limit=2 * 1024 * 1024)
        if current_identity != identity or current != raw:
            raise p.PublicationError('Workpad: update replaced during host sync; current input preserved for next recovery')
        request.unlink()
    return status


def main():
    try:
        phase = sys.argv[1]
        if phase not in ('before', 'after'):
            raise p.PublicationError('Workpad: expected before or after')
        path = Path.cwd()
        issue = p.validate(path)
        p.STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (p.STATE / f'{issue}.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            status = sync(path, phase)
        if status == 'blocked':
            print('Workpad: blocked; dispatch parked; publication not attempted', file=sys.stderr)
            return 2
        return 0
    except Exception as exc:
        print(str(exc) if isinstance(exc, p.PublicationError) else
              'Workpad: host operation failed; check auth/connectivity or local update JSON and retry; no credentials logged', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
