# Housing run → World input audit (SHE-245)

Audited 2026-11-12. Research only: no schema or adapter changes. Decision: retain **Decision Studio housing 1.2.0** as authority for this housing slice's aggregate metrics and project construction. Population remains authority for its own residents and minute clock. Monthly CityState/Future Machine remains a third independent model; its existing 120-month demo is not evidence of a housing-to-Population mapping.

## Evidence and boundary

Source contracts: [housing model](../world/models/housing/index.js), [schema and units](../world/models/housing/schema.js), [model notes](../world/models/housing/README.md), [construction lifecycle](../world/buildings/lifecycle.js), [proposal contract](../world/buildings/proposal.js), [renderer](../world/buildings/renderer.js), [World bridge](../world/buildings/world-bridge.js), [Decision run envelope](../world/decision/kernel.js), [Population context](../world/population/world-view.js), [Population renderer](../world/population/renderer.js), [Population contracts](../world/population/contracts.js), [aggregate import boundary](../world/population/DATA_FORMATS.md).

Observed code behavior: the World construction bridge and Decision replay already consume the same stored project states. The bridge fetches on-demand full traces before rendering. `illustrativeWorldMapping` reads recorded housing supply/vacancy; context height and shade are symbols, not parcels or occupied homes. `buildingStateAtMonth` selects the last state at or before the requested month; absent states fall back to a proposed state. `storedMetricSnapshot` uses monthly rows, or annual rows when monthly history is absent; it does not interpolate. Thus the recorded month can differ from the selected month. These fallbacks must not become claims of exact dated state.

Synthetic assumptions: default metropolitan stocks, parameters, project location, delay/cancellation risks, and all behavioral coefficients. Modeled results: the attached numerical run. Interpretation: recommendations below, not empirical causal findings. No external observations were imported for this audit.

## Metric comparison

Status means **matched**: an existing housing renderer consumes compatible semantics; **missing**: no consumer or source counterpart; **mismatched**: superficially similar Population input has different meaning, scope, clock or units. A missing consumer is not necessarily a defect: many metrics should remain summary/analysis values. Every metric is emitted in final `metrics`, annual `timeline[].metrics`, and monthly `monthlyTimeline[].metrics`.

| Run metric | Unit | World housing input / current use | Status |
| --- | --- | --- | --- |
| housing_supply | homes | Supply HUD and illustrative supplyIndex; no parcel allocation | matched |
| median_rent | base-year USD/month | Population baseRent is an input/district assumption, not aggregate outcome | mismatched |
| affordability | percent income remaining | Population housingBurden/stress is burden, usually a fraction, per household/district | mismatched |
| homelessness_proxy | household-equivalents | No resident-level homelessness observation | missing |
| displacement_risk | percent index | Population displaced flag is a realized synthetic event, not a probability/index | mismatched |
| construction | cumulative homes | No systemic completion geometry; project-only units are separate | missing |
| public_expenditure | cumulative USD | Inspector reads project publicCost only; includes neither all grants nor vouchers | mismatched |
| employment | proxy jobs | Population employmentStatus/person income and district employment have different denominators | mismatched |
| commute_burden | index | Population routes/trips use minutes, positions and flows | mismatched |
| tax_revenue | cumulative proxy USD | No construction renderer consumer | missing |
| implementation_success | percent | No construction renderer consumer | missing |
| low_income_rent_burden | percent | Population household burden fraction is individually modeled, not low-income aggregate | mismatched |
| vacancy_rate | percent | Vacancy HUD and illustrative shade; divided by 100 for shade | matched |
| project_housing_units | homes | Renderer uses states.completedUnits, not this final aggregate | missing |
| project_public_cost | USD | Renderer uses states.publicCost, not this final aggregate | missing |
| project_capacity_used | cumulative home-equivalents | No scene consumer | missing |
| project_occupied_units | homes | Renderer uses states.occupiedUnits, not this final aggregate | missing |
| project_affordable_units | homes | Inspector reads proposal count; no affordable tenure simulation | missing |

Metric audit count: **18 fields: 2 matched, 9 missing, 7 mismatched**. Counts refer only to these unique metric IDs (not repetitions across snapshots or grouped structural fields below). Seven semantic mismatches are informational findings, not seven failing tests.

## Complete structural field inventory

