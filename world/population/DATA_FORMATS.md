# Aggregate population data

JSON uses a canonical envelope:

```json
{"schemaVersion":"population-data.v1","datasetId":"example","kind":"population","source":{"name":"Illustrative source","date":"2026-11-02","status":"synthetic"},"units":{"population":"people"},"rows":[{"districtId":"__all__","population":1000}]}
```

Use actual source dates, not the import date. Status may be observed, estimated or synthetic. Source URLs must be HTTP(S). Imports are limited to 2 MB, 10,000 rows, 48 columns and a bounded district registry. Personal names, addresses and unsupported record fields are rejected.

| Kind | Required row fields | Explicit units |
|---|---|---|
| population | districtId, population | population: people; optional medianIncome: USD/year; meanHouseholdSize: people/household; employmentRate: fraction |
| employment | districtId, jobs | jobs: jobs; optional meanWage: USD/year |
| od | originDistrict, destinationDistrict, trips | trips: trips/day; optional meanMinutes: minutes/trip |
| transit | routeId, originDistrict, destinationDistrict, headwayMinutes, capacity, mode | headwayMinutes: minutes; capacity: passengers/vehicle; optional serviceHours: hours/day; mode bus or rail |
| observed_mobility | districtId, mode, share | share: fraction; optional meanMinutes: minutes/trip; tripsPerDay: trips/day |
| observed_moves | districtId, moveRate, periodDays | moveRate and optional displacementRate: fraction/period; periodDays: days |

Modes are walk, bike, car, bus and rail. Fractions are 0–1, never silently converted from percentages. Full mode shares and optional category share distributions must sum to one. Duplicate aggregate keys, unknown districts, invalid dates, nonfinite numbers, negative counts and missing units are rejected. District mappings explicitly translate external IDs to current runtime IDs. `__all__` means a city aggregate and cannot be mixed with district totals in a dataset. It does not establish district coverage. OD/transit endpoints must map to districts.

CSV supports quoted cells, escaped quotes, CRLF and BOM. In the metadata editor supply datasetId, source, units, columns (canonical field to source header), and districtMapping (external ID to model ID). Canonical headers work without a column map. Category share objects in CSV must be JSON strings in quoted cells.

Only explicit city population target fields propose global generation settings. District medians are not averaged into a city median. District distributions, employment, OD and transit are validation/reference data until an explicit adapter exists. Proposals disclose coverage, warnings, applied:false and requiresReset:true and are delivered for Studio review. No source import automatically establishes calibration.

Retained fact exports preserve decision/trip/observation records that actually exist. Separate departure/arrival facts do not imply a complete linked trip. Missing values remain null. Paired actor differences use the shared world/analysis/behavior-deltas.js comparator and are explicitly scoped to supplied actors.

### Reported allocation recovery (`population-memory-recovery.v1`)

`createPopulationRuntime().getMemoryRecovery()` returns a pending offer only after
an allocation-specific error during reset or advance. `recoverWithFewerAgents()`
is an explicit fresh reset with `max(1, floor(population / 2))` individuals; it
releases the failed worker before retrying. At one individual no smaller offer
exists. Advance/resume stay blocked until a reset or checkpoint restore succeeds.
Ordinary worker errors, timeouts, generic RangeErrors and slow frames do not count
as evidence of memory pressure.

The successful snapshot's `resetProvenance.memoryRecovery` and checkpoint runtime's
`memoryRecovery` retain the source configuration, seed, model version, run/revision,
committed tick, before/after population and fidelity note. The source configuration
and source run are historical evidence, not a checkpoint of a partially failed
model. Recovery changes population identities and trajectories. Both measured
active-agent fields are null: allocated individuals do not establish the number of
independently changed states in a measurement window. No cohort backend or retained
microagent precision is claimed. Living City displays the offer and final counts;
recovery leaves the new run paused. Process termination outside JavaScript remains
unrecoverable by this API.

## Neighborhood selection diagnostic

`runtime.inspectNeighborhood({minX,maxX,minZ,maxZ})` reads the full authoritative
worker at the committed tick without advancing it. Bounds are inclusive current
world x/z coordinates, ordered, finite and within ±1,000,000. The
`population-selection.v1` response carries bounds, tick, minute, model version,
seed and a last-step activity window. `simulatedAgents` counts individual records,
not the visible sample or represented weights. `activeAgents` counts distinct
selected residents that changed any of x/z, activity, travel remaining, hunger,
energy, fun or social during that step. Intermediate substep changes persist in
the diagnostic even if values later revert. This is a declared subset of state,
not a claim that every other state field is instrumented. Before any step or in
legacy saves without diagnostics it is null. Missing interaction evidence is
null, never zero. Aggregate-only persons is zero only for unit weights; otherwise
null because the model does not place separate aggregate persons spatially.

