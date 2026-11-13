# World Population and House — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Explore synthetic daily activity, household constraints and social consequences. Patterns of commuting, unmet needs and budget stress are programmed outcomes; no empirical target fit is claimed. The [model card](../../world/population/MODEL_CARD.md) distinguishes diagnostic checks from validation.

## 2. Entities, state variables and scales

People have persistent prefixed IDs, age bands, employment, destinations, activity, travel time and needs in typed arrays; households own membership, income, rent, savings and vehicles. Districts and locations supply capacity and local coordinates. House interiors, objects, relationships, children and local firms share these people and household balances. Time is elapsed minutes (1440/day); represented population weight is separate from raw individuals. Monthly City IDs are unrelated.

## 3. Process overview and scheduling

In [stepPopulation](../../world/population/model.js), tick must increase and minutes must be positive and at most 1440 (default 15). Each interval prepares traditions, roommates, tasks, household systems, parties and life; splits at quarter-hour and supported event/action/system boundaries; prepares employment and children; advances activities, traditions/promises and household systems. At a day boundary it finalizes child/employment/progression records, steps the local economy and household choices, synchronizes roommates and goals. Hotspot social encounters run after the outer loop, then metrics and the bounded series update. Preserve outer step sizes as well as seed: not every subsystem is invariant to arbitrary chunking.

## 4. Design concepts

Basic principles: bounded needs and constrained utility choices, with analyst coefficients. Emergence: activity, congestion, budgets and encounters arise from competing choices/capacities. Adaptation/objectives: people respond to needs, affordability and access, rather than optimizing lifetime welfare. Learning/prediction: no general learned policy or foresight; schedules and local alternatives are heuristics. Sensing: modeled district accessibility, available capacity and resident state. Interaction: shared jobs/housing, local firms, household actions and sparse relationship ties. Stochasticity: seeded generation and counter draws in contracts.js. Collectives: households and social groups, not an extra population. Observation: metrics, decision traces and activity/history buffers; retained records are incomplete histories.

## 5. Initialization

Ordinary World visits defer this model until a Population toolbar action. Explicit
`living=1` links still initialize on entry; saved Living runs restore their recorded
checkpoint. Deferral changes allocation timing only, not the generator, seed,
initial model minute or configured resident count. The legacy preview has its own
model identity and is not a partially initialized Population run.


[createPopulationModel](../../world/population/model.js) normalizes config, calls [generatePopulation](../../world/population/generator.js), initializes needs, employment, economy and histories and aggregates. A fresh initialMinute is within day one; it supplies no prehistory. Save full config, context, initialMinute/tick and optional subsystem configuration, or use the [checkpoint codec](../../world/population/checkpoint.js) for continuation. Keep the recorded POPULATION_VERSION from contracts.js rather than assuming the latest version.

## 6. Input data

Synthetic generation uses configured population, seed, household/income/employment targets and supplied district/building context. [Data formats](../../world/population/DATA_FORMATS.md) describe imports. Coordinates may be sourced geography; preferences, costs and targets remain synthetic unless explicitly documented otherwise. Missing weather uses neutral effects. Culture/weather are host-supplied minute-aligned inputs, not independent household ledgers.

## 7. Submodels

[behavior.js](../../world/population/behavior.js) defines activities, destination/mode utility, event effects and household choices; [economy.js](../../world/population/economy.js) defines daily demand and firms; employment.js and children.js account for committed work/care intervals. [House model](../../world/house/model.js) validates requests and resources, reserves participants/objects and applies effects only over committed intervals. System installers/registry add life, safety and family mechanisms on the same clock. [Relationships](../../world/relationships/model.js) uses seeded sparse ties, bounded friendship/trust/tension, proximity and availability gates; promises and traditions retain actual attendance. These are stylized social assumptions, not observed friendships. Culture scene strengths are bounded aggregate indices; hourly synthetic events project only supported district multipliers ([culture contract](../../world/culture/README.md)). Weather is synthetic environmental input ([weather contract](../../world/weather/README.md)). Reproduce with saved checkpoint/config and identical commands, event schedule, seed, versions and step partition. Verify: `bun test test/population-model.test.js world/population/checkpoint.test.js world/house/model.test.js test/culture-simulation.test.js`.


### Optional transport-channel research controls

[The headless transport experiment](../../world/research/interaction-ablation.js) reuses this same Population authority and the synthetic two-district benchmark context; it introduces no new residents or clock. It attaches [transport controls](../../world/population/transport-experiment.js) once to a fresh midnight model, then advances one to 31 days using 60-minute outer calls and the existing internal boundaries. Each population/seed pair starts from the same complete state digest. The full arm leaves ordinary arithmetic unchanged. Alternative arms freeze congestion, crowding and boarding-demand reads at their initial values, permute district feedback using a separate seeded stream at each internal interval, or scale congestion above free flow and crowding/demand by one half or two. Physical capacities, household budgets, care, housing, firms and social dependencies remain active, so none is a complete no-interaction model.

