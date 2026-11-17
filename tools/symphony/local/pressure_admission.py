"""Opt-in host-only pressure admission. No policy creation or live activation."""
import fcntl
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import time

import current_pressure

POLICY = 'darwin-current-pressure-single-worker.v2'
REVIEW_QUESTION_ID = 'call_02d17c96a5f049ee8710876f912fbee4'
POLICY_FILE = 'current-pressure-policy.json'
SAMPLES_FILE = 'current-pressure-samples.json'


def _hold(reason):
    result = current_pressure.evaluate([])
    result['reasons'] = [reason]
    result['policy'] = POLICY
    return result


def _private_state(state):
    path = Path(state).absolute()
    if any(parent.is_symlink() for parent in [path, *path.parents]):
        raise ValueError('private state path must not contain symlinks')
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('host state must be an existing private mode0700 directory')
    return path


def _safe_file(fd):
    info = os.fstat(fd)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or
            stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1 or info.st_size > 65536):
        raise ValueError('unsafe host-private file')


def _read(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd) as stream:
        _safe_file(stream.fileno())
        return json.load(stream)


def _approval(path, issue, limit, now):
    value = _read(path / POLICY_FILE)
    if (not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 2 or value.get('allowWarningPressure') is not True or
            value.get('policy') != POLICY or issue not in ('SHE-83', 'SHE-142') or value.get('issue') != issue or
            type(limit) is not int or limit != 1 or type(value.get('maxConcurrentAgents')) is not int or
            value['maxConcurrentAgents'] != 1 or
            not isinstance(value.get('reviewedBy'), str) or not value['reviewedBy'].strip() or
            not ((issue == 'SHE-83' and value.get('reviewQuestionId') == REVIEW_QUESTION_ID) or
                 (issue == 'SHE-142' and value.get('operatorAuthorization') == {
                     'source': 'direct-user-request',
                     'request': 'um okay can you make SHE-142 workable by symphony ASAP TYVM'})) or
            not current_pressure.number(value.get('expiresAt')) or not now < value['expiresAt'] <= now + 86400):
        raise ValueError('missing, revoked, mismatched or expired operator pressure approval')
    return value


def _collect():
    # Fixed trusted source, no worker-controlled executable, no shell/network.
    result = subprocess.run([sys.executable, str(Path(current_pressure.__file__).resolve())],
                            check=True, capture_output=True, text=True, timeout=7)
    if len(result.stdout) > 65536:
        raise ValueError('oversized native observation')
    value = json.loads(result.stdout)
    if not isinstance(value, dict):
        raise ValueError('invalid native observation')
    # macOS system Python's time.monotonic() may use a process-relative origin.
    # CLOCK_MONOTONIC is boot-relative across independent hook invocations.
    value['monotonic_seconds'] = time.clock_gettime(time.CLOCK_MONOTONIC)
    return value


def _save(path, value):
    fd, temporary = tempfile.mkstemp(prefix='.pressure-', dir=path)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path / SAMPLES_FILE)
        directory = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def check(issue, current_limit, state):
    """Return evaluate-shaped decision. Approval/resource errors always hold.

    Exactly one bounded observation per approved invocation, <=4 retained samples,
    no sleep. Concurrent invocation holds immediately. Does not claim work.
    """
    try:
        path = _private_state(state)
        policy = _approval(path, issue, current_limit, time.time())
        fd = os.open(path / 'current-pressure.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
        with os.fdopen(fd, 'r+') as lock:
            _safe_file(lock.fileno())
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Recheck after acquiring serialization; revocation must fail closed.
            if _approval(path, issue, current_limit, time.time()) != policy:
                return _hold('operator pressure approval changed')
            previous = []
            if (path / SAMPLES_FILE).exists() or (path / SAMPLES_FILE).is_symlink():
                previous = _read(path / SAMPLES_FILE)
                if not isinstance(previous, list) or len(previous) > 4 or not all(isinstance(s, dict) for s in previous):
                    return _hold('invalid retained pressure observations')
            sample = _collect()
            if not isinstance(sample, dict):
                return _hold('native observation unavailable')
            now = time.time()
            if _approval(path, issue, current_limit, now) != policy:
                return _hold('operator pressure approval changed during collection')
            # A reset/reboot cannot pair with older observations. Preserve it as
            # a held observation so the next call requires a fresh stable window.
            latest = previous[-1] if previous else None
            continuity = (not latest or
                          (sample.get('boot_id') == latest.get('boot_id') and
                           sample.get('page_size_bytes') == latest.get('page_size_bytes') and
                           current_pressure.number(sample.get('sampled_at')) and
                           current_pressure.number(latest.get('sampled_at')) and
                           latest['sampled_at'] <= sample['sampled_at'] <= now and
                           current_pressure.number(sample.get('monotonic_seconds')) and
                           current_pressure.number(latest.get('monotonic_seconds')) and
                           sample['monotonic_seconds'] > latest['monotonic_seconds'] and
                           current_pressure.number(sample.get('swapouts_pages')) and
                           current_pressure.number(latest.get('swapouts_pages')) and
                           sample['swapouts_pages'] >= latest['swapouts_pages']))
            if not continuity:
                previous = []
            retained = [s for s in previous if current_pressure.number(s.get('sampled_at')) and
                        0 <= now - s['sampled_at'] <= 60]
            candidates = [s for s in retained if current_pressure.number(s.get('monotonic_seconds')) and
                          current_pressure.number(sample.get('monotonic_seconds')) and
                          15 <= sample['monotonic_seconds'] - s['monotonic_seconds'] <= 30]
            # Never skip an intervening bad observation to pair old good samples.
            candidate = candidates[-1] if candidates else None
            interval = retained[retained.index(candidate):] if candidate else []
            _save(path, (retained + [sample])[-4:])
            if candidate is None:
                return _hold('fresh continuous observations 15–30 seconds apart required')
            decision = current_pressure.evaluate([candidate, sample], current_limit, now=now, allow_warning_pressure=True)
            for observation in interval:
                fields = ('sampled_at', 'monotonic_seconds', 'collection_seconds',
                          'headroom_estimate_bytes', 'swap_used_bytes', 'swapouts_pages',
                          'page_size_bytes', 'disk_free_bytes', 'cpu_busy_ratio')
                healthy = (all(current_pressure.number(observation.get(k)) for k in fields) and
                           observation.get('platform') == 'Darwin' and not observation.get('errors') and
                           type(observation.get('pressure_level')) is int and observation['pressure_level'] in (1, 2) and
                           observation.get('boot_id') == sample.get('boot_id') and
                           observation.get('page_size_bytes') == sample.get('page_size_bytes') and
                           observation['collection_seconds'] <= 10 and
                           observation['headroom_estimate_bytes'] >= (4 if observation['pressure_level'] == 2 else 2) * current_pressure.GIB and
                           observation['swap_used_bytes'] <= current_pressure.MAX_SWAP_USED_BYTES and
                           observation['disk_free_bytes'] >= 10 * current_pressure.GIB and
                           observation['cpu_busy_ratio'] <= .85)
                if not healthy:
                    decision['allow'] = False
                    decision['reasons'].append('intervening observation was not healthy')
                    break
            return decision
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError):
        return _hold('pressure admission unavailable: private state, approval or native observation invalid')
