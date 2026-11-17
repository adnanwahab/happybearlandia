# SHE-221 / SHE-230: correctness and determinism audit

Audited 2026-11-12 at source `b963dd353538294cb0fbf5d34d5283fad6e10e68`,
Bun 1.4.2. This is the high-priority Experiment 2 Codex report, not a
completion claim for the umbrella's remaining experiments. No model equations,
application code, or existing tests were changed. No push or deployment.

## Scope and overlap

Linear SHE-59 is Done and already supplies a 106-case real monthly City replay
harness. SHE-76 is In Review and its paired 121-frame implementation is present.
Reuse these; do not rebuild them. SHE-240 (Experiment 7 Codex) and both
Experiment 5 tickets are Canceled as read on the audit date. Claude hypotheses
were not supplied; these findings are Codex observations, not a Claude review.

Read the product design, implementation plan, City README and existing replay,
paired-comparison and seed tests. Primary authority is monthly City
`city-systems.1.0.0`; legacy Population paired experiments are a separate model.
Synthetic fixtures and illustrative equations provide reproducibility evidence,
not empirical forecasts or proof of policy causality.

## Confirmed: unsupported input model versions execute under current rules

**Impact:** incompatible input can pass the normal experiment normalization
boundary. Its manifest claims current rules while its resulting state retains
the incompatible version. Severity: high for provenance integrity.

`world/city/contracts.js:validateState` checks `schemaVersion` but never `version`.
`world/city/api.js:normalizeExperiment` uses that validator, then sets manifest
version to the current constant. `world/city/engine.js:step` also relies on the
validator and emits current-version observations while preserving state.version.

Reproduction from repository root:

```sh
bun --eval '
import {createCity} from "./world/city/seed.js";
import {normalizeExperiment} from "./world/city/api.js";
import {createEngine} from "./world/city/engine.js";
const initial=createCity({seed:42,households:30});
initial.version="city-systems.0.0.0";
const manifest=normalizeExperiment({initial,runs:1,months:1});
const result=createEngine().step(manifest.initial);
console.log(manifest.version,result.state.version,result.observations[0].modelVersion);
'
```

Observed: `city-systems.1.0.0 city-systems.0.0.0 city-systems.1.0.0`.
This establishes normalization and engine acceptance; no HTTP request with
malformed input was submitted in this audit.

Pattern search: the replay route checks the outer manifest version and Future
Machine boundary tests reject stale recipe/replay versions. Those guards work
but do not establish validity of arbitrary explicit initial CityState input.
Smallest safe fix: reject absent or unsupported state.version in the shared
City validator. Explicit migration is a separate operation; do not rewrite the
version silently. Regression: current input succeeds; missing, old and future
versions fail through both normalizeExperiment and engine.step before mutation.
Idea status: **validated defect; proposed fix**, not implemented.

## Confirmed: orphan workers are accepted and participate in employment

**Impact:** a worker can fill a job without any household receiving their wage.
Severity: medium for imported inventory and household budget interpretation.

Reproduce using the same imports as above, replacing the mutation with:

```js
initial.workers[0].householdId="missing-household";
const manifest=normalizeExperiment({initial,runs:1,months:1});
const state=createEngine().step(manifest.initial).state;
console.log(state.workers[0],state.households[0].income);
```

Observed worker-0 still references missing-household and fills job-d1-2.
household-0 income is 1603.8971199654043, versus 5587.897119965404 in the
unmodified seed-42 control. These are observed modeled outputs, not prescribed
economic expectations. The jobs resolver allocates workers independently of
household membership, then credits only workers whose householdId matches an
existing household (`world/city/systems.js`, jobs pack).

Root cause: `validateState` checks reciprocal job/worker assignment but omits
worker-to-household membership. Pattern search: building/unit and household/unit
references already have guards; job.businessId and building.parcelId also lack
equivalent membership checks in that validator. Their downstream effects remain
**suspected**, not reproduced here. Smallest safe fix: require every worker's
householdId to resolve before stepping. Define any intended nonresident-worker
contract explicitly before supporting it. Regression: orphan input rejected at
normalization and engine boundaries, legitimate unemployed workers accepted,
ordinary seed-42 output unchanged. Idea status: **validated defect; proposed fix**.

## Suspected risks with bounded evidence

1. `world/paired.js:pickMetrics` converts absent or NaN outcomes to zero using
   `Number(outcomes?.[k] || 0)`. That coercion is confirmed by source inspection;
   a real simulateYear run producing such missing outcomes was not observed.
   Reproduce the boundary with a missing-metric simulation fixture in a separate
   test process. Proposed fix: validate finite supported metrics and expose
   missing coverage instead of silently reporting zero. Preserve real zero.
