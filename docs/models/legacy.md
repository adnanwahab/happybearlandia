# Legacy World needs simulation — ODD

The model description follows the ODD (Overview, Design concepts, Details) protocol (Grimm et al. 2006, updated 2010 and 2020). See [scope and review rules](README.md). Reviewed against the repository sources on 2026-11-12; retain the checkout revision with any run.

## 1. Purpose and patterns

Provide a synthetic Sims-style daily world in the legacy runtime. Need satisfaction and shared stock/cash changes explain activity patterns; they are not predictions of real residents.

## 2. Entities, state variables and scales

[sim.js](../../world/sim.js) owns people (needs, money, home/job, movement, action commitments), buildings (stock, fridges, cash, visitors), world stats and optional social/journal state. Coordinates are local meters and time is game minutes. IDs and clock belong to the legacy world, not Population.

## 3. Process overview and scheduling

createWorld returns step(gameMinutes), which requires nonnegative whole minutes and performs that many minute updates. Minute updates advance the clock, environmental/civic effects and people in array order, applying need changes, pay, movement, completion and subsequent choices. Shared mutations make ordering significant. Rendering does not itself define a model minute.

## 4. Design concepts

Basic principles: advertised actions and need-based utility. Emergence: shared stock, trips and budget outcomes. Adaptation/objectives: choose feasible nearby actions to satisfy needs, with work/school schedules. Learning/prediction: fixed heuristics, no training or general foresight. Sensing: nearby building advertisements and own state. Interaction: shared inventories, visitor capacity, social actions. Stochasticity: seeded world RNG plus keyed draws. Collectives: households and shared venues. Observation: stats, summaries, retained decisions, logs and activity ledger; narrative text is interpretation of synthetic events.

## 5. Initialization

createWorld(town, opts) uses rng(hashSeed(town.seedKey + ":sim" + optional runSeed suffix)). Retain generated town, all options, resolved simulation parameters, runSeed and commands. World postcard selection supplies the versioned `postcard-v1:<place>` URL seed as `runSeed` in both 3D and Canvas2D entry points; custom locations use `place-v1:<coordinates>`. Activity snapshots report this effective seed. Town generation remains keyed by coordinates. A shared seed does not freeze live OSM geometry; exact replay still requires retained town inputs/checkpoints. Postcard hooks are authored invitations, not predictions. Fresh start time is not simulated prehistory. [Legacy checkpoints](../../world/legacy-checkpoint.js) capture/restore continuation; preserve RNG state and model metadata.

## 6. Input data

Town geometry and building kinds come from the supplied town. Resident attributes and economic/need coefficients are synthetic. Culture and weather instances use the committed clock and remain distinct from Living Population instances; source geography does not validate behavioral parameters.

## 7. Submodels

ACTIONS defines locations, eligibility, duration, need rates and start effects: e.g. eating consumes fridge stock, purchases transfer money, work pays per minute. Base need decay is hunger .09, energy .045, fun .05, social .04 per minute, modified by active rules; walking is 40 m/min. These are gameplay assumptions. [simulation-parameters.js](../../world/simulation-parameters.js) resolves overrides/metadata. [Relationships](../../world/relationships/model.js) supplies the same sparse social rule family through legacySocial with legacy identity/availability adapters; [culture](../../world/culture/README.md) and [weather](../../world/weather/README.md) specify environmental submodels. Verify: `bun test test/simulation-playback.test.js test/weather-simulation.test.js test/culture-simulation.test.js`.
