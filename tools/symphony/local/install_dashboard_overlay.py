#!/usr/bin/env python3
"""Extend the observed installed Symphony dashboard; default is check-only.
The Elixir runtime is installed locally and is not vendored in the sprint repo.
Exact anchor checks fail closed. Backups preserve every original source byte.
"""
import argparse
import hashlib
import json
from pathlib import Path
import os
import sys

OVERLAY = Path(__file__).parent / 'overlays/factory_throughput.ex'
PRESENTER = 'lib/symphony_elixir_web/router.ex'
DASHBOARD = 'lib/symphony_elixir_web/live/dashboard_live.ex'
MODULE = 'lib/symphony_elixir_web/factory_throughput.ex'
TEST = 'test/symphony_elixir/factory_throughput_test.exs'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def changes(root):
    if not (root / 'mix.exs').is_file() or 'symphony_elixir' not in (root / 'mix.exs').read_text():
        raise ValueError('Expected the existing Symphony Elixir installation')
    anchors = {
        PRESENTER: [('    get("/api/v1/state", ObservabilityApiController, :state)', '    get("/api/v1/throughput", FactoryThroughputController, :index)\n    get("/api/v1/state", ObservabilityApiController, :state)')],
        DASHBOARD: [
            ('      |> assign(:payload, load_payload())', '      |> assign(:factory, SymphonyElixirWeb.FactoryThroughput.snapshot())\n      |> assign(:payload, load_payload())') ,
            ('        <section class="metric-grid">', '        <SymphonyElixirWeb.FactoryThroughput.panel data={@factory} />\n\n        <section class="metric-grid">'),
            ('    {:noreply, assign(socket, :now, DateTime.utc_now())}', '\n    {:noreply,\n     socket\n     |> assign(:now, DateTime.utc_now())\n     |> assign(:factory, SymphonyElixirWeb.FactoryThroughput.snapshot())}')],
    }
    result = {}
    for name, replacements in anchors.items():
        path = root / name
        if path.is_symlink():
            raise ValueError('Refusing a symlink source')
        original = path.read_bytes()
        text = original.decode()
        for old, new in replacements:
            if new in text:
                continue
            expected = 1
            if text.count(old) != expected:
                raise ValueError(f'Installed source changed: {name}; reconcile before installing')
            text = text.replace(old, new)
        result[name] = (original, text.encode())
    path = root / MODULE
    if path.is_symlink():
        raise ValueError('Refusing a symlink overlay')
    if path.exists() and path.read_bytes() != OVERLAY.read_bytes():
        raise ValueError('Existing overlay differs; preserve and reconcile newer work')
    result[MODULE] = (path.read_bytes() if path.exists() else None, OVERLAY.read_bytes())
    test_path = root / TEST
    if test_path.is_symlink():
        raise ValueError('Refusing a symlink test')
    expected_test = OVERLAY.with_name('factory_throughput_test.exs').read_bytes()
    if test_path.exists() and test_path.read_bytes() != expected_test:
        raise ValueError('Existing overlay test differs; preserve and reconcile newer work')
    result[TEST] = (test_path.read_bytes() if test_path.exists() else None, expected_test)
    return result


def install(root, backup):
    patch = changes(root)  # Validate every source before writing anything.
    if backup.exists():
        raise ValueError('Backup directory already exists; never overwrite recovery evidence')
    backup.mkdir(parents=True, mode=0o700)
    manifest = {'version': 1, 'root': str(root), 'files': {}}
    for name, (before, after) in patch.items():
        if before is not None:
            target = backup / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(before)
        manifest['files'][name] = {'before': sha(before) if before is not None else None, 'after': sha(after)}
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    # Individual replacements are atomic. Manifest contains recovery for interrupted apply.
    for name, (_, after) in patch.items():
        target = root / name
        temporary = target.with_suffix(target.suffix + '.factory-new')
        if temporary.exists() or temporary.is_symlink():
            raise ValueError('Unexpected installation temporary file; preserve and reconcile')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary.write_bytes(after)
        os.replace(temporary, target)
    return manifest


def restore(root, backup):
    manifest = json.loads((backup / 'manifest.json').read_text())
    if manifest.get('root') != str(root) or set(manifest.get('files', {})) != {PRESENTER, DASHBOARD, MODULE, TEST}:
        raise ValueError('Wrong backup installation or schema')
    for name, value in manifest['files'].items():
        path = root / name
        if path.is_symlink() or not path.is_file() or sha(path.read_bytes()) != value['after']:
            raise ValueError('Installed source changed since apply; never overwrite newer work')
        if value['before'] is not None and sha((backup / name).read_bytes()) != value['before']:
            raise ValueError('Invalid backup checksum')
    for name, value in manifest['files'].items():
        if value['before'] is not None:
            (root / name).write_bytes((backup / name).read_bytes())
    # Leave the unreferenced new module as useful recovery evidence; do not delete it.
    return {'restored': True, 'retained_overlay': MODULE}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--elixir-root', type=Path, required=True)
    group = p.add_mutually_exclusive_group()
    group.add_argument('--apply', action='store_true')
    group.add_argument('--restore', action='store_true')
    p.add_argument('--backup', type=Path)
    args = p.parse_args()
    root = args.elixir_root.resolve()
    try:
        if args.apply or args.restore:
            if args.backup is None or not args.backup.is_absolute():
                raise ValueError('Apply/restore requires an explicit absolute backup path')
            result = restore(root, args.backup) if args.restore else install(root, args.backup)
        else:
            result = {'check_only': True, 'changed_files': [k for k, (a, b) in changes(root).items() if a != b]}
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, UnicodeError, KeyError):
        print('Dashboard overlay check/apply failed; preserve sources and backup for reconciliation', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
