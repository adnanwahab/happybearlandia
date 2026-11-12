# Coupled City Laboratory

Open `/world/city-lab.html` with `bun run start`. The world view links to it and carries its latitude/longitude parameters. Run `bun run test:city` and `bun run test:city:e2e` for verification.

This implements a coarse, monthly first release of the supplied Months 10–12 specification (which ends mid-sentence at Feature 139). It is a new experiment engine alongside the existing population and decision engines; it does not silently change their forecasts or persistence formats.

## Model and synchronization

`contracts.js` defines the eight v1 system contracts, deterministic counter draws, assignment invariants and an atomic capacity registry. `engine.js` exposes `createEngine`, `addIntervention`, `scheduleShock`, and `cityMetrics`. Each of twelve packs implements initialize/proposeStep/resolve/commit/observe.

All proposals read a recursively frozen STATE(t). Resolvers operate on an unpublished draft, following explicit topologically sorted dependencies; pack registration order does not change outcomes. Commits publish system summaries and observations after resolution. Failure discards the draft. Annual demographics and quarterly development use the same monthly clock; business openings/closures happen quarterly. This is a district planning clock, separate from rendering and daily population activities.

Resolution graph:

```
environment → governance → utilities → development → construction
→ transport → businesses → jobs → housing → services → demographics → finance
```

Housing/jobs affect next month's transport, accessibility affects current housing choice, and finance feeds next month's funding. These one-month lags are deliberate. A resolver may see prior resolved draft changes; a proposal cannot. Individual capacity reservations and multi-resource reservations are deterministic and atomic.

## Systems

- Housing: explicit units/listings, leases, affordability/bedroom eligibility, ranked applications, seeded conflict resolution, failure reasons, bounded rent changes, local pressure, vacancy days, moves and household budgets.
- Development: parcel capacity, illustrative residual valuation, build/redesign/wait decisions, land competition, staged redevelopment and recorded displaced inventory/businesses.
- Construction: financing, permit queue, contractor/labor/material/equipment limits, weather and rate exposure, delay cost estimates, utility completion gates, start/topping/completion events. Public upgrades consume budget, time and construction resources. Partial monthly capacity advances large projects proportionally rather than requiring the entire nominal monthly allocation to be available.
- Employment: explicit jobs, occupation/commute eligibility, deterministic allocation and bounded wages. Household income reflects filled jobs.
- Businesses: local spending/foot traffic, wages/rent/utility costs, hazard effects, viability, quarterly openings and closures, employment feedback and commercial vacancy proxy.
- Transport: district OD work trips, shortest-path road/transit assignment, parking cost, bounded congestion and denied boarding, accessibility matrix shared with jobs/housing/businesses.
- Services: schools, parks, healthcare, emergency and community facilities; proportional demand sharing across same-type district facilities; utilization/access coverage and stress events.
- Finance: property/activity/fee/transfer revenue, operations, infrastructure operating costs, capital allocation, interest and debt ceilings, fiscal events and monthly ledgers.
- Utilities: electric/water/sewer/stormwater demand, reserve/service level, hazard outages and capacity upgrade projects.
- Environment: spatial district flood/heat/rate/material/recession shocks, damage/displacement, road and utility disruption, repair and resilience projects.
- Governance: proposed/approved/funded/implementing/active lifecycle, staff delays, budget limits, compliance/adoption and immutable scenario world revisions.
- Demographics: annual aging, retirement, bounded job/housing-sensitive migration and household formation/departure.

## Assumed equations (city-systems.1.0.0)

All monetary units are illustrative USD; wages/income/rent are monthly. None of these coefficients is empirically calibrated.

- Listing rent adjustment: `clamp((0.08 - vacancy) * 0.1 + min(5, searchers / max(1, listings)) * 0.002, -0.03, 0.03)`. Rent bound: 100–50,000; leases gate incumbent changes.
- Developer residual: `monthly rent * 12 * units * 15 - (units * construction cost + land value) * (1 + interest + 0.1)`. Candidates contain at most 100 units; default assumed construction cost is 140,000/unit. This is not a financial appraisal.
- Road time: `min(240, freeTime * (1 + 0.15 * min(5, flow/capacity)^4))`. Transit adds `max(0, flow/capacity - 1) * 10` minutes. Single-pass district routing is not equilibrium assignment.
- Utility demand: households + 2 × open businesses; heat raises electric demand by up to 50%. Flood reduces effective capacity by up to 70%. Completion reserves all four utility resources atomically.
- Wage adjustment: `clamp((job vacancy - unemployment) * 0.02, -0.02, 0.02)`, with wage bound 500–50,000.
- Housing budget: savings accrue `income * 0.65 - rent` monthly; budget stress when rent/income > 0.6.
- Revenue: 8% of monthly unit rents + 3% of positive business demand + permit fees + assumed 50,000 monthly transfer. Operations use explicit per-capacity proxies, plus debt interest. Capital funding cannot exceed cash plus explicitly enabled bounded debt.
- Annual growth: baseline + `(jobVacancy - 0.1)*0.02 + (housingVacancy - 0.1)*0.02`, bounded -3% to +5%.

