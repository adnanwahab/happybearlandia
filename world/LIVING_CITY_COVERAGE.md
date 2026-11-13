# Living City implementation coverage

This audit covers the Months 7–9 roadmap and the realistic synthetic human behavior specification. It records delivered code and explicit gaps; it does not claim the entire quarter or all 140 entries are complete.

## Try it

- `/world?living=1` or **People · Living City** on the current map. **Simulate 10,000 people** activates the worker population; subsequent additions are bounded at 100,000. At most 500 are drawn in Living City. Normal neighborhood mode remains available.
- Select a person to inspect actual modeled state, household, decisions and live need meters.
- **Activity dashboard** shows recorded activity time budgets, need trends, completed trips, event summaries and retained person routines, with filters and CSV/JSON exports. Lifetime aggregates survive detail eviction. Hour/day charts and individual detail have explicit retention boundaries; untracked Living people do not receive invented past routines.
- **Parameters** opens the right-side panel with searchable, grouped sliders and synchronized numeric inputs for every registered model parameter. Change assumptions to reset/reseed; bounded paired previews show recorded trajectories. Policy packages require explicit approval.
- **Workers · N** shows registered worker observations. `/world/bench/people` runs an explicit, cancellable benchmark.
- Dear Congress offers a location/seed handoff; the civic snapshot is provenance only and is not silently compiled into behavioral policy.

## Material boundaries

The live population has one authoritative worker. Independent seeded futures use a bounded pool; pool-count equality is not a claim of distributed live-agent sharding. Transport uses district/building straight-line approximations; housing uses district capacity rather than individual unit/bedroom matching. Demographics and coefficients are assumptions. Empirical calibration and historical validation require appropriate observed data and a separate fitting/holdout workflow. Collaboration is local to same-origin tabs. Optional GPU behavior compute, SharedArrayBuffer and animated vehicle/person systems remain deferred.

The main pause control freezes modeled activity, needs, person interpolation and simulation-driven traffic while camera controls and geometry loading remain available. Resume reanchors time instead of catching up a paused wall-clock gap. The world Living clock explicitly uses modeled minutes per real second. Walking defaults to a relaxed 40 meters per modeled minute (2.4 km/h) in both neighborhood and Living City models. The world starts at 1×; faster simulation controls remain available.

An original, self-contained CC0 `world/assets/human-person.glb` provides pants and a short-sleeved T-shirt. Five shared instanced parts and stable per-person shirt palettes are used in the world; far Living agents remain points. The model is unrigged: translating people are not claimed to have a skeletal walking animation. Preview/download: `/world/assets/human-preview.html`.

Four daily need meters (food, energy, fun, connection) are distinct from civic policy outcomes. Population behavior 1.1.0 uses food, energy, fun and connection in seeded flexible activity choices, constrained by work, school, travel, resources and minimum activity commitments. Activities update needs over actual elapsed intervals; fractional travel arrivals preserve remaining destination time. The legacy neighborhood model also uses need urgency in action selection. The supplied policy ideas are not treated as evidence that any law has been enacted or as automatic effects of an activity.

## Roadmap entries

77 implemented within the documented model boundary; 57 partial; 6 deferred. These are acceptance entries, not independent major capabilities.

