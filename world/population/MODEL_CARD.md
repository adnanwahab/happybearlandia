# Synthetic population behavior model card

This module presents exploratory synthetic model outputs. It does not claim empirical calibration, predictive accuracy, policy causality, or observed human behavior. Map coordinates can supply geography; default incomes, preferences, housing and job capacities remain assumptions.

| Behavior | Actual implementation | Boundary |
|---|---|---|
| Activity and destination | population/behavior.js; clock, employment and seeded schedules | Simplified district destinations; no observed activity diary |
| Travel mode | Recorded alternatives and mode components in decisionTrace | District travel approximation; inspect-only alternatives are distinguished from recorded decisions |
| Housing search | Household affordability, savings, capacity and utility decisions | District capacities rather than individual leases; displacement risk is not a verified displacement |
| Employment and economy | population/economy.js and behavior.js | Simplified demand and job capacity, not a validated labor market |

The coefficient registry in world/behavior/coefficients/registry.js labels its values analyst-assumption, confidence low. Calibration dataset, date, error metrics and calibrated ranges are null. A registered coefficient is not evidence of its use in a runtime equation. Consult recorded components and active coefficient references. Parameter min/max bounds are engineering limits, not empirically supported domains.

The panel uses authoritative full-model aggregate metrics and cohorts. Visible agents are a bounded render sample. Income cohorts can change membership between snapshots, so differences of cohort means are descriptive rather than matched-person effects. Selected household stories quote actual inspected state and retained decisions; absent detail remains absent. Trace buffers and exports omit older records and do not reconstruct full trips.

Sensitivity runs use actual independent runtime futures: at most 1,000 diagnostic people, two paired seeds, one day and baseline plus up to three levers. Results retain their manifests. Sampling changes shared capacity and demand; these runs are diagnostics rather than citywide elasticities or empirical uncertainty bounds. Selected paired actors use nonmutating future inspection and the shared analysis comparator; missing or inconsistent weights make weighted totals unavailable.

Generation target checks use engineering review tolerances and are not independent validation. Observed scorecards compare only matching statistics and units. Missing district outputs are not filled with city totals. Move rates require identical observation periods. Source provenance is supplied by the user and is not independently verified. Calibration candidates and imports require Studio review and never modify the runtime directly.
