#!/usr/bin/env python3
"""Bounded recurring host reconciliation; no worker command is executed here."""
import argparse
import copy
from datetime import datetime
import json
from pathlib import Path
import re
import signal
import sys
import threading
import time
import urllib.request
import urllib.error

import backlog_coordinator as c
import coordinator_host as host
from throughput_policy import capacity_decision

RUNTIME_URL = 'http://127.0.0.1:43111/api/v1/state'
REFRESH_URL = 'http://127.0.0.1:43111/api/v1/refresh'


def workflow_limit(path):
    """Read the actual supported agent key, rejecting ambiguous/templated YAML."""
    text = Path(path).read_text()
    front = text.split('---', 2)
    if len(front) != 3 or front[0].strip():
        raise ValueError('Expected workflow YAML front matter')
    blocks = re.findall(r'^agent:\s*\n((?:[ \t]+[^\n]*\n|\n)*)', front[1], re.M)
    if len(blocks) != 1:
        raise ValueError('Expected exactly one agent block')
    matches = re.findall(r'^  max_concurrent_agents:\s*([1-9][0-9]*)\s*(?:#.*)?$', blocks[0], re.M)
    if len(matches) != 1 or not 1 <= int(matches[0]) <= 12:
        raise ValueError('Expected one explicit max_concurrent_agents within 1–12')
    return int(matches[0])


def read_runtime():
    with urllib.request.urlopen(RUNTIME_URL, timeout=5) as response:
        data = json.load(response)
    if not isinstance(data, dict) or data.get('error') or not isinstance(data.get('counts'), dict) or not all(
            type(data['counts'].get(k)) is int and data['counts'][k] >= 0 for k in ['running', 'retrying', 'blocked']):
        raise ValueError('Invalid runtime snapshot')
    return data


def refresh_runtime():
    request = urllib.request.Request(REFRESH_URL, method='POST', data=b'')
    with urllib.request.urlopen(request, timeout=5) as response:
        if response.status != 202:
            raise ValueError('Runtime did not accept refresh')


def watchdog(runtime, report, resources, now=None):
    now = time.time() if now is None else now
    alarms = []
    try:
        generated = datetime.fromisoformat(runtime['generated_at'].replace('Z', '+00:00')).timestamp()
        if not -5 <= now - generated <= 60:
            alarms.append({'code': 'stale-runtime', 'severity': 'hold'})
    except (KeyError, TypeError, ValueError):
        alarms.append({'code': 'runtime-time-unavailable', 'severity': 'hold'})
    visible = {x.get('issue_id') for group in ['running', 'retrying', 'blocked'] for x in runtime.get(group, []) if isinstance(x, dict)}
    for ident, lease in report.get('leases', {}).items():
        if lease.get('status') in ['pending', 'active', 'held'] and now - lease.get('createdAt', now) > 600:
            alarms.append({'code': 'retained-lease-needs-reconciliation', 'severity': 'hold', 'issue': lease.get('identifier')})
        if lease.get('status') == 'active' and ident not in visible and now - lease.get('createdAt', now) > 180:
            alarms.append({'code': 'worker-unobserved-or-publication-missing', 'severity': 'hold', 'issue': lease.get('identifier')})
    if report.get('selected') and not runtime['counts']['running']:
        alarms.append({'code': 'eligible-work-awaiting-dispatch', 'severity': 'notice'})
    for receipt in report.get('publication_receipts', []):
        if receipt.get('status') == 'committed' and not receipt.get('pr_url') and now - receipt.get('at', now) > 120:
            alarms.append({'code': 'commit-without-draft-pr', 'severity': 'hold', 'issue': receipt.get('identifier')})
    for pr in report.get('pullRequests', []):
        if pr.get('state') == 'open' and pr.get('ci_status') == 'pending' and now - pr.get('ci_started_at', now) > 1800:
            alarms.append({'code': 'stalled-ci', 'severity': 'notice', 'pr': pr.get('number')})
    return alarms


