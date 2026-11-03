#!/usr/bin/env bash
set -euo pipefail

DELIVERY_SHA="f2ec7e1f66e03b8c464480fab440e9babc3c293f"
BASE_URL="https://raw.githubusercontent.com/adnanwahab/happybearlandia/${DELIVERY_SHA}/patches/family"
PATCHES=(
  0001-commitment-states.patch
  0002-proposal-wedding.patch
  0003-partner-move-in.patch
  0004-family-system.patch
  0005-baby-care.patch
)

for patch in "${PATCHES[@]}"; do
  echo "Downloading ${patch}"
  curl -fL --retry 3 "${BASE_URL}/${patch}" -o "${patch}"
done

echo "Downloaded ${#PATCHES[@]} patches to $(pwd)"