Grouped rows enumerate each field explicitly. Fields without a visual consumer remain valid retained evidence. Optional event detail depends on event type; fields below cover the programmed event producers, not just the example's observed events.

| Produced fields (paths relative to raw run unless specified) | Units / World counterpart | Status |
| --- | --- | --- |
| modelVersion, exploratory | version, boolean; raw run has no model ID/seed | missing: renderer does not enforce version/source flags |
| timeline[].year; monthlyTimeline[].month, year | elapsed years and months; renderer month, annual fallback year × 12 | matched: relative time only |
| projects[].projectId, name | ID/text; joins scenario project.id and inspector name | matched within construction workspace only |
| projects[].proposal.schemaVersion, id, name, status | building-proposal.v1, strings; renderer gets scenario proposals separately | matched; proposed/cancelled inputs short-circuit state lookup |
| projects[].proposal.location.districtId, x, z, rotation | district label, local meters, radians; placement/selection/rotation | matched locally; no geographic identity guarantee |
| projects[].proposal.geometry.floors, footprintSqFt, heightMeters | count, sqft, meters; square width = sqrt(sqft × 0.09290304) | matched |
| projects[].proposal.program.residentialUnits, affordableUnits | counts; inspector and occupancy denominator | matched; affordable count is not rent control |
| projects[].proposal.program.retailSqFt, officeSqFt, parkingSpaces | sqft, sqft, spaces; capacity model only | missing scene/operational consumer |
| projects[].proposal.finance.estimatedCost, publicSubsidy | USD total estimate/fixed award, not actual spending | missing direct scene consumer |
| projects[].proposal.construction.permitMonths, buildMonths | months; simulation inputs, not measured durations | missing direct scene consumer |
| projects[].states[].month, status, progress, floorsBuilt | month, phase enum, 0–1, count; recorded selection/phase/floors/inspector | matched |
| projects[].states[].completedUnits, occupiedUnits, publicCost, expectedCompletionMonth | homes, homes, paid USD, elapsed month; inspector/windows | matched |
| projects[].states[].affordableUnits, privateCost, totalCost, capacityUsed, cumulativeCapacityUsed, delayedMonths | homes, USD, USD, home-equivalents/month-step, cumulative home-equivalents, months | missing direct scene consumer |
| projects[].uncertainty.permitDelayMonths, buildDelayMonths, costMultiplier, cancellationRisk, synthetic, phaseMonths[].phase, phaseMonths[].months | months, months, multiplier, fraction, boolean, enum, months | missing scene consumer; retain as synthetic risk provenance |
| projectMetrics.completedUnits, occupiedUnits, affordableUnits, publicCost, privateCost, capacityUsed, pipelineUnits, completedProjects, cancelledProjects | homes/counts, USD costs, cumulative home-equivalents | missing direct scene consumer; summaries not dated states |
| accounting.initialHousing, completedHomes, demolishedHomes, finalHousing, starts, initialPipelineHomes, pipelineHomes, projectCompletedHomes, systemicCompletedHomes | homes (continuous model quantities, not necessarily integers) | missing scene consumer; mass/pipeline checks only |
| accounting.subsidySpent, voucherSpent, projectPublicSpent | cumulative paid USD | missing direct scene consumer |
| accounting.projectCapacityUsed; capacityLedger[].month, total, project, systemic, unused (under accounting) | cumulative home-equivalents; month and monthly home-equivalent capacity allocations | missing scene consumer; ledger only when projects active |
| drivers[].id, parameterId, metricId, label, value, unit, description | IDs/text; value unit carried per row (log rent change, multiplier, fraction, USD) | missing scene consumer; explanation terms, not causal percentages |
| events[].month, year, type, label, message, projectId, value, unit | relative time, text, optional project ID/value/unit | missing World event.v2 adapter; construction events are retained, not Population events |
| events[].housing, households, completedHomes, demolishedHomes, starts, pipelineHomes, projectCompletedHomes | homes/households; annual-accounting payload | missing direct scene consumer |
| events[].constructionExpenditure, voucherExpenditure, projectPublicExpenditure, expenditure | cumulative USD | missing direct scene consumer |
| events[].projectCapacityUsed, monthlyCapacity, systemicStarts | monthly home-equivalent allocations | missing direct scene consumer |
| events[].presetId, operations, cause, months, multiplier, publicSubsidyCapped, homes, publicCost, sunkPublicCost | stress ID, WorldEdit operations, text, months, multiplier, boolean, homes, USD, USD; optional stress/fork/project details | missing event/provenance adapter |
| projects[].events[] | same project event fields as events above | missing Population event adapter; duplicate retained project ledger |
| fork.schemaVersion, month, operations, appliedAtMonth, parentSeed, parentRunId, parentExperimentId, modelVersion, continuation | timeline-fork.v1, elapsed months, operations, seed/version/text | missing Population branch mapping; optional raw output |

