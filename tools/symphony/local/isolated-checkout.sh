#!/bin/sh
set -eu
PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH
BASE=sprint/one-city-two-futures-20261111
REPO=${HBL_REPO_URL:-https://github.com/adnanwahab/happybearlandia.git}
HERE=$(pwd -P)
ISSUE=$(basename "$HERE")
case "$ISSUE" in *[!A-Za-z0-9._-]*|'') echo 'Invalid workspace name' >&2; exit 2;; esac
if [ -n "$(ls -A "$HERE")" ]; then
  echo 'Refusing to overwrite nonempty workspace' >&2; exit 3
fi
case "$ISSUE" in
  SHE-*) /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/prepare.py --clone-check ;;
esac
MIN_GIB=${HBL_MIN_FREE_GIB:-10}
case "$MIN_GIB" in *[!0-9]*|'') echo 'Invalid disk threshold' >&2; exit 2;; esac
FREE_KB=$(df -Pk "$HERE" | awk 'NR==2 {print $4}')
if [ "$FREE_KB" -lt "$((MIN_GIB * 1048576))" ]; then
  echo 'DISK_GUARD: insufficient free space' >&2; exit 75
fi
# Independent objects, refs and FETCH_HEAD. No worktrees or alternates.
env -u GIT_CONFIG -u GIT_CONFIG_COUNT -u GIT_DIR -u GIT_WORK_TREE GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -c core.hooksPath=/dev/null clone --no-local --no-hardlinks --single-branch --branch "$BASE" "$REPO" .
env -u GIT_CONFIG -u GIT_CONFIG_COUNT -u GIT_DIR -u GIT_WORK_TREE GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -c core.hooksPath=/dev/null switch -c "symphony/$ISSUE"
