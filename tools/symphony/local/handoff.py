"""Data-only handoffs outside Codex's protected Git metadata, with legacy recovery."""
import json
import os
from pathlib import Path
import stat
import uuid


def directory(path):
    target = Path(path) / '.hbl-handoff'
    if target.is_symlink() or (target.exists() and not target.is_dir()):
        raise ValueError('Unsafe handoff directory')
    target.mkdir(mode=0o700, exist_ok=True)
    return target


def pending(path, name):
    modern = Path(path) / '.hbl-handoff' / (name + '.json')
    legacy = Path(path) / '.git' / ('hbl-' + name + '.json')
    if modern.parent.is_symlink():
        raise ValueError('Unsafe handoff directory')
    found = [p for p in (modern, legacy) if p.exists() or p.is_symlink()]
    if len(found) > 1:
        raise ValueError('Both legacy and source handoffs exist; preserve and reconcile')
    return found[0] if found else modern


def read_raw(path, limit=262144):
    parent = os.open(Path(path).parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fd = os.open(Path(path).name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
    finally:
        os.close(parent)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > limit:
            raise ValueError('Unsafe or oversized handoff')
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
        if len(raw) > limit or identity(info) != identity(after):
            raise ValueError('Handoff changed while reading; preserve and retry')
        return raw, identity(info)


def read(path, limit=262144):
    return json.loads(read_raw(path, limit)[0])


def snapshot(directory, name, text):
    """Replace a data file without following model-controlled file/dir symlinks."""
    parent = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    temporary = '.host-' + uuid.uuid4().hex
    try:
        fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        with os.fdopen(fd, 'w') as stream:
            stream.write(text); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
        os.fsync(parent)
    finally:
        try:
            os.unlink(temporary, dir_fd=parent)
        except FileNotFoundError:
            pass
        os.close(parent)
