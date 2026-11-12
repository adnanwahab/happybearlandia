#!/usr/bin/env python3
"""Host-only queue audit and additive approval leases. Dry-run is the default."""
import argparse
from contextlib import contextmanager
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import stat
import sys
import tempfile
import time

import coordinator_host as host
from throughput_policy import rank_rows

REVIEW_LABEL = 'hbl-symphony-queue'
APPROVAL_LABEL = 'symphony-pilot'
PROJECT = '3f960f14-ee1f-4b2b-a4f8-b1b67483b88a'
STATE = host.STATE / 'backlog-coordinator'
ACTIVE = {'Todo', 'In Progress', 'Rework'}
ISSUE_REF = re.compile(r'\bSHE-[1-9][0-9]*\b', re.I)
SHA = re.compile(r'[0-9a-f]{40}')


def digest(issue):
    fields = {k: issue[k] for k in ('id', 'identifier', 'title', 'description', 'comments', 'blockedBy', 'attachments')}
    return hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()


def review_digest(review):
    return hashlib.sha256(json.dumps(review, sort_keys=True).encode()).hexdigest()


def paginate(fetch, initial=None):
    """Consume complete connections, optionally continuing an embedded first page."""
    cursor, seen, rows = None, set(), []
    page = initial
    while True:
        if page is None:
            page = fetch(cursor)
        if (not isinstance(page, dict) or not isinstance(page.get('nodes'), list) or
                not isinstance(page.get('pageInfo'), dict) or
                type(page['pageInfo'].get('hasNextPage')) is not bool or
                'endCursor' not in page['pageInfo']):
            raise host.PublicationError('Coordinator: incomplete pagination response; no approval allowed')
        rows.extend(page['nodes'])
        if not page['pageInfo']['hasNextPage']:
            return rows
        cursor = page['pageInfo']['endCursor']
        if not isinstance(cursor, str) or not cursor or cursor in seen:
            raise host.PublicationError('Coordinator: incomplete or cyclic pagination; no approval allowed')
        seen.add(cursor)
        page = None


