# Citizen Quest Forge

Normal entry: `/world` → **Citizen Quest Forge** → `/world/quest-forge/`.
The initial Genuine logged requests choice explicitly has no source data. No
external request service, ingestion, collection, authentication or publishing is
enabled. Choose Pinned authored housing demo to exercise the complete local
journey. This is a separate monthly City experiment, with no mapping to the
World Population resident or tick selected before navigation.

## Source contract and bounded template

`forgeQuest(record, initialState)` accepts exactly these `civic-quest-request.v1`
fields: `schemaVersion`, `id`, positive integer `revision`, `sourceKind`
(`authored-demo` or `logged-request`), bounded plain `sourceRef` and `text`,
`concern`, City `districtId`, current `modelVersion`, and exact full
`checkpointHash` (the City challenge contract's canonical SHA256 initialHash).
`sourceRef` identifies the original log record/revision, not a rendered quote or
an endorsement. Inputs are cloned before asynchronous work. Unknown fields,
unsupported source/model versions, absent districts and checkpoint mismatches
refuse. An identity from Population, geographic OSM data or another civic model
is insufficient: a producer must explicitly map a request to this City authority
and immutable initial state. A hash detects changes, not source authenticity.

Only `housing-access` maps to a lever in this version. The authored template
permits two homes in the request's exact district for 1,000 synthetic USD, a
5,000 public capital cap, 20 monthly steps and no-action matched control. Its
objective is fewer unhoused synthetic households citywide, with the existing
population, employment and housing guards retained. It does not promise a home
for the requester or improvement within their district. Funding, construction,
utilities and ordinary City rules determine whether the objective is met. Actual
capital excludes operating expense/private construction. No arbitrary prose is
translated into parameters, scores or new model behavior.

`forgeRequests(records, initialState)` accepts up to 32 records and returns
`no-source-data`, `unsupported`, or `available`, with explicit per-record
rejections. It never manufactures an origin. This is an adapter API for local
producers; there is currently no connected producer of genuine requests. An
external adapter still needs source authenticity, permitted use/redaction,
revision retention and a reviewed City identity/checkpoint mapping. No real
resident information is included in the demo or tests.

`verifyQuest(quest, candidate, {signal})` reconstructs and compares the entire
frozen quest before replaying through the existing City challenge verifier.
Source text/revision, digest, terms, seed, initial-state or guard changes reject.
Only frozen action IDs can be chosen; caller outcomes are refused. A result
includes the original request, declared condition, exact starting checkpoint,
matched seeds, final synthetic observations and complete monthly capital
ledgers. These are recomputed outcomes, not equivalence to independently
recorded historical checkpoints. Missing measurements do not count as success.
Cancellation rejects without a receipt. Source/plan changes clear rendered
receipts and invalidate pending work; late completion cannot repopulate the UI.

## Pinned authored demonstration

`demo.js`, `quest-forge-housing-demo.v1`: six synthetic households, seed 42,
initial month 0. All existing units start under construction, households unhoused,
private parcel capacity zero and utility capacity 10,000. These intentionally
extreme toy assumptions isolate the existing public housing mechanism. The
request is authored flavor, not measured testimony. Same-seed City outputs at
month 20 are control six / candidate four unhoused households; no action yields
six / six and does not win. All default challenge guards remain enabled.

The test pins the full initial-state hash and quest digest. Rule/fixture changes
must be deliberate, versioned and reviewed, never silently update that evidence.
Existing City ODD remains applicable: this adapter adds no agent scheduling,
preferences, simulation rules, RNG draws, clock or causal claim. Compare
`docs/models/city.md`, `world/city/engine.js` and `world/challenges/contract.js`.

Checks: `bun test test/quest-forge.test.js`; optional DOM integration:
`HBL_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js bun test test/quest-forge-ui.test.js`.
Without the optional module that test is explicitly skipped. Browser navigation:
`bunx playwright test --config test/quest-forge.browser.config.js`.
