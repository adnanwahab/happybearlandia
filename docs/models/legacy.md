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

createWorld(town, opts) uses rng(hashSeed(town.seedKey + ":sim" + optional runSeed suffix)). Retain generated town, all options, resolved simulation parameters, runSeed and commands. Fresh start time is not simulated prehistory. [Legacy checkpoints](../../world/legacy-checkpoint.js) capture/restore continuation; preserve RNG state and model metadata.

## 6. Input data

Town geometry and building kinds come from the supplied town. Resident attributes and economic/need coefficients are synthetic. Culture and weather instances use the committed clock and remain distinct from Living Population instances; source geography does not validate behavioral parameters.

## 7. Submodels

ACTIONS defines locations, eligibility, duration, need rates and start effects: e.g. eating consumes fridge stock, purchases transfer money, work pays per minute. Base need decay is hunger .09, energy .045, fun .05, social .04 per minute, modified by active rules; walking is 40 m/min. These are gameplay assumptions. [simulation-parameters.js](../../world/simulation-parameters.js) resolves overrides/metadata. [Relationships](../../world/relationships/model.js) supplies the same sparse social rule family through legacySocial with legacy identity/availability adapters; [culture](../../world/culture/README.md) and [weather](../../world/weather/README.md) specify environmental submodels. Verify: `bun test test/simulation-playback.test.js test/weather-simulation.test.js test/culture-simulation.test.js`.

### Classic World Storm — parcel-storm.v1

The normal Storm button selects the existing ranked non-park building IDs by
`round(count × max(0,.24−floodMitigation) × intensity)`. In automatic-weather mode
an explicit Storm uses intensity1; in manual mode it captures the Weather panel's
Storm intensity (0–1), including zero. The storm records that input, world seed,
onset model minute, sequence, selected stable IDs and evacuation records in
`policy.storm`. This is synthetic gameplay exposure, not an observed flood result.

[parcel-storm.js](../../world/weather/parcel-storm.js) owns depth and flood flags.
Peak depth is `.3 + 1.2 × intensity` metres, initially10% of peak, rising linearly
to peak at20 model minutes and draining to zero at180. Rain/sky intensity holds
until60 minutes and fades to zero at90. Each minute updates depth before resident
movement; paused clocks freeze the envelope. Storm metadata, building surface
polygons/depths and person evacuation trips use the existing full checkpoint.
No additional random draws occur.

Current geometry supplies building footprints, not cadastral lots or hydraulic
street cells. The model records a synthetic2m radial apron around each exposed
footprint, suppressing the apron when its bounds touch another footprint. This
illustrative lot surface belongs to the same flooded ID; it is not surveyed
inundation extent. The renderer triangulates only that recorded polygon and uses
its committed positive depth, in one shared water draw. Street-wide flood extent
and calibrated hydraulic depth remain unavailable.

Residents whose current home is flooded choose the nearest unflooded home by
home-center distance (stable array-order ties). There is no shelter capacity,
household regrouping, road-flood avoidance or return-home model. Without a safe
home, the record explicitly says `no-safe-home`; those residents are not counted
as relocated. Successful relocations change home and walk from their actual
current position along the existing road graph at40m/min, replacing current
activities/commands without teleportation. Arrival is recorded with the model
minute. A later explicit resident command interrupts the evacuation record and
does not claim arrival at the safe home. Repeated Storm commands replace the bounded current storm record and
exposure, rather than keeping unlimited event history. Preserve command times
and checkpoint version to replay. Checks: `test/parcel-storm.test.js` and
`test/legacy-checkpoint.test.js`. Rendering rain/cloud drift/lightning and
opt-in thunder are presentation; reduced motion removes those moving cues while
retaining static model depth readings.
