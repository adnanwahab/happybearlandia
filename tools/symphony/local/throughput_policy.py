"""Pure host scheduling policy. Ranking never grants approval or transfers ownership."""
from collections import deque
import math
import time

GIB = 1024 ** 3
LANES = ('fast', 'feature', 'research')


def _number(value, low=0, high=float('inf')):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and low <= value <= high


def rank_rows(rows, config, now=None):
    """Rank only the supplied rows; eligibility and leases remain coordinator-owned.

    Optional ranking fields live in the already trusted per-issue review record.
    Weighted rounds (3 fast, 2 feature, 1 research) bound research occupancy while
    retaining a slot for long work. Missing ranking data keeps original priority
    ordering, so installing this module alone changes no dispatch policy.
    """
    reviews = config.get('reviews', {})
    if not any('scheduling' in reviews.get(row['id'], {}) for row in rows):
        return sorted(rows, key=lambda r: (r.get('priority') or 5, r['identifier']))
    buckets = {lane: [] for lane in LANES}
    for row in rows:
        spec = reviews.get(row['id'], {}).get('scheduling', {})
        if not isinstance(spec, dict):
            raise ValueError('Scheduling evidence must be an object')
        lane = spec.get('lane', 'feature')
        if lane not in LANES:
            raise ValueError('Unknown scheduling lane')
        values = {key: spec.get(key, default) for key, default in
                  [('gameplayImpact', 0), ('scientificCorrectness', 0), ('reliability', 0),
                   ('unblockingValue', 0), ('risk', 0), ('effortHours', 1), ('successProbability', .5)]}
        for key in ('gameplayImpact', 'scientificCorrectness', 'reliability', 'unblockingValue', 'risk'):
            if not _number(values[key], 0, 5):
                raise ValueError('Scheduling impact/risk must be 0–5')
        if not _number(values['effortHours'], .1, 168) or not _number(values['successProbability'], 0, 1):
            raise ValueError('Scheduling effort/probability is invalid')
        benefit = (3 * values['gameplayImpact'] + 3 * values['scientificCorrectness'] +
                   3 * values['reliability'] + 2 * values['unblockingValue'])
        score = benefit * values['successProbability'] / (values['effortHours'] * (1 + values['risk']))
        buckets[lane].append((score, row))
    queues = {lane: deque(row for _, row in sorted(items, key=lambda x: (-x[0], x[1].get('priority') or 5, x[1]['identifier'])))
              for lane, items in buckets.items()}
    # The coordinator derives this cursor from the count of its durable lease
    # history (including released leases). Failed scans/no-op loops do not move
    # it. Rotating the weighted slots prevents cap=1 from always choosing fast.
    cursor = config.get('schedulingCursor', 0)
    if type(cursor) is not int or cursor < 0:
        raise ValueError('Scheduling cursor must be a nonnegative durable lease count')
    slots = ['fast', 'fast', 'fast', 'feature', 'feature', 'research']
    offset = cursor % len(slots)
    slots = slots[offset:] + slots[:offset]
    result = []
    while any(queues.values()):
        for lane in slots:
            if queues[lane]:
                result.append(queues[lane].popleft())
    return result


def capacity_decision(resources, current_limit, requested_limit=None, evidence=None, now=None):
    """Recommend a grant ceiling, never resize/kill existing workers.

    Inputs/evidence are operator-owned observations, not assertions from tickets.
    High swap is a stop signal even when disk and CPU look idle. Modeled ceilings
    are explicitly not claims that those concurrency levels have been exercised.
    """
    if type(current_limit) is not int or not 1 <= current_limit <= 12:
        raise ValueError('Configured worker concurrency must be 1–12')
    requested_limit = current_limit if requested_limit is None else requested_limit
    if type(requested_limit) is not int or not 1 <= requested_limit <= 12:
        raise ValueError('Requested concurrency must be 1–12')
    now = time.time() if now is None else now
    evidence = evidence or {}
    if not isinstance(resources, dict) or not isinstance(evidence, dict):
        raise ValueError('Resource/scaling evidence must be objects')
    reasons = []
    for key in ['available_memory_bytes', 'swap_used_bytes', 'disk_free_bytes', 'cpu_load_ratio']:
        if not _number(resources.get(key)):
            reasons.append('resource measurement unavailable: ' + key)
    sampled = resources.get('sampled_at')
    if sampled is not None and (not _number(sampled) or not -5 <= now - sampled <= 60):
        reasons.append('resource sample stale or invalid')
    if not reasons:
        if resources['swap_used_bytes'] > 16 * GIB:
            reasons.append('swap exceeds 16 GiB')
        if resources['disk_free_bytes'] < 10 * GIB:
            reasons.append('free disk below 10 GiB')
        if resources['cpu_load_ratio'] > .85:
            reasons.append('CPU/load pressure exceeds 85%')
    observed = evidence.get('observedConcurrency', 1)
    if type(observed) is not int or not 1 <= observed <= 12:
        raise ValueError('Observed concurrency evidence is invalid')
    proposed = min(requested_limit, current_limit)
    scale_reasons = []
    if proposed > observed:
        valid = (isinstance(evidence.get('scaleApprovedBy'), str) and bool(evidence['scaleApprovedBy'].strip()) and
                 _number(evidence.get('sampleWorkerHours'), 1) and
                 _number(evidence.get('acceptedChangesPerWorkerHour'), .000001) and
                 _number(evidence.get('baselineAcceptedChangesPerWorkerHour'), .000001) and
                 evidence['acceptedChangesPerWorkerHour'] >= evidence['baselineAcceptedChangesPerWorkerHour'] and
                 _number(evidence.get('failureRate'), 0, .1) and _number(evidence.get('retryRate'), 0, .2) and
                 type(evidence.get('reviewBacklog')) is int and 0 <= evidence['reviewBacklog'] <= 2)
        if not valid:
            proposed = min(observed, proposed)
            scale_reasons.append('scale-up held: operator approval and accepted-throughput/resource evidence required')
    # Actual measured regression scales down new grants without cancelling work.
    degraded = (_number(evidence.get('failureRate')) and evidence['failureRate'] > .1) or (
        _number(evidence.get('retryRate')) and evidence['retryRate'] > .2) or (
        _number(evidence.get('acceptedChangesPerWorkerHour')) and
        _number(evidence.get('baselineAcceptedChangesPerWorkerHour'), .000001) and
        evidence['acceptedChangesPerWorkerHour'] < evidence['baselineAcceptedChangesPerWorkerHour'])
    if degraded:
        proposed = max(1, proposed // 2)
        scale_reasons.append('new-grant ceiling reduced after measured failure/retry/throughput regression')
    if type(evidence.get('reviewBacklog')) is int and evidence['reviewBacklog'] > 2:
        reasons.append('review backlog exceeds reserved integration capacity')
    return {'grant_limit': 0 if reasons else proposed, 'configured_limit': current_limit,
            'requested_limit': requested_limit, 'observed_limit': observed,
            'hold_new_grants': bool(reasons), 'reasons': reasons + scale_reasons,
            'active_workers_cancelled': False,
            'modeled_candidates': [4, 6, 8, 12], 'live_capacity_claim': observed}
