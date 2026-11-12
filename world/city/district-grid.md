# District schematic identity contract

`district-grid.js` exports `createDistrictGrid({scope, districts})`. Version
`city-district-grid.v1` maps each exact initial City district ID to one schematic
context tile. This is a display adapter, with no simulation or geographic model.
The initial district inventory is authoritative for the layout's lifetime.

`scope` contains `runId`, `initialHash`, `modelVersion` and uint32 `seed`.
Use the experiment/pair identity as `runId` when comparing matched arms. Separate
experiments must have separate scope. The caller verifies the saved manifest and
initial hash; this adapter does not authenticate provenance or compute a hash.
Only the current monthly City model version is supported.

Cells contain `cellId`, `districtId`, integer `row`/`column`,
`mapping: synthetic-district-context`, and `geographicCoverage: unsupported`.
IDs encode version, scope and district as JSON tuples, avoiding delimiter
collisions. Neither month, scenario arm, metric, name nor district input order
affects identity. Layout sorts the initial IDs in JavaScript string order into
four columns. There are at most 1,024 districts; empty inventory is supported.
Changing the initial inventory requires a new mapping and may change positions.
No tile represents a physical area, building or real neighborhood boundary.

`grid.project(state, {scope, measurements})` joins by exact `measurements[].id`,
matching the existing `districtHeatmap` output. Values must be finite numbers or
null; duplicate measurement IDs fail closed. It returns version, scope, exact
City month, label, `rows` and `unlocated`. Each row retains a cloned measurement
record, including supplied count, units, source or metric metadata. Consumers
must carry the metric ID/unit and arm alongside each projection and obtain rows
from that exact checkpoint. The adapter does not calculate metrics, validate
their formulas, or establish independently recorded checkpoint equivalence.

Example using the existing supported heatmap source:

```js
const grid = createDistrictGrid({scope, districts: initial.districts});
const view = grid.project(checkpoint.state, {
  scope,
  measurements: districtHeatmap(checkpoint.state, 'rent'),
});
// Keep metric='rent', unit='Illustrative USD per month', and selected arm
// with view. Use view.rows[].cellId for selection across time.
```

`available` preserves a measured zero. `measurement_unavailable` preserves null;
`measurement_missing` means no row was supplied; `district_absent` means the
initial district is absent at this checkpoint. All three unavailable states
have null display values. A removed district retains its tile and identity.
Unknown/new districts and measurements for absent districts remain in the
`unlocated` list with their original record and reason, never a fabricated tile.
No geographic coverage ratio is invented from district counts. Values describe
district context once, never an allocation to smaller cells. Frozen mapping
metadata and cloned measurements protect the source records from view mutation.

The existing Future Machine building/project mapping and heatmap calculations
are reused unchanged. This module adds no browser controls or routes. A later
grid integration can consume this contract; sourced footprint crosswalks and
cell-level aggregation remain separate work.
