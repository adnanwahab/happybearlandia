#!/bin/sh
set -eu
HERE=$(pwd -P)
if [ ! -d .git ] || [ -L .git ]; then
  echo 'Blocked: expected independent .git directory, not a shared worktree' >&2; exit 1
fi
GIT_DIR=$(git rev-parse --absolute-git-dir)
COMMON=$(git rev-parse --path-format=absolute --git-common-dir)
if [ "$GIT_DIR" != "$HERE/.git" ] || [ "$COMMON" != "$HERE/.git" ]; then
  echo 'Blocked: Git metadata escapes workspace' >&2; exit 1
fi
if [ -e .git/objects/info/alternates ] || [ -L .git/objects ]; then
  echo 'Blocked: external object storage' >&2; exit 1
fi
if [ -n "$(find .git -type l -print -quit)" ]; then
  echo 'Blocked: symlink in Git metadata' >&2; exit 1
fi
