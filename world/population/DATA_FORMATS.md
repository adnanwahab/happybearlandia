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

## Current-trip read projection

Bounded `visibleAgents` and inspected people optionally carry `trip`, null when
`remaining <= 0`. `population-current-trip.v1` includes departureMinute,
durationMinutes (planned), remainingMinutes, plannedActivity (contracts.js enum),
from/to world x/z and `geometry: straight-line model approximation`. This is
current committed synthetic travel state, not completed-trip history or surveyed
street routing. Enclosing run/version/seed/time provenance applies. Bus/rail
markers identify passengers, not shared vehicles. Consumers must not infer a
fleet count or realized duration from this record. Legacy rows without trip
remain supported by the renderer.