| # | Feature | Status | Evidence / limitation |
|---|---|---|---|
| 1 | PersonAgent Contract | Implemented (bounded) | Synthetic IDs, demographics, current state, schedules, budgets and inspectors; no real-person identity inference. |
| 2 | Household Contract | Implemented (bounded) | Household membership, income, rent, savings, housing choices and member inspection. |
| 3 | Synthetic Population Generator | Partial | Seeded marginal targets and validation; full joint distributions/IPF and full age/vehicle/OD fitting remain absent. |
| 4 | Population Validation | Implemented (bounded) | Declared synthetic target tolerances and initialization gate; target fit is distinct from empirical validation. |
| 5 | Agent IDs | Implemented (bounded) | Snapshot/seed-stable IDs and explicit model version; selected detail replay uses frozen manifests. |
| 6 | Activity Types | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 7 | Daily Schedule Templates | Partial | Clock-derived weekday/weekend templates; no general activity-plan/time-window constraint solver. |
| 8 | Weekday / Weekend Behavior | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 9 | Flexible Activities | Partial | Seeded flexible activities exist; not all activity probabilities are registered/calibrated parameters. |
| 10 | Activity Locations | Partial | Bounded district/building alternatives; no complete facility opening-hour/cost/accessibility matching. |
| 11 | Schedule Disruption | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 12 | Household Budget | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 13 | Housing Cost Burden | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 14 | Financial Stress | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 15 | Savings Buffer | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 16 | Housing Search Trigger | Partial | Burden, savings and staggered reconsideration; explicit lease/growth/new-supply event queue incomplete. |
| 17 | Housing Search | Partial | District vacancies and household utility with constraints; no individual bedroom/unit market. |
| 18 | Moving Decision | Implemented (bounded) | Seeded softmax, stay comparison, savings and moving inertia; monthly staggered reconsideration. |
| 19 | Move Event | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 20 | Displacement | Partial | Reports modeled displacement RISK separately; no forced-relocation implementation or invented destination. |
| 21 | Neighborhood Churn | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 22 | Employment Locations | Partial | District job slots and business classes; explicit individual occupation/job/wage matching incomplete. |
| 23 | Worker Job Assignment | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 24 | Job Accessibility | Partial | All-worker commute enters housing score; full accessibility matrix/metric absent. |
| 25 | Job Change | Partial | Actual layoffs, capacity-safe hiring and location changes; richer career/wage-improvement transitions absent. |
| 26 | Unemployment Shock | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 27 | Mode Choice | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 28 | Trip Generation | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 29 | Route Choice | Partial | Trips use straight-line district/building geometry, not a road-link routing model. |
| 30 | Dynamic Congestion | Implemented (bounded) | Actual trip demand affects district congestion and subsequent mode utility; aggregate transport approximation. |
| 31 | Transit Crowding | Implemented (bounded) | Capacity affects feasibility/denied boarding; no microscopic vehicle queue or timetable. |
| 32 | Mode Switching | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 33 | Decision Reason Codes | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 34 | Decision Score Breakdown | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 35 | Behavior Timeline | Implemented (bounded) | Bounded decision traces and semantic events; selected details regenerate through deterministic replay. |
| 36 | Follow Person | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 37 | Follow Household | Partial | Household inspector and member IDs; simultaneous camera follow/routines for every member incomplete. |
| 38 | Agent Rendering LOD | Partial | Shared clothed GLB instances nearby and far points with interpolation; skeletal close-up animation absent. |
| 39 | Crowd Density Rendering | Partial | Actual district density layer; no separate procedural crowd-density renderer. |
| 40 | Building Occupancy Animation | Partial | Authoritative building occupancy is computed; visible window/interior animation integration is incomplete. |
| 41 | Commute Flows | Implemented (bounded) | Actual current-trip OD flows, with raw and represented counts; no invented transit service paths. |
| 42 | People Heatmap | Partial | Density, stress and commuters layers exist; complete six-layer visitors/displacement UI incomplete. |
| 43 | Person Inspector | Implemented (bounded) | Current worker-backed person/household/reasons/follow inspection; on-demand inspector records distinguish evaluations from decisions. |
| 44 | Business Entities | Implemented (bounded) | Versioned local-economy-v1 pack and coupled bounded businesses; exploratory assumptions. |
| 45 | Business Location | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 46 | Employment Capacity | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 47 | Customer Demand | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 48 | Business Opening / Closure | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 49 | Commercial Vacancy | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 50 | Policy Impact on Businesses | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 51 | Household Satisfaction | Implemented (bounded) | Transparent modeled utility, explicitly not objective happiness. |
| 52 | Access to Amenities | Partial | District service/access proxies; no validated per-facility travel-time access calculation. |
| 53 | Service Crowding | Partial | Transit crowding implemented; school/healthcare seat matching incomplete. |
| 54 | Equity Distribution View | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 55 | Event Framework 2.0 | Partial | Nine bounded event classes, including layoffs/openings/outages/storms/closures; full catalogue not implemented. |
| 56 | Temporary Events | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 57 | Behavioral Response to Events | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 58 | Recovery Curves | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 59 | Local Information Sharing | Partial | Bounded awareness diffusion; headless local idea v0 adds a synthetic radius peer graph, parent-linked hops and matched no-sharing control (civilization/ideas/README.md). Live Population peer sharing remains absent. |
| 60 | Adoption Curves | Partial | Gradual awareness, experience and habit; full unaware/tried/adopted/abandoned state machine absent. |
| 61 | Neighborhood Preference Feedback | Partial | No complete bounded neighborhood-preference feedback model beyond existing service/access utility. |
| 62 | Central Worker Registry | Implemented (bounded) | Real registered browser workers, bounded telemetry and preserved legacy adapters; inventory is per browser page. |
| 63 | Worker Message Protocol | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 64 | Heartbeats | Implemented (bounded) | Real heartbeats where workers implement protocol; legacy unsupported status remains explicit. |
| 65 | Worker Groups | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 66 | Worker Pool Scaling | Partial | Explicit resize for independent-future pools; automatic measured adaptive growth/shrink not enabled. |
| 67 | Worker Priority | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 68 | Worker Backpressure | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 69 | Worker Crash Recovery | Implemented (bounded) | Bounded retry only for deterministic tasks; transferred input tasks not blindly retried. |
| 70 | Workers Button | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 71 | Worker Inspector Drawer | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 72 | Worker List | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 73 | Worker Detail Panel | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 74 | Worker Throughput | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 75 | Worker Queue | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 76 | Worker Timeline | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 77 | Worker Errors | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 78 | Worker Actions | Partial | Read-only normal view and capability-gated pool actions; individual restart/termination need real host callbacks. |
| 79 | Worker Pool Actions | Partial | Pause/resume/drain/resize supported; idle-worker-specific restart not exposed. |
| 80 | Worker Diagnostics Export | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 81 | Worker Inspector Performance Graph | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 82 | Worker-to-World Highlight | Partial | Reported district ownership highlights; complete geometry chunk/agent-range visual targeting incomplete. |
| 83 | Population Sharding | Deferred | One authoritative live model protects shared capacities; distributed live population sharding is not implemented. |
| 84 | Fixed Simulation Tick | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 85 | Event-Driven Behavior | Partial | Activity transitions and staggered housing exist; generic affected-actor event queue incomplete. |
| 86 | Typed Agent Storage | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 87 | Transferable Buffers | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 88 | Optional SharedArrayBuffer Path | Deferred | Optional optimization deferred; transferable fallback works without cross-origin isolation. |
| 89 | Worker Determinism | Partial | Independent paired futures invariant across pool counts; not a distributed live-shard equivalence claim. |
| 90 | Worker Scaling Benchmark | Partial | Measured independent-future pool benchmark 1/2/4/8/12; district-vs-ID shard comparison absent. |
| 91 | Simulation Clock | Implemented (bounded) | Fixed worker clock separated from RAF; some portable timing diagnostics remain unavailable. |
| 92 | Pause Simulation | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 93 | Time Speed | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 94 | Step One Tick | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 95 | Agent Counts | Implemented (bounded) | Represented, synthetic and visible counts are distinct; no invented high-detail-active count. |
| 96 | Behavioral Outcomes | Partial | Actual trips/moves/burden/mode shares and risk; full observed displacement/accessibility metric catalogue incomplete. |
| 97 | Behavioral Sensitivity | Implemented (bounded) | Bounded numerical paired diagnostics over actual model output, labeled sampled diagnostic population. |
| 98 | Cohort Outcome Comparison | Implemented (bounded) | Authoritative income cohorts; complete tenure/commute cohort matrix not implemented. |
| 99 | Behavioral Failure Modes | Partial | Actual diagnostics and numerical comparisons; complete behavioral failure-rule mining not implemented. |
| 100 | Human Impact Story | Partial | Matched selected actors can be inspected; automatic representative-story selection/brief integration incomplete. |
| 101 | Edit Population | Partial | Validated population/income edits; no university/institution compiler creating capacity/jobs/travel together. |
| 102 | Edit Employment | Partial | Workforce/job shock assumptions; no spatial campus creation with explicit job entities. |
| 103 | Edit Services | Partial | District service proxies and event impacts; no school/facility creation/seat assignment editor. |
| 104 | Edit Road Capacity | Partial | District capacity and full-closure feasibility; no selected-road lane geometry edit. |
| 105 | Pedestrianize Street | Partial | Approved district car-free closure can reject car/bus modes; not individual-street pedestrian network editing. |
| 106 | Transit Frequency Edit | Partial | Service multiplier changes waiting/availability; no direct minutes-headway/timetable editor. |
| 107 | Policy Packages | Implemented (bounded) | Concrete bounded bundles with preview, explicit approval/rejection and stale-preview protection. |
| 108 | Ask a Person | Partial | Grounded local structured explanation templates; optional provider prose on selected people not added. |
| 109 | Ask a District | Implemented (bounded) | Structured current district analysis; no invented causal story from counts alone. |
| 110 | Ask the Workforce | Implemented (bounded) | Recorded workforce aggregates and actual mode-choice alternatives; no unconstrained persona conversation. |
| 111 | AI Experiment Designer | Partial | Deterministic reviewable experiment designer; conversational provider experiment generation absent. |
| 112 | AI Worker Diagnostics | Partial | Real worker/frame diagnostics available; AI bottleneck recommendation layer not implemented. |
| 113 | Follow Presenter | Partial | Presenter follow works between same-origin tabs; no cross-device authenticated collaboration. |
| 114 | Participant Viewpoints | Partial | Same-origin participant camera viewpoints; no cross-device presence backend. |
| 115 | Collaborative Annotations | Implemented (bounded) | Versioned bounded annotations and portable replay; local tabs only. |
| 116 | Behavioral Questions Queue | Implemented (bounded) | Questions become proposed experiment tasks; approval remains required before execution. |
| 117 | Decision Session Replay | Partial | Read-only event replay/export/import; full automatic capture and executable world-state playback incomplete. |
| 118 | Behavior Model Card | Implemented (bounded) | Explicit assumptions, coefficients, equations/source references, calibration absence and known limitations. |
| 119 | Choice Calibration | Deferred | Observed-data scoring and reviewable candidates exist; no fitted, held-out calibrated behavioral model. |
| 120 | Agent Aggregate Validation | Implemented (bounded) | Synthetic target report/gate and finite/capacity/property checks; does not imply empirical calibration. |
| 121 | Behavioral OOD Warning | Implemented (bounded) | Engineering-range warnings distinguished from absent empirically calibrated validity ranges. |
| 122 | Decision Trace | Implemented (bounded) | Actual chosen/rejected alternatives, scores, constraints, seeded draw and reason codes; bounded retention. |
| 123 | Population Provenance | Implemented (bounded) | Implemented in the connected population model, runtime or inspector; see module/test references below. |
| 124 | Observed Mobility Import | Partial | Validated observed mobility import and compatible trip-share errors; not live feeds or completed historical backtest. |
| 125 | Observed Moves | Partial | Validated aggregate move observations; score only matching periods/definitions and available model statistics. |
| 126 | Behavioral Forecast Scorecard | Partial | Descriptive supplied-observation scorecard; independent historical forecast evaluation incomplete. |
| 127 | Calibration Recommendation | Partial | Explicit candidate proposal requires approval; no automatic fitted recommendation/parameter application. |
| 128 | Population Data Import Wizard | Implemented (bounded) | Bounded JSON/CSV envelope, units/source/date/geography mapping, validation and reviewable supported globals. |
| 129 | Employment Dataset Import | Partial | Employment datasets validated/covered; explicit district job-data initialization adapter incomplete. |
| 130 | OD Matrix Import | Partial | OD import/coverage supported; imported OD does not silently replace routing or generation. |
| 131 | Transit Schedule Import | Partial | Transit import/coverage supported; no full GTFS/timetable ingestion and runtime adapter. |
| 132 | Data Coverage Map | Partial | Geography coverage report with observed/estimated/synthetic/missing labels; dedicated coverage map incomplete. |
| 133 | Confidence by Geography | Partial | Source confidence retained by geography; dedicated confidence choropleth incomplete. |
| 134 | Animated Person LOD | Deferred | Clothed GLB instances and far points are implemented; skeletal walking animation is deferred. |
| 135 | Interior Building Activity | Partial | Actual occupancy by modeled building IDs; interior elevators/entry animation incomplete. |
| 136 | Rush Hour | Partial | Schedules and current trips change over time; no separate polished rush-hour crowd/vehicle presentation. |
| 137 | Event Crowds | Partial | Events affect actual decisions/demand; event-specific crowd renderer absent. |
| 138 | Transit Vehicles | Deferred | No timetable-driven bus/train renderer; decorative traffic is not relabeled as modeled people. |
| 139 | Construction Workers | Deferred | Existing construction lifecycle retained; selected-site lightweight worker characters not added. |
| 140 | Street-Level Life | Partial | People/business activity layers exist; full parked/delivery/storefront street-life set incomplete. |

