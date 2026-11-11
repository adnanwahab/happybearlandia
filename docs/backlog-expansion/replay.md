# Replay expansion: tickets 113 and 131

## Scope and acceptance

Deliver versioned, bounded serialized housing checkpoints and nested forks using the existing 1.2.0 monthly stock-flow model and building lifecycle. Preserve exact random stream, queue, balances, progress, events and prefix. Reject absent/corrupt/incompatible checkpoints and invalid interventions. Never assign housing authority to CityState or Population.

Implemented adapter: `world/decision/backlog-replay/index.js`. Shared hooks are delivered as `world/decision/backlog-replay/integration.patch`, NOT applied to shared production files under this track's ownership rules. No model coefficients or numerical rules change. Patch exposes existing closure state and lifecycle internals; it does not create another simulator. Frozen 1.0/1.1 engines stay untouched.

## Coordinator integration (required)

1. Apply `git apply world/decision/backlog-replay/integration.patch` from repository root. Review only `world/models/housing/index.js` and `world/buildings/lifecycle.js` hooks. The hook argument is internal; never pass request-controlled `replay` state directly to the engine.
2. Existing decision store/API owner imports:

```js
import { createHousingCheckpointAdapter } from './backlog-replay/index.js';
import { simulateHousingRun } from '../models/housing/index.js';
const replay = createHousingCheckpointAdapter({ simulateRun: simulateHousingRun });
```

3. On a selected completed run, use its recorded effective sampled parameters, exact uint32 seed, original inputProjects, years and scheduledStress. Require recorded modelVersion 1.2.0. Do not pass final run.projects as input projects. `await replay.start({parameters,seed,years,projects,scheduledStress}, selectedMonth)` returns `{checkpoint,serialized,result,source,empiricalCalibration}`. This initial creation recomputes from retained inputs; compare its numerical prefix against the independently stored run before claiming recorded equivalence. Never relabel recomputation as an observed snapshot.
4. Persist `serialized` immutably keyed by checkpoint.id AND digest, under the existing experiment/run authorization and retention boundary. Reject overwrites with different content. `restore(serialized,{id,digest,recipeDigest})` pins expected identities; digest is integrity, not authentication. Treat saved server data as the authority, not a client-supplied envelope. Enforce HTTP body limits before JSON parsing. Internally captured state includes private lifecycle fields; do not render them as geographic entities.
5. `await replay.resume(serialized,targetMonth)` advances only after the captured month. `await replay.fork(serialized,approvedOperations,targetMonth)` applies existing validated operations before captured month+1. Call only after existing preview/approval checks. Store returned lineage, immediate parent digest/id, child checkpoint and output together. Parent remains immutable. Require target > branch month; branches limited to 16 ancestors, operations to existing 32, horizon to existing 600 months, envelope to 8 MiB. Over-limit checkpoints fail explicitly; do not silently reduce horizon.
6. Preserve lineage separately from legacy result.fork: a resume result contains numerical history without old singular fork metadata. The checkpoint.lineage is authoritative for multi-generation ancestry. ParentDigest links resume checkpoints as well; branch lineage records only interventions. Do not promote a nested child through the old single-fork scenario contract without a separately versioned recipe/contract.
7. Existing API/UI owner must add save/load/fork entrypoints and explicit unavailable/corrupt/version/oversize states; errors must never fall back to another model/run/seed. This track changes no route, server, store or browser UI. Re-run production journey/browser evidence after wiring.

## Evidence

`test/backlog-replay.test.js` copies existing model/building source into a temporary directory, applies the exact integration patch, and imports that actual engine. No replacement dynamics or fabricated outcomes. It verifies all numerical/history output against the unmodified normal engine, restart at months13/37/120 for seed0/42/uint32-max, frozen parent state, nested intervention prefixes, deterministic repeated branches, matched no-op branch, added project clock and forward cancellation, stock conservation, missing/corrupt/oversize/version/identity rejection, time reversal and prohibited stock rewrite. Bare unpatched engine fails explicitly.

- Focused final: `bun test test/backlog-replay.test.js`: 4 passed, 38 assertions.
- Regression before final extra lifecycle test: `bun test test/backlog-replay.test.js test/housing-fork.test.js test/housing-model.test.js test/building-lifecycle.test.js test/checkpoint-replay.test.js`: 53 passed, 2873 assertions.
- `git diff --check`: passed before final documentation; final check repeated at commit.
- Browser/screenshots: not run; no browser behavior wired. Production integration remains coordinator-owned.

The generated checks establish deterministic mechanics only. Model outputs remain synthetic, not empirical calibration. No external services, paid calls, production writes or deployment.

## Ready-to-apply global status

| Ticket | Implemented / verified | Remaining blocker |
| --- | --- | --- |
| 113 | Bounded serialized exact housing state and restart adapter implemented; actual patched-engine equality verified under three boundary seeds. Identity/version/hash errors reject. | Coordinator apply hooks, persist immutable envelopes and wire existing on-demand replay route; production browser acceptance unverified. Keep Partial until wired. |
| 131 | Nested forward forks implemented on actual restored lifecycle state with causal lineage, deterministic replay, immutable prefix and seed-matched no-op comparison tests. | Coordinator route/approval/store integration and versioned multi-fork scenario promotion; legacy singular-fork promotion cannot represent nested lineage. Keep Partial until wired. |

Owned files only: adapter, integration patch, unique test, this handoff. No shared implementation plan/backlog/entrypoint edits. Worktree `/Users/wahabma/.codex/worktrees/backlog-replay/happybearlandia`, baseline `1b19358`.
