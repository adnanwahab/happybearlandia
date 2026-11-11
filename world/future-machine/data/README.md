# Future Machine City adapter

`index.js` implements the frozen v1 interfaces with the existing persisted City API. Create uses one run per arm, summary storage, matched seed, 120 monthly steps; sequential replay supplies exact detailed state. Both returned Month 0 snapshots are the unchanged common original, before the plan policy is proposed. History and nested records are frozen. Canonical SHA-256 identifies the original; reopened manifests must match the generator, model pack manifest, pair structure and horizon.

The versioned `future-machine-synthetic.v1` generator starts with City `createCity`, initialized once. Explicit assumptions: no private parcel capacity, utility capacity 200 for each network/district, annual growth zero. It has no geographic coordinates. The default intervention produces 24 additional completed homes and 1,000,000 modeled USD capital spending after 120 months. These are synthetic, uncalibrated model results, not a prediction.

City resets `state.finance.capitalExpense` before publishing each state. Cumulative capitalSpending therefore sums the recorded monthly `state.systems.finance.capitalExpense` ledger. Missing ledgers fail rather than become zero. Events/decisions are preserved; the existing API replay does not enable causal tracing, so causalRecords is empty. Replay is labeled recomputation, not independent checkpoint verification.

Bounds: 1–120 starting households, one intervention (housing at most 120 homes), exact 120-month horizon, validated inventory caps and 1 MB/state, no retained global history/cache. The caller owns the current frozen pair and should discard it when switching runs. Requests have one 180-second operation deadline and support AbortSignal, including polling. Cancellation stops client work; the existing API has no server-job cancellation endpoint, so an already submitted experiment may finish and persist. No API/engine files are changed here.

Acceptance: `bun test test/future-machine-data.test.js test/city-systems.test.js`. Tests cover deterministic replay, immutable original/hash, identical Month 0, both endpoints, version mismatch, missing states, zero-diff deterministic baseline, invalid bounds, cancellation, server errors, real SQLite-backed creation and exact reopen. Measured on this checkout: default engine pair + normalization about 218 ms, serialized normalized history 17,060,382 bytes; persisted API creation + two replays about 711 ms. These measurements exclude browser/network latency and are not production guarantees. Browser composition belongs to integration owner.

Integration contract clarification: capitalSpending must use the recorded system ledger, not the reset finance accumulator. Synthetic generator assumptions above are required to demonstrate completed housing without silently removing utility constraints from the City engine.

## Seed-42 flagship audit (2026-11-11)

Reproduction: `DEFAULT_RECIPE` (`city-systems.1.0.0`, 30 households, 120 months, housing in `d1`, amount 24 homes, cost 1,000,000 USD, delay 0, compliance 1). Use `initialForRecipe()` and the existing monthly engine for both arms; apply the intervention after their common Month 0. The SQLite-backed API create/reopen test verifies the same pair. No new simulator or fixture outcomes are substituted.

| Recorded month | Homes WITHOUT / WITH / delta | Cumulative capital USD WITHOUT / WITH / delta | Mean link travel minutes delta |
| --- | --- | --- | --- |
| 0 (January 2026) | 36 / 36 / 0 | 0 / 0 / 0 | 0 |
| 16 (May 2027) | 36 / 60 / +24 | 0 / 1,000,000 / +1,000,000 | 0 |
| 120 (January 2036) | 36 / 60 / +24 | 0 / 1,000,000 / +1,000,000 | -0.00025240888888866664 |

Month 16 is the first physical inventory divergence. One added three-floor building, `building-project-policy-1-0`, holds the 24 added units. Its `parcelId` is null: the model does not identify a real parcel or geographic footprint. This supports one schematic building, not 24 invented building locations. The plan's Month 16 `construction` event `16-0`, `PROJECT_COMPLETE`, records district `d1`, project `project-policy-1-0`, type `housing`, units 24, and the model version. The recorded project links to policy `policy-1-0` and stage `completion`. Preserve that chain for WHY. Event IDs are local to an arm/month; identify evidence with experiment, arm, seed, model version and time, not event ID alone. No traced causal records are available from the current API.

At Month 120 mean unit rent is 971.504282807192 versus 230.73527356811846 USD/month (delta -740.7690092390735). This average includes added inventory and synthetic vacancy equations; it is not a matched incumbent rent reduction or an empirical forecast. Travel is a mean across links, not residents' commute time. The tiny terminal travel delta is not a material mobility benefit. Capital expenditure is not the same as the city cash-balance delta.

Audit validation: `bun test test/future-machine-data.test.js test/future-machine-diff.test.js test/city-systems.test.js`: 28 passed, 0 failed, 202 assertions. New regression checks lock the first physical month, exact building/unit join, homes/spending/rent/travel measurements, all metric units, deterministic replay, retained completion event/project/policy evidence and missing-ledger rejection. No production code or shared interface change was needed. Browser acceptance remains coordinator-owned.