Optional `model.selectionActivity` retains tick, from/to minutes and a Uint8Array
of changed resident indices through existing checkpoints. It is observational;
it does not alter behavior or random seeds. The Living World toolbar exposes
Shift-drag ground selection and a keyboard bounds form. Inspection pauses the
clock and labels the returned snapshot; selecting again refreshes it.

### Current-position density (`population-density.v1`)

Population snapshots include `density`: modelVersion, seed, tick, minute,
size=32, bounds, row-major `explicit` resident counts and `weighted` cohort mass.
Bounds span model locations plus one world unit (and origin); row zero is minZ.
Each finite in-bounds current resident position contributes once, including home
and inactive travelers. “Explicit residents” means all simulated resident
records, not the separate last-step active-agent diagnostic, commuters or visible avatars. Weight is the model's uniform
represented-population multiplier. No rendering sample or district average is
used. `located + missing + outside = total`; weighted bins sum to located×weight,
and representedTotal=total×weight (floating-point tolerance applies).
Missing/nonfinite and outside positions remain separate, never edge-clamped.
Units are counts per tile, not area-normalized density. Color scale is linear
zero-to-current-maximum per selected mode and tick; colors across ticks are not
fixed-scale comparisons. The overview Canvas2D legend reports its scale and totals.
Older snapshots without density show unavailable, never reconstructed estimates.


### Assigned-home occupancy and retained encounters (`city-heatmap.v1`)

Population snapshots additionally expose `cityHeatmap` with seed, tick, minute,
`fromMinute`, `occupancy`, `activity`, `unmapped` and `retentionLimit`. Occupancy
counts every simulated resident at their assigned home location (or home district
if that location is absent); `representedCount` is that count multiplied by the
run's population weight. It is distinct from the current-position `density` grid
and the last-step changed-state `selectionActivity` diagnostic.

Activity counts retained hotspot encounters whose recorded minute is in the
open/closed window `(minute - 30, minute]`. The displayed lower bound is clipped
to zero for a freshly initialized run. Each record counts once, without resident
weighting; missing locations contribute to `unmapped`, not a guessed map point.
The existing hotspot buffer retains at most 120 encounters citywide, so this is
not a complete interaction history or a count of distinct active residents.
Coordinates are model x/z; circle intensity is count divided by the largest count
for the selected measure at this timestamp. There is no area normalization or
fixed color scale across ticks. Older snapshots without this projection show
unavailable. Both panels clear with the authoritative snapshot on reset.


### Building home counts (`buildingHomeCounts`)

Current Population snapshots expose `{buildingId, residents, atHome}` rows for
assigned home locations. Counts include all individual records, independent of
`visibleLimit`, using the House `personAtHome` predicate (no active visit, no
remaining travel, home district and within one world unit of home coordinates).
Unmapped home locations are omitted. Values are raw synthetic individuals; no
represented-population multiplier is applied. Residents at other homes do not
light their assigned home's windows. The projection is read-only and uses the
snapshot's minute/tick/model/run provenance. Window selection is a deterministic
visual approximation of atHome/residents, not observed electricity demand.

## Current-trip read projection

Bounded `visibleAgents` and inspected people optionally carry `trip`, null when
`remaining <= 0`. `population-current-trip.v1` includes departureMinute,
durationMinutes (planned), remainingMinutes, plannedActivity (contracts.js enum),
from/to world x/z and a `geometry` label. Legacy checkpoints without the
optional `residentRules` manifest preserve the former straight-line behavior.
Fresh runs declare `residentRules.pedestrian: sidewalks.v1`; walk trips carry
`route` (rulesVersion, kind, world-metre points, distanceMetres, jaywalk and
optional fallback reason) and distance-based `progress`. `mapped-sidewalk`
means an approximate path along supplied road offsets and junction crossings,
not surveyed entrances. Missing/disconnected networks declare `straight-line
fallback`. Other modes retain their district approximation.

Active conversations add `socialDelayMinutes` to projected durationMinutes and
also expose movementMinutes. `remainingMinutes` is locomotion time, excluding a
current chat hold. A conversation starts with the existing social-need effect,
then holds actual movement for three committed minutes; completed-trip history
records the actual elapsed duration. Snapshot people optionally carry
`socialEncounter` with recorded participants, outcome/text, start/until minutes,
partnerId and facing heading. This is a synthetic event on the Population clock,
not a second resident authority or a generated observation.

Enclosing run/version/seed/time provenance applies. Bus/rail markers identify
passengers, not shared vehicles. Consumers must not infer a fleet count from this
record. Rows without trip remain supported by the renderer.


## Compatible resident rule manifest

