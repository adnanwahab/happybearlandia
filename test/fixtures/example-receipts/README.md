# Reproducible example receipts

These are `canonical-run-receipt.v1` exports containing `future-machine-evidence.v1`
evidence, generated from supported
Future Machine recipes using the real monthly City engine. They are synthetic,
uncalibrated model results, not observations of real people or empirical forecasts.
Each JSON includes the generator assumptions, model/system versions, seed, policy,
time range, initial-state hash, selected-month records and interpretation limits.
No experiment is persisted: `evidence.experimentId` is null.

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
parsed report, excluding formatting. `evidence.initialHash` inside each receipt separately
identifies its generated Month 0. The check regenerates each report, compares its
exact serialized content, validates each checked-in JSON with `validateRunReceipt`,
and verifies the pinned whole-receipt hash. The embedded `checksum` separately
hashes the receipt body without its checksum field. Hashes are integrity
checks, not proof of empirical validity or independent checkpoint equivalence.

Replay uses the existing bounded recipe codec, generator, engine, normalization
and evidence exporter; it performs no network requests. Full histories are rebuilt
in memory and only selected-month evidence is checked in. The receipt also pins rules, units and selected/terminal outcome digests.
Regeneration recomputes both full histories locally and compares these digests.
`replayRunReceipt` requires a saved identity, so these unsaved examples cannot be
reopened through that loader. See [the receipt contract](../../../docs/run-receipt.md).
Browser behavior is unchanged.

## Current and historical model versions

The active examples and `hashes.json` are generated with city-systems.1.1.0,
using its actual engine, resident rules, event provenance and strict canonical
receipt exporter. The November 12 integration regenerated both paired histories
on Bun 1.4.4; it did not relabel older evidence or claim saved-checkpoint replay.

The original city-systems.1.0.0 JSON receipts and hash manifest are retained
byte-for-byte in `historical/city-systems.1.0.0/`, copied from PR #215 head
`a4634b11f1c130701b004eeb0c85ee15f0d607b2`. Their byte hashes are checked as
historical evidence. The current strict validator intentionally rejects those
old model versions; reproducing them requires their matching implementation.
`--write` and `--check` operate only on the current files in this directory.
