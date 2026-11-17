#!/usr/bin/env python3
"""Host-only disposable prerequisite probe; never launches a model or approves issues."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import time

REPOSITORY = 'https://github.com/adnanwahab/happybearlandia.git'
BASE = 'sprint/one-city-two-futures-20261111'


class Blocked(Exception):
    pass


def command(argv, cwd, *, env=None, timeout=60):
    """Never expose subprocess output: remote errors may contain credentials."""
    try:
        process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, start_new_session=True)
    except OSError:
        raise Blocked('command unavailable or timed out; remote output omitted') from None
    try:
        stdout, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        # Git/Bun can spawn descendants that retain pipes or keep writing the clone.
        # Terminate this command's private group before disposable-directory cleanup.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.communicate()
        raise Blocked('command unavailable or timed out; remote output omitted') from None
    if process.returncode:
        raise Blocked(f'command exited {process.returncode}; remote output omitted')
    return stdout.strip()


def verify_isolation(root):
    root = root.resolve()
    metadata = root / '.git'
    if metadata.is_symlink() or not metadata.is_dir():
        raise Blocked('independent .git directory required')
    for path in metadata.rglob('*'):
        if path.is_symlink():
            raise Blocked('symlink in Git metadata')
    if (metadata / 'objects/info/alternates').exists():
        raise Blocked('external Git object storage')
    for args in (['--absolute-git-dir'], ['--path-format=absolute', '--git-common-dir']):
        if Path(command(['git', 'rev-parse', *args], root)).resolve() != metadata:
            raise Blocked('Git metadata escapes workspace')
    # Actual writes, rather than access() permission guesses.
    for directory in (root, metadata):
        with tempfile.TemporaryFile(dir=directory) as probe:
            probe.write(b'preflight\n')
            probe.flush()


def worker_environment():
    # No host API keys, credential helpers, Git configuration or injected Git paths.
    return {**{k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR') if k in os.environ},
            'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
            'GIT_TERMINAL_PROMPT': '0', 'GIT_AUTHOR_NAME': 'Symphony preflight',
            'GIT_AUTHOR_EMAIL': 'preflight@example.invalid',
            'GIT_COMMITTER_NAME': 'Symphony preflight',
            'GIT_COMMITTER_EMAIL': 'preflight@example.invalid'}


def credential_guard(home=None):
    """Match the installed before_run guard before invoking any sandbox probe."""
    home = Path.home() if home is None else Path(home)
    config = Path(os.environ.get('GH_CONFIG_DIR', home / '.config/gh'))
    for path in (config / 'hosts.yml', home / '.git-credentials', home / '.netrc'):
        if path.exists():
            value = path.read_text()
            if (path.name == 'hosts.yml' and re.search(r'oauth_token:\s*\S+', value)) or (
                    path.name != 'hosts.yml' and 'github' in value.lower()):
                raise Blocked('plaintext GitHub credential file; host Keychain authentication required')


def probe(root_parent, *, repository=REPOSITORY, run=command, sandbox=True,
          install=True, host_auth=True, min_free_bytes=10 * 1024**3, object_cache=None):
    """The internal repository override exists for offline tests; CLI pins GitHub."""
    report = {'version': 1, 'startedAt': time.time(), 'base': BASE, 'checks': [],
              'ready': False, 'disposableCloneRemoved': False,
              'scope': 'host prerequisites only; no issue readiness or execution approval'}
    stage = 'disk'
    temporary = None
    try:
        parent = Path(root_parent).resolve(strict=True)
        report['freeBytes'] = shutil.disk_usage(parent).free
        if report['freeBytes'] < min_free_bytes:
            raise Blocked('insufficient disk space')
        report['checks'].append(stage)
        stage = 'executables'
        needed = ['git', 'bun'] + (['codex'] if sandbox or host_auth else []) + (['gh'] if host_auth else [])
        if any(shutil.which(name) is None for name in needed):
            raise Blocked('required executable unavailable')
        report['checks'].append(stage)
        if host_auth:
            stage = 'host-credential-boundary'
            credential_guard()
            report['checks'].append(stage)
            stage = 'host-authentication'
            run(['codex', 'login', 'status'], parent)
            run(['gh', 'auth', 'status'], parent)
            run(['gh', 'repo', 'view', 'adnanwahab/happybearlandia', '--json', 'viewerPermission'], parent)
            permission = json.loads(run(['gh', 'api', 'repos/adnanwahab/happybearlandia',
                                         '--jq', '.permissions.push'], parent))
            if permission is not True:
                raise Blocked('GitHub host lacks push permission')
            report['checks'].append(stage)
        stage = 'isolated-clone'
        # A freshly allocated directory is exclusive ownership; never reuse a ticket checkout.
        temporary = tempfile.TemporaryDirectory(prefix='hbl-preflight-', dir=parent)
        root = Path(temporary.name) / 'probe'
        if object_cache is None:
            run(['git', 'clone', '--no-local', '--single-branch', '--branch', BASE,
                 repository, str(root)], parent, timeout=180)
        else:
            # Copy objects, never hardlink/alternate or copy uncommitted source.
            # No cached code runs before the approved remote fetch and checkout.
            run(['git', 'clone', '--no-local', '--no-checkout',
                 str(Path(object_cache).resolve(strict=True)), str(root)], parent, timeout=180)
            run(['git', 'remote', 'set-url', 'origin', repository], root)
            report['objectCacheUsed'] = True
        verify_isolation(root)
        report['checks'].append(stage)
        stage = 'host-baseline-fetch'
        run(['git', 'fetch', 'origin', BASE], root, timeout=90)
        base_sha = run(['git', 'rev-parse', 'FETCH_HEAD'], root)
        if object_cache is None:
            run(['git', 'merge', '--ff-only', 'FETCH_HEAD'], root)
        else:
            run(['git', 'checkout', '-B', BASE, 'FETCH_HEAD'], root)
        report['baseSha'] = base_sha
        report['checks'].append(stage)
        environment = worker_environment()
        def worker(argv, timeout=60):
            if sandbox:
                argv = ['codex', 'sandbox', '-P', 'preflight', '-c',
                        'permissions={preflight={extends=":workspace",filesystem={":workspace_roots"={".git"="write"}}}}',
                        '-C', str(root), *argv]
            return run(argv, root, env=environment, timeout=timeout)
        stage = 'sandbox-local-commit' if sandbox else 'local-commit-fixture'
        worker(['git', 'switch', '-c', 'symphony/PREFLIGHT'])
        # Empty probe commits modify only this disposable clone, never an issue or remote.
        worker(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
                'commit', '--allow-empty', '-m', 'Disposable prerequisite probe'])
        head = run(['git', 'rev-parse', 'HEAD'], root)
        if head == base_sha:
            raise Blocked('probe commit was not created')
        report['probeCommit'] = head
        report['checks'].append(stage)
        if install:
            stage = 'dependency-install'
            # Trusted sprint lockfile only; lifecycle scripts are never executed on host.
            run(['bun', 'install', '--frozen-lockfile', '--ignore-scripts'], root, timeout=300)
            report['checks'].append(stage)
            stage = 'sandbox-dependency-import' if sandbox else 'dependency-import-fixture'
            worker(['bun', '-e', 'await import("@playwright/test"); await import("three");'], timeout=60)
            if run(['git', 'status', '--porcelain'], root):
                raise Blocked('dependency installation changed tracked or untracked source')
            report['checks'].append(stage)
        report['ready'] = sandbox and install and host_auth
        report['fixtureOnly'] = not report['ready']
    except (Blocked, OSError, ValueError) as error:
        # Only locally generated classifications; never interpolate external exceptions.
        report['blockedAt'] = stage
        report['error'] = str(error) if isinstance(error, Blocked) else 'local prerequisite failed; details omitted'
    finally:
        if temporary is not None:
            temporary.cleanup()
            report['disposableCloneRemoved'] = not Path(temporary.name).exists()
        report['finishedAt'] = time.time()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--temporary-root', type=Path, default=Path(tempfile.gettempdir()))
    parser.add_argument('--object-cache', type=Path,
                        help='Optional read-only local Git object source; remote sprint fetch remains mandatory')
    args = parser.parse_args()
    report = probe(args.temporary_root, object_cache=args.object_cache)
    print(json.dumps(report, indent=2))
    return 0 if report['ready'] else 75


if __name__ == '__main__':
    raise SystemExit(main())