Inspect the source and stored manifest before interpreting outcomes. Values and equations are versioned together; any future equation change must bump VERSION to prevent silently replaying old runs under changed equations.

## Evidence and limits

Use a complete `CityState.v1` JSON for explicit input inventory, or load OSM area data using the existing `/api/area` importer. `createCityFromArea` preserves OSM building geometry and source IDs. District assignments, parcels inferred from footprints, units, costs, zoning, population, roads/transit and capacities remain synthetic and are labeled in provenance. Imported geometry alone does not calibrate a city.

Current implementation intentionally uses coarse substitutes: annual household formation/departure rather than detailed family splitting/merging, aggregate customer demand rather than daily activity-derived visitors, district service coverage rather than travel-time emergency response, deterministic delay cost estimates rather than calibrated overrun probabilities, and shared upgrade machinery rather than fluid/electrical physics. Detailed career transitions, commercial floor-area inventory, iterative transport equilibrium, all-day trips, optimizer fiscal constraints, archive/share bundles, model-card UI, GIS selection APIs, population snapshot databases, multi-user access control, and automatic integration with the existing Decision Room/population worker remain follow-up work. RTree indexes are populated for imported bounding boxes; the default synthetic fixture has no invented geographic coordinates.

## Durable storage

The default is `.hbl-city/` (gitignored), outside all public static roots. `HBL_CITY_DATA_DIR` can point to a durable private volume. This differs from the proposed `data/` path because this application's `/data` directory is publicly served.

```
.hbl-city/hbl.sqlite
.hbl-city/projects/city_<id>/world.sqlite
.hbl-city/experiments/city_<id>.sqlite
```

Control-plane tables index projects, models, datasets, experiments and audit actions; organization/user/member tables reserve future access-control metadata but implement no authentication. World databases hold typed inventory fields, metadata/geometry JSON, immutable revision snapshots and building/parcel/facility RTree indexes with string-ID mapping tables. Experiment databases hold typed metrics, observations, events, decisions/alternatives, trips, moves, finance, services, utilities, businesses, system summaries, flows and diagnostics. Complete initial world/population inputs and model versions are embedded in the manifest. JSON is used for flexible metadata; analytical values have typed columns.

All writers run through one transaction queue per experiment; simulation workers send one completed-run batch and wait for persistence before starting another. There is no animation-frame persistence. WAL, foreign keys, NORMAL synchronous mode and a 5-second busy timeout are set on writable databases. Work is bounded to two concurrent jobs, 1,000 futures per scenario, 120 months, 2,000 initial households, and 10 million household-month-scenarios. Full retention permits at most five futures per scenario. These are protective limits, not performance claims. Summary retains all system events and aggregate/utility/service/fiscal records. Analysis additionally retains every tenth decision/move/trip/business row by deterministic row order; this is a preview sample, not a statistically representative sample. Full retains every decision and alternative/trip/move/business record. Replay recomputes detail regardless of retention.

The existing JSON experiment stores are preserved. This release creates SQLite-backed city experiments rather than migrating older experiments. Active jobs are marked interrupted on server restart. Failed/partial experiments remain inspectable; only completed experiments can be exported or briefed.

## API

