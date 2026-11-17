#!/usr/bin/env python3
"""Single-host runner lock. Fixed entry point; never a guest command executor."""
import fcntl, os, pathlib, stat, sys
root = pathlib.Path(os.environ.get('HBL_PREVIEW_STATE_DIR', ''))
if not root.is_absolute() or any(p.is_symlink() for p in [root, *root.parents]):
    sys.exit('Set a canonical absolute HBL_PREVIEW_STATE_DIR')
root.mkdir(mode=0o700, parents=True, exist_ok=True)
info = root.stat()
if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
    sys.exit('Preview state must be owned by this operator and mode0700')
fd = os.open(root / 'host-runner.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit('Another trusted preview runner owns this state; no duplicate started')
os.set_inheritable(fd, True)
os.environ['HBL_PREVIEW_LOCK_FD'] = str(fd)
# exec preserves the OS lock across process replacement; no expiry-based takeover.
os.execvp('bun', ['bun', str(pathlib.Path(__file__).with_name('runner.js'))])
