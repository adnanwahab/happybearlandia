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
