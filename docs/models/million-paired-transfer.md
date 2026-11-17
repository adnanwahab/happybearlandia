# Million-scale synthetic paired-transfer workload — ODD

Review candidate; describes `world/bench/million-kernel.js` and
`world/bench/million-browser.js`, model/rules/source identity
`hbl.synthetic-paired-transfer.v1`. This differs from the bounded
[energy fixture](energy-transfer.md) and [scalar oracle](../scalar-agent-oracle.md).

## 1. Purpose and patterns

A reproducible, uncalibrated compute/render workload for the opt-in
[headless runner](../million-benchmark.md). It measures this synthetic workload,
not city behavior, causal social mechanisms or production capacity.

## 2. Entities, state variables and scales

10k, 100k or 1M individual Uint32 energy entries, stable local ID equal to array
index. State also contains uint32 PRNG and integer tick. Energy units and ticks
are abstract; steps range 1–600. No geography or cross-model identity/time map.

## 3. Process overview and scheduling

Each tick advances the LCG once, reduces it modulo population to choose an
offset, then visits adjacent pairs in wraparound order, advancing by two IDs.
All supported populations are even: pairs are disjoint within a tick. A donor
with positive energy transfers one unit to the recipient. An empty donor causes
no event or counted update. Tick advances even if all donors are empty.

## 4. Design concepts

Conservation and nonnegative energy are invariants. Distribution is the only
emergent pattern; no learning, objectives, adaptation or sensing. Pairing is a
synthetic scheduling assumption with modulo bias. Observation counts two actual
individual state changes per successful transfer, one interaction and distinct
changed IDs across ticks. The workload retains no event log: replay regenerates
ordered pairs from exact seed, model bytes and tick count. Compact final hash
is a regression digest, not cryptographic or independent causal validation.

## 5. Initialization

Every phase starts at tick 0, PRNG equal to the uint32 seed (including zero),
and energy 10 for every ID. No hidden warm-up. Setup is outside measured wall
time. There is no empirical initial population or persistence.

## 6. Input data

Only size, steps and seed; no external observations. CLI defaults are all three
sizes, 30 steps and seed 42. Source SHA256 hashes and runner hash accompany
host/runtime metadata; browser/device metadata are available only after launch.
Model results, measured timings and synthetic assumptions are distinct.

## 7. Submodels

LCG: `(imul(random,1664525)+1013904223) >>> 0`. Successful transfers conserve
`size*10`; with at most 600 ticks energy cannot approach uint32 overflow.
Compute-only runs synchronous ticks. Render-only leaves state unchanged and
counts zero interactions/updates. Combined steps and draws on each RAF callback;
it must match compute-only final state for the same recipe. Rendering submits
one WebGL point per ID, using grid coordinates and energy-dependent vertical
offset. Points overlap and establish no visible-avatar count. Draw timing
includes encoding, upload, draw and blocking `gl.finish`, not presentation.
Memory is maximum sampled page JS heap at setup/step boundaries, null if absent;
process/GPU peaks and transient allocations are unobserved. Final digest is
outside wall timing; changed-ID instrumentation is inside step timing.

Verification: `bun test test/million-benchmark.test.js test/million-benchmark-cli.test.js`;
actual browser gate: `HBL_MILLION_BROWSER=1 bun test test/million-benchmark-cli.test.js`.
The latter must run on a browser-capable host before accepting measurements.
