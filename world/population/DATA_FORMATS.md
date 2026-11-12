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

### Current-position density (`population-density.v1`)

Population snapshots include `density`: modelVersion, seed, tick, minute,
size=32, bounds, row-major `explicit` resident counts and `weighted` cohort mass.
Bounds span model locations plus one world unit (and origin); row zero is minZ.
Each finite in-bounds current resident position contributes once, including home
and inactive travelers. “Explicit active agents” means all simulated resident
states, not only commuters or visible avatars. Weight is the model's uniform
represented-population multiplier. No rendering sample or district average is
used. `located + missing + outside = total`; weighted bins sum to located×weight,
and representedTotal=total×weight (floating-point tolerance applies).
Missing/nonfinite and outside positions remain separate, never edge-clamped.
Units are counts per tile, not area-normalized density. Color scale is linear
zero-to-current-maximum per selected mode and tick; colors across ticks are not
fixed-scale comparisons. The overview Canvas2D legend reports its scale and totals.
Older snapshots without density show unavailable, never reconstructed estimates.
