#!/usr/bin/env python3
"""launchd bootstrap for the existing coordinator and one Symphony process.

Host-private config and credential files only; never a model/issue command runner.
Render plists separately. Installing/replacing an existing runtime is an explicit
operator handoff, not a side effect of rendering or running coordinator dry-run.
"""
import argparse
from datetime import datetime
import fcntl
import json
import os
from pathlib import Path
import plistlib
import signal
import socket
import stat
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request

import backlog_coordinator as c
import coordinator_host as host
import assignment_lifecycle as a
import publish


def event(code, **fields):
    print(json.dumps(dict(code=code, at=time.time(), **fields), sort_keys=True), flush=True)


def private_path(path):
    path = Path(path)
    if not path.is_absolute() or any(p.is_symlink() for p in [path, *path.parents]):
        raise ValueError('private path must be canonical')
    return path


def configuration(path):
    path = private_path(path)
    if path.parent != host.STATE / 'supervisor':
        raise ValueError('config must be in private supervisor directory')
    info = path.parent.stat()
    if info.st_mode & 0o077 or info.st_uid != os.getuid():
        raise ValueError('private config directory required')
    value = c.read_private(path)
    if value.get('version') != 1 or type(value.get('coordinatorApply')) is not bool:
        raise ValueError('explicit coordinator mode required')
    directories = value.get('toolchainDirectories')
    if not isinstance(directories, list) or any(not isinstance(item, str) for item in directories):
        raise ValueError('explicit host toolchain directories required')
    roots = [Path.home()/'.nvm/versions/node', Path.home()/'.local/share/mise/installs', Path.home()/'.bun/bin']
    for item in directories:
        toolchain = private_path(item)
        if not toolchain.is_dir() or not any(toolchain.is_relative_to(root) for root in roots):
            raise ValueError('toolchain must be a canonical host-managed installation')
    for field in ['code', 'workflow', 'evidence', 'linearKeyFile', 'symphonyExecutable']:
        target = private_path(value[field])
        if not any(target.is_relative_to(root) for root in [Path.home() / 'happybearlandia', host.STATE]):
            raise ValueError('host-managed path required')
    if Path(value['evidence']).parent != c.STATE:
        raise ValueError('coordinator evidence must remain host-private')
    return value


def command(service, config):
    if service == 'coordinator':
        return ['/usr/bin/python3', str(Path(config['code']) / 'throughput_scheduler.py'), '--watch',
                '--evidence', config['evidence'], '--workflow', config['workflow'],
                *(['--apply'] if config['coordinatorApply'] else [])]
    return [config['symphonyExecutable'],
            '--i-understand-that-this-will-be-running-without-the-usual-guardrails',
            '--port', '43111', config['workflow']]


def validate_workflow(path):
    from throughput_scheduler import workflow_limit
    limit = workflow_limit(path)
    front = Path(path).read_text().split('---', 2)[1]
    required = [r'  approval_policy: never', r'  thread_sandbox: workspace-write',
                r'    type: workspaceWrite', r'  root: ~/code/symphony-source-only',
                r'  required_labels: \["symphony-pilot", "symphony-pressure-release"\]']
    if any(not re.search('^' + pattern + '$', front, re.M) for pattern in required):
        raise ValueError('source-only approval/sandbox/resource filters required')
    if 'writableRoots' in front or not all('-u ' + name in front for name in ['LINEAR_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN']):
        raise ValueError('no metadata exception or worker credential inheritance')
    return limit


def runtime_health(now=None):
    now = time.time() if now is None else now
    with urllib.request.urlopen('http://127.0.0.1:43111/api/v1/state', timeout=5) as response:
        value = json.load(response)
    generated = datetime.fromisoformat(value['generated_at'].replace('Z', '+00:00')).timestamp()
    return -5 <= now - generated <= 60 and all(
        type(value['counts'][k]) is int and len(value[k]) == value['counts'][k]
        for k in ['running', 'retrying', 'blocked'])


def port_in_use():
    with socket.socket() as check:
        return check.connect_ex(('127.0.0.1', 43111)) == 0


def environment(config):
    path = private_path(config['linearKeyFile'])
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(fd)
        if info.st_mode & 0o077 or info.st_size > 8192:
            raise ValueError('credential must already be private and bounded')
        host.private_file(fd)
        key = stream.read(8193).strip()
    if not key or len(key) > 8192 or '\n' in key:
        raise ValueError('invalid private credential')
    # Never inherited by model: WORKFLOW must retain existing stripped worker env.
    return {'HOME': str(Path.home()), 'PATH': publish.TRUSTED_PATH + ''.join(':' + item for item in config['toolchainDirectories']),
            'LINEAR_API_KEY': key, 'PYTHONDONTWRITEBYTECODE': '1'}