class Services:
    """Read queries reuse trusted publisher auth; the only mutation is addLabel."""

    # Small issue pages bound nested GraphQL cost. Each connection remains fully
    # paginated: batching removes round trips, never truncates approval evidence.
    issue_page_size = 10
    nested_page_size = 20
    connection_fields = (
        ('comments', 'id body'), ('labels', 'id name'),
        ('inverseRelations', 'type issue{identifier state{name}}'),
        ('relations', 'type relatedIssue{identifier state{name}}'),
        ('attachments', 'id url title'),
    )

    def __init__(self):
        self.scan_metrics = {}

    def linear(self, query, variables):
        self.scan_metrics['linearQueryCalls'] = self.scan_metrics.get('linearQueryCalls', 0) + 1
        return host.linear(query, variables)

    def connection(self, query, variables, field):
        return paginate(lambda after: self.linear(query, dict(variables, after=after))[field])

    def scan(self):
        started = time.monotonic()
        self.scan_metrics = dict(linearQueryCalls=0, githubCommandCalls=0, githubRetries=0,
                                 nestedContinuationCalls=0)
        connections = ' '.join(
            field + '(first:' + str(self.nested_page_size) + '){nodes{' + selection +
            '} pageInfo{hasNextPage endCursor}}' for field, selection in self.connection_fields)
        query = ('query($project:ID!,$after:String){issues(first:' + str(self.issue_page_size) +
                 ',after:$after,includeArchived:true,filter:{project:{id:{eq:$project}}}){nodes{' +
                 'id identifier title description priority updatedAt archivedAt state{name} team{id} ' +
                 connections + '} pageInfo{hasNextPage endCursor}}}')
        issues = self.connection(query, {'project': PROJECT}, 'issues')
        if len({i['id'] for i in issues}) != len(issues) or len({i['identifier'] for i in issues}) != len(issues):
            raise host.PublicationError('Coordinator: duplicate issue inventory; retry complete scan')
        for issue in issues:
            for field, selection in self.connection_fields:
                continuation = ('query($id:String!,$after:String){issue(id:$id){' + field +
                                '(first:100,after:$after){nodes{' + selection +
                                '} pageInfo{hasNextPage endCursor}}}}')

                def fetch(after, field=field, query=continuation, issue_id=issue['id']):
                    self.scan_metrics['nestedContinuationCalls'] += 1
                    return self.linear(query, {'id': issue_id, 'after': after})['issue'][field]

                # Missing/invalid embedded evidence fails closed; never silently
                # substitute an empty connection or drop its initial page.
                if field not in issue or issue[field] is None:
                    raise host.PublicationError('Coordinator: missing embedded issue evidence; no approval allowed')
                issue[field] = paginate(fetch, initial=issue[field])
            issue['state'] = issue['state']['name']
            issue['blockedBy'] = [x['issue'] for x in issue.pop('inverseRelations') if x['type'] == 'blocks']
            issue['labels'] = {x['name']: x['id'] for x in issue['labels']}
        prs = self.github_pages(f'repos/{host.REPO}/pulls?state=all&per_page=100')
        for pr in prs:
            pr['files'] = [x['filename'] for x in self.github_pages(f'repos/{host.REPO}/pulls/{pr["number"]}/files?per_page=100')]
            # GitHub caps pull-request files at 3000; incomplete evidence is a hold.
            if len(pr['files']) >= 3000:
                raise host.PublicationError('Coordinator: GitHub PR file limit reached; reconcile manually')
        base = self.github(f'repos/{host.REPO}/git/ref/heads/{host.BASE}')['object']['sha']
        self.scan_metrics['elapsedSeconds'] = time.monotonic() - started
        return {'issues': issues, 'prs': prs, 'baseSha': base, 'scannedAt': time.time(),
                'scanMetrics': dict(self.scan_metrics)}

    def github(self, endpoint, pages=False):
        env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'GH_', 'GITHUB_', 'LINEAR_'))}
        args = ['gh', 'api'] + (['--paginate', '--slurp'] if pages else []) + [endpoint]
        for attempt in range(3):
            try:
                # Never run authenticated commands in a model-owned workspace.
                self.scan_metrics['githubCommandCalls'] = self.scan_metrics.get('githubCommandCalls', 0) + 1
                result = subprocess.run(args, cwd=tempfile.gettempdir(), env=env, capture_output=True, text=True, timeout=120)
                if result.returncode:
                    raise ValueError('request failed')
                return json.loads(result.stdout)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                if attempt == 2:
                    raise host.PublicationError('Coordinator: GitHub read failed after 3 attempts; check host auth/connectivity') from None
                self.scan_metrics['githubRetries'] = self.scan_metrics.get('githubRetries', 0) + 1
                time.sleep(attempt + 1)

    def github_pages(self, endpoint):
        pages = self.github(endpoint, pages=True)
        if not isinstance(pages, list) or any(not isinstance(p, list) for p in pages):
            raise host.PublicationError('Coordinator: incomplete GitHub pagination')
        return [row for page in pages for row in page]

    def approve(self, issue):
        self.verify_assignment_maintenance()
        check = issue.get('_assignmentCheck')
        if not callable(check):
            raise host.PublicationError('Coordinator: execution label requires locked assignment admission')
        check()
        result = host.linear('mutation($id:String!,$label:String!){issueAddLabel(id:$id,labelId:$label){success}}',
                             {'id': issue['id'], 'label': issue['approvalLabelId']})
        if not result['issueAddLabel']['success']:
            raise host.PublicationError('Coordinator: approval label rejected; pending lease retained')

    def verify_assignment_maintenance(self):
        if getattr(self, 'evidence_path', None) and read_private(self.evidence_path) != self.expected_config:
            raise host.PublicationError('Coordinator: operator review revoked/changed during scan; preserve pending admission', retryable=False)

    def admission_inventory(self):
        from assignment_lifecycle import collect
        return collect(self, STATE)

    def approval_label(self, team):
        labels = self.connection('''query($after:String){issueLabels(first:100,after:$after){
          nodes{id name team{id}} pageInfo{hasNextPage endCursor}}}''', {}, 'issueLabels')
        labels = [x for x in labels if x['name'] == APPROVAL_LABEL and (x['team'] is None or x['team']['id'] == team)]
        if len(labels) != 1:
            raise host.PublicationError('Coordinator: expected exactly one existing execution label for team')
        return labels[0]['id']


