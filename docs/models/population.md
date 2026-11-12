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

[createPopulationModel](../../world/population/model.js) normalizes config, calls [generatePopulation](../../world/population/generator.js), initializes needs, employment, economy and histories and aggregates. A fresh initialMinute is within day one; it supplies no prehistory. Save full config, context, initialMinute/tick and optional subsystem configuration, or use the [checkpoint codec](../../world/population/checkpoint.js) for continuation. Keep the recorded POPULATION_VERSION from contracts.js rather than assuming the latest version.

## 6. Input data

Synthetic generation uses configured population, seed, household/income/employment targets and supplied district/building context. [Data formats](../../world/population/DATA_FORMATS.md) describe imports. Coordinates may be sourced geography; preferences, costs and targets remain synthetic unless explicitly documented otherwise. Missing weather uses neutral effects. Culture/weather are host-supplied minute-aligned inputs, not independent household ledgers.

## 7. Submodels

[behavior.js](../../world/population/behavior.js) defines activities, destination/mode utility, event effects and household choices; [economy.js](../../world/population/economy.js) defines daily demand and firms; employment.js and children.js account for committed work/care intervals. [House model](../../world/house/model.js) validates requests and resources, reserves participants/objects and applies effects only over committed intervals. System installers/registry add life, safety and family mechanisms on the same clock. [Relationships](../../world/relationships/model.js) uses seeded sparse ties, bounded friendship/trust/tension, proximity and availability gates; promises and traditions retain actual attendance. These are stylized social assumptions, not observed friendships. Culture scene strengths are bounded aggregate indices; hourly synthetic events project only supported district multipliers ([culture contract](../../world/culture/README.md)). Weather is synthetic environmental input ([weather contract](../../world/weather/README.md)). Reproduce with saved checkpoint/config and identical commands, event schedule, seed, versions and step partition. Verify: `bun test test/population-model.test.js world/population/checkpoint.test.js world/house/model.test.js test/culture-simulation.test.js`.
