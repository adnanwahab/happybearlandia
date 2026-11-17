# SHE-33 neighborhood metric audit

The executable mapping is `world/city/neighborhood-metrics.js`, catalog
`neighborhood-metrics.v1`, for `CityState.v1` / `city-systems.1.0.0` only.
It describes the twelve **provisional** IDs in the archived proposal and active
NB-M01 catalog. The screenshot's exact labels and units remain unverified.
`lookupNeighborhoodMetric(label)` returns `not_modeled`, null value/unit and
no source mapping for unaudited labels, including crime, pollution, life
satisfaction, commute time and employment rate. No keyword or proxy inference
is allowed. Supported means a model field exists, not that a particular
snapshot contains a valid measurement.

Each entry declares source paths, district join, unit, reducer, denominator,
evidence files, model/schema/catalog versions, snapshot month scope, missing
policy and limitations. All numeric signals are synthetic assumptions or
modeled results, even when building footprints came from OpenStreetMap.
District IDs are model assignments, not verified neighborhood boundaries.
No cell attribution is established; `cellValue` remains null.

## Observed overlap and differences

- `world/city/seed.js` supplies every listed source field at month zero;
  `world/city/systems.js` updates the modeled state on the existing monthly clock.
  Tests inspect a seed-33, three-household fixture and its real next step.
- `world/city/engine.js:cityMetrics` already computes city-wide population,
  households, unit/availability counts, unhousing, employment, business,
  travel, service and utility summaries. Preserve it. Its mean rent covers
  **all units**, whereas this catalog specifies rental tenure only. Its jobs
  count is all positions, whereas unfilled jobs requires null `workerId`.
  City-wide empty means returning zero are not the district missing-data rule.
- `world/causal/heatmap.js:districtHeatmap` already computes rental-only rent,
  household income and occupancy, with null for an empty denominator. Income
  and occupancy are valid existing layers but are not among the provisional
  twelve. This audit does not replace or expand that UI.
- `world/metric-registry.js` derives proposed policy outcome metrics from plan
  domains. It is not an inventory-field mapping for monthly CityState and must
  not be treated as proof that district outcomes are measured.
- Dependency HBL-W1-004 / SHE-9 was read from Linear as Done on 2026-11-12.
  Existing paired replay tests and `docs/city-seed-replay.md` are retained;
  this metadata catalog neither changes seeds nor creates another model.

## Missing-data contract for downstream aggregation

Missing collections/fields or district attribution must produce unavailable,
not zero. Explicit null assignment IDs mean known unassigned; undefined IDs
mean missing evidence. Complete empty count/sum inventories can yield zero;
empty rental/link mean denominators yield null. No confidence or coverage
numbers are fabricated. Link attribution uses `from`, not `districtId`.
A link mean is not a resident-weighted commute statistic. Facility/network
counts are not counts of affected people. Retain snapshot provenance, month,
seed, scenario/run identity and coverage when implementing actual metric rows.

## Scope, verification and limits

Owned slice: new catalog, its focused tests, this audit and a status entry in
the implementation plan. Existing engine, UI, storage, shared backlog and
simulation contracts are unchanged. Verification resumed on branch
`mini/SHE-33` with these four draft files already present as local changes;
they were preserved and reviewed against source. No worker dispatch, issue
status changes, merge or deployment.

Acceptance: exactly twelve stable unique IDs; source fields verified on initial
and engine-produced state; metadata and missing policy on every entry;
unsupported labels remain null/not_modeled; no input state mutation.

Commands and actual results are recorded in the implementation plan. No browser
behavior changes, so Playwright and screenshots are inapplicable. No lint or
type-check script is configured in package.json. District value computation,
per-snapshot coverage/status evaluation, API/UI wiring and screenshot-label
reconciliation remain separate slices (NB-M02/M04/M05). The registry does not
claim these are implemented. No commit or PR has been published from this task.
