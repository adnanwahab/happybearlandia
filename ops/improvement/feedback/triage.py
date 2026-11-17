"""Pure bounded normalization followed by an explicitly injected proposal sink."""
import hashlib
import json

DAY = 86400
MAX_RETENTION = 7 * DAY
SURFACES = {'world', 'worldline', 'decision-studio'}
SYMPTOMS = {'replay-unavailable', 'result-unavailable', 'navigation-blocked'}


class InvalidAggregate(ValueError):
    """Errors disclose classifications only, never input values."""


def require(condition):
    if not condition:
        raise InvalidAggregate('invalid or unsupported aggregate input')


def exact(value, fields):
    require(type(value) is dict and set(value) == set(fields.split()))


def integer(value, low, high):
    require(type(value) is int and low <= value <= high)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def triage(batch, *, now, sink):
    """Validate the entire batch before sending deterministic proposed tickets.

    Caller supplies a trusted clock and an idempotent sink. No local state is kept.
    Vote ordinals are fixture-only, batch-scoped synthetic deduplication examples.
    """
    integer(now, 0, 2**53 - 1)
    exact(batch, 'schemaVersion aggregates')
    require(batch['schemaVersion'] == 'feedback-aggregate-fixture.v1')
    rows = batch['aggregates']
    require(type(rows) is list and len(rows) <= 100)
    receipts, groups = {}, {}
    deleted = 0
    for row in rows:
        exact(row, 'ordinal consent surface symptom observations voteOrdinals reproduction createdAt deleteAt deletedAt')
        integer(row['ordinal'], 0, 10000)
        exact(row['consent'], 'granted scope version')
        require(row['consent'] == {'granted': True, 'scope': 'aggregate-triage', 'version': 1}
                and row['consent']['granted'] is True and type(row['consent']['version']) is int)
        require(type(row['surface']) is str and row['surface'] in SURFACES)
        require(type(row['symptom']) is str and row['symptom'] in SYMPTOMS)
        integer(row['observations'], 1, 100000)
        votes = row['voteOrdinals']
        require(type(votes) is list and len(votes) <= 1000)
        for vote in votes:
            integer(vote, 0, 100000)
        reproduction = row['reproduction']
        exact(reproduction, 'scenario seed modelVersion')
        # Only this authored synthetic recipe is supported. No run/player IDs,
        # URLs, arbitrary model labels or purported replay mappings pass through.
        require(reproduction['scenario'] is None or type(reproduction['scenario']) is str
                and reproduction['scenario'] == 'synthetic-riverside-v1')
        require(reproduction['modelVersion'] is None or type(reproduction['modelVersion']) is str
                and reproduction['modelVersion'] == 'fixture-model.v1')
        if reproduction['seed'] is not None:
            integer(reproduction['seed'], 0, 2**32 - 1)
        integer(row['createdAt'], 0, now)
        integer(row['deleteAt'], row['createdAt'] + 1, row['createdAt'] + MAX_RETENTION)
        if row['deletedAt'] is not None:
            integer(row['deletedAt'], row['createdAt'], now)
        normalized = {**row, 'voteOrdinals': sorted(set(votes))}
        fingerprint = digest(normalized)
        ordinal = row['ordinal']
        require(ordinal not in receipts or receipts[ordinal] == fingerprint)
        if ordinal in receipts:
            continue
        receipts[ordinal] = fingerprint
        if row['deletedAt'] is not None or now >= row['deleteAt']:
            deleted += 1
            continue
        key = digest([row['surface'], row['symptom'], reproduction])
        group = groups.setdefault(key, {'surface': row['surface'], 'symptom': row['symptom'],
                                       'reproduction': reproduction.copy(), 'observations': 0,
                                       'votes': set(), 'deleteAt': row['deleteAt']})
        group['observations'] += row['observations']
        group['votes'].update(votes)
        group['deleteAt'] = min(group['deleteAt'], row['deleteAt'])
    proposals, metadata = [], []
    for key, group in sorted(groups.items()):
        evidence = {**group, 'votes': len(group['votes'])}
        revision = digest(evidence)
        context = '; '.join(f'{k}={v if v is not None else "unavailable"}'
                            for k, v in sorted(group['reproduction'].items()))
        proposals.append({
            'schemaVersion': 'improvement-proposal.v1', 'kind': 'feedback',
            'title': f'Review {group["surface"]} {group["symptom"]}',
            'hypothesis': f'Synthetic consent-asserted aggregate: {group["observations"]} observations; '
                          f'{len(group["votes"])} fixture-deduplicated votes. Reproduction: {context}. '
                          'Category reports warrant review; no verified defect or causal claim.',
            'sources': [{'type': 'feedback-aggregate', 'id': key, 'revision': revision,
                         'url': None, 'evidence': 'consented-aggregate'}],
            'acceptanceCriteria': ['Review aggregate evidence and unavailable reproduction fields before implementation.',
                                   'Obtain an independently reproducible case before claiming a defect is fixed.'],
            'testCommands': [['python3', '-m', 'unittest', 'discover', '-s', 'ops/improvement/feedback', '-p', 'test_*.py']],
            'dependencies': ['SHE-52', 'SHE-120'], 'deduplicationKeys': ['feedback:' + key],
            'targetIssue': None,
        })
        metadata.append({'aggregateHash': key, 'revision': revision, 'deleteAt': group['deleteAt']})
    for proposal in proposals:
        sink(proposal)
    return {'proposals': len(proposals), 'excludedDeletedOrExpired': deleted,
            'retention': metadata, 'rulesVersion': 'feedback-triage.v1'}