`residentRules` accompanies Population snapshots and experiment manifests. Known
values are `{pedestrian: "sidewalks.v1", encounters: "resident-encounters.v1"}`.
Absence/null identifies older rules; unknown values, mixed-authority versions or
extra manifest keys reject before restore/replay mutation. The enclosing 1.3.0
model and checkpoint envelopes remain compatible. Live reset, future generation,
replay and future inspection keep the selected manifest. This distinguishes
new sidewalk/social assumptions from older runs using the same enclosing model
version; a missing manifest does not silently opt a saved recipe into new rules.

SHE-447 adds `inspectNeighborhood({polygon:[{x,z},…]})` (3–256 finite
vertices, ±1,000,000 world units). Screen lasso vertices are ray-projected onto
y=0; selection tests current ground anchors with inclusive polygon edges and
an even/odd fill rule. It includes occluded anchors, independent of rendered
samples and interpolation. Keyboard world bounds remain supported.
`entityIds` retains at most 2048 canonical `${model.prefix}-p${index}` IDs in
model order. `selectionStatus` is `complete`, `empty`, or `too-large`; in the
last case IDs are partial and counts still cover the entire polygon. Run and
revision from the worker scope these IDs. This is one atomic read of committed
state, without a second query that could mix ticks. No resident-weight total is
inferred. The UI allows one pending query and one bounded outline; oversized
outlines fail explicitly. Its static SVG has no animation, including under
reduced motion; no GPU selection/readback or retained selection history is used.

## Transient selected journey frames (SHE-623)

`journey-trail.js` consumes only received `visibleAgents` rows with a supported
`population-current-trip.v1` trip and a finite committed x/z position. The host
mounts it in `/world` Living Population person details. This is presentation
memory, not a checkpoint field or a source of model observations. It begins when
a resident is selected, retaining at most 32 frames and 30 elapsed Population
minutes. Nothing is reconstructed from routes, destinations or renderer tweening.

Scope combines runtime ID/revision, model version, resident ID, departure minute
and committed trip endpoints (the existing trip projection has no independent
trip ID). Samples expose that scope, seed, tick, minute, x/z and geometry label.
Only consecutive ticks separated by exactly the runtime's fixed step get a
schematic connecting stroke. Missing positions, unsupported trips, absent sampled
residents and skipped ticks never produce interpolated samples. The Population
clock must agree with `tick * stepMinutes`; other authorities are unsupported.
Backward time, trip/run replacement, selection changes and closing/deactivating
clear history. A finished trip's recent frames can remain until the 30-minute
window expires or another trip begins. Closing the details or leaving Living
Population clears them immediately. Reopening has no historical prefill.

Native sample buttons inspect exact positions and provenance, marking the sample
in the scene without moving the resident, camera or clock. Geometry is static
and identical with reduced motion; there is no playback, pulse or automatic
camera animation in this overlay. Coordinates and connections are synthetic
model outputs and schematic presentation, never real resident tracking or proof
of the path traveled between samples. Buffers are fixed-capacity and disposed on
host teardown. No model rules, scheduling, RNG, source identities or persisted
run records change; the Population ODD remains applicable unchanged.

## Cohort Spotlight (`home-district-id-order.v1`)

The existing `/world` Population City Deck zoom consumes one frozen Population
snapshot. `zoomEvidence(frame, districtId)` maps `visibleAgents.homeDistrictId`
to an exact `districts.id`; coordinates must be finite and IDs present. It sorts
IDs lexically, deduplicates by ID and selects at most 12 within that home district.
Unknown district IDs and empty samples produce no representatives, never a
substitute district or generated person. This is a presentation cohort, not the
SHE-144 hierarchical engine or the household income cohorts.

The fixture in `test/population-zoom.test.js` fixes all inputs and expected IDs.
Stable means identical supplied snapshot and district produce identical ordering;
camera-dependent worker membership, tick changes and resets may change the sample.
Opening captures a snapshot; district changes reuse it; reopening captures anew.
Inspection sends the retained ID to the existing inspector, which reads current
state and can reject stale identities. Frozen coordinates do not promise history.
Model version, seed, runtime ID, tick and minute retain snapshot provenance; absent
metadata is displayed as unavailable. No RNG is consumed or model state changed.

Allocated resident records, weighted represented total, worker sample size,
selected IDs and drawn representatives are separate. Independently active agents
remain unavailable without a changed-state window measurement. Weighted mass is
not an independently simulated population. The Canvas2D circles/radii/fade are
decorative projections of synthetic model outputs; no observed resident sources,
probabilities, causal effects or empirical representativeness are supplied.
Missing Canvas2D retains textual IDs/inspection. Destruction cancels animation,
removes the panel and releases retained snapshots; it allocates no GPU resources.