## Human-behavior definition of done

| Requirement | Status / boundary |
|---|---|
| Population matches aggregate targets | Seeded marginal generation, explicit tolerance gate; full joint distributions remain partial. |
| Coherent daily plans and activity-generated trips | Clock-derived schedules and actual building/district trips; general plan/time-window solver absent. |
| Time/cost/access mode choices | Hard eligibility plus seeded softmax and registered assumption coefficients. |
| Learning and behavior memory | Compact experienced-time/habit fields; full multi-plan memory and adoption state machine partial. |
| Household budgets and housing constraints | Actual income/rent/savings, all-worker commute utility, capacity-safe monthly choices. |
| Event-driven housing search | Staggered monthly triggered searches; generic affected-actor queue incomplete. |
| Housing scarcity | Capacity-safe district slots, not individual unit/bedroom matching. |
| Move reasons and rejected alternatives | Actual bounded structured traces, seeded draws and explicit risk-vs-move distinction. |
| Capacity affects behavior | Housing/jobs/road/transit capacity, including full car-free closure feasibility and denied boarding. |
| Paired population and BehaviorDelta | Frozen shared generation inputs, paired seeds, compatible actor-ID comparisons; unknown weights do not become totals. |
| Determinism and worker-count invariance | Deterministic replay and independent future pool counts 1 vs 8; live distributed sharding not done. |
| Detail regeneration | Nonmutating selected-future entity replay; bounded traces remain explicitly bounded. |
| Aggregate calibration and model cards | Synthetic target validation and cards implemented; empirical held-out calibration incomplete. |
| No required LLM calls | Local model and numerical experiments execute without AI API calls. |
| World person/household/worker inspection | Connected inspectors, follow, live needs and actual registered workers. |
| Grounded AI explanation | Structured local templates use actual records; provider paraphrasing is not required or claimed. |

