# Monthly coupled City — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Explore constrained housing, work, development and policy scenarios. Vacancy, fiscal stress and project delays are illustrative patterns, not calibrated forecasts. [City documentation](../../world/city/README.md) gives equations and API contracts.

## 2. Entities, state variables and scales

CityState contains households, workers, jobs, units/leases, firms, parcels/projects, districts, links, facilities, utilities, policies and finance. IDs belong to this engine. Time is integer months; money is illustrative USD, rents/wages monthly, travel minutes. Demographics are annual and business/development proposals quarterly.

## 3. Process overview and scheduling

[createEngine](../../world/city/engine.js) topologically sorts packs. All active proposals read frozen STATE(t). Resolvers mutate an unpublished draft in dependency order: environment, governance, utilities, development, construction, transport, businesses, jobs, housing, services, demographics, finance. Commit/observe follows resolution; validation precedes return. Failure leaves input unchanged. Jobs/housing affect next month transport; finance affects next month funding. Cadence gates active packs.

## 4. Design concepts

Basic principles: explicit inventories and atomic scarce-resource allocations. Emergence: vacancy, moves, closures and delays result from constraints. Adaptation/objectives: households rank eligible homes/jobs, developers build/redesign/wait, businesses respond to viability. Learning/prediction: no learned strategies; residual valuation is a fixed heuristic. Sensing: prior snapshot plus explicitly resolved dependencies. Interaction: competition for units, jobs, land, finance and construction resources. Stochasticity: counter draws keyed by seed, time and rule keys. Collectives: households, firms and institutions. Observation: events, alternatives, moves/trips, flows and metrics; sampled retention cannot supply a complete agent history.

## 5. Initialization

[createCity](../../world/city/seed.js) creates a synthetic fixture; explicit CityState or area-derived inputs are alternatives. Engine initialization clones state and initializes every pack. Retain full initial state, seed, parameters, interventions, shocks, engine VERSION and pack manifest. Do not substitute a new fixture for a saved initial state.

## 6. Input data

OSM imports preserve geometry/source IDs, while inferred units, costs, capacities and population remain labeled synthetic. No external observations arrive autonomously during steps. Shocks and policy schedules are scenario inputs. [Seed/replay evidence](../city-seed-replay.md) describes retained inputs and comparisons.

## 7. Submodels

[systems.js](../../world/city/systems.js) implements the twelve packs. Housing filters affordability/bedrooms then ranks applications with seeded conflict resolution; rent changes are bounded to ±3%. Development uses illustrative rent capitalization minus construction/land/finance cost. Construction reserves permits/labor/materials/equipment and requires utility capacity before completion. Transport uses single-pass district routing rather than equilibrium. Business demand is aggregate spending, services use proportional coverage, utilities use household/firm demand proxies. Finance tracks revenue, operating cost, capital and bounded debt. Demographics use bounded job/housing-sensitive annual migration. These assumptions and exact equations are colocated in the [City equations](../../world/city/README.md#assumed-equations-city-systems100). Future Machine replays this engine; it is not a second ABM. Verify: `bun test --timeout 15000 test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js`.