def render(path, output):
    config = configuration(path)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    logs = host.STATE / 'supervisor/logs'
    for service in ['coordinator', 'symphony']:
        label = 'com.happybearlandia.' + service
        item = {'Label': label, 'ProgramArguments': ['/usr/bin/python3',
                str(Path(config['code']) / 'supervisor.py'), '--config', str(path), '--service', service],
                'RunAtLoad': True, 'KeepAlive': {'SuccessfulExit': False}, 'ThrottleInterval': 60, 'Umask': 63,
                'ProcessType': 'Background', 'ExitTimeOut': 60,
                'WorkingDirectory': str(host.STATE),
                'StandardOutPath': str(logs / (service + '.log')),
                'StandardErrorPath': str(logs / (service + '.err.log'))}
        with (output / (label + '.plist')).open('wb') as stream:
            plistlib.dump(item, stream)
    return output


def existing_coordinator():
    result = subprocess.run(['/bin/ps', '-axo', 'command='], capture_output=True, text=True, timeout=5)
    if result.returncode:
        raise ValueError('coordinator process inventory unavailable')
    import shlex
    for line in result.stdout.splitlines():
        try: argv = shlex.split(line)
        except ValueError: continue
        if len(argv) > 1 and argv[1].endswith('/throughput_scheduler.py') and '--watch' in argv:
            return True
    return False


def coordinator_health(started):
    status = c.read_private(c.STATE / 'scheduler-status.json', limit=65536)
    return started <= status['at'] <= time.time()+5 and time.time()-status['at'] <= 120 and not status['scheduler'].get('error')


def run(service, config, stop=None):
    stop = stop or threading.Event()
    state = host.STATE / 'supervisor'
    a.protected(host.STATE); a.protected(state); a.protected(state / 'logs')
    fd = os.open(state / (service + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        host.private_file(fd)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if (service == 'symphony' and port_in_use()) or (service == 'coordinator' and existing_coordinator()):
            event('existing-runtime-held', action='operator must hand off existing owner; never start a second instance')
            return 0  # terminal hold; selective launchd KeepAlive must not spin
        validate_workflow(config['workflow'])
        env = environment(config)
        if service == 'symphony' and any(not shutil.which(tool, path=env['PATH']) for tool in ['codex', 'elixir', 'erl']):
            raise ValueError('reviewed host toolchain incomplete')
        budget_path = state / (service + '-restart.json')
        generation = a.checksum(config)
        budget = c.read_private(budget_path, limit=65536) if budget_path.exists() else {}
        if budget.get('generation') != generation:
            budget = {'generation': generation, 'attempts': 0}
        if type(budget.get('attempts')) is not int or not 0 <= budget['attempts'] <= 3:
            raise ValueError('invalid durable restart budget')
        while not stop.is_set():
            if budget['attempts'] >= 3:
                event('bounded-restarts-exhausted', service=service,
                      action='review cause and advance private restartGeneration; no automatic child restart')
                return 0
            # Reserve before spawn: a wrapper crash cannot erase failure history.
            budget['attempts'] += 1
            c.atomic(budget_path, budget)
            started = time.time()
            child = subprocess.Popen(command(service, config), cwd=host.STATE, env=env)
            event('supervised-start', service=service, pid=child.pid)
            stable = False
            while child.poll() is None:
                if stop.wait(10):
                    child.send_signal(signal.SIGTERM)
                    child.wait()
                    return 0
                try:
                    healthy = runtime_health() if service == 'symphony' else coordinator_health(started)
                except Exception: healthy = False
                if not healthy:
                    event('runtime-health-held', pid=child.pid, action='inspect host logs; no forced restart of active work')
                elif not stable and time.time()-started >= 300:
                    # Only an observed stable service resets the durable budget.
                    budget['attempts'] = 0; c.atomic(budget_path, budget); stable = True
            event('supervised-exit', service=service, exit=child.returncode, attempt=budget['attempts'])
            if child.returncode == 0:
                # Bounded --watch completes normally; continue supervision until
                # launchd/operator stops this wrapper, without counting failure.
                budget['attempts'] = 0; c.atomic(budget_path, budget)
            if budget['attempts'] >= 3:
                continue
            if stop.wait(min(60, 10 * 2 ** max(0, budget['attempts']-1))): return 0
            if (service == 'symphony' and port_in_use()) or (service == 'coordinator' and existing_coordinator()):
                event('replacement-runtime-held'); return 0
        return 0
    except BlockingIOError:
        event('duplicate-supervisor-held', service=service); return 0
    finally:
        os.close(fd)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--service', choices=['coordinator', 'symphony'])
    mode.add_argument('--render', type=Path)
    args = parser.parse_args(argv)
    try:
        if args.render:
            render(args.config, args.render); return 0
        config = configuration(args.config)
        stop = threading.Event()
        for sig in [signal.SIGINT, signal.SIGTERM]: signal.signal(sig, lambda *_: stop.set())
        return run(args.service, config, stop)
    except Exception:
        event('supervision-held', action='check private config, credentials, permissions and host logs; no details logged')
        return 0 if args.service else 1


if __name__ == '__main__':
    sys.exit(main())
