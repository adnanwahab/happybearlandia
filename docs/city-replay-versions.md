# Monthly City golden replay versions

Initial baseline: city-systems.1.0.0, future-machine-synthetic.v1. SHE-111
pins three synthetic 120-month scenarios: seed 0 without policy, seed 42
with the default housing policy, and uint32 maximum seed with delayed,
half-compliance housing. These are modeled results, not empirical forecasts.

Run `bun scripts/check-city-replay.mjs <fixture>` to check a baseline.
The first differing normalized month and first differing entity (sorted by
collection/ID within that month) are reported. Output-only differences are
explicitly labeled. All normalized frame fields are hashed without rounding;
entity hashes locate state differences, including additions/removals.

For intentional changes, bump the monthly City VERSION, document the new
version and rationale here, then regenerate all three files using
`bun scripts/check-city-replay.mjs <fixture> --write`. Review the recipe,
rules, generator, month hashes and entity hashes in the diff. CI compares
changed baselines with the PR base and rejects same-version replacements.
The initial addition establishes the baseline; subsequent additions require
review of the fixture set and workflow. Independent replay checks remain in
`test/city-seed-replay-sweep.test.js`.

## Current baseline: city-systems.1.1.0

The November 12 integration found the incoming SHE-111 fixtures pinned to
city-systems.1.0.0 while the integrated engine already reports
city-systems.1.1.0. The existing version change adds the resident pack, monthly
resident records and rule/event provenance, including checked building-change
events. See the [City model description](models/city.md) and
[resident rules](../world/city/README.md#living-city-residents-city-systems110).
The synthetic generator remains future-machine-synthetic.v1. This fixture
reconciliation does not change model equations or invent a further model version.

All three active JSON fixtures were independently regenerated through the actual
current engine and normalizer for Months 0–120, on Bun 1.4.4. They now identify
city-systems.1.1.0 in both recipe and rules. CI retains its existing Bun 1.4.2
pin; execution on that CI runtime remains a separate verification gate.

The original three city-systems.1.0.0 files are retained byte-for-byte under
`test/fixtures/city-replay/historical/city-systems.1.0.0/`, copied from PR #198
head `d7e1e3c29b034cf046ce4a32697cebf8ca5ee4cf`. Their historical hashes are
checked separately. They are historical evidence, not current-engine baselines;
recomputing them requires the matching old implementation. Do not relabel them,
overwrite them with current output, or relax the model-version update guard.
