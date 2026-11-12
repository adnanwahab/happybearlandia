"""Private, redacted observations for the existing Symphony dashboard.

Observations are not approvals. Repository PR rates are explicitly separate from
Symphony branch rates, and unavailable counters remain null rather than zero.
"""
import datetime as dt
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import subprocess
import time

REPO = 'adnanwahab/happybearlandia'
ISSUE = re.compile(r'SHE-[1-9][0-9]*\Z')
SHA = re.compile(r'[a-f0-9]{40}\Z')
RESOURCE_KEYS = ('available_memory_bytes', 'total_memory_bytes', 'swap_used_bytes',
                 'disk_free_bytes', 'cpu_load_ratio', 'cpu_count', 'sampled_at')
WATCHDOG_CODES = {key: key for key in ('orphaned_worker', 'expired_lease', 'unresponsive_session',
    'missing_draft', 'authentication', 'disk_pressure', 'memory_pressure', 'eligible_idle',
    'stalled_ci', 'unknown_resources')}
WATCHDOG_CODES.update({
    'stale-runtime': 'stale_runtime', 'runtime-time-unavailable': 'runtime_time_unavailable',
    'retained-lease-needs-reconciliation': 'retained_lease_needs_reconciliation',
    'worker-unobserved-or-publication-missing': 'worker_unobserved_or_publication_missing',
    'commit-without-draft-pr': 'missing_draft', 'stalled-ci': 'stalled_ci',
    'runtime-refresh-unavailable': 'runtime_refresh_unavailable',
    'upstream-or-auth-failure': 'upstream_or_auth_failure', 'resource-pressure': 'resource_pressure',
    'approval-policy-disabled': 'approval_policy_disabled',
    'eligible-work-awaiting-dispatch': 'eligible_idle',
})
API_KEYS = ('linear_reads', 'github_reads', 'errors', 'throttles', 'retries', 'scan_seconds',
            'github_retries', 'linear_retries', 'nested_continuation_calls')

STAGES = {'running', 'retrying', 'blocked', 'eligible', 'claimed', 'draft', 'merged', 'commit',
          'ci_passed', 'ci_failed', 'worker_failed', 'pr_opened'}


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def timestamp(value):
    if number(value) is not None:
        return float(value)
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.timestamp() if parsed.tzinfo else None
    except (ValueError, AttributeError, TypeError):
        return None


def identifier(value):
    return value if isinstance(value, str) and ISSUE.fullmatch(value) else None


def _run(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=2,
                                env={'PATH': os.environ.get('PATH', '/usr/bin:/bin')})
        return result.stdout if result.returncode == 0 else ''
    except (OSError, subprocess.TimeoutExpired):
        return ''


def sample_resources(root=None):
    """Read OS counters, without credentials or process command-line contents."""
    result = {key: None for key in RESOURCE_KEYS}
    result.update(sampled_at=time.time(), cpu_count=os.cpu_count())
    try:
        result['cpu_load_ratio'] = os.getloadavg()[0] / result['cpu_count'] if result['cpu_count'] else None
    except OSError:
        pass
    try:
        result['disk_free_bytes'] = shutil.disk_usage(root or Path.cwd()).free
    except OSError:
        pass
    if os.uname().sysname == 'Darwin':
        physical = _run(['sysctl', '-n', 'hw.memsize']).strip()
        result['total_memory_bytes'] = int(physical) if physical.isdigit() else None
        memory = _run(['vm_stat'])
        page = re.search(r'page size of (\d+) bytes', memory)
        free = re.search(r'Pages free:\s*(\d+)', memory)
        speculative = re.search(r'Pages speculative:\s*(\d+)', memory)
        # Conservative immediately available pages; does not call inactive memory free.
        if page and free and speculative:
            result['available_memory_bytes'] = int(page[1]) * (int(free[1]) + int(speculative[1]))
        swap = re.search(r'used\s*=\s*([\d.]+)([MG])', _run(['sysctl', 'vm.swapusage']))
        if swap:
            result['swap_used_bytes'] = int(float(swap[1]) * (1024 ** (2 if swap[2] == 'M' else 3)))
    else:
        try:
            values = dict(re.findall(r'^(\w+):\s+(\d+) kB', Path('/proc/meminfo').read_text(), re.M))
            for key, field in [('total_memory_bytes', 'MemTotal'), ('available_memory_bytes', 'MemAvailable')]:
                result[key] = int(values[field]) * 1024 if field in values else None
            if 'SwapTotal' in values and 'SwapFree' in values:
                result['swap_used_bytes'] = (int(values['SwapTotal']) - int(values['SwapFree'])) * 1024
        except OSError:
            pass
    return result