def references(issue):
    text = '\n'.join([issue['description'] or ''] + [c['body'] for c in issue['comments']])
    return sorted(set(x.upper() for x in ISSUE_REF.findall(text)) - {issue['identifier']})


def linked(pr, issue):
    # Native issue branch is authoritative; prose references are conservative.
    return ((pr.get('head') or {}).get('ref') == 'symphony/' + issue['identifier'] or
            issue['identifier'] in {x.upper() for x in ISSUE_REF.findall((pr.get('title') or '') + '\n' + (pr.get('body') or ''))} or
            any(a['url'].rstrip('/') == pr['html_url'].rstrip('/') for a in issue['attachments']))


def delivered(pr, issue):
    """Only the exact repository issue branch can release an execution lease."""
    return (pr['state'] == 'open' and pr.get('draft') is True and
            (pr.get('head') or {}).get('ref') == 'symphony/' + issue['identifier'] and
            ((pr.get('head') or {}).get('repo') or {}).get('full_name') == host.REPO and
            pr['base']['ref'] == host.BASE and
            pr['base'].get('repo', {}).get('full_name') == host.REPO and
            bool(SHA.fullmatch(str(pr['head'].get('sha', '')))))


def reserved_scope(issue, reviews, leases):
    review = reviews.get(issue['id'], {})
    lease = leases.get(issue['id'], {})
    retained = lease.get('status') in {'pending', 'active', 'held', 'released'}
    files = scope(review) + (lease['files'] if retained else [])
    interfaces = (review.get('interfaces') or []) + (lease['interfaces'] if retained else [])
    known = bool(retained or (scope(review) and review.get('issueDigest') == digest(issue)))
    return files, interfaces, known


def safe_paths(paths):
    return (isinstance(paths, list) and bool(paths) and len(paths) == len(set(paths)) and
            all(isinstance(p, str) and p and not p.startswith('/') and '\\' not in p and
                all(x.casefold() not in ('', '.', '..', '.git') for x in p.split('/')) and
                not any(c in p for c in '*?[]\n\r') and str(PurePosixPath(p)) == p for p in paths))


def overlaps(a, b):
    return any(x.casefold() == y.casefold() or x.casefold().startswith(y.casefold() + '/') or
               y.casefold().startswith(x.casefold() + '/') for x in a for y in b)


def scope(review):
    return review.get('files', []) if safe_paths(review.get('files')) else []


