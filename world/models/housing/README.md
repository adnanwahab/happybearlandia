# Housing model pack v1.2.0

`index.js` is browser-safe and has no DOM or network dependency. It exports the
agreed `housingModel`, `compileHousingPlan`, `createHousingScenarios`,
`simulateHousingRun`, `stressPresets`, and `validateHousingParameters` contract.
All parameter IDs, native units, bounds, steps, defaults, uncertainty options,
source/confidence/date, and model boundaries live in `schema.js`.

This is a **synthetic demonstration**, not an empirically calibrated model.
The model's numerical coefficients and default metropolitan area are illustrative.
The Houston example bundles four sourced housing/occupancy estimates. These and
the official series references below provide historical context, not empirical
support for the policy effect sizes.

## Kernel integration

Scenarios contain full **raw** parameter maps and preset IDs. Sample uncertainty
first, then call `applyHousingStress(sampledParameters, scenario.stressPresets)`
**once**, then pass that map to `simulateHousingRun({parameters,seed,years})`.
The alias `applyStressPresets` is also exported. Stresses are adverse bounds, so
combination order does not matter and repeated application is idempotent. They
override uncertainty draws only where the draw is less adverse than the preset.
Unknown preset IDs throw an inspectable error.

The default pack provides current policy, Plan A, Plan B, and Plan A with recession,
implementation delay, and budget cuts. Baseline is current-policy stock, permitting,
and construction with zero incremental subsidies or vouchers. Plans change explicit
policy parameters; the same three monthly exogenous innovations are drawn in each
paired seed irrespective of policy. Seven presets compose: recession, high
inflation, low adoption, implementation delay, demand surge, budget cut, supply
constraint.

## Accounting and equations

Each month:

1. Households compound by household formation + migration + a bounded stochastic
   demand innovation. Income compounds by real wage trend, economic growth, and
   unemployment stress.
2. Policy delivery is `phase × adoption × (1 − resistance)`. Implementation delay
   and resistance defer the 12-month phase-in. Current-policy building continues.
3. Retirements remove homes; queued projects reaching completion add homes. Policy
   interpolates permitting from 18 months to its target, density from 1× to its
   target, and transit siting from 25% to its target.
4. Private starts depend on physical capacity, permit throughput, density,
   financing feasibility, construction costs, macro conditions, and actual vacancy.
   Subsidized starts use remaining physical capacity. A construction grant covers
   an illustrative 35% of per-home cost; starts pay the grant then enter the queue.
   Queue duration includes permitting and construction. Public construction funds
   support additional starts only; no unlimited conversion of money into homes.
5. Delivered vouchers are capped by eligible households' rent. Only actual grants
   and vouchers count as expenditure; undelivered/unspent appropriations do not.
6. Annual rent adjustment is `rent_response × (6% target vacancy − actual vacancy)`,
   bounded between −10% and +16% annually, plus a small wage/demand trend term.
   This behavioral response coefficient needs local calibration.

Housing satisfies initial stock + completions − retirements = final stock.
Initial pipeline + new starts = completions + remaining pipeline. Year-zero and
annual snapshots plus event ledgers retain the resulting accounting. Rents and
incomes are base-year dollars. Construction inflation erodes the purchasing power
of fixed program budgets. Tax, employment, homelessness, displacement, and commute
outputs are explicitly labeled proxies and their formulas appear in the code.
Driver traces record calculated terms; they are not invented causal percentages.

## Plan compiler

The deterministic parser extracts explicit permitting targets (including “from 18
months to 6 months”), implementation delays, and annual `$B`/`$million` housing or
voucher budgets. It retains matching excerpts and flags ambiguous allocations,
lump sums without annual periods, and out-of-bound amounts. Keyword suggestions
and unspecified values retain low-confidence generated/synthetic provenance.
Nothing from parsing is a verified fact. Review the resulting assumptions.

## Historical adapter and calibration

Official references inspected on **2026-11-02**:

