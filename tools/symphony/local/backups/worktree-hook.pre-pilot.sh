#!/bin/sh
# Called by Symphony workspace.hooks.after_create with cwd=empty issue workspace.
set -eu
REPO_URL="${HBL_REPO_URL:-https://github.com/adnanwahab/happybearlandia.git}"
BASE_BRANCH="${HBL_BASE_BRANCH:-sprint/one-city-two-futures-20261111}"
SHARED_ROOT="${HBL_SHARED_ROOT:-$HOME/.local/share/hbl-codex/shared-git}"
MIRROR="$SHARED_ROOT/happybearlandia.git"
MIN_GIB="${HBL_MIN_FREE_GIB:-10}"
LOCK="$SHARED_ROOT/.bootstrap-lock"
HERE=$(pwd -P)
ISSUE=$(basename "$HERE")
case "$ISSUE" in *[!A-Za-z0-9._-]*|'') echo 'Invalid issue workspace name' >&2; exit 2;; esac
case "$MIN_GIB" in *[!0-9]*|'') echo 'HBL_MIN_FREE_GIB must be an integer' >&2; exit 2;; esac
free_kb=$(df -Pk "$HERE" | awk 'NR==2 {print $4}')
required_kb=$((MIN_GIB * 1048576))
if [ "$free_kb" -lt "$required_kb" ]; then
  echo "DISK_GUARD: free=${free_kb}KiB required=${required_kb}KiB; stop dispatch / free disk" >&2
  exit 75
fi
# Symphony must have created an empty workspace, not a previous agent checkout.
if [ -n "$(ls -A "$HERE")" ]; then
  echo "Refusing to overwrite nonempty workspace: $HERE" >&2; exit 3
fi
mkdir -p "$SHARED_ROOT"
i=0
while ! mkdir "$LOCK" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 45 ]; then echo "Shared repository bootstrap lock busy: $LOCK" >&2; exit 75; fi
  sleep 1
done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT HUP INT TERM
if [ ! -d "$MIRROR" ]; then
  TEMP="$SHARED_ROOT/.happybearlandia-init-$$"
  trap 'rm -rf "$TEMP"; rmdir "$LOCK" 2>/dev/null || true' EXIT HUP INT TERM
  git clone --bare --depth 1 --single-branch --branch "$BASE_BRANCH" "$REPO_URL" "$TEMP"
  mv "$TEMP" "$MIRROR"
  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT HUP INT TERM
fi
if [ "$(git --git-dir="$MIRROR" rev-parse --is-bare-repository)" != true ]; then
  echo "Not a bare repository: $MIRROR" >&2; exit 4
fi
# Refresh no more than once per 5 minutes, even with many new agents.
STAMP="$SHARED_ROOT/.last-fetch"
now=$(date +%s)
last=0
if [ -f "$STAMP" ]; then last=$(cat "$STAMP" 2>/dev/null || echo 0); fi
case "$last" in *[!0-9]*|'') last=0;; esac
if [ $((now-last)) -ge 300 ]; then
  git --git-dir="$MIRROR" fetch --depth 1 origin "+refs/heads/$BASE_BRANCH:refs/heads/$BASE_BRANCH"
  printf '%s\n' "$now" > "$STAMP"
fi
# Branch is unique to this issue and persists with the issue worktree.
AGENT_BRANCH="symphony/$ISSUE"
if git --git-dir="$MIRROR" show-ref --verify --quiet "refs/heads/$AGENT_BRANCH"; then
  echo "Refusing to reuse existing branch $AGENT_BRANCH in a newly created workspace" >&2
  exit 5
fi
git --git-dir="$MIRROR" worktree add --no-track -b "$AGENT_BRANCH" "$HERE" "refs/heads/$BASE_BRANCH"
echo "Ready: $HERE on $AGENT_BRANCH; shared objects at $MIRROR"
