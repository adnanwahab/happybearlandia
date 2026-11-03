# HappyBearLandia family / generational simulation patches

Base commit: `6722f7d274fc7c2d6b002835c0b411ba068a01cf`

These five patches are sequential and are intended for `git apply` in this exact order:

1. `0001-commitment-states.patch`
2. `0002-proposal-wedding.patch`
3. `0003-partner-move-in.patch`
4. `0004-family-system.patch`
5. `0005-baby-care.patch`

## Apply

From the HappyBearLandia repository root:

```bash
git status --short
git rev-parse HEAD
git apply --check patches/family/0001-commitment-states.patch
git apply patches/family/0001-commitment-states.patch
git apply --check patches/family/0002-proposal-wedding.patch
git apply patches/family/0002-proposal-wedding.patch
git apply --check patches/family/0003-partner-move-in.patch
git apply patches/family/0003-partner-move-in.patch
git apply --check patches/family/0004-family-system.patch
git apply patches/family/0004-family-system.patch
git apply --check patches/family/0005-baby-care.patch
git apply patches/family/0005-baby-care.patch
```

If your local branch has moved past the base commit, run each `git apply --check` first and resolve any overlapping edits before applying.

## Verify

```bash
bun test world/house/relationship-commitment.test.js
bun test world/house/commitment-system.test.js
bun test world/house/commitment-move-in.test.js
bun test world/house/family-system.test.js
bun test world/house/family-care.test.js
```

Then launch HappyBearLandia and verify this loop in `/world/house/`:

`date -> propose -> wedding -> invite partner -> move in together -> start a family -> child arrives -> buy crib/changing table -> baby care/autonomy`

Notes:
- Partner move-in uses the existing roommate authority and deliberately does not merge financial households.
- Newborns are stored as checkpointed household dependents. They do not resize the fixed-length city population arrays.
- The default child-arrival delay is 3 modeled days; the family action supports 1–280 modeled days internally.