- [Census ACS median gross rent variable B25064_001E](https://api.census.gov/data/2024/acs/acs1/variables/B25064_001E.html).
- [Census ACS table registry](https://api.census.gov/data/2024/acs/acs1/groups.html)
  for housing stock (B25001), gross rent (B25064), household income (B19013), and
  households (B11001).
- [Census HVS historical tables and methodology cautions](https://www.census.gov/housing/hvs/data/histtabs.html).

`housingHistoricalSources` stores agency, series definitions, URLs, units, and
verification date. No fictional observations or calibration scores appear.
Rental HVS vacancy and all-home model vacancy have different denominators and
must not be treated as interchangeable. ACS stock may include seasonal/unusable
homes. ACS income covers all households, not just renters. These are model/data
boundary issues requiring analyst judgment.

`importHousingHistory(csvOrJson, options)` accepts long rows
`{year,metricId,value,unit,availableAt,geography}` or wide rows plus a
`mapping:{metricId:columnName}`. Options may supply shared geography, units,
source URL/name, retrievedAt, and publication date. `availableAt` means actual
publication/vintage availability, **not** just the observation date.
`cutoffDate` excludes later publications. Negative Census sentinels, empty cells,
invalid units, invalid dates, and nonnumbers never become zeros. Dollar conversion
requires an explicit `dollarFactors:{[observationYear]:factor}` when the data's
dollar year differs from `baseYear`; no inflation index is fabricated.

`importCensusHousingHistory(downloadedApiArray, options)` maps the official fields
`B25001_001E`, `B25064_001E`, `B19013_001E`, and `B11001_001E`. Supply a single
geography, year, actual release date, source URL, retrieval date, and dollar basis.
It does not fetch data or imply that an arbitrary imported file is genuine Census
data. Imported provenance remains “user-supplied-cited” until verified externally.

`historicalInitialParameters(observations,{cutoffDate,geography})` selects only
pre-cutoff observations and refuses mixed years/geographies/dollar bases.
`calibrateHousingModel(...)` performs an inspectable grid fit of `rent_response`
against **pre-cutoff** user-supplied rent observations, retaining candidate errors
and training provenance. `validateHousingHistory(...)` compares saved ensemble
timelines against observed rent/stock, returning MAE, RMSE, MAPE, interval coverage,
and observed percentile. Results distinguish held-out observations from in-sample
diagnostics. Compare one scenario/geography at a time, with a consistent dollar
basis. Model year zero is `baseYear`. Calibration and held-out evaluation must use
separate observations; historical fit does not establish future predictive accuracy.

### Published Houston diagnostic

`houstonHistoricalExample` and `createHoustonHistoricalDiagnostic({runs:100,seed:42})`
are exported from `index.js`. The helper returns published observations, full source
metadata, cutoff-aware initial parameters, actual deterministic model runs, and
`validation.points` containing observed value, simulated mean/median/p10/p90,
error, and observed percentile. Analysis UI can render those fields directly.

The [2018–2022 ACS table published by Houston](https://www.houstontx.gov/planning/Demographics/2024-council-districts/demographics-tables/2024/3.%20Housing%20Occupancy%20Status.pdf)
reports **1,006,392 housing units and 897,510 occupied units**, released December
2023. The [2019–2023 table](https://www.houstontx.gov/planning/Demographics/2023-cd-demog-profiles-released-2024-dec/demo-tables/03-Housing-Occupancy-Status.pdf)
reports **1,023,112 units and 916,536 occupied units**, released December 2024.
Both values come from the “City of Houston” row on page 1. Dates `2023-12-31` and
`2024-12-31` are explicitly **inferred conservative month-end availability dates**;
the source only states the release month. Data were verified November 2, 2026.

Only the earlier stock and occupied units initialize this example at cutoff
`2023-12-31`; all other coefficients remain synthetic. The later stock estimate
is compared to model year one; later occupancy is context only. These are
**overlapping five-year survey estimates**, not independent annual point estimates.
The cutoff is after the period indexed 2023, so this is **not a strict forward
forecast backtest** even though the later estimate had not yet been published.
Margins of error and overlapping-period covariance are unavailable in the source
tables and not simulated. No empirical policy calibration or predictive-accuracy
claim follows from this diagnostic. These limitations travel with the helper output.

Run model checks with `bun test test/housing-model.test.js`.

## Building interventions and version compatibility

`legacy-v1.js` and `schema-v1.js` retain the original **1.0.0** implementation and
schema. API/worker code must select the stored model version. The public
`resolveHousingModel(version)` returns both model descriptor fields and
`{model,simulateRun,simulateHousingRun,applyStressPresets,validateParameters}`.
Version 1.0.0 cannot accept projects or scheduled stresses; use a new 1.1.0 draft.
Saved/completed experiments are never reinterpreted as 1.1.0.

Version 1.1.0 accepts `projects:BuildingProposal[]` and
`scheduledStress:[{presetId,startMonth}]`. Empty projects preserve every original
metric's numerical value and all original exogenous draws. Removing an approved
project restores the identical no-project input result under the same seed.
Project randomness uses independent project-ID streams. Adding another project
does not consume the housing model's random stream; capacity competition can
still change physical project timing.

The building contract and placement validator are in `../../buildings/proposal.js`.
Coordinates are meters and rotations radians. Square footprints convert sqft to
m² using exactly 0.09290304; edge crossings, containment, rotated footprints,
native town `poly` polygons, world bounds, and optional district boundaries are
checked. This is geometric validation, not zoning or land-ownership clearance.

`../../buildings/lifecycle.js` publishes the renderer/analysis run shape. Each
project stores every month (including zero): phase, construction progress in 0–1,
floors, completed/occupied/affordable units, paid public subsidy, private/total
cost, capacity use, and delays. Permit/build delay, cost overrun, and cancellation
draws are deterministic synthetic assumptions. Proposed and cancelled input
projects never alter market dynamics or spending. Imported in-progress statuses
restart as approved projects at model month zero; importing historical partial
construction accounts is outside this contract.

Approved projects traverse permitting, site preparation, excavation, foundation,
structure, floors, envelope, interior, completion, then a six-month occupancy ramp.
The construction phase schedule reserves an observable month for each phase;
short requested builds have a documented eight-month minimum including seeded delays.
Monthly shared construction capacity is reserved in stable project-ID order. Each
project requires home-equivalents equal to homes + commercial sqft/1,000 + parking
spaces/10. The remaining capacity supports systemic construction starts. Stock is
added once at completion; affordable homes are a subset, never extra stock.
Project grants are separate fixed public awards paid proportional to construction
work and delivered funding; private owners absorb seeded overruns. Cancelled
projects retain actual sunk costs and add no homes.

`run.projects` retains project timelines/events; `projectMetrics` summarizes them.
`accounting.capacityLedger` records each month's available capacity, specific
projects, systemic starts, and unused balance when projects are active. Housing
mass accounting includes project completions; the systemic pipeline separately
reconciles initial pipeline + starts = systemic completions + remaining pipeline.
Project metrics also appear in the schema so comparisons/exports can include them.
Only residential completions change housing stock: retail, offices, and parking
consume capacity/private cost but their operational activity is not separately
modeled. Affordable-unit tenure, local rent caps, and unit-specific vacancy are
not modeled.

Timed stress presets actually begin at `startMonth` (month zero is explicit).
They update monthly dynamics from that month onward and emit
`STRESS_PRESET_STARTED`; they do not rewrite earlier snapshots or trigger at year
zero silently. New macro conditions alter demand, income, financing, capacity,
and delivered project funding. Initial project uncertainty draws are fixed at
approval, so timed shocks do not retroactively resample cancellation/overrun risk.

Run building checks with
`bun test test/building-proposal.test.js test/building-lifecycle.test.js`.

## Monthly forks and numerical explanation (v1.2.0)

`legacy-v1.1.js`, `schema-v1.1.js`, `lifecycle-v1.1.js`, and `proposal-v1.1.js`
freeze the 1.1.0 model, schema, construction, and validation implementation.
The 1.0.0 files remain intact. Resolve
the **recorded** model version; an older run is never silently rerun as latest.
Only 1.2.0 advertises `supportsForks` and a `simulateHousingFork` resolver method.
Existing schema units and numerical dynamics are unchanged for a no-op input.

`simulateHousingFork({parameters,seed,years,projects,scheduledStress,
fork:{month,operations}})` runs the original monthly loop. Month `m` is the last
unchanged completed month. Approved operations begin **before month m+1**, after
the original RNG, construction queues, policy history, balances, and project
progress have reached month m. There is no new year-zero simulation with edited
parameters and no timeline splicing. Deterministically replaying to the branch
reconstructs the actual live state, then continues it; serialized resumable
checkpoints and nested/multiple branches are not implemented.

All 1.2.0 outputs include `monthlyTimeline:[{month,year,metrics}]` for every month
including zero. Yearly `timeline` remains compatible. Fork output includes
`fork:{schemaVersion,month,appliedAtMonth,operations,parentSeed,modelVersion,...}`.
A no-op fork is numerically and historically identical to the original run,
apart from its lineage metadata. Existing project monthly states and risk draws
are retained. New project states/events start after the branch, use independent
project-ID randomness, and compete for the same actual capacity. Their permit
clock starts at the branch, not at year zero. Cancelling unfinished construction
retains sunk public/private cost and historical geometry; it adds no housing.

Supported operations use the approved WorldEdit vocabulary:

- `set_parameter` with a bounded registered parameter ID and numeric value;
  initial housing/household/rent/income resets are rejected.
- `add_building` targeting `world.projects`, with a fully validated **approved**
  proposal and non-overlapping footprint.
- `remove_building` targeting an unfinished project ID: forward cancellation,
  never demolition or erasure of completed stock.
- `apply_stress_preset` with a known preset ID: it begins after the branch and
  does not duplicate already-scheduled stresses.

Moving/redesigning existing buildings is deliberately rejected. Otherwise a final
proposal could retroactively alter pre-branch geometry in replay. Arbitrary
equations, evidence changes, uncertainty resampling, and nested schedules are also
unsupported. This simulation API does not confer approval; the host's existing
preview/approval/revision mechanism must authorize the operations first.

`runHousingCounterfactual({run,scenario,years,parameterId,value,metricId})` resolves
the recorded version and reuses effective sampled parameters (including immediate
stress), exact seed, original projects, scheduled stress, and fork contract. It
returns actual baseline/counterfactual runs, metric deltas and event logs. It
reports mismatches if retained inputs do not reproduce stored metrics. A fork
requires original project inputs, because final project rows may include buildings
added later and cannot safely serve as year-zero input.

`explainHousingRun({run,scenario,baselineRun,baselineScenario,years,metricId})`
reruns one changed parameter at a time at its baseline value with matched seeds.
It returns `contributions`, `topFive`/`reasons`, `totalDelta`, `sumOfReversions`,
`residual`, and `topFiveResidual`, plus equations and actual events. Baseline
defaults are explicitly labeled illustrative if no recorded baseline is supplied.
Reversion deltas are **nonadditive**: they are not percentages, causal proof,
Shapley values, or a calibrated decomposition. Residual includes interactions,
project/schedule/fork differences and unexamined effects.

`housingCausalRegistry` exposes browser-safe nodes, edges, equation expressions,
source references and event-type links. It describes programmed dependencies and
synthetic coefficients, not empirical causal identification.

Focused checks: `bun test test/housing-fork.test.js`.
Backlog coverage for this component: numerical portions of 5, 19–25, 104–106,
124–127, 129–131. UI approval, fork comparison/promotion, graph rendering and
broader optimization/stress workflows belong to their respective owners; this
module does not claim completion of all numbered product requirements.

## CI validation rules

[Automatic model validation](../../../docs/model-validation.md) runs the existing
calibration and backtest tests plus `housing.houston-stock-error` on every PR.
The accuracy rule requires complete finite predictions and unchanged observed
stock, dataset, model version, seed and ensemble size. Absolute mean stock error
must not exceed the reviewed fixture plus 0.000001 homes numerical tolerance.
The Houston overlapping-vintage diagnostic is not a strict forecasting backtest.

The checked calibration invariants are: historical inputs used for initialization
and coefficient fitting were available at cutoff; held-out observations do not
enter fitting; geography, units and dollar basis match; missing dates, sentinel
values and invalid horizons are rejected. Synthetic coefficient recovery must
recover the known coefficient. Seed replay reproduces all numerical outputs;
policy and uncertainty scenarios preserve their supported parameter contracts.
Stock and pipeline conservation equations are specified under Accounting and
equations above. The monthly City has its own separate
[invariant catalog](../../city/VALIDATION.md).

Additional checked housing invariants: public expenditure equals actual subsidy
plus voucher spending; each stays within its annual budget times horizon; zero
funding or zero adoption yields zero policy expenditure; zero adoption preserves
current-policy supply and rents. All timeline metrics are finite. The supported
plan increases supply, reduces rents and spends more than baseline; every
registered parameter affects dynamics. Stress application is idempotent and
order independent, rejects unknown presets and changes numerical outcomes.
Malformed parameters, nonnumeric inputs and invalid horizons fail explicitly.