2. `world/city/contracts.js:draw` joins key tuples with `:`. Directly observed
   `draw(42,"a:b","c") === draw(42,"a","b:c")`, both
   0.4695265721529722. This is an encoding alias, not evidence that current
   generated entity IDs collide or that distinct seeds give identical cities.
   Test IDs containing delimiters before selecting a fix. A length-prefixed
   encoding requires a model version change because it changes existing draws.

Both fixes remain **proposed**, pending targeted production-path validation.

## Working behavior and intentional limits

| Requested investigation | Evidence and classification |
| --- | --- |
| Same seed differs | Focused independent replay, uint32 boundaries, persisted API replay and legacy repeated-seed tests passed; no defect observed in those fixtures. |
| Different seeds identical | Legacy runSeed test passes divergent moods; monthly boundary seeds produce different initial and baseline hashes. Does not establish statistical RNG quality. |
| Rendering changes results | Monthly engine has no renderer imports and current frame scrub tests pass. Live renderer/worker scheduling interference remains untested. |
| Impossible population or budgets | Existing capacity, assignment, funding, utilities, flood, construction and persistence tests pass. Orphan membership defect above is confirmed; exhaustive finance/population invariants remain untested. |
| Hidden global state / event order | Reverse pack registration produces an identical complete first step for seed 42; existing all-pack replay test passes. Input parent remains unchanged. Browser globals and locale portability remain untested. |
| Unexplained worldline differences | Null intervention tests have identical arms; nonzero housing policy changes recorded inventory and capital expense. Seed and identity incompatibility checks pass. |
| Cross-page metrics | Monthly meanTravelMinutes is minutes/link; legacy avgWalkMinutes is resident walking minutes/day. These are intentionally different metrics. Current Future Machine units and UI documentation explain that distinction. Live cross-page presentation was not exercised. |
| Parameter nonresponse | Construction and flood tests demonstrate response to supported inputs. Delayed/blocked construction is intentional. Exhaustive sensitivity tests for every parameter remain untested. |

Observed seed-42 twelve-month finance summary: revenue 54224.40481663721,
operating expense 14086, capital expense 0, balance 10487719.85801674, debt 0.
All cityMetrics values were finite. This is a diagnostic observation, not an
accounting proof. Negative cash is explicitly modeled as a BUDGET_DEFICIT event;
it is not alone evidence of an engine defect. Annual age increments occur on
cadence 12, not every monthly step.

A separate metamorphic probe passed 72 monthly checks: seeds 0, 42 and
4294967295, 30 households, 24 months, housing intervention d1/24 units/$1M.
Each step preserved its complete input state and satisfied, within 1e-6 USD,
`next.balance = prior.balance + debtIncrease + revenue - operatingExpense - capitalExpense`.
Ledger values came from next.systems.finance; debt increase came from the two
finance states. This covers those fixtures, not arbitrary shocks or debt settings.

## Verification and next decisions

Executed:

```sh
bun test test/city-seed-replay-sweep.test.js test/future-machine-data.test.js test/future-machine-boundaries.test.js test/future-machine-scrub-identity.test.js world/sim-seed.test.js world/paired.test.js
bun test test/city-systems.test.js test/temporal-city.test.js test/paired-future-comparison.test.js
```

Results: **24 pass / 0 fail / 328 assertions** and **32 pass / 0 fail /
151 assertions**, respectively. The persisted API tests use isolated local
storage. No lint or type-check script is defined in package.json. No browser
behavior changed; Playwright was skipped. These checks do not certify browser
rendering, hosted durability, calibration, or cross-model identity.

Full existing sweep rerun: **106/106 passed, zero mismatches**, exit 0. The invocation
imports `sweep()` and prints its summary without overwriting SHE-59's retained
JSON evidence. It uses the harness's explicit seeds 0–99 and uint32 boundaries,
default versioned Future Machine recipe and two population/policy boundaries;
each case independently reruns both 120-step arms. No new random seed selection.

```sh
bun --eval 'import {sweep} from "./scripts/verify-city-seed-replay.mjs"; const r=await sweep(); console.log(JSON.stringify({cases:r.caseCount,passed:r.passed,mismatches:r.mismatches})); if(r.mismatches.length)process.exitCode=1;'
```

Recommended order: (1) version rejection regression and shared validator guard;
(2) worker membership regression and guard; (3) broader foreign-key audit;
(4) missing-outcome fixture before changing legacy aggregation; (5) evaluate key
encoding only with explicit replay/version compatibility. The first two are
independent validation fixes but share contracts.js, so one owner should integrate
them. This report is complete before any application fixes begin. Remaining
SHE-221 child reports and Claude reinterpretation remain separate work.
