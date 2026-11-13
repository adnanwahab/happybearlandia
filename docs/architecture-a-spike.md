# Architecture A spike — SHE-143

Implemented standalone research entry: `/world/microagents/index.html`. This is
an uncalibrated synthetic compute experiment, separate from City and Population.
No entity/time mapping to those models is asserted. Model `flat-microagents.v1`,
rules `cell-contact-integer.v1`, seed 143. A tick applies one synchronous update.

Persistent IDs are row indices. CPU-generated immutable x/y coordinates select
cells in a square grid targeting 16 rows per cell. CSR offsets and ascending ID
lists form the spatial index. Each row reads at most eight other rows in its own
cell, in ID order. The integer energy rule is `(old + 1 + sum(neighbors) % 7) %
1024`. CPU and GPU use the same bounded unsigned arithmetic; maximum sum is
32 × 1023. The index does not move or rebuild during ticks. Stable selection
avoids atomic insertion order, race-dependent writes and parallel reductions.
Each GPU invocation owns one destination row; ping-pong buffers preserve causal
ordering between ticks. x, y, energy, contact count and completion flag are
separate array sections. The completion flag provides per-row execution evidence.

Gained fidelity: persistent explicit state rows and bounded synchronous local
influence. Excluded: cognition, movement, household/policy semantics, long-range
relationships and production event provenance. Only same-cell contacts count;
neighboring-cell radius searches and density-induced truncation are not modeled.
The stable first-ID cap biases contact selection. Directed contact evaluations
are actual shader reads, **not** verified state-changing pairwise events under
`agent-counts.v1`: modulo cancellation can conceal individual influences.
Accordingly the strict pairwise count is null; this spike does not widen or claim
conformance to that existing contract. There are zero avatars/cohort weights.

## Reproduce

- `bun test test/microagents.test.js test/agent-counts.test.js`
- `bun scripts/benchmark-microagents-cpu.js` (bounded 10k CPU measurement)
- With Playwright installed: `node scripts/benchmark-microagents.mjs /tmp/architecture-a.json`.
  Set `HBL_PLAYWRIGHT_MODULE` to an absolute installed Playwright module path
  if it is not resolvable locally. Requires installed Google Chrome.
- Or serve the checkout on localhost and open the research entry above. Click
  Run benchmark, then Download JSON. The existing static server serves the files;
  no server API changes are needed.

The browser runner intercepts only this page's local assets at a secure test
origin. It exercises the real Run button and exports 10k/100k/1M, three ticks each.
10k is checked against an independently evolving CPU state every tick, including
contact counts. Mismatches fail the scenario. Larger counts check GPU invariants
and per-row completion only. Failed or unavailable scales export errors, never
successful feasibility claims. GPU timestamps are optional and null without the
feature; submit/readback wall duration includes copies, mapping and host work.
Allocation bytes include staging and timestamp buffers and are not physical VRAM
(which browsers do not expose). No steady-state throughput claim is made from
three ticks; setup/index construction and readback have separate costs.

## Actual evidence and remaining gates

On 2026-11-12, Darwin arm64, Bun 1.4.2: 11 tests passed, 477 assertions,
including existing metric regression tests. `git diff --check` passed.
[CPU record](evidence/she143-cpu.json) records three 10k ticks: 10,000 changed
rows and 79,912 directed contact evaluations each, with hashes and observed
CPU durations. Synthetic inputs and modeled outputs are not empirical city data.

GPU measurement blocked: localhost bind denied (`Operation not permitted`),
then Playwright Chrome launch aborted with SIGABRT in this restricted sandbox.
Shader compilation, actual CPU/GPU parity, GPU pass durations, adapter limits,
100k/1M feasibility and browser UI remain **unverified**. Run the browser command
on an authorized GPU host before treating issue acceptance as complete.
Do not substitute CPU timings for GPU evidence.

Audit: isolated branch `mini/SHE-143` in the assigned worktree; initial tree clean.
GitHub connector search found no open SHE-143 PR; CLI remote audit was blocked
by network access. Linear SHE-141/SHE-142 were Done at inspection; SHE-142's
scalar files are absent in this checkout. The local reference tests only this
spike's distinct rules, and does not establish parity with SHE-142. No existing
engines or metric interfaces were modified. No dispatch, commit, merge or deploy.