`metrics`, `timeline`, `monthlyTimeline`, `events`, `drivers`, `accounting`, `projects`, `projectMetrics` are containers, not additional scalar metrics. Fork operations contain the validated WorldEdit operation contract, including approved proposal fields already listed; no arbitrary output schema is introduced here.

### Decision envelope and World-only required inputs

| Field or input | Unit / contract | Status |
| --- | --- | --- |
| Kernel id, experimentId, scenarioId, seed, runIndex, modelVersion, engineVersion | IDs, uint32 seed, index, versions | matched by World bridge selection; preserve with full trace |
| Kernel parameters, sampledParameters, preStressSampledParameters, appliedStressPresets, inputProjects, scheduledStress, timelineFork | original/effective inputs and schedules | matched as retained replay inputs; not Population settings |
| Kernel startedAt, completedAt, durationMs, status, error, outcome | wall time, ms, execution/classification | matched selection metadata; wall time is not model date |
| Kernel traceRetention; transport traceDelivery | summary-only/on-demand markers | mismatched if treated as full replay; bridge hydrates on-demand traces, summary-only is insufficient |
| Calendar epoch/date, calendar convention, Population tick/minute | none in raw housing result; relative month is not minute clock | missing |
| World town origin, source, seedKey, bounds, buildings[].id, kind, center, height, poly/polygon; roads[].pts | source geography plus local geometry | missing for systemic housing; project x/z alone cannot locate a real parcel |
| Population context district IDs, bounds, x/z and building accessPoint | synthetic spatial partitions and derived roadside points | missing housing mapping; matching text labels do not establish identity |
| Population visibleAgents/agents/visible rows: id/personId, householdId, x/z or currentLocation.x/z | persistent person/household IDs, meters | missing; housing has no agents |
| Population row housingBurden/householdHousingBurden, frame.config.burdenThreshold | burden fraction and threshold | mismatched with aggregate percent affordability/burden |
| Population row activity/currentActivity, ageBand, employmentStatus, income, moved/displaced/modeSwitched or flags | enums, USD/year, event flags | missing; cannot manufacture from aggregate proxies |
| Population households[].id, financialRisk.status | IDs, categorical risk | missing |
| Population districts/districtMetrics: id/districtId, population, housingStress/housingBurden/meanHousingBurden/affordabilityStress | people, district stress; aliases accepted by renderer | missing spatial observations; aggregate low-income burden is not district stress |
| Population district commuters/trips or roadDemand + transitDemand; flows/odFlows from/origin, to/destination, count | modeled demand/counts, district IDs | missing; commute index has no route or OD meaning |
| Renderer month, projects, run, worldVisuals (heightScale, facadeColor, skyColor, treeDensity, nightBrightness, showCranes) | selected time, scenario input, stored trace, visual overrides | matched construction host inputs; visual overrides are not model outcomes |

Nonhousing cosmetics and unrelated Population activity/economy internals are outside scope. This table includes the shared visible-person fields needed to avoid implying a housing-to-resident handoff.

## Supported proposals, costs, versions and snapshots

`createHousingScenarios` supports baseline, plan-a (permitting 6 months, density 1.6, construction appropriation $2B/year, vouchers $300M/year, transit share 0.65), plan-b (capacity 90k homes/year, appropriation $3B/year, vouchers $600M/year, density 1.9), and immediate stress variants. These are illustrative policy levers, not a full municipal budget or a modeled transit construction project. All 25 parameter definitions, bounds, defaults and units live in schema.js and the evidence records all effective values. Construction subsidy is a 35% contribution subject to starts/delivery; vouchers are capped by eligible rent. Appropriations differ from actual cumulative public expenditure. Project finance is a separate fixed public award with private overrun exposure.

