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