The read hooks run at travel choice/boarding; the observer records work-bound planned departure minutes and end-interval resident/resource incidences after ordinary demand accounting. The graph is a sampled resource dependency graph, with isolated residents retained and no claim of causal pair interactions or cross-shard execution. Controls and observers live outside serialized production state; experimental runs must be regenerated from their versioned recipe, source hashes, population, seeds, days and fixed step partition, not resumed as production checkpoints. The report includes denominators and actual units, uses paired synthetic-seed Student-t intervals, and withholds the complete interaction release criterion. See [the protocol and limitations](../research/million-agent-architectures.md); verify with `bun test test/interaction-ablation.test.js test/population-model.test.js world/population/checkpoint.test.js`.


### Spatial activity diagnostics

The optional retained `selectionActivity` record and [neighborhood query](../../world/population/neighborhood-selection.js) observe this same Population state. Each successful outer step records distinct residents whose x/z position, activity, remaining travel or hunger/energy/fun/social need fields changed, accumulating internal-boundary changes even if a value later reverts. The final hotspot-social update is included; no random draws, choices or simulated clock increments are introduced by inspection. Checkpoints retain the optional typed diagnostic array. A legacy save or unstepped state has no measured activity window and reports null, not zero.

Neighborhood bounds use inclusive current world x/z positions and count full individual records in the authoritative worker, independently of the rendering sample. These are synthetic resident counts and a declared subset of changed fields, not a complete interaction measure. Current-interaction evidence remains unavailable; represented weights are not separately located aggregate-only people. The toolbar pauses for inspection and retains the measured tick/window until the user selects again. See [the read contract](../../world/population/DATA_FORMATS.md#neighborhood-selection-diagnostic). Existing allocation-recovery rules still apply if diagnostic buffer allocation fails; this does not create a cohort simulation backend.


Current snapshots also expose [a current-position density aggregate](../../world/population/density.js): a 32×32 grid over model location bounds plus origin and a one-world-unit margin. Each finite in-bounds individual contributes once; weighted values multiply those counts by the run's declared represented-population weight. Missing and outside positions remain separate and are never clamped into a tile. These are counts per tile, not people per square kilometre or counts of residents who changed state in the last step. Rendering, grid formation and neighborhood inspection do not advance time or draw random numbers. The [density read contract](../../world/population/DATA_FORMATS.md#current-position-density-population-densityv1) specifies scope and unavailable snapshots.


The separate [city heatmap](../../world/population/city-heatmap.js) projects all
resident records onto assigned homes, while its interaction view counts only
retained hotspot encounter records in the preceding 30 model minutes. The
120-record citywide encounter cap can make those counts incomplete; encounters
are neither population-weighted nor a count of distinct changed residents. This
projection leaves RNG, choices, time and current-position density unchanged.
See [the heatmap read contract](../../world/population/DATA_FORMATS.md#assigned-home-occupancy-and-retained-encounters-city-heatmapv1)
for normalization and missingness. Verify with `bun test test/city-heatmap.test.js
test/population-density.test.js test/neighborhood-selection.test.js`.


### Adaptive wall-clock admission

The live runtime's [scheduling guard](../../world/population/scheduling-guard.js)
measures successful automatic commit duration on the host, including worker
queue/transport and snapshot acceptance. At 100 ms or more it admits subsequent
automatic steps no sooner than 400 ms after the previous completion; eight
consecutive measurements at or below 40 ms restore normal admission. These are
illustrative presentation thresholds. Cooldown time is discarded by the existing
busy-clock path, rather than accumulated into a catch-up burst. Explicit steps,
replay and household observation keep their existing fixed-step schedule.

This policy changes how many ticks fit in elapsed wall time, not model entities,
seed, RNG consumption, fixed-step duration or command order. Compare the same
modeled ticks and command timeline, not equal wall time. Session diagnostics
retain at most 64 transitions across resets and are not authoritative checkpoint
state. The receiving runtime retains its device policy on checkpoint restore.
Allocation failure and explicit smaller-population recovery remain separate
from slow commits. Failed or cancelled commits produce no successful timing
sample. The guard cannot preempt a single expensive tick or promise a frame-rate
bound. See [the runtime policy](../../world/workers/README.md#adaptive-live-population-scheduling-she-174).
Verify with `bun test test/population-scheduling.test.js test/population-memory-pressure.test.js`.

### Current-trip presentation (SHE-261)

`world/population/trip-display.js` projects committed `remaining`, `tripTotal`,
`departureMinute`, `plannedActivity` and endpoint arrays into each bounded
snapshot/inspection row. Null means no current trip. This read introduces no
random draws, rules or time advancement. Coordinates retain behavior.js's
straight-line approximation; sidewalk access endpoints do not establish a road
path. Car shapes represent traveling residents; bus/rail shapes represent
passengers, since the model has no shared fleet identity. Neither shape counts
nor sampled points establish real traffic volume. Ongoing trips are distinct
from a retained completed-trip ledger. Seed, model version, clock and run
identity remain on the enclosing snapshot/runtime. Verify with
`test/population-trip-display.test.js` and the existing model/replay suites.