## Source and verification references

- `world/population/`: generation, behavior, economy, model, worker runtime, views, data imports and trust.
- `world/behavior/core/` and `world/behavior/coefficients/`: utility, choice, reason registries and explicit assumption coefficients.
- `world/analysis/behavior-deltas.js`: matched actor comparisons and weighted-count boundaries.
- `world/workers/README.md`, `world/LIVING_CITY_PRODUCT.md`: worker controls, local sessions and benchmark scope.
- `world/population/MODEL_CARD.md`, `world/population/DATA_FORMATS.md`: methods, limitations and import formats.
- `world/person-needs.js`, `world/person-needs.css`, `world/sim.js`: live need display and shared actual activity rates.

**Final verification:** 73 focused tests passed across 12 component suites (1,504 assertions), including actual Worker execution, deterministic replay, pause/cadence, needs, target gates, slider result calculations and GLB loading. Dear Congress TypeScript and its handoff checks passed. Browser checks cover the connected 10k → 20k button, all registered sliders, actual rent/burden trajectory changes, invalid-value rejection/no-op restoration, pause of model/display/traffic with camera panning, and the real clothed GLB. Local ports 3000 and 3217 serve the updated world, benchmark and asset routes. Browser measurements use local headless software WebGL and do not establish hardware FPS or 100k interactive performance. See test/e2e/living-city-*.e2e.js for individual acceptance cases.

**Activity dashboard and behavior 1.1 verification:** 89 focused tests across 12 files passed (633 assertions), plus eight connected browser acceptance cases for dashboard/filter/export/reset, actual need replay, playback/GLB and all 30 registered parameter controls. The history browser check used 10,000 synthetic agents over 600 modeled minutes, retained exact lifetime accounting within floating-point precision, disclosed dropped recent detail, and reset cleanly to 20,000. See `world/ACTIVITY_DASHBOARD.md` for scope and retention.