def run_loop(services, config_loader, directory, current_limit, runtime_reader, resource_reader,
             metrics=None, apply=False, interval=15, max_cycles=1, sleep=time.sleep,
             stop=None, refresh=refresh_runtime, clock=time.time):
    """One host lock spans each scan and any durable grant. Never expire leases.

    Unknown resources/runtime cause audit-only cycles. Persistent or deterministic
    failures stop this invocation rather than spinning or restarting workers.
    """
    if not isinstance(interval, (int, float)) or isinstance(interval, bool) or not 5 <= interval <= 300:
        raise ValueError('Interval must be 5–300 seconds')
    if type(max_cycles) is not int or not 1 <= max_cycles <= 10000:
        raise ValueError('max_cycles must be 1–10000')
    stop = stop or threading.Event()
    directory = Path(directory)
    consecutive_errors = 0
    reports = []
    for count in range(max_cycles):
        if stop.is_set():
            break
        started = clock()
        runtime, resources = {}, {}
        configured_limit = None
        try:
            configured_limit = current_limit() if callable(current_limit) else current_limit
            config = config_loader()
            if not isinstance(config, dict):
                raise ValueError('Invalid evidence')
            cap = config.get('cap', 3)
            if type(cap) is not int or not 1 <= cap <= 12:
                raise ValueError('Invalid operator cap')
            if apply and (config.get('enableApprovals') is not True or not config.get('overlapReconciledBy')):
                raise ValueError('Live approvals disabled')
            runtime = runtime_reader()
            resources = resource_reader()
            runtime = dict(runtime, max_workers=configured_limit)
            capacity = capacity_decision(resources, configured_limit, min(cap, configured_limit), config.get('scaling', {}), now=clock())
            stale = watchdog(runtime, {}, resources, now=clock())
            effective = copy.deepcopy(config)
            effective['cap'] = max(1, capacity['grant_limit'])
            effective_apply = apply and not capacity['hold_new_grants'] and not any(x['severity'] == 'hold' for x in stale)
            with c.locked(directory):
                before = c.load_state(directory)
                report = c.cycle(services, effective, directory, effective_apply)
                after = c.load_state(directory)
            added = [key for key, value in after['leases'].items() if value.get('status') == 'active' and before['leases'].get(key, {}).get('status') != 'active']
            report['max_workers'] = configured_limit
            report['scheduler'] = {'capacity': capacity, 'watchdog': watchdog(runtime, report, resources, now=clock()),
                                   'cycle_elapsed_seconds': max(0, clock() - started), 'new_grants': len(added),
                                   'apply_requested': apply, 'apply_effective': effective_apply, 'error': None}
            if added:
                try:
                    refresh()
                    report['scheduler']['refresh_accepted'] = True
                except Exception:
                    # The remote additive approval is already durable; never retry it here.
                    report['scheduler']['refresh_accepted'] = False
                    report['scheduler']['watchdog'].append({'code': 'runtime-refresh-unavailable', 'severity': 'notice'})
            consecutive_errors = 0
        except Exception as error:
            consecutive_errors += 1
            retryable = ((isinstance(error, host.PublicationError) and getattr(error, 'retryable', False)) or
                         (isinstance(error, urllib.error.HTTPError) and error.code in [408, 429, 500, 502, 503, 504]) or
                         (isinstance(error, (urllib.error.URLError, TimeoutError, ConnectionError)) and
                          not isinstance(error, urllib.error.HTTPError)))
            if isinstance(error, urllib.error.HTTPError):
                error.close()
            report = {'dryRun': not apply, 'max_workers': configured_limit, 'issues': [], 'selected': [],
                      'leases': {}, 'pullRequests': [], 'scheduler': {'error': 'upstream-unavailable' if retryable else 'invalid-or-deterministic-input',
                      'retryable': retryable, 'consecutive_errors': consecutive_errors,
                      'watchdog': [{'code': 'upstream-or-auth-failure', 'severity': 'hold'}],
                      'cycle_elapsed_seconds': max(0, clock() - started), 'new_grants': 0}}
        # Persist public projections only; raw issues/comments stay in host-private coordinator data.
        host.private_directory(directory)
        if metrics is not None:
            metrics.observe(runtime, report, resources, now=clock())
            c.atomic(directory / 'throughput.json', metrics.snapshot(now=clock()))
        c.atomic(directory / 'scheduler-status.json', {'version': 1, 'at': clock(), 'cycles': count + 1,
                 'scheduler': report['scheduler'], 'selected': report.get('selected', [])})
        reports.append(report)
        if report['scheduler'].get('error') and (not report['scheduler'].get('retryable') or consecutive_errors >= 3):
            break
        if count + 1 < max_cycles and not stop.is_set():
            delay = min(60, interval * (2 ** max(0, consecutive_errors - 1)))
            # Event.wait makes SIGTERM interrupt the normal CLI sleep immediately.
            if sleep is time.sleep:
                stop.wait(delay)
            else:
                sleep(delay)
    return reports


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--once', action='store_true')
    mode.add_argument('--watch', action='store_true')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--workflow', required=True, type=Path)
    parser.add_argument('--interval', type=float, default=15)
    parser.add_argument('--max-cycles', type=int, default=10000)
    args = parser.parse_args(argv)
    try:
        if args.evidence.absolute().parent != c.STATE.absolute() or args.evidence.is_symlink():
            raise ValueError('Evidence must be direct host-private coordinator file')
        workflow_limit(args.workflow)
        from throughput_metrics import MetricsStore, sample_resources
        stop = threading.Event()
        old = {sig: signal.signal(sig, lambda *_: stop.set()) for sig in [signal.SIGINT, signal.SIGTERM]}
        try:
            reports = run_loop(c.Services(), lambda: c.read_private(args.evidence), c.STATE, lambda: workflow_limit(args.workflow),
                read_runtime, sample_resources, metrics=MetricsStore(c.STATE), apply=args.apply,
                interval=args.interval, max_cycles=args.max_cycles if args.watch else 1, stop=stop)
        finally:
            for sig, handler in old.items():
                signal.signal(sig, handler)
        print(json.dumps({'cycles': len(reports), 'scheduler': reports[-1]['scheduler'] if reports else {'stopped': True}}, sort_keys=True))
        return int(bool(reports and reports[-1]['scheduler'].get('error')))
    except Exception:
        print('Scheduler stopped: invalid configuration, private state, runtime or metrics; no worker restart attempted.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
