# Map of Unknowns

Open 3D `/world` → World controls → Map of Unknowns. Inspect a tile using native
keyboard/touch buttons, choose a layer, or refresh after a view change. Only the
first 60 original loaded buildings are displayed. The arrangement is schematic,
not geography, population, uncertainty magnitude or coverage percentage. No numeric
outcomes are produced. All terrain styling is decorative. World currently supplies
no availability adapter; every live cell therefore honestly remains unknown.

## Contract: hbl-availability.v1

`inspectCoverage(metadata, scope, entityId, layer)` reads metadata with exact `scope`,
nonempty immutable `revision`, and `cells`. Scope must identify the producing authority
and, for run-bound evidence, run/revision/time; entity IDs must be explicitly mapped
within that scope. Never reuse a metadata revision for changed evidence. Cells contain
`entityId`, one of the four exported `layers`, `state` (available/missing/unsupported),
`reason`, `needed`, and `evidence` (all nonempty strings). Evidence should name the
absent/present model and input and their versions/citations; computed outputs additionally
need model/rules/run/seed/time provenance. An available record is not validation.

Missing metadata, wrong schema/scope, absent/duplicate cells or incomplete evidence
return unknown with no numeric value. No imputation, interpolation or zero replacement.
Explicit missing/unsupported records retain their reason and prerequisites. A producer
must validate provenance truth; this reader checks structural eligibility only.

`fixture.json` is deterministic, authored synthetic metadata, with available, missing,
unsupported and omitted cells. No RNG or simulated effects. It is test-only evidence,
never observations or live World coverage. No new agent/social mechanisms or ODD rules.

`mountUnknowns({container,getData})` consumes `{scope,entities:[{id}],metadata}` on open,
refresh and layer change. Adapter failures show unavailable and retry. `destroy()`
removes DOM and listeners. No frame loop or graphics resources are allocated.