def classify(snapshot, config, state, now=None):
    now = time.time() if now is None else now
    issues, prs = snapshot['issues'], snapshot['prs']
    reviews = config.get('reviews', {})
    by_ref = {i['identifier']: i for i in issues}
    rows = []
    for issue in issues:
        ref = issue['identifier']
        review = reviews.get(issue['id'], {})
        reasons = []
        text_refs = references(issue)
        dependencies = {d['identifier'] for d in issue['blockedBy']} | set(text_refs)
        if issue.get('archivedAt'):
            reasons.append('archived issue')
        if issue['state'] != 'Todo':
            reasons.append('only fresh Todo work can receive a new lease; active/review/terminal work preserved')
        if REVIEW_LABEL not in issue['labels']:
            reasons.append('not in review queue')
        if APPROVAL_LABEL in issue['labels']:
            reasons.append('existing execution approval reserved; never interrupt or replace')
        lease = state['leases'].get(issue['id'])
        if lease and not (lease['status'] == 'pending' and lease['digest'] == digest(issue) and
                          lease['files'] == scope(review) and lease['interfaces'] == review.get('interfaces') and
                          lease['baseSha'] == snapshot['baseSha'] and
                          lease.get('reviewDigest') == review_digest(review)):
            reasons.append('prior approval lease retained; no automatic reapproval')
        if not review:
            reasons.append('missing trusted operator readiness review')
        else:
            if review.get('issueDigest') != digest(issue):
                reasons.append('stale issue/comment/blocker/attachment review')
            if review.get('baseSha') != snapshot['baseSha'] or not SHA.fullmatch(str(review.get('baseSha', ''))):
                reasons.append('base SHA missing or stale')
            if review.get('branch') != 'symphony/' + ref:
                reasons.append('wrong or missing isolated issue branch')
            expires = review.get('expiresAt')
            if not isinstance(expires, (int, float)) or isinstance(expires, bool) or not now < expires <= now + 86400:
                reasons.append('operator review expired or exceeds 24-hour freshness bound')
            for key in ('reviewedBy', 'dependencyAudit', 'duplicateAudit', 'ownershipAudit', 'cleanBaseEvidence', 'testEvidence'):
                if not isinstance(review.get(key), str) or not review[key].strip():
                    reasons.append('missing ' + key)
            if review.get('implementationAbsent') is not True:
                reasons.append('existing implementation not ruled out')
            if not scope(review):
                reasons.append('missing/unsafe exact file ownership')
            interfaces = review.get('interfaces')
            if not isinstance(interfaces, list) or any(not isinstance(x, str) or not x.strip() for x in interfaces):
                reasons.append('missing explicit interface ownership (empty list allowed)')
            tests = review.get('tests')
            if not isinstance(tests, list) or not tests or any(not isinstance(t, list) or not t or any(not isinstance(a, str) or not a.strip() for a in t) for t in tests):
                reasons.append('missing runnable test argv (data only; never executed by coordinator)')
            acceptance = review.get('acceptance')
            if not isinstance(acceptance, list) or not acceptance or any(not isinstance(a, str) or not a.strip() for a in acceptance):
                reasons.append('missing observable acceptance criteria')
            # The operator must explicitly enumerate aliases/description-only prerequisites.
            mapped = review.get('dependencies')
            if not isinstance(mapped, list) or any(not isinstance(x, str) or not ISSUE_REF.fullmatch(x) for x in mapped):
                reasons.append('missing explicit audited dependencies (empty list allowed)')
            else:
                dependencies.update(mapped)
        for dep in sorted(dependencies):
            native = next((d for d in issue['blockedBy'] if d['identifier'] == dep), None)
            found = by_ref.get(dep)
            status = found['state'] if found else native and native['state']['name']
            proof = review.get('verifiedPrerequisites', {}).get(dep)
            if status != 'Done' or not isinstance(proof, str) or not proof.strip():
                reasons.append(f'prerequisite {dep}: completion/verification missing ({status or "not in project"})')
        if any(r['type'] in {'duplicate', 'duplicate_of'} for r in issue.get('relations', [])):
            reasons.append('native duplicate relation requires reconciliation')
        matching = [p for p in prs if linked(p, issue)]
        if matching:
            reasons.append('existing PR/merged/closed implementation requires reconciliation: ' + ','.join(str(p['number']) for p in matching))
        if sum(c['body'].startswith('## Codex Workpad') for c in issue['comments']) > 1:
            reasons.append('duplicate workpads')
        # Missing workpads deliberately do not block readiness; before_run initializes.
        for other in issues:
            if other['id'] == issue['id']:
                continue
            other_files, other_interfaces, known = reserved_scope(other, reviews, state['leases'])
            busy = (other['state'] in {'In Progress', 'Rework'} or APPROVAL_LABEL in other['labels'] or
                    state['leases'].get(other['id'], {}).get('status') in {'pending', 'active', 'held'} or
                    any(p['state'] == 'open' and linked(p, other) for p in prs))
            if busy and not known:
                reasons.append(f'unknown active ownership: {other["identifier"]}')
            elif busy and (overlaps(scope(review), other_files) or set(review.get('interfaces') or []) & set(other_interfaces)):
                reasons.append(f'ownership conflict: {other["identifier"]}')
            if issue['title'].strip().casefold() == other['title'].strip().casefold():
                reasons.append(f'duplicate title: {other["identifier"]}')
        for ident, lease in state['leases'].items():
            if ident != issue['id'] and ident not in {i['id'] for i in issues} and lease['status'] != 'released':
                if overlaps(scope(review), lease['files']) or set(review.get('interfaces') or []) & set(lease['interfaces']):
                    reasons.append('ownership conflict with retained missing-issue lease')
        for pr in prs:
            if pr['state'] == 'open' and overlaps(scope(review), pr['files']):
                reasons.append(f'open conflicting PR: {pr["number"]}')
        rows.append({'id': issue['id'], 'identifier': ref, 'state': issue['state'], 'priority': issue.get('priority'), 'digest': digest(issue),
                     'proseReferences': text_refs, 'nativeBlockedBy': issue['blockedBy'],
                     'nativeRelations': issue.get('relations', []),
                     'description': issue['description'], 'title': issue['title'],
                     'workpads': [c['id'] for c in issue['comments'] if c['body'].startswith('## Codex Workpad')],
                     'comments': issue['comments'], 'attachments': issue['attachments'],
                     'existingPRs': [p['number'] for p in matching], 'files': scope(review),
                     'interfaces': review.get('interfaces') or [], 'reasons': reasons, 'eligible': not reasons})
    return rows


