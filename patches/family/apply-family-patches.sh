#!/usr/bin/env bash
set -euo pipefail
for patch in \
  0001-commitment-states.patch \
  0002-proposal-wedding.patch \
  0003-partner-move-in.patch \
  0004-family-system.patch \
  0005-baby-care.patch
do
  echo "Checking $patch"
  git apply --check "patches/family/$patch"
  echo "Applying $patch"
  git apply "patches/family/$patch"
done
echo "Family patches applied."
