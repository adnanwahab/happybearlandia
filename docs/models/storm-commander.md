# Storm Commander v1

This is a deterministic synthetic hazard challenge, not an agent-based social
model or calibrated hydrology. It adds authored preparation rules around the
existing storm solver, without changing water or exposure rules.

## Purpose

Choose drainage for three schematic blocks under a crew deadline and budget.
A block means exactly one existing building footprint, not a geographic parcel
boundary. The challenge makes no claims about real water, lives saved, expected
resilience, measured observations or flood probabilities.

## Entities, state and scales

`world/storm/commander.js` owns challenge state. `BLOCKS` maps center-homes,
east-homes and south-homes to existing scenario building IDs. Two exterior drain
cells per block are authored installation sites, distinct from building cells.
The 32×32 closed-boundary grid, synthetic terrain and building geometry belong
to `scenario.js`; `physics.js` owns depth in metres per model step. There are 60
storm steps plus the initial dry frame. Preparation has four abstract shifts,
with no conversion to seconds, hours or storm steps. Costs are illustrative USD.

## Process and scheduling

One crew processes the three jobs in displayed block order. Skip costs zero and
takes zero shifts. Standard costs 240,000 and takes two shifts; express costs
360,000 and takes one. These are authored game assumptions, not staffing
estimates. Express changes preparation time only, never drainage capacity.
A job installs its two existing `drain` edits only if its cumulative completion
shift is at most four. Late jobs still consume their posted budget. Total cost
above 960,000 is rejected before simulation. Both arms start dry with identical
terrain/rain; only installed drains differ. The existing solver adds rainfall,
removes local drainage, then exchanges water across adjacent cells.

## Design concepts and invariants

No resident behavior, adaptation or new social mechanism is introduced. Every
plan has exactly three recognized choices. No duplicate drain sites or building
placements are generated. Existing drain capacity is 0.15 metres per model step
at each installed cell. Existing exposure thresholds from `impacts.js` remain
unchanged (homes flood at 0.15 m). A block is protected iff its footprint never
crossed that threshold in any of the 61 frames. Success requires three protected
blocks. Baseline parcel exposure remains visible even when the challenge fails.
Missing, incomplete, nonfinite, negative or incompatible frames refuse scoring;
cancellation and execution failure produce no partial score. Parent inputs and
returned checkpoint arrays are deeply frozen; a new run creates a new record.

## Initialization

`SOURCE` pins storm-commander.v1, storm-neighborhood.v1, seed 2911, rain rate
0.0012 m/step, 60 steps and no starting edits. Current single-storm terrain and
rain are deterministic and consume no RNG; the seed is retained as scenario
identity, not represented as a sampled rainfall draw. No 100-storm ensemble is
claimed. Both arms run the same CPU reference to avoid backend rounding drift.

## Input data

All geometry, rainfall, deadlines and prices are synthetic authored inputs.
There is no external observation feed. `test/fixtures/storm/commander-demo.json`
is a checked-in reference checkpoint for express/express/standard. It records
model, impact and scenario versions, seed, source, plan, dispatch, parcel flood
counts/peaks, and every step's maximum footprint depth for both arms. It was
produced from the CPU implementation; it is regression evidence, not independent
scientific validation. Runtime records are session-only; reload discards them.

## Submodels and observation

`compileStorm` produces existing water inputs; `simulateWater` executes them;
`consequences` / `assessFlood` evaluate existing building exposure. These keep
their own version identifiers in the checkpoint. `replayCommander` recomputes
and compares the entire canonical record against its immutable checkpoint,
including per-step depths and scores. Tampering or version mismatch refuses
verification; this does not certify externally submitted scores or authenticity.
The page scrubs or plays only stored footprint depths, without interpolation,
wind, clouds, invented outflow or predicted intermediate states. Playback is
opt-in and stops at step 60 or page departure; static readings support reduced
motion. Structural uncertainty is unquantified; one authored storm cannot
establish safety or probability. No City/Population identity mapping is asserted.

## Verification

`test/storm-commander.test.js` verifies the pinned success, deadline failure,
empty/invalid/over-budget plans, immutable matched baseline, exact replay,
tampering, cancellation, missing source/frames and solver failures.
`test/e2e/storm-commander.e2e.js` covers normal navigation, keyboard demo,
recorded scrubbing/replay, mobile layout, failed plans and injected failure states.
Execution evidence and remaining browser prerequisite: `../reviews/SHE-691.md`.
