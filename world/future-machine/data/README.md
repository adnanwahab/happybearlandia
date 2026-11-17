# Future Machine City adapter

## SHE-21 acceptance refresh (2026-11-12)

The adapter already exists on this checkout. The remaining owned slice adds
`test/future-machine-paired.test.js`: run the default seed-42 recipe twice,
compare canonical full normalized state and diff digests, verify both 121-frame
arms and unchanged Month 0, then run a null-intervention pair and require zero
differences at every month. Prerequisites are the existing City engine and frozen
diff interface; neither is modified. This local status lives here because the
assignment reserves the shared implementation plan for the coordinator.

Observed acceptance: `bun test test/future-machine-data.test.js test/future-machine-paired.test.js test/city-systems.test.js`
passed 19 tests, 0 failed, 143 assertions. The new test logs the complete scenario,
seed, actual completion event and measured Month-16 homes 36/60/+24 and cumulative
capital USD 0/1000000/+1000000. First physical entity is the added building
`building-project-policy-1-0`, with no identified parcel. Original hash:
`e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`;
paired state digest `7a1d5108b5096380fa3acef8172616fcbcb5dd8810ecbf0993d671441a965264`;
diff digest `1431a5c2df93ee0593bfee9293a735854b6505e7d438918f32caa30224416aee`.
These are real synthetic engine results, not observations of a real city.
Replay remains recomputation. No browser behavior changed; browser/media
verification remains with the coordinator. No shared interfaces changed.

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

## Boundary and reverse-scrub audit (R03/R08)

Follow-up base `c64ce56`, November 11, 2026. Both uint32 boundary seeds were created through the actual SQLite-backed City API, reopened, and independently recomputed. Each arm retained all 120 steps plus immutable common Month 0. Both first completed one 24-home building at Month 16 and ended with 36 baseline / 60 plan homes and 0 baseline / 1,000,000 plan cumulative capital USD. Terminal mean-link travel deltas are positive but negligible: seed 0 `+0.00001464888889302074` minutes/link; seed 4294967295 `+0.000297116444444967` minutes/link. Neither supports a material commute improvement claim.

Canonical SHA-256 evidence (unchanged after pair processing and equal on independent baseline recomputation):

| Seed | Original state | Full normalized baseline history |
| --- | --- | --- |
| 0 | `f49da5e5da9b2f7cc668435b725a6e266bb2dbb3aff52d1b71dce6fd249aa850` | `c8dbfeef6bbd045eb32a119ec470eb4f6bcd7d505718b8f4be052c961a335b6d` |
| 4294967295 | `643d4b0396befbef4e24a09ec3fd061739ff5d591a4e45072ae657b7b13451b9` | `acc26d52682a6f489ba566c67e52a60b1e6faa4a552f2925e49036f9704de5e9` |

A failing regression demonstrated that the adapter previously ignored a wrong experiment ID and did not compare a returned creation recipe with the submitted recipe. It now checks both before requesting replays. No public API signature or persistence format changed. Tests also reject altered generator state, model packs, short/long histories, wrong replay seeds/versions/months, and verify polling abort plus delayed stale replay rejection while a fresh retry completes.

Reverse-scrub tests use real seed-42 City states and the current shared mapping, prewarmed across history as the stage does. They preserve exact IDs/coordinates, omit future inventory at Month 0 even with ghosts enabled, and confirm one shared Canvas camera/scale across split/difference/baseline/plan modes. Pure mapping identity is independent of renderer; native GPU camera behavior still requires coordinator browser verification. No scene/diff files changed.

Verification: `bun test test/future-machine-data.test.js test/future-machine-diff.test.js test/future-machine-boundaries.test.js test/future-machine-scrub-identity.test.js` — 23 passed, 0 failed, 341 assertions. Browser tests were not run for this adapter/pure-regression increment.

## Saved-manifest preflight (SHE-79)

The existing `loadExperiment`/`createExperiment` path validates the completed saved record before either replay request. Both scenario entries must be objects with exact ordered `baseline`/`plan` IDs and real intervention arrays (empty baseline, zero or one object policy for plan). Missing/null entries, array-like impostors and null/primitive policies produce explicit pair/scenario/intervention errors rather than raw property-access exceptions. Unsupported model/system versions, workload bounds, absent initial inventory and mismatched saved/requested recipes retain their existing rejection paths. The common original's canonical hash must also match the versioned generator **before replay**, rather than discovering the mismatch after both replays.