def _reason(value):
    """Closed categories only: issue comments and arbitrary errors never persist."""
    if not isinstance(value, str):
        return 'unclassified'
    categories = [('ownership', ('ownership', 'scope', 'interface')), ('dependency', ('prerequisite', 'dependenc')),
                  ('approval', ('review', 'approval', 'label')), ('existing_work', ('existing', 'duplicate', 'prior')),
                  ('capacity', ('capacity',)), ('state', ('Todo', 'archived', 'active'))]
    lowered = value.lower()
    return next((name for name, words in categories if any(word.lower() in lowered for word in words)), 'unclassified')


class MetricsStore:
    def __init__(self, directory):
        self.directory = Path(directory).absolute()
        if self.directory.is_symlink():
            raise ValueError('Metrics directory cannot be a symlink')
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        info = self.directory.stat()
        if info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('Metrics directory must be host-owned and private')
        self.path = self.directory / 'throughput.sqlite'
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or info.st_mode & 0o077:
                raise ValueError('Metrics database must be a private host-owned regular file')
        finally:
            os.close(fd)
        with self._db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS meta(version INTEGER NOT NULL)')
            version = db.execute('SELECT version FROM meta').fetchone()
            if version is None:
                db.execute('INSERT INTO meta VALUES (1)')
            elif version[0] != 1:
                raise ValueError('Unsupported metrics version; preserve state for reconciliation')
            db.execute('CREATE TABLE IF NOT EXISTS samples(at REAL PRIMARY KEY, payload TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS events(key TEXT PRIMARY KEY, at REAL NOT NULL, issue TEXT, stage TEXT NOT NULL, source TEXT NOT NULL, pr_number INTEGER)')
            db.execute('CREATE INDEX IF NOT EXISTS events_at ON events(at)')

    @contextmanager
    def _db(self):
        # Parent directory is private; reject replacement of the database before opening.
        info = self.path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('Unsafe metrics database')
        db = sqlite3.connect(self.path, timeout=5)
        try:
            db.execute('PRAGMA journal_mode=DELETE')
            with db:
                yield db
        finally:
            db.close()

    def observe(self, runtime, report, resources, now=None):
        now = time.time() if now is None else timestamp(now)
        if now is None:
            raise ValueError('Observation timestamp is invalid')
        runtime, report, resources = (x if isinstance(x, dict) else {} for x in (runtime, report, resources))
        counts = runtime.get('counts') if isinstance(runtime.get('counts'), dict) else {}
        workers, events = [], []
        for stage in ('running', 'retrying', 'blocked'):
            entries = runtime.get(stage) if isinstance(runtime.get(stage), list) else []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                issue = identifier(entry.get('issue_identifier') or entry.get('identifier'))
                if not issue:
                    continue
                started = timestamp(entry.get('started_at'))
                workers.append({'issue': issue, 'stage': stage,
                                'elapsed_seconds': max(0, now - started) if started is not None else None})
                # Session values never persist; a bounded hash is not needed for stage transitions.
                events.append((f'worker:{issue}:{stage}:{started if started is not None else "observed"}',
                               started if started is not None and stage == 'running' else now, issue, stage, 'runtime', None))
        rows = report.get('issues') if isinstance(report.get('issues'), list) else []
        reasons, ready = {}, 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            if row.get('eligible') is True:
                ready += 1
            for reason in row.get('reasons', []) if isinstance(row.get('reasons'), list) else []:
                category = _reason(reason)
                reasons[category] = reasons.get(category, 0) + 1
        totals = runtime.get('codex_totals') if isinstance(runtime.get('codex_totals'), dict) else {}
        scan = report.get('scanMetrics') if isinstance(report.get('scanMetrics'), dict) else report.get('scan_metrics', {})
        scan = scan if isinstance(scan, dict) else {}
        aliases = {'linear_reads': 'linearQueryCalls', 'github_reads': 'githubCommandCalls',
                   'scan_seconds': 'elapsedSeconds', 'github_retries': 'githubRetries',
                   'nested_continuation_calls': 'nestedContinuationCalls'}
        api = {key: number(scan.get(key, scan.get(aliases.get(key)))) for key in API_KEYS}
        # Logical query calls are measured; hidden Linear transport retries and
        # HTTP throttles are not inferred from successful logical calls.
        api['read_counter_scope'] = 'logical_transport_calls'
        payload = {'runtime': {stage: number(counts.get(stage)) for stage in ('running', 'retrying', 'blocked')},
                   'workers': workers, 'max_workers': number(report.get('max_workers', runtime.get('max_workers'))),
                   'queue': {'ready': ready if isinstance(report.get('issues'), list) else None, 'blocked': sum(bool(r.get('reasons')) for r in rows if isinstance(r, dict)) if isinstance(report.get('issues'), list) else None,
                             'remaining_estimate': len(rows) if isinstance(report.get('issues'), list) else None, 'blocking_reasons': [{'reason': k, 'count': v} for k, v in sorted(reasons.items())]},
                   'resources': {key: number(resources.get(key)) for key in RESOURCE_KEYS},
                   'tokens': {key: number(totals.get(key + '_tokens')) for key in ('total', 'input', 'output')}, 'api': api,
                   'watchdog': [], 'pr_inventory_observed': isinstance(report.get('pullRequests'), list)}
        scheduler = report.get('scheduler') if isinstance(report.get('scheduler'), dict) else {}
        watchdog = report.get('watchdog', scheduler.get('watchdog', []))
        for row in watchdog if isinstance(watchdog, list) else []:
            if isinstance(row, dict) and isinstance(row.get('code'), str) and row['code'] in WATCHDOG_CODES:
                severity = row.get('severity')
                alarm = {'code': WATCHDOG_CODES[row['code']],
                         'severity': severity if isinstance(severity, str) and severity in {'notice', 'warning', 'hold', 'error'} else 'warning',
                         'issue': identifier(row.get('issue'))}
                if type(row.get('pr')) is int and row['pr'] > 0:
                    alarm['pr_number'] = row['pr']
                payload['watchdog'].append(alarm)
        for pr in report.get('pullRequests', []) if isinstance(report.get('pullRequests'), list) else []:
            if not isinstance(pr, dict) or type(pr.get('number')) is not int or pr['number'] <= 0:
                continue
            n = pr['number']
            if pr.get('html_url') != f'https://github.com/{REPO}/pull/{n}':
                continue
            head = pr.get('head') if isinstance(pr.get('head'), dict) else {}
            branch = head.get('ref', '')
            issue = identifier(branch.removeprefix('symphony/')) if isinstance(branch, str) and branch.startswith('symphony/') else None
            head_repo = head.get('repo') if isinstance(head.get('repo'), dict) else {}
            source = 'symphony_pr' if issue and head_repo.get('full_name') == REPO else 'repository_pr'
            for stage, field in [('pr_opened', 'created_at'), ('merged', 'merged_at')]:
                at = timestamp(pr.get(field))
                if at is not None and at <= now:
                    events.append((f'pr:{n}:{stage}', at, issue, stage, source, n))
        # Optional explicit lifecycle observations from a trusted host collector.
        # Missing commit/CI timestamps are never guessed from PR update time.
        for event in report.get('events', []) if isinstance(report.get('events'), list) else []:
            if not isinstance(event, dict):
                continue
            issue, at = identifier(event.get('issue')), timestamp(event.get('at'))
            stage, source = event.get('stage'), event.get('source')
            if (issue and at is not None and at <= now and isinstance(stage, str) and stage in STAGES
                    and isinstance(source, str) and source in {'symphony_log', 'git', 'github', 'coordinator'}):
                events.append((f'host:{issue}:{stage}:{source}:{at}', at, issue, stage, source, None))
        with self._db() as db:
            # One transaction atomically retains the sample and lifecycle discoveries.
            db.execute('INSERT OR IGNORE INTO samples VALUES (?,?)', (now, json.dumps(payload, allow_nan=False)))
            db.executemany('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?)', events)
        return self.snapshot(now)

    def snapshot(self, now=None):
        now = time.time() if now is None else timestamp(now)
        if now is None:
            raise ValueError('Snapshot timestamp is invalid')
        window = 3600
        with self._db() as db:
            raw = db.execute('SELECT at,payload FROM samples WHERE at<=? ORDER BY at DESC LIMIT 1000', (now,)).fetchall()
            recent_events = db.execute('SELECT at,issue,stage,source,pr_number FROM events WHERE at>=? AND at<=? ORDER BY at,key', (now-window, now)).fetchall()
            prs = db.execute("SELECT pr_number,stage,at FROM events WHERE stage IN ('pr_opened','merged') AND at<=?", (now,)).fetchall()
        samples = [(at, json.loads(payload)) for at, payload in reversed(raw)]
        latest = samples[-1][1] if samples else {}
        observed, capacity, busy = 0.0, 0.0, 0.0
        for (at, row), (end, _) in zip(samples, samples[1:]):
            start = max(at, now-window)
            span = end-start
            maximum, running = row.get('max_workers'), row.get('runtime', {}).get('running')
            if span > 0 and span <= 120 and maximum is not None and maximum > 0 and running is not None:
                observed += span
                capacity += span*maximum
                busy += span*min(running, maximum)
        token_data = dict(latest.get('tokens', {'total': None, 'input': None, 'output': None}))
        token_data.update(delta_total=None, delta_seconds=None, tokens_per_second=None, counter_reset=False)
        if len(samples) > 1:
            a, b = samples[-2:]
            old, new = a[1]['tokens']['total'], b[1]['tokens']['total']
            if old is not None and new is not None and b[0] > a[0]:
                reset = new < old
                delta = None if reset else new-old
                token_data.update(delta_total=delta, delta_seconds=b[0]-a[0], counter_reset=reset,
                                  tokens_per_second=delta/(b[0]-a[0]) if delta is not None else None)
        grouped = {}
        for n, stage, at in prs:
            grouped.setdefault(n, {})[stage] = at
        cycles = sorted(x['merged']-x['pr_opened'] for x in grouped.values() if 'merged' in x and 'pr_opened' in x and x['merged'] >= now-window and x['merged'] >= x['pr_opened'])
        median = (cycles[(len(cycles)-1)//2] + cycles[len(cycles)//2])/2 if cycles else None
        p95 = cycles[math.ceil(.95*len(cycles))-1] if cycles else None
        rates = {name: sum(stage == target and (not symphony or source == 'symphony_pr') for _, _, stage, source, _ in recent_events)
                 for name, target, symphony in [('prs_opened_per_hour', 'pr_opened', False), ('prs_merged_per_hour', 'merged', False),
                                                ('symphony_prs_opened_per_hour', 'pr_opened', True), ('symphony_prs_merged_per_hour', 'merged', True)]}
        if not latest.get('pr_inventory_observed'):
            rates = {key: None for key in rates}
        runtime = dict(latest.get('runtime', {'running': None, 'retrying': None, 'blocked': None}))
        runtime.update(max_workers=latest.get('max_workers'), workers=latest.get('workers', []))
        queue = latest.get('queue', {'ready': None, 'blocked': None, 'remaining_estimate': None, 'blocking_reasons': []})
        queue = dict(queue, retrying=runtime.get('retrying'))
        return {'schema_version': 1, 'generated_at': now, 'window_seconds': window,
                'runtime': runtime, 'queue': queue, 'rates': rates,
                'cycle_times': {'scope': 'pr_creation_to_merge', 'median_seconds': median, 'p95_seconds': p95, 'samples': len(cycles), 'small_sample': len(cycles) < 20},
                'utilization': {'fraction': busy/capacity if capacity else None, 'idle_fraction': 1-busy/capacity if capacity else None,
                                'observed_seconds': observed, 'capacity_seconds': capacity, 'samples': len(samples)},
                'resources': latest.get('resources', {key: None for key in RESOURCE_KEYS}), 'tokens': token_data,
                'api': latest.get('api', {key: None for key in API_KEYS}),
                'quality': {'first_pass_ci_success_rate': None, 'retry_rate': None, 'failure_rate': None,
                            'reason': 'CI attempt and worker outcome history not supplied by current sources'},
                'watchdog': latest.get('watchdog', []),
                'timeline': [{'at': at, 'issue': issue, 'stage': stage, 'source': source, 'pr_number': n} for at, issue, stage, source, n in recent_events[-200:]],
                'limitations': ['Sampled utilization excludes gaps over 120 seconds and times before observation.',
                                'Repository PR metrics are not attributed to Symphony without an exact same-repository symphony issue branch.',
                                'Cycle time measures PR creation to merge, not eligibility to delivery; samples below 20 are descriptive only.']}