def atomic(path, value):
    fd, temporary = tempfile.mkstemp(prefix='.coordinator-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_private(path, limit=None):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1 or
                (limit is not None and info.st_size > limit)):
            raise host.PublicationError('Coordinator: evidence/state must be host-owned private regular files')
        return json.load(stream)


@contextmanager
def locked(directory):
    host.private_directory(directory)
    fd = os.open(directory / 'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        host.private_file(fd)
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def load_state(directory):
    path = directory / 'leases.json'
    if path.is_symlink():
        raise host.PublicationError('Coordinator: symlink lease state forbidden; preserve and reconcile')
    if not path.exists():
        return {'version': 1, 'leases': {}}
    value = read_private(path)
    if value.get('version') != 1 or not isinstance(value.get('leases'), dict):
        raise host.PublicationError('Coordinator: invalid lease state; preserve and reconcile, never reset')
    for lease in value['leases'].values():
        if lease.get('status') not in {'pending', 'active', 'held', 'released'} or not safe_paths(lease.get('files')) or not isinstance(lease.get('interfaces'), list) or any(
                not isinstance(x, str) or not x.strip() for x in lease['interfaces']):
            raise host.PublicationError('Coordinator: invalid retained lease; no new approvals')
    return value


def occupied(snapshot, state):
    result = set()
    for issue in snapshot['issues']:
        lease = state['leases'].get(issue['id'], {})
        done = (lease.get('status') == 'released' and
                any(delivered(p, issue) for p in snapshot['prs']))
        if APPROVAL_LABEL in issue['labels'] or (issue['state'] in {'In Progress', 'Rework'} and not done):
            result.add(issue['id'])
    result.update(k for k, lease in state['leases'].items() if lease['status'] != 'released')
    return result


def cycle(services, config, directory, apply=False, maintain=False):
    """Caller holds the host lock throughout read/reconcile/persist/mutate."""
    if config.get('version') != 1 or config.get('projectId') != PROJECT:
        raise host.PublicationError('Coordinator: wrong readiness evidence version/project')
    cap = config.get('cap', 3)
    if type(cap) is not int or not 1 <= cap <= 12:
        raise host.PublicationError('Coordinator: cap must be 1–12')
    state = load_state(directory)
    snapshot = services.scan()  # Any incomplete inventory aborts before writes.
    if cap > 3:
        proof = config.get('concurrentDraftProof', [])
        valid = [p for p in snapshot['prs'] if p['number'] in proof and p['state'] == 'open' and p.get('draft') and p['base']['ref'] == host.BASE and any(delivered(p, i) for i in snapshot['issues'])]
        if len(valid) < 3 or not config.get('scaleApprovedBy'):
            raise host.PublicationError('Coordinator: scale above3 needs operator approval and three actual open draft PRs')
    by_id = {i['id']: i for i in snapshot['issues']}
    import assignment_lifecycle as assignments
    inventory = services.admission_inventory() if hasattr(services, 'admission_inventory') else None
    # Never revoke a remote label or expire a running lease by wall clock.
    for ident, lease in state['leases'].items():
        issue = by_id.get(ident)
        if not issue:
            lease['status'] = 'held'
            continue
        approved = APPROVAL_LABEL in issue['labels']
        linked_draft = assignments.verified_handoff(snapshot, issue, inventory)
        release_reason = config.get('releases', {}).get(ident)
        if not approved and isinstance(release_reason, str) and release_reason.strip():
            lease['status'] = 'released'
            lease['releaseReason'] = release_reason
        elif approved:
            lease['status'] = 'active'
        elif lease['status'] in {'pending', 'active', 'held'} and linked_draft:
            lease['status'] = 'released'
            lease['releaseReason'] = 'verified draft handoff'
            receipt = next(x for x in inventory['handoffs'] if x['issue'] == issue['identifier'])
            lease['handoff'] = {'commit': receipt['commit'], 'url': receipt['url'], 'verifiedAt': time.time()}
        elif lease['status'] == 'active':
            lease['status'] = 'held'  # Operator removal may race a worker; retain scope.
    maintenance = []
    trusted_approved = set()
    enabled = config.get('enableApprovals') is True and bool(config.get('overlapReconciledBy'))
    for issue in snapshot['issues']:
        if APPROVAL_LABEL not in issue['labels']:
            continue
        policy, reasons = assignments.plan(snapshot, config, state, inventory, issue)
        entry = {'identifier': issue['identifier'], 'action': 'hold' if reasons else 'ready', 'reasons': reasons}
        maintenance.append(entry)
        if not reasons:
            existing_policy = next((x['policy'] for x in inventory['assignments'] if x['name'] == issue['identifier']), None)
            if existing_policy and all(existing_policy.get(key) == value for key, value in policy.items() if key not in ['expiresAt', 'publishEnabled']):
                try:
                    assignments.validate_policy(existing_policy, issue['identifier'])
                    trusted_approved.add(issue['id'])
                except host.PublicationError:
                    pass
        if (apply or maintain) and enabled and not reasons:
            if not apply:
                # Under a new-grant/resource hold, only renew a policy already
                # owned by this exact durable active admission. No missing policy
                # repair or label addition may escape that hold.
                lease = state['leases'].get(issue['id'], {})
                existing = next((x['policy'] for x in inventory['assignments'] if x['name'] == issue['identifier']), None)
                if (not existing or lease.get('status') != 'active' or
                        not assignments.owns_policy(lease, existing) or
                        not config['reviews'][issue['id']].get('standingAuthorization')):
                    entry.update(action='hold', reasons=['maintenance-only: no exact existing standing-authorized admission'])
                    continue
            if hasattr(services, 'verify_assignment_maintenance'):
                services.verify_assignment_maintenance()
            # Fresh inventory and full remote scan before maintenance too.
            fresh = services.scan()
            current = next((i for i in fresh['issues'] if i['id'] == issue['id']), None)
            fresh_inventory = services.admission_inventory()
            policy, reasons = assignments.plan(fresh, config, state, fresh_inventory, current) if current else (None, ['issue disappeared'])
            if reasons:
                entry.update(action='hold', reasons=reasons)
                continue
            state['leases'].setdefault(issue['id'], {'identifier': issue['identifier'], 'status': 'pending',
                'digest': digest(current), 'reviewDigest': review_digest(config['reviews'][issue['id']]),
                'files': policy['files'], 'interfaces': policy['interfaces'], 'baseSha': policy['baseCommit'], 'createdAt': time.time()})
            atomic(directory / 'leases.json', state)
            try:
                entry['action'] = assignments.ensure(directory, state, current, policy, config, verify=getattr(services, 'verify_assignment_maintenance', None))
                state['leases'][issue['id']]['status'] = 'active'
                atomic(directory / 'leases.json', state)
            except host.PublicationError as error:
                entry.update(action='hold', reasons=[str(error)])
    rows = classify(snapshot, config, state)
    for row in rows:
        issue = by_id[row['id']]
        if row['eligible']:
            _, reasons = assignments.plan(snapshot, config, state, inventory, issue)
            row['reasons'].extend(reasons)
            row['eligible'] = not row['reasons']
    occupied_ids = occupied(snapshot, state)
    occupied_ids.update(k for k, v in state['leases'].items() if v['status'] != 'released')
    selected = []
    # Durable history, not poll count, advances weighted lanes at capacity one.
    rank_config = dict(config, schedulingCursor=len(state['leases']))
    for row in rank_rows([row for row in rows if row["eligible"]], rank_config):
        if not row['eligible']:
            continue
        if len(occupied_ids | {r['id'] for r in selected} | {row['id']}) > cap:
            row['reasons'].append('approval capacity reserved')
        elif any(overlaps(row['files'], s['files']) or set(row['interfaces']) & set(s['interfaces']) for s in selected):
            row['reasons'].append('ownership conflict within proposed batch')
        else:
            selected.append(row)
    for row in rows:
        row['eligible'] = not row['reasons']
    held_by_code = {}
    for row in rows:
        for code in set(assignments.reason_code(reason) for reason in row['reasons']):
            held_by_code[code] = held_by_code.get(code, 0) + 1
    queue = {'approved': len(trusted_approved),
             'execution_labeled': sum(APPROVAL_LABEL in issue['labels'] for issue in snapshot['issues']),
             'awaiting_review': None,  # review decisions are not supplied by the PR inventory
             'open_draft_prs': sum(pr['state'] == 'open' and pr.get('draft') is True for pr in snapshot['prs']),
             'held_by_code': held_by_code}
    report = {'dryRun': not apply, 'projectId': PROJECT, 'baseSha': snapshot['baseSha'],
              'scannedAt': snapshot['scannedAt'], 'scanMetrics': snapshot.get('scanMetrics', {}), 'cap': cap, 'occupied': len(occupied_ids),
              'queue': queue, 'assignmentMaintenanceEnabled': bool(apply or maintain), 'assignmentMaintenance': maintenance, 'issues': rows, 'selected': [r['identifier'] for r in selected], 'leases': state['leases'], 'pullRequests': snapshot['prs']}
    if not apply:
        return report
    if config.get('enableApprovals') is not True or not config.get('overlapReconciledBy'):
        raise host.PublicationError('Coordinator: live approvals disabled; reconcile SHE-126/127 and obtain host operator enablement')
    # Save reconciliation before any new label addition. Pending survives ambiguous errors.
    atomic(directory / 'leases.json', state)
    for row in selected:
        issue = by_id[row['id']]
        state['leases'].setdefault(row['id'], {'identifier': row['identifier'], 'status': 'pending', 'digest': row['digest'],
                                     'reviewDigest': review_digest(config['reviews'][row['id']]),
                                     'files': row['files'], 'interfaces': row['interfaces'], 'baseSha': snapshot['baseSha'], 'createdAt': time.time()})
        atomic(directory / 'leases.json', state)
        # Re-scan all services immediately before approval; changes fail closed.
        fresh = services.scan()
        fresh_rows = classify(fresh, config, state)
        fresh_row = next((r for r in fresh_rows if r['id'] == row['id']), None)
        fresh_occupied = occupied(fresh, state) - {row['id']}
        fresh_occupied.update(k for k, v in state['leases'].items() if k != row['id'] and v['status'] != 'released')
        if not fresh_row or not fresh_row['eligible'] or len(fresh_occupied) >= cap:
            raise host.PublicationError('Coordinator: readiness/capacity changed before approval; pending lease retained for operator reconciliation')
        current = next(i for i in fresh['issues'] if i['id'] == row['id'])
        fresh_inventory = services.admission_inventory()
        policy, reasons = assignments.plan(fresh, config, state, fresh_inventory, current)
        if reasons:
            raise host.PublicationError('Coordinator: assignment admission held: ' + '; '.join(reasons))
        if hasattr(services, 'verify_assignment_maintenance'):
            services.verify_assignment_maintenance()
        assignments.ensure(directory, state, current, policy, config, verify=getattr(services, 'verify_assignment_maintenance', None))
        with assignments.grant(directory, current, state['leases'][row['id']],
                               verify=getattr(services, 'verify_assignment_maintenance', None)) as check:
            issue['approvalLabelId'] = services.approval_label(issue['team']['id'])
            check()
            issue['_assignmentCheck'] = check
            services.approve(issue)
        if row['id'] not in trusted_approved:
            report['queue']['approved'] += 1
            report['queue']['execution_labeled'] += 1
            trusted_approved.add(row['id'])
        state['leases'][row['id']]['status'] = 'active'
        atomic(directory / 'leases.json', state)
    report['leases'] = copy.deepcopy(state['leases'])
    return report


def render(report):
    lines = ['# Symphony backlog audit', '', f'Project: {PROJECT}', f'Base: {report["baseSha"]}',
             f'Mode: {"DRY RUN" if report["dryRun"] else "APPLY"}; occupied at scan {report["occupied"]}/{report["cap"]}',
             'Selected: ' + (', '.join(report['selected']) or 'none'), '']
    for row in report['issues']:
        lines.extend([f'## {row["identifier"]} · {row["state"]}',
                      'Result: ' + ('; '.join(row['reasons']) or 'eligible'),
                      'Digest: ' + row['digest'], 'Files: ' + ', '.join(row['files']),
                      'Interfaces: ' + ', '.join(row['interfaces']),
                      'Prose references: ' + ', '.join(row['proseReferences']),
                      'Existing PRs: ' + ', '.join(map(str, row['existingPRs'])), ''])
    return '\n'.join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--apply', action='store_true')
    parser.add_argument('--evidence', required=True, type=Path, help='Host-private operator evidence JSON; data, never commands')
    parser.add_argument('--json-report', type=Path, help='Optional complete local audit snapshot')
    parser.add_argument('--report', type=Path, help='Optional local Markdown report')
    args = parser.parse_args(argv)
    try:
        if args.evidence.absolute().parent != STATE.absolute() or args.evidence.is_symlink():
            raise host.PublicationError('Coordinator: evidence must be a direct host-private state file; never load workspace approval policy')
        config = read_private(args.evidence)
        services = Services()
        services.evidence_path, services.expected_config = args.evidence, config
        if args.apply:
            with locked(STATE):
                report = cycle(services, config, STATE, True)
        else:
            report = cycle(services, config, STATE)
        if args.json_report:
            atomic(args.json_report, report)
        output = render(report)
        if args.report:
            args.report.write_text(output + '\n')
        print(output)
        return 0
    except Exception as error:
        print(str(error) if isinstance(error, host.PublicationError) else
              'Coordinator: invalid evidence, state or API response; no further approvals; preserve state and inspect host configuration', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
