#!/usr/bin/env python3
"""Check/install the pinned local Symphony lifecycle patch, preserving source backups."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

BUNDLE = Path(__file__).with_name('overlays')
FILES = {'lib/symphony_elixir/agent_runner.ex', 'lib/symphony_elixir/workspace.ex',
         'lib/symphony_elixir/orchestrator.ex', 'lib/symphony_elixir_web/factory_throughput.ex',
         'test/symphony_elixir/factory_throughput_test.exs', 'test/symphony_elixir/core_test.exs', 'lib/symphony_elixir/config/schema.ex',
         'test/symphony_elixir/workspace_and_config_test.exs', 'README.md'}
TESTS = ('agent_runner_handoff_test.exs', 'host_handoff_parking_test.exs')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise ValueError('Expected an unshared regular source file')
    return path.read_bytes()


def expected(root):
    manifest = json.loads((BUNDLE/'handoff-lifecycle.json').read_text())
    if manifest.get('version') != 1 or set(manifest.get('files', {})) != FILES:
        raise ValueError('Unsupported pinned source manifest')
    original = {name: read_regular(root/name) for name in FILES}
    states = {side for side in ['before', 'after'] if all(
        sha(original[name]) == manifest['files'][name][side] for name in FILES)}
    if not states:
        raise ValueError('Source differs from pinned installation; preserve and reconcile')
    patched = dict(original)
    if 'before' in states:
        with tempfile.TemporaryDirectory(prefix='hbl-lifecycle-patch-') as directory:
            staging = Path(directory)
            for name, data in original.items():
                target = staging/name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
            subprocess.run(['patch', '--batch', '--fuzz=0', '-p1', '-i', str((BUNDLE/'handoff-lifecycle.patch').resolve())],
                           cwd=staging, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            patched = {name: read_regular(staging/name) for name in FILES}
        if any(sha(data) != manifest['files'][name]['after'] for name, data in patched.items()):
            raise ValueError('Patched source checksum mismatch')
    for test in TESTS:
        name = 'test/symphony_elixir/'+test
        data = (BUNDLE/test).read_bytes()
        if (root/name).exists() or (root/name).is_symlink():
            if read_regular(root/name) != data:
                raise ValueError('Existing test differs; preserve newer work')
            original[name] = data
        else:
            original[name] = None
        patched[name] = data
    return original, patched


def install(root, backup=None):
    original, patched = expected(root)
    changed = [name for name in patched if original[name] != patched[name]]
    if backup is None:
        return {'check_only': True, 'changed_files': sorted(changed)}
    if not backup.is_absolute() or backup.exists():
        raise ValueError('Use a new absolute backup directory')
    backup.mkdir(parents=True, mode=0o700)
    manifest = {'root': str(root), 'files': {}}
    for name, data in original.items():
        if data is not None:
            p = backup/name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
        manifest['files'][name] = {'before': sha(data) if data is not None else None, 'after': sha(patched[name])}
    (backup/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    # Refuse concurrent changes before any source replacement.
    for name, data in original.items():
        if data is None:
            if (root/name).exists() or (root/name).is_symlink(): raise ValueError('Concurrent source creation')
        elif read_regular(root/name) != data:
            raise ValueError('Concurrent source edit')
    for name in changed:
        target = root/name; target.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(dir=target.parent, prefix='.lifecycle-')
        try:
            with os.fdopen(fd, 'wb') as stream: stream.write(patched[name])
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary): os.unlink(temporary)
    return {'installed': True, 'changed_files': sorted(changed), 'backup': str(backup)}


def restore(root, backup):
    manifest = json.loads((backup/'manifest.json').read_text())
    names = FILES | {'test/symphony_elixir/'+name for name in TESTS}
    if manifest.get('root') != str(root) or set(manifest.get('files', {})) != names:
        raise ValueError('Wrong backup')
    current = {}
    for name, record in manifest['files'].items():
        path = root/name
        if record['before'] is None and not path.exists() and not path.is_symlink():
            current[name] = None
            continue
        value = sha(read_regular(path))
        if value not in {record['before'], record['after']}:
            raise ValueError('Newer installed edit; preserve it')
        current[name] = value
    for name, record in manifest['files'].items():
        if record['before'] is not None and sha(read_regular(backup/name)) != record['before']:
            raise ValueError('Backup changed')
    for name, record in manifest['files'].items():
        if record['before'] is not None and current[name] != record['before']:
            target = root/name
            fd, temporary = tempfile.mkstemp(dir=target.parent, prefix='.lifecycle-restore-')
            try:
                with os.fdopen(fd, 'wb') as stream: stream.write(read_regular(backup/name))
                os.replace(temporary, target)
            finally:
                if os.path.exists(temporary): os.unlink(temporary)
    return {'restored': True, 'retained_new_tests': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elixir-root', required=True, type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--apply', action='store_true'); group.add_argument('--restore', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    try:
        root = args.elixir_root.resolve()
        if (args.apply or args.restore) and args.backup is None: raise ValueError('Backup required')
        result = restore(root, args.backup) if args.restore else install(root, args.backup if args.apply else None)
        print(json.dumps(result, indent=2)); return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError):
        print('Lifecycle overlay refused; preserve source and backup for reconciliation'); return 1


if __name__ == '__main__':
    raise SystemExit(main())
