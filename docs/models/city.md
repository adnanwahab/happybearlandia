# Monthly coupled City — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Explore constrained housing, work, development and policy scenarios. Vacancy, fiscal stress and project delays are illustrative patterns, not calibrated forecasts. [City documentation](../../world/city/README.md) gives equations and API contracts.

## 2. Entities, state variables and scales

CityState contains households, workers, jobs, units/leases, firms, parcels/projects, districts, links, facilities, utilities, policies, finance and resident records. Each worker supplies one synthetic adult resident ID; this is neither the complete household population nor a mapping to daily Population people. Resident state includes monthly routines, bounded need-satisfaction proxies, ties, current goals and retained event-linked memories. IDs belong to this engine. Time is integer months; money is illustrative USD, rents/wages monthly, travel minutes. Demographics are annual and business/development proposals quarterly.

## 3. Process overview and scheduling

[createEngine](../../world/city/engine.js) topologically sorts packs. All active proposals read frozen STATE(t). Resolvers mutate an unpublished draft in dependency order: environment, governance, utilities, development, construction, transport, businesses, jobs, housing, services, demographics, finance, residents. The residents pack updates monthly after finance; building inventory changes are then checked against exact construction-completion events before publication. Commit/observe follows resolution; validation precedes return. Failure leaves input unchanged. Jobs/housing affect next month transport; finance affects next month funding. Cadence gates active packs.

## 4. Design concepts

Basic principles: explicit inventories and atomic scarce-resource allocations. Emergence: vacancy, moves, closures and delays result from constraints. Adaptation/objectives: households rank eligible homes/jobs, developers build/redesign/wait, businesses respond to viability. Learning/prediction: no learned strategies; residual valuation is a fixed heuristic. Sensing: prior snapshot plus explicitly resolved dependencies. Interaction: competition for units, jobs, land, finance and construction resources. Stochasticity: counter draws keyed by seed, time and rule keys. Collectives: households, firms and institutions. Observation: events, alternatives, moves/trips, flows, metrics and resident records; sampled retention cannot supply a complete agent history. Resident district-context event IDs are contextual links, not demonstrated causal effects; event payloads identify the synthetic rule and model version.

## 5. Initialization

[createCity](../../world/city/seed.js) creates a synthetic fixture; explicit CityState or area-derived inputs are alternatives. Engine initialization clones state and initializes every pack; resident initialization adds only missing worker-backed identities and preserves existing resident records. New residents start with housing/livelihood satisfaction 100 and social satisfaction 50, empty ties/memories and unachieved goals; monthly rules then update those assumed initial values. Retain full initial state, seed, parameters, interventions, shocks, engine VERSION and pack manifest. Do not substitute a new fixture for a saved initial state. Current city-systems.1.1.0 manifests require their matching implementation; older manifests are not silently replayed under these rules.

## 6. Input data

OSM imports preserve geometry/source IDs, while inferred units, costs, capacities and population remain labeled synthetic. No external observations arrive autonomously during steps. Shocks and policy schedules are scenario inputs. [Seed/replay evidence](../city-seed-replay.md) describes retained inputs and comparisons. The optional [housing/drainage guide](../../world/city/policy-comparison.js) supplies a versioned scenario recipe using the unchanged engine: 120 synthetic households, seeds 42–46, 36 months, and a shared month 24 Riverside flood of severity 0.7 lasting three months. Its baseline has no intervention; housing proposes six homes for illustrative USD 840,000, while drainage proposes +0.4 resilience for USD 200,000. Ordinary funding/construction gates apply. This resilience proxy is not hydraulic water-depth or pipe-flow simulation; event-time flood evidence remains separate from final repaired stocks.

## 7. Submodels

[systems.js](../../world/city/systems.js) implements thirteen packs, including the [resident submodel](../../world/city/residents.js). Housing filters affordability/bedrooms then ranks applications with seeded conflict resolution; rent changes are bounded to ±3%. Development uses illustrative rent capitalization minus construction/land/finance cost. Construction reserves permits/labor/materials/equipment and requires utility capacity before completion. Transport uses single-pass district routing rather than equilibrium. Business demand is aggregate spending, services use proportional coverage, utilities use household/firm demand proxies. Finance tracks revenue, operating cost, capital and bounded debt. Demographics use bounded job/housing-sensitive annual migration. Resident housing satisfaction is 100 when housed and 0 otherwise; livelihood satisfaction is bounded `100*(1-housingBurden)`. An active resident gains one bounded social-satisfaction/tie-strength point monthly with the first other resident whose household is in the same district. Monthly routines and housing/job goals reflect current assignment, not simulated daily behavior or permanent achievement; departed residents retain their history. These assumptions and exact equations are colocated in the [City equations](../../world/city/README.md#assumed-equations-city-systems100). Future Machine replays this engine; it is not a second ABM. Verify: `bun test --timeout 15000 test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js`.


The [Hundred-Future Racetrack](../../world/racetrack/README.md) records a bounded
presentation fixture from the existing Future Machine synthetic initializer and
unchanged City engine. Its 100 authored scenarios use seed 42, 30 initial
households, 120 monthly steps, housing amounts 1–100 and delay `(index * 7) % 48`
for zero-based index 0–99. Other proposal fields retain DEFAULT_RECIPE. These
inputs are synthetic assumptions, not sampled probabilities. The view reads unit
inventory projections; it adds no social mechanism, RNG, clock or state authority.


The [Policy Impact Explorer](../policy-impact-preview.md) freezes public legal
versions over the existing Constitution City registry/runtime. It uses the same
Monthly City IDs, integer-month clock and shared initial state for each paired
seed. No agent rules change. The integration's declared initialization and
intervention assumptions are synthetic: supported mechanism presence/absence,
full compliance, no added delay and an illustrative USD 1,000 capital envelope
per mechanism. `h_lots` authorizes +4 homes per modeled parcel, `f_drainage`
adds +0.12 resilience when built, and `t_brt` adds +30 link capacity at one
synthetic hub with the existing 0.8 travel-time multiplier on completion.
Unknown clauses and wording-only edits do not infer new numeric effects. A
removed authorization is compared from the common initial city, not by deleting
built assets. Recorded metric rows are monthly; the viewer's renderable state
checkpoints are month 0, month 12 when within the horizon and the terminal month.
Only actual checkpoint states are displayed, and failed pairs remain missing.
Seed spread is not calibrated real-world uncertainty. The versioned manifest and
persisted results retain the replay basis; later model versions cannot silently
reinterpret frozen results.
