# Reproducible example receipts

These are existing `future-machine-evidence.v1` exports, generated from supported
Future Machine recipes using the real monthly City engine. They are synthetic,
uncalibrated model results, not observations of real people or empirical forecasts.
Each JSON includes the generator assumptions, model/system versions, seed, policy,
time range, initial-state hash, selected-month records and interpretation limits.
No experiment is persisted: `experimentId` is null.

- `housing-month-16.json`: default seed 42, first completed housing project; 24
  additional homes and 1,000,000 illustrative USD capital expenditure.
- `zero-control-month-120.json`: seed 7, no intervention; identical paired results.

From the repository root:

```sh
bun scripts/example-receipts.js --check
bun test test/example-receipts.test.js
# Intentionally regenerate after reviewing model/contract changes:
bun scripts/example-receipts.js --write
```

`hashes.json` pins the existing canonical SHA-256 (`stateHash`) of each entire
parsed report, excluding formatting. `initialHash` inside each receipt separately
identifies its generated Month 0. The check regenerates each report, compares its
exact serialized content and verifies the pinned report hash. Hashes are integrity
checks, not proof of empirical validity or independent checkpoint equivalence.

Replay uses the existing bounded recipe codec, generator, engine, normalization
and evidence exporter; it performs no network requests. Full histories are rebuilt
in memory and only selected-month evidence is checked in. These fixtures do not
define the proposed general receipt import/export contracts in SHE-83/SHE-84, and
do not claim to exercise a future JSON upload validator. Browser behavior is unchanged.
