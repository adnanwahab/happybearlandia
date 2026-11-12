"""Trusted coordinator admission, not an independent approval authority.

Caller owns the coordinator lock; issue locks serialize publisher/reviewer writes.
No ticket text, worker handoff or execution label supplies operator authority.
"""
import copy
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.request
from datetime import datetime

import coordinator_host as host
import host_git


def checksum(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def protected(directory):
    # Reject symlink ancestors before mkdir/chmod; do not follow a worker swap.
    directory = Path(directory)
    aliases = {Path('/var'): Path('/private/var'), Path('/tmp'): Path('/private/tmp')}
    if any(p.is_symlink() and aliases.get(p) != p.resolve() for p in [directory, *directory.parents]):
        raise host.PublicationError('Assignment: symlink private directory forbidden')
    host.private_directory(directory)


def read_assignment(path):
    import backlog_coordinator as c
    if path.parent.is_symlink():
        raise host.PublicationError('Assignment: unsafe assignment directory')
    value = c.read_private(path, limit=65536)
    if not isinstance(value, dict):
        raise host.PublicationError('Assignment: invalid retained policy')
    return value


def source_fingerprint(path):
    """Bind the operator's ownership audit to dirty/untracked/ignored source state.

    No repository Git filters/hooks are executed. Large/ambiguous inventories hold.
    Dependencies and Git objects are excluded, never modified or collected.
    """
    if not path.is_dir() or path.is_symlink():
        raise host.PublicationError('Assignment: retained source workspace unavailable')
    def fail(_):
        raise host.PublicationError('Assignment: source ownership inventory unreadable')
    rows = []
    for root, directories, files in os.walk(path, followlinks=False, onerror=fail):
        directories[:] = sorted(n for n in directories if n not in ['.git', 'node_modules'])
        for name in sorted(files + [n for n in directories if (Path(root) / n).is_symlink()]):
            item = Path(root) / name
            info = item.lstat()
            rows.append([str(item.relative_to(path)), info.st_mode, info.st_size, info.st_mtime_ns])
            if len(rows) > 20000:
                raise host.PublicationError('Assignment: source inventory too large; explicit bounded audit required')
    return checksum(rows)


def validate_runtime(runtime, now):
    try:
        generated = datetime.fromisoformat(runtime['generated_at'].replace('Z', '+00:00')).timestamp()
        if not -5 <= now - generated <= 60:
            raise ValueError('stale')
    except (KeyError, TypeError, ValueError):
        raise host.PublicationError('Assignment: stale or invalid source runtime timestamp') from None


def collect(services, directory):
    """Read actual host state. Unknown/unavailable inventory is never empty proof."""
    import subprocess
    now = time.time()
    with urllib.request.urlopen('http://127.0.0.1:43111/api/v1/state', timeout=5) as response:
        runtime = json.load(response)
    validate_runtime(runtime, now)
    if (not isinstance(runtime.get('counts'), dict) or
            any(type(runtime['counts'].get(k)) is not int for k in ['running', 'retrying', 'blocked'])):
        raise host.PublicationError('Assignment: invalid runtime inventory')
    claims = []
    for group in ['running', 'retrying', 'blocked']:
        rows = runtime.get(group)
        if not isinstance(rows, list) or len(rows) != runtime['counts'][group]:
            raise host.PublicationError('Assignment: incomplete runtime claims')
        for row in rows:
            if not isinstance(row.get('issue_id'), str):
                raise host.PublicationError('Assignment: unknown runtime owner')
            claims.append({'id': row['issue_id'], 'identifier': row.get('issue_identifier'), 'status': group})
    env = host_git.environment()
    command = ['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
               '-C', str(Path.home() / 'happybearlandia'), 'worktree', 'list', '--porcelain']
    result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise host.PublicationError('Assignment: local worktree inventory unavailable')
    worktrees = []
    for block in result.stdout.strip().split('\n\n'):
        fields = dict(line.split(' ', 1) for line in block.splitlines() if ' ' in line)
        if not fields.get('worktree') or not fields.get('HEAD'):
            raise host.PublicationError('Assignment: invalid worktree inventory')
        worktrees.append({'path': fields['worktree'], 'head': fields['HEAD'],
                          'sourceDigest': source_fingerprint(Path(fields['worktree']))})
    import backlog_coordinator as c
    leases = c.load_state(Path(directory))['leases']
    assignments, handoffs = [], []
    root = Path(directory).parent / 'assignments'
    if root.is_symlink():
        raise host.PublicationError('Assignment: symlink assignment directory')
    if root.exists():
        for path in sorted(root.iterdir()):
            if re.fullmatch(r'SHE-[1-9][0-9]*\.json', path.name):
                value = read_assignment(path)
                entry = {'name': path.stem, 'policy': value}
                assignments.append(entry)
                receipt_path = Path(directory).parent / 'host-git' / path.stem / 'receipt.json'
                phase_path = Path(directory).parent / 'workpad-status' / path.name
                if receipt_path.exists() and phase_path.exists():
                    receipt = read_assignment(receipt_path)
                    if read_assignment(phase_path).get('status') == 'handoff':
                        handoffs.append(dict(receipt, issue=path.stem))
                        lease = next((x for x in leases.values() if x['identifier'] == path.stem), {})
                        proof = lease.get('handoff', {})
                        entry['released'] = bool(lease.get('status') == 'released' and
                            lease.get('admission', {}).get('policyDigest') == checksum(value) and
                            proof.get('commit') == receipt.get('commit') and proof.get('url') == receipt.get('url') and
                            receipt.get('status') == 'published')
    return {'at': now, 'claims': claims, 'worktrees': worktrees, 'assignments': assignments, 'handoffs': handoffs}


def verified_handoff(snapshot, issue, inventory):
    import backlog_coordinator as c
    if not inventory or any(x.get('id') == issue['id'] or x.get('identifier') == issue['identifier']
                            for x in inventory.get('claims', [])):
        return False
    for pr in snapshot['prs']:
        if not c.delivered(pr, issue):
            continue
        receipt = next((x for x in inventory.get('handoffs', []) if x.get('issue') == issue['identifier']), {})
        if (receipt.get('status') == 'published' and receipt.get('commit') == pr['head']['sha'] and
                receipt.get('url') == pr['html_url'] and any(
                    comment['body'].startswith('## Codex Workpad') and
                    receipt['url'] in comment['body'] and receipt['commit'] in comment['body']
                    for comment in issue['comments'])):
            return True
    return False


def conflicts(inventory, config, issue, review, now, allow_running=False):
    import backlog_coordinator as c
    reasons = []
    if not isinstance(inventory, dict) or not -5 <= now - inventory.get('at', 0) <= 60:
        return ['fresh complete host runtime/worktree/assignment inventory missing']
    for key in ['claims', 'worktrees', 'assignments']:
        if not isinstance(inventory.get(key), list):
            return ['incomplete host ownership inventory']
    # Existing same-issue execution is never restarted/re-admitted automatically.
    if not allow_running and any(x.get('id') == issue['id'] or x.get('identifier') == issue['identifier'] for x in inventory['claims']):
        reasons.append('same issue has a live/retry/blocked runtime claim; preserve worker state')
    for claim in inventory['claims']:
        if claim.get('id') == issue['id'] or claim.get('identifier') == issue['identifier']:
            continue
        owner = next((x['policy'] for x in inventory['assignments']
                      if x['name'] == claim.get('identifier')), None)
        if (not owner or not c.safe_paths(owner.get('files')) or
                not isinstance(owner.get('interfaces'), list) or not owner.get('reviewedBy') or not owner.get('reviewDigest')):
            reasons.append('unknown runtime ownership: ' + str(claim.get('identifier') or claim.get('id')))
        elif c.overlaps(review['files'], owner['files']) or set(review['interfaces']) & set(owner['interfaces']):
            reasons.append('runtime ownership conflict: ' + claim['identifier'])
    for tree in inventory['worktrees']:
        proof = config.get('worktreeReviews', {}).get(tree['path'], {})
        if (proof.get('head') != tree['head'] or not tree.get('sourceDigest') or
                proof.get('sourceDigest') != tree['sourceDigest'] or not proof.get('reviewedBy') or
                not isinstance(proof.get('expiresAt'), (int, float)) or
                not now < proof['expiresAt'] <= now + 86400 or
                not isinstance(proof.get('files'), list) or not isinstance(proof.get('interfaces'), list)):
            reasons.append('unreviewed local worktree ownership: ' + tree['path'])
        elif c.overlaps(review['files'], proof['files']) or set(review['interfaces']) & set(proof['interfaces']):
            reasons.append('local worktree ownership conflict: ' + tree['path'])
    for item in inventory['assignments']:
        if item['name'] == issue['identifier'] or item.get('released') is True:
            continue
        value = item['policy']
        # Even expired policies may retain unfinished work; never steal them.
        if not c.safe_paths(value.get('files')):
            reasons.append('unknown retained assignment ownership: ' + item['name'])
        elif c.overlaps(review['files'], value['files']):
            reasons.append('retained assignment file conflict: ' + item['name'])
        elif set(review['interfaces']) & set(value.get('interfaces', [])):
            reasons.append('retained assignment interface conflict: ' + item['name'])
    return reasons


def effective_review(review, now):
    """An expired original review may renew only via its exact standing grant."""
    result = copy.deepcopy(review)
    standing = review.get('standingAuthorization')
    if standing is not None:
        original = {k: v for k, v in review.items() if k != 'standingAuthorization'}
        if (not isinstance(standing, dict) or standing.get('reviewDigest') != checksum(original) or
                standing.get('authorizedBy') != review.get('reviewedBy') or
                not isinstance(standing.get('authorizationId'), str) or not standing['authorizationId'].strip() or
                standing.get('revoked') is not False or
                not isinstance(standing.get('validUntil'), (int, float)) or
                not now < standing['validUntil'] <= now + 30 * 86400 or
                type(standing.get('leaseSeconds')) is not int or not 60 <= standing['leaseSeconds'] <= 86400):
            raise host.PublicationError('Assignment: expired/revoked/changed standing authorization')
        result['expiresAt'] = min(now + standing['leaseSeconds'], standing['validUntil'])
    return result


def owns_policy(lease, policy):
    if not policy:
        return False
    admission = lease.get('admission', {})
    value = checksum(policy)
    return (admission.get('policyDigest') == value or
            (admission.get('status') == 'prepared' and admission.get('pendingPolicy') and
             admission.get('previousPolicyDigest') == value))


def plan(snapshot, config, state, inventory, issue, now=None):
    import backlog_coordinator as c
    now = time.time() if now is None else now
    review = config.get('reviews', {}).get(issue['id'])
    if not review:
        return None, ['missing trusted operator readiness review']
    try:
        effective = effective_review(review, now)
    except host.PublicationError as error:
        return None, [str(error)]
    # Reuse the actual coordinator's complete dependency/digest/PR/ownership
    # classifier. Only existing self approval/state/lease are normalized for repair.
    adjusted = copy.deepcopy(snapshot)
    target = next(i for i in adjusted['issues'] if i['id'] == issue['id'])
    target['labels'].pop(c.APPROVAL_LABEL, None)
    if target['state'] in c.ACTIVE:
        target['state'] = 'Todo'
    retained = copy.deepcopy(state)
    lease = retained['leases'].pop(issue['id'], None)
    cfg = copy.deepcopy(config)
    cfg['reviews'][issue['id']] = effective
    row = next(r for r in c.classify(adjusted, cfg, retained, now) if r['id'] == issue['id'])
    reasons = list(row['reasons'])
    if lease and lease.get('status') == 'released':
        reasons.append('released task requires explicit new review, never automatic re-admission')
    if not all(host_git.safe_name(n) for n in effective.get('files', [])):
        reasons.append('assignment requires exact safe files, not protected paths or directory/glob policies')
    if lease and (lease.get('digest') != c.digest(issue) or lease.get('reviewDigest') != c.review_digest(review) or
                  lease.get('files') != review.get('files') or lease.get('interfaces') != review.get('interfaces') or
                  lease.get('baseSha') != snapshot['baseSha']):
        reasons.append('durable lease review changed; never reinterpret prior admission')
    if not reasons:
        own = next((item['policy'] for item in inventory.get('assignments', [])
                    if item['name'] == issue['identifier']), None) if isinstance(inventory, dict) else None
        allow_running = bool(lease and lease.get('status') == 'active' and own and
                             owns_policy(lease, own))
        reasons.extend(conflicts(inventory, config, issue, effective, now, allow_running))
    policy = {'version': 1, 'issue': issue['identifier'], 'repository': host.REPO, 'base': host.BASE,
              'baseCommit': snapshot['baseSha'], 'files': sorted(effective.get('files', [])),
              'interfaces': effective.get('interfaces', []), 'reviewedBy': effective.get('reviewedBy'),
              'expiresAt': effective.get('expiresAt'), 'publishEnabled': False,
              'reviewDigest': c.review_digest(review), 'issueDigest': c.digest(issue)}
    try:
        validate_policy(policy, issue['identifier'])
    except host.PublicationError as error:
        reasons.append(str(error))
    return policy, reasons


def validate_policy(policy, issue):
    try:
        return host_git.validate_assignment(policy, issue)
    except host_git.p.PublicationError as error:
        raise host.PublicationError(str(error)) from None


@contextmanager
def grant(directory, issue, lease, verify=None):
    """Hold the existing publisher lock through label lookup and mutation."""
    root = Path(directory).parent
    fd = os.open(root / (issue['identifier'] + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        host.private_file(fd)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        def check():
            if verify: verify()
            policy = read_assignment(root / 'assignments' / (issue['identifier'] + '.json'))
            validate_policy(policy, issue['identifier'])
            if (checksum(policy) != lease.get('admission', {}).get('policyDigest') or
                    policy.get('publishEnabled') is not False):
                raise host.PublicationError('ASSIGNMENT_UNSAFE: policy changed before execution approval; admission retained')
        yield check
    except BlockingIOError:
        raise host.PublicationError('Assignment: publisher/reviewer busy; execution approval held') from None
    finally:
        os.close(fd)


def ensure(directory, state, issue, policy, config, now=None, verify=None):
    """Journal -> compare-and-write policy -> journal. Label mutation follows.

    Existing policies are never replaced unless this exact durable admission owns
    their previous digest and an unchanged standing authorization permits renewal.
    """
    import backlog_coordinator as c
    now = time.time() if now is None else now
    validate_policy(policy, issue['identifier'])
    root = Path(directory).parent / 'assignments'
    protected(Path(directory).parent)
    protected(root)
    lock_path = Path(directory).parent / (issue['identifier'] + '.lock')
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        host.private_file(fd)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if verify: verify()
        target = root / (issue['identifier'] + '.json')
        existing = read_assignment(target) if target.exists() or target.is_symlink() else None
        lease = state['leases'][issue['id']]
        admission = lease.get('admission', {})
        if existing:
            # A newer/external valid record wins. Adoption needs exact original
            # review identity, including digest, never just similar file names.
            identity = [k for k in policy if k not in ['expiresAt', 'publishEnabled']]
            if any(existing.get(k) != policy[k] for k in identity):
                raise host.PublicationError('Assignment: retained external or changed policy requires operator reconciliation')
            if existing.get('publishEnabled') is not False:
                raise host.PublicationError('Assignment: independent publication authorization retained; no automatic overwrite')
            if admission.get('status') == 'prepared' and admission.get('policyDigest') == checksum(existing):
                lease['admission'] = {'status': 'assignment-created', 'policyDigest': checksum(existing),
                                      'reviewDigest': existing['reviewDigest'], 'at': now}
                c.atomic(Path(directory) / 'leases.json', state)
            if existing['expiresAt'] >= policy['expiresAt']:
                return 'retained-newer'
            if existing['expiresAt'] > now + 300:
                return 'current'
            if not config['reviews'][issue['id']].get('standingAuthorization'):
                raise host.PublicationError('Assignment: renewal requires explicit exact standing authorization')
            expected = (admission.get('previousPolicyDigest') if admission.get('pendingPolicy') else admission.get('policyDigest'))
            if expected != checksum(existing):
                raise host.PublicationError('Assignment: policy changed since admission; no older overwrite')
        pending = admission.get('pendingPolicy')
        if pending:
            # Interrupted creation is recovered only with the exact same review.
            if any(pending.get(k) != policy[k] for k in policy if k != 'expiresAt') or pending['expiresAt'] <= now:
                raise host.PublicationError('Assignment: pending admission changed/expired; preserve and reconcile')
            policy = pending
        if verify: verify()
        lease['admission'] = {'status': 'prepared', 'policyDigest': checksum(policy), 'pendingPolicy': policy,
                              'previousPolicyDigest': checksum(existing) if existing else None}
        c.atomic(Path(directory) / 'leases.json', state)
        if verify: verify()
        c.atomic(target, policy)
        lease['admission'] = {'status': 'assignment-created', 'policyDigest': checksum(policy),
                              'reviewDigest': policy['reviewDigest'], 'at': now}
        c.atomic(Path(directory) / 'leases.json', state)
        return 'created' if existing is None else 'renewed'
    except BlockingIOError:
        raise host.PublicationError('Assignment: publisher/reviewer busy; preserve admission for retry') from None
    finally:
        os.close(fd)


def reason_code(reason):
    for code in ['ASSIGNMENT_MISSING', 'ASSIGNMENT_UNSAFE', 'ASSIGNMENT_EXPIRED']:
        if reason.startswith(code + ':'):
            return code
    mapping = [('standing authorization', 'AUTHORIZATION_HELD'), ('review expired', 'AUTHORIZATION_HELD'),
               ('trusted operator readiness review', 'REVIEW_MISSING'), ('base SHA', 'BASELINE_STALE'),
               ('cleanBaseEvidence', 'BASELINE_EVIDENCE_MISSING'), ('ownership', 'OWNERSHIP_HELD'),
               ('conflict', 'OWNERSHIP_HELD'), ('worktree', 'OWNERSHIP_HELD'),
               ('prerequisite', 'DEPENDENCY_HELD'), ('existing PR', 'PR_RECONCILIATION'),
               ('policy changed', 'POLICY_CHANGED'), ('publication authorization', 'PUBLICATION_RETAINED')]
    return next((code for text, code in mapping if text in reason), 'ADMISSION_HELD')


def projection(report):
    actions = {'created', 'renewed', 'current', 'retained-newer', 'ready', 'hold'}
    return [{'identifier': row['identifier'], 'action': row['action'] if row['action'] in actions else 'hold',
             'reasons': sorted(set(reason_code(reason) for reason in row['reasons']))}
            for row in report.get('assignmentMaintenance', [])
            if re.fullmatch(r'SHE-[1-9][0-9]*', str(row.get('identifier')))]
