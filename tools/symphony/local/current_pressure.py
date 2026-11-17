"""Opt-in Darwin single-worker admission recommendation; never activates policy."""
import json
import math
import platform
import re
import subprocess
import time

GIB = 1024 ** 3
MIB = 1024 ** 2
MAX_SWAP_USED_BYTES = 16 * GIB
MAX_SWAPOUT_BYTES_PER_SECOND = MIB
MAX_SWAP_GROWTH_BYTES_PER_SECOND = 256 * 1024


def number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def evaluate(samples, current_limit=1, *, now=None, allow_warning_pressure=False):
    """Evaluate exactly two trusted observations, never worker assertions.

    Epoch time controls freshness; monotonic time measures rates and detects clock
    discontinuity. The returned allow is only a resource recommendation.
    """
    now = time.time() if now is None else now
    reasons, warnings, metrics = [], [], {}
    if type(current_limit) is not int or current_limit != 1:
        reasons.append('alternative supports configured single-worker limit only')
    if not number(now):
        reasons.append('invalid evaluation time')
    if not isinstance(samples, (list, tuple)) or len(samples) != 2:
        reasons.append('exactly two observations required')
    else:
        numeric = ('sampled_at', 'monotonic_seconds', 'collection_seconds',
                   'headroom_estimate_bytes', 'swap_used_bytes', 'swapouts_pages',
                   'page_size_bytes', 'disk_free_bytes', 'cpu_busy_ratio')
        for index, sample in enumerate(samples):
            prefix = f'sample {index + 1}: '
            if not isinstance(sample, dict):
                reasons.append(prefix + 'missing observation')
                continue
            if sample.get('errors'):
                reasons.append(prefix + 'native collection failed')
            if sample.get('platform') != 'Darwin':
                reasons.append(prefix + 'Darwin required')
            if (type(sample.get('pressure_level')) is not int or
                    sample.get('pressure_level') not in ((1, 2) if allow_warning_pressure is True else (1,))):
                reasons.append(prefix + 'native pressure is not normal')
            if not isinstance(sample.get('boot_id'), str) or not sample['boot_id'].strip():
                reasons.append(prefix + 'boot identity unavailable')
            if any(not number(sample.get(key)) for key in numeric):
                reasons.append(prefix + 'missing or invalid numeric observation')
                continue
            if sample['page_size_bytes'] not in (4096, 16384) or type(sample['swapouts_pages']) is not int:
                reasons.append(prefix + 'invalid VM counter units')
            if sample['collection_seconds'] > 10:
                reasons.append(prefix + 'collection exceeded bounded observation window')
            if number(now) and not 0 <= now - sample['sampled_at'] <= 60:
                reasons.append(prefix + 'stale or future observation')
            minimum_headroom = 4 * GIB if sample.get('pressure_level') == 2 else 2 * GIB
            if sample['headroom_estimate_bytes'] < minimum_headroom:
                reasons.append(prefix + 'OS headroom estimate below required ' + str(minimum_headroom // GIB) + ' GiB')
            if allow_warning_pressure is True and sample.get('pressure_level') == 2:
                warnings.append(prefix + 'warning pressure accepted only with at least 4 GiB headroom and low paging')
            if sample['disk_free_bytes'] < 10 * GIB:
                reasons.append(prefix + 'disk below 10 GiB')
            if sample['cpu_busy_ratio'] > .85:
                reasons.append(prefix + 'CPU above 85%')
            if sample['swap_used_bytes'] > MAX_SWAP_USED_BYTES:
                reasons.append(prefix + 'swap exceeds 16 GiB')
            elif sample['swap_used_bytes'] > 0:
                warnings.append(prefix + 'historical swap present; paging checked separately')
        # Compute only with structurally valid data; pressure failures still hold.
        if all(isinstance(s, dict) and all(number(s.get(k)) for k in numeric) for s in samples):
            first, last = samples
            elapsed = last['monotonic_seconds'] - first['monotonic_seconds']
            wall = last['sampled_at'] - first['sampled_at']
            if first.get('boot_id') != last.get('boot_id'):
                reasons.append('boot changed between observations')
            if first['page_size_bytes'] != last['page_size_bytes']:
                reasons.append('VM page size changed')
            if not 15 <= elapsed <= 30 or abs(wall - elapsed) > 2:
                reasons.append('observations require continuous stable 15–30 second interval')
            if number(now) and now - last['sampled_at'] > 30:
                reasons.append('latest observation older than 30 seconds')
            delta = last['swapouts_pages'] - first['swapouts_pages']
            if delta < 0:
                reasons.append('swap-out counter reset')
            if elapsed > 0 and delta >= 0:
                metrics['swapout_bytes_per_second'] = delta * last['page_size_bytes'] / elapsed
                metrics['swap_growth_bytes_per_second'] = max(0, last['swap_used_bytes'] - first['swap_used_bytes']) / elapsed
                metrics['interval_seconds'] = elapsed
                if metrics['swapout_bytes_per_second'] > MAX_SWAPOUT_BYTES_PER_SECOND:
                    reasons.append('swap-out rate exceeds policy 1 MiB/sec')
                if metrics['swap_growth_bytes_per_second'] > MAX_SWAP_GROWTH_BYTES_PER_SECOND:
                    reasons.append('swap growth exceeds policy 256 KiB/sec')
    return {'allow': not reasons, 'reasons': reasons, 'warnings': warnings,
            'metrics': metrics, 'policy': 'darwin-current-pressure-single-worker.v2' if allow_warning_pressure is True else 'darwin-current-pressure-single-worker.v1',
            'activation': 'operator-review-required', 'active_workers_cancelled': False}


def parse_native(pressure, memory, vm, boot, swap, disk, cpu):
    """Parse actual bounded native output; parsing failure is a held observation."""
    def match(pattern, text):
        found = re.search(pattern, text)
        if not found:
            raise ValueError('required native field unavailable')
        return found
    total = int(match(r'system has (\d+)', memory)[1])
    percent = float(match(r'memory free percentage:\s*(\d+(?:\.\d+)?)%', memory)[1])
    if not 0 <= percent <= 100:
        raise ValueError('invalid memory headroom percentage')
    page_size = int(match(r'page size of (\d+) bytes', vm)[1])
    used, unit = match(r'used\s*=\s*([\d.]+)([MG])', swap).groups()
    idle = float(match(r'([\d.]+)% idle', cpu)[1])
    if not 0 <= idle <= 100:
        raise ValueError('invalid CPU percentage')
    rows = disk.strip().splitlines()
    free = int(rows[-1].split()[3]) * 1024
    return {'pressure_level': int(pressure.strip()), 'boot_id': boot.strip(),
            'headroom_estimate_bytes': total * percent / 100,
            'page_size_bytes': page_size,
            'swapouts_pages': int(match(r'^Swapouts:\s*(\d+)\.', vm)[1]) if vm.startswith('Swapouts:') else int(match(r'\nSwapouts:\s*(\d+)\.', vm)[1]),
            'swap_used_bytes': float(used) * (MIB if unit == 'M' else GIB),
            'disk_free_bytes': free, 'cpu_busy_ratio': (100 - idle) / 100}


def collect():
    """Read only; seven native commands, each capped at three seconds. No loop."""
    started = time.monotonic()
    result = {'platform': platform.system(), 'errors': []}
    if result['platform'] == 'Darwin':
        commands = [ ['/usr/sbin/sysctl', '-n', 'kern.memorystatus_vm_pressure_level'],
                     ['/usr/bin/memory_pressure', '-Q'], ['/usr/bin/vm_stat'],
                     ['/usr/sbin/sysctl', '-n', 'kern.boottime'],
                     ['/usr/sbin/sysctl', '-n', 'vm.swapusage'],
                     ['/bin/df', '-k', '/'], ['/usr/bin/top', '-l', '1', '-n', '0'] ]
        try:
            outputs = [subprocess.run(command, check=True, capture_output=True, text=True,
                                      timeout=3).stdout for command in commands]
            result.update(parse_native(*outputs))
        except (OSError, subprocess.SubprocessError, ValueError, IndexError):
            result['errors'].append('native observation unavailable; no fallback estimate')
    else:
        result['errors'].append('Darwin required')
    result.update(sampled_at=time.time(), monotonic_seconds=time.monotonic(),
                  collection_seconds=time.monotonic() - started)
    return result


if __name__ == '__main__':
    print(json.dumps(collect(), sort_keys=True))