- `POST /api/city-experiments` accepts `{title, city:{seed,households}, initial?, runs, months, retention, scenarios?, interventions?, shocks?}` and returns 202 with ID. Without explicit scenarios, baseline and plan use paired seeds. `initial` is a complete CityState; `interventions` configure the plan.
- `GET /api/city-experiments` lists experiments; `GET /api/city-experiments/:id` returns progress, manifest and long-form scenario comparison metrics.
- `GET /api/experiments/:city_id/tables` returns typed table schemas and saved queries.
- `POST /api/experiments/:city_id/query` accepts `{sql}`. SELECT/WITH only, one statement, read-only connection, query_only pragma, disposable worker with a 3-second hard timeout; 1,000-row result preview. Statement/extension/pragma/attachment mutations are rejected.
- `GET /api/experiments/:city_id/export` returns a checkpointed SQLite file including its replay manifest. Add `?format=csv&table=run_metrics` for a formula-escaped, at-most-1,000-row CSV preview; `x-result-truncated` records truncation. Use SQLite for complete exports.
- `GET /api/experiments/:city_id/lineage` exposes provenance, dependency graph, sampling and model manifests.
- `POST /api/experiments/:city_id/replay` accepts `{scenarioId,runIndex}` and regenerates the exact monthly state, decisions, events, flows and diagnostics using its recorded version. Unavailable model versions fail explicitly.
- `GET /api/experiments/:city_id/brief` returns a downloadable Markdown comparison with assumptions and sample ranges.

The same per-experiment suffixes are available under `/api/city-experiments/:id/…`. Existing `/api/experiments` CRUD continues to use its existing contract. The city lab assumes the application's existing trusted deployment boundary; add authentication and authorization before exposing private experiment data to multiple users.

Example intervention: `{type:'utility', districtId:'d1', utility:'sewer', amount:500, cost:1000000, delay:2, compliance:0.8}`. Types: housing, transit, utility, school, resilience, upzone. Resilience amount is a protection fraction capped at 0.95. Upzoning changes capacity; it does not instantly complete homes. Utility projects improve only their selected network. Adding 5,000 homes without labor, money and utility reserves can correctly leave projects delayed.

## Disposable worker lifetime and replay cancellation

City operations retain their existing wall-clock deadlines: simulation workers
use 60 seconds, and query workers use 3 seconds. The shared `workerCall` helper
settles once, clears its timer, removes abort listeners, detaches handlers and
terminates its disposable worker after success, failure, timeout or cancellation.

The replay route passes the request's AbortSignal. An already-aborted request
starts no worker; an abort during replay terminates its worker and releases the
existing replay capacity token. The established API error contract remains
HTTP 400 with `{error: "Operation aborted"}` when a response can be returned.
This does not introduce cancellation for persisted background experiments or
SQL queries, a queued-job cancellation endpoint, or a global multi-process limit.

`bun test test/city-worker-call.test.js` exercises lifecycle races and cleanup,
real deterministic short workers, a real nonresponsive worker deadline, and
normal replay-route cancellation/capacity reuse.

## Verification snapshot

The engine-only synthetic benchmark `bun scripts/benchmark-city.js 1000 12 30` completed 1,000 twelve-month futures with 30 initial households in 12,728 ms on the development machine. This excludes worker startup, SQLite writes, browser rendering and large-city scaling; it is not a 1,000-future end-to-end latency claim.

## What would unblock this?

In **Enter future**, regenerate a saved run and select a month. The project inspector lists unfinished projects, checks the actual next simulated month for delay events, and shows utility headroom plus shared monthly resources. Choose a project, inspect it, then test added sewer/water/electric/stormwater capacity or added labor, permits, contractors, materials or equipment.

Each test runs two bounded continuations in a disposable browser worker from exactly the same state, month, seed and shocks. The proposed capacity is added only to the tested continuation. Utility changes affect the selected project's district; construction and permit changes affect city-wide capacity. A successful fix can still leave another bottleneck binding. The results show completion months, city public/capital spending, ending cash, remaining delay events and a downloadable JSON evidence record linked to the original experiment/scenario/run/month. Tests never modify the saved experiment. Changing the saved month or experiment cancels work and clears the comparison.

Enter the assumed one-time public cost explicitly. The test requires sufficient saved city cash, subtracts that amount once and records it in the first comparison month's capital ledger. Capacity becomes available next month: this is an immediate-procurement diagnostic, not a simulated construction pipeline for an upgrade. Recurring staffing or procurement costs are not inferred. Spending differences include city-wide feedback during the selected horizon and are not project invoices. Comparisons are capped at 60 months, 120,000 household-months and a 30-second worker timeout; cancellation is available. A project not completed during the horizon is reported as unfinished within that horizon, never as permanently impossible.

Run `bun test test/project-unblock.test.js` for the paired-future and budget checks and `bunx playwright test test/e2e/project-unblock.e2e.js` for the saved-experiment UI flow.

Replay responses include an additive `identity` envelope with `experimentId`,
`scenarioId`, `runIndex` and `runId` (`scenarioId-runIndex`, scoped to experiment).
It identifies the validated replay request; Future Machine rejects missing or
mismatched identity before using response states. This does not authenticate
response contents or change stored records/model rules.
