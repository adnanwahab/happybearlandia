# Monthly City model invariants

All City coefficients are illustrative synthetic assumptions. CI executes these
rules through `scripts/verify-city-seed-replay.mjs`, `contracts.js`, the engine,
and City/replay contract tests. Failures preserve the assertion/contract message.
See [CI validation](../../docs/model-validation.md) for execution and review.

## State contract (`validateState`)

- CityState schema must be supported. Districts, parcels, buildings, units,
  households, workers, businesses, jobs, links, facilities, utilities, projects
  and policies must be arrays with unique nonempty string IDs; numeric row
  properties must be finite.
- Month is a nonnegative integer; seed is uint32. There are 1–32 districts.
  Parameters, finance, systems and shocks must exist.
- Contractors, labor, materials, equipment, permits, administration, interest
  rate and construction cost are finite and nonnegative. Annual growth is finite.
  Balance, debt, maximum debt, revenue, operating/capital expense are finite;
  debt cannot be negative.
- Unit rent is finite and within 0–50,000; bedrooms are nonnegative integers;
  status is available, occupied, reserved, under renovation or under construction.
- Household income is finite/nonnegative; other income, savings, age and lease
  end are finite. Household size is a positive integer.
- Link capacity is finite/nonnegative and free time finite/positive. Utility and
  facility capacities are finite/nonnegative. Project duration is a positive
  integer, progress finite/nonnegative and unit count a nonnegative integer.
- District references and link endpoints resolve. Units reference real buildings.
- Housing assignments are reciprocal and one-to-one; an assigned unit is occupied
  and an occupied unit has a household. Job/worker assignments are reciprocal and
  each worker fills at most one job.

## Capacity and engine contracts

- Capacity registration has a unique resource/district/time key and finite
  nonnegative capacity. Reservations are finite/nonnegative and cannot exceed
  available capacity (1e-9 numerical tolerance). Multi-resource reservations are
  atomic: a failed reservation restores all prior usage.
- Resource flows are finite/nonnegative. System IDs are unique; dependencies
  resolve without cycles and every pack supplies initialize/propose/resolve/
  commit/observe. Proposals use an immutable common pre-step snapshot.
- Coupled-system tests verify constrained project funding and delivery, utility
  completion gating, gradual construction under limited labor, unique housing
  allocation, flood recovery and congestion/unreachable-route handling.

## Seed sweep and replay contracts

- Seeds are unique uint32 values. Each supported recipe preserves seed, model
  version, generator dataset version and synthetic assumptions at every step.
- Clock advances exactly one month. Every entity collection has unique IDs.
  Events have unique IDs within a step, the current month, matching City version,
  known system and matching model/system identity. Observations are nonempty,
  timed to the current month and carry the emitting system's rules version.
- Normalized histories contain exactly 121 frames, including the common original
  month zero. Capital ledgers are present. The original frozen state remains
  hash-identical after both arms and independent generation reproduces it.
- Independent runs reproduce initial, raw-step and normalized-history digests
  for both baseline and intervention arms. Intermediate records and ordering
  contribute to the digest. Missing/stale versions, identities, frames and saved
  generator contracts fail explicitly in the retained boundary tests.

These invariants bound the tested recipes, not every possible City configuration.
No Population/House identity or time equivalence is implied.