The City's existing optional `manifest.title` is the display-name boundary: if supplied, it must be nonblank text within the API's existing 200-code-unit bound, without C0/C1 or bidi override/isolate controls. Printable Unicode and literal markup remain text; values are neither rewritten nor echoed in validation errors. A missing title remains valid for legacy manifests. No new per-scenario `displayName`/`name` field, required metadata, general scenario catalog, API schema or engine was introduced. Unsupported generic scenario manifests are not converted into a Future Machine pair.

`test/future-machine-manifest-validation.test.js` covers corrupt shapes/metadata, unsupported or missing inputs, pre-replay generator rejection, valid/legacy manifests, a zero-control pair and actual SQLite-backed City API creation/reopen. Errors reject the normal adapter promise, which the existing host displays; this increment does not change UI rendering or make server-wide startup-validation claims. Invalid submitted City jobs may already exist on the server; this client preflight prevents replay/rendering, not production job cancellation.

SHE-57 failure injection retains the existing 180-second whole-operation deadline
(`timeoutMs` may override it for adapter tests). Deadline failures and interrupted
fetch/body transfers report connection/retry guidance; caller abort remains
cancellation. The page's Retry comparison repeats the failed recipe, saved ID and
selected month. Failed loads keep any previously completed pair visibly identified;
a fresh shared page publishes no history until both arms validate. No network
failure triggers recipe recomputation: only an explicitly missing saved record does.

## Snapshot integrity (SHE-86)

City replay responses now add `identity: {experimentId, scenarioId, runIndex,
runId}`; run IDs retain the City's existing `scenario-index` convention and are
scoped to the experiment. The adapter requires the exact requested identity and
copies it onto every normalized snapshot, including the common Month 0 state.
The two Month 0 **states** remain equal; their arm identities differ.
`normalizeReplay` remains a pure state-only helper; production histories use the
identified adapter path. Sparse/null replay steps fail explicitly.

`../integrity.js` checks persisted paired histories before selection, diffing and
stage construction, and checks frame clocks/paired identities before stage
updates. Exactly 121 ordered months, matching state clocks/seed/model and exact
arm/run identity are required. Pure unpersisted diff fixtures can still describe
missing data as unavailable. Old replay servers without identity fail closed;
frontend and backend need to be released together. The additive API envelope is
the only City API change; it does not change storage or model rules. These are
structural integrity checks, not cryptographic authentication or proof of exact
checkpoint replay.

## SHE-76 paired acceptance closure (2026-11-12)

The adapter was already integrated at base `b963dd3`; this increment adds the
assignment's missing `test/future-machine-paired.test.js`, without changing the
engine, API or shared interfaces. The test runs the actual engine twice using
`DEFAULT_RECIPE`, normalizes both complete arms and compares canonical SHA-256
digests of snapshots and frame diffs. It also independently runs the null-policy
control, verifies identical arms and zero differences across all 121 frames,
checks finite-or-null metrics and logs the exact recipe and measured divergence.

Seed 42 digest evidence (same on both executions):

| Content | SHA-256 |
| --- | --- |
| Common initial state | `e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe` |
| Normalized baseline | `139fcb91f0114f87d883d12ef12ed8b06ab3032af7d271410ddfcaef06011f95` |
| Normalized plan | `69480cbe85d6d3f33e152c1d7046a8fab54deb603f9376d5c5beb23c07fe3bf9` |
| Frame diffs | `1431a5c2df93ee0593bfee9293a735854b6505e7d438918f32caa30224416aee` |

First physical divergence remains Month 16, added building
`building-project-policy-1-0`: housing 36 baseline / 60 plan / +24 homes;
cumulative capital 0 / 1,000,000 / +1,000,000 USD. This is synthetic modeled
inventory, with the generator assumptions and replay limitations above.

Actual verification:

- `bun test test/future-machine-data.test.js test/future-machine-paired.test.js test/city-systems.test.js`: 19 passed, 0 failed, 622 assertions, three files.
- `bun test test/future-machine-boundaries.test.js test/future-machine-manifest-validation.test.js test/future-machine-diff.test.js`: 23 passed, 0 failed, 285 assertions, three files. Includes saved identity/version/seed drift, missing snapshots, polling/replay abort and fresh retry.
- `git diff --check`: passed. No browser behavior changed; browser smoke and media were not needed for this test/documentation increment.

Coordinator handoff: retain the existing adapter; integrate this paired regression
and update the coordinator-owned implementation plan with this acceptance
evidence. That plan is outside this assignment's allowed files. No release,
deployment or production data change was performed.