1.0.0 and 1.1.0 remain resolvable frozen implementations. 1.0.0 rejects projects/timed stresses; 1.1.0 supports these but not forks; 1.2.0 adds monthly metrics and in-loop forks. Resolve the recorded version, never rerun an old record as latest. Year-zero plus annual and (1.2.0) monthly metrics are observations of the simulation, not resumable engine checkpoints. Forks reconstruct state by deterministic replay; serialized queues/RNG continuation state are not provided. Construction workspace checkpoints retain selection, source topology and full stored traces, with current-version validation and an 8MB bound; they are not universal Population checkpoints.

## Reproducible example

[Full inputs and output](evidence/she-245-housing-run.json), generated by [audit-housing-run.js](../scripts/audit-housing-run.js). Run `bun scripts/audit-housing-run.js` from the checkout to recompute and deep-compare every stored field. `--write` deliberately regenerates the artifact and must not be used for independent verification.

Model housing.v1 / 1.2.0, seed 42, ten years, fixed plan-a parameters without uncertainty sampling, no stresses/fork, one approved synthetic building `audit-housing-001`. Fixed project ID matters because project RNG depends on it. This is the public version-resolved simulation API, not a sampled Decision ensemble; ensemble seed derivation and uncertainty sampling are intentionally absent. No timestamps or random factory IDs enter the evidence.

Recorded output SHA-256 over compact JSON: `eb8735147c99de9967238cb2332ff220dc43bade3bc599f5fb39002d76adb8a5`. 121 monthly and 11 annual rows. Final stock 1,307,447.0497337622 homes; monthly rent $1,593.9327957322066; vacancy 13.14290958687111%; cumulative public spending $14,296,533,333.333345; project completed/occupied homes 310 and affordable subset 90. Fractional totals and floating-point currency residuals reflect model arithmetic, not observed physical units or financial settlement precision. Raw values remain in the artifact.

Validation observed: example generation and separate verification invocation matched under Bun 1.4.2; stock accounting checked within 1e-6. Focused housing/model/fork/renderer/World integration suite: 46 passed, 0 failed, 2,589 assertions. No application behavior changed; Playwright is inapplicable. **Independent second-person replay remains required**: reviewer should run the verification command, record runtime/version and hash, and compare without regenerating evidence. An automated repeat by the author is not that acceptance evidence.

## Ranked follow-up ticket proposals

These are proposed tickets, not created Linear records; implementation is outside this spike.

| Priority / suggested ticket | Risk addressed | Acceptance and dependency |
| --- | --- | --- |
| P0: Versioned housing run selection and trace contract | Wrong scenario, version or summary masquerades as selected recorded future | Pin experiment/scenario/run/seed/model/rules/input identity; require full trace and explicit missing/version errors. Preserve parent and matched baseline. First adapter task. |
| P0: Relative month and calendar mapping | Same year label can describe different model times | Explicit epoch/calendar and selected vs recorded month; annual-only/missing row paths; no implicit minute conversion. Depends on run contract. |
| P0: Geographic/project identity registry | Synthetic project or metro totals could be presented as real parcels/residents | Version source geometry, local coordinate transform, bounds, district/project crosswalk and coverage. Unmapped systemic stock stays aggregate. Depends on run contract. |
| P1: Housing metric/unit presentation contract | Percent/fraction, burden/remaining income and proxies confused | Preserve base-dollar basis, cumulative vs monthly quantities, denominators, proxy labels and unsupported district fields; test missing/zero/boundary states. Depends on run/time contract. |
| P1: Resident handoff feasibility gate | Fabricated identities or double simulation authority | Either demonstrate seeded, versioned Population identity/time mapping or explicitly keep resident inspection unavailable for housing runs. No aggregate proxy becomes an individual event. Depends on geography/time contracts. |
| P1: Event provenance and replay evidence | Narrative explanation presented as causal evidence | Preserve actual project/annual/stress/fork events, source inputs and lineage; namespace IDs; distinguish programmed dependencies from empirical causal claims. Then run matched baseline/edited ten-year journey. |
| P2: Storage/entry-point acceptance | Lost traces or exact selection on reopen | Versioned share/reopen journey and missing trace/version tests across World and Decision. Measure trace size; retain provenance. Depends on preceding contracts. |

The immediate next action is independent replay review, then the run/time/geography contract tasks. The remaining five housing checklist items stay pending.
