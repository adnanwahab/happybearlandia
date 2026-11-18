# Energy Control Room — energy-toy-1 / dispatch-1

## 1. Purpose and patterns
Independent authored stock/flow puzzle, not an ABM or empirical city grid.
Keep a synthetic neighborhood powered across three waves. No calibrated validity.

## 2. Entities, state and scales
One aggregate demand, generator and battery. Integer abstract energy units per
wave (not kW). Battery capacity 4, generation capacity 6 per wave. No mapping to
City/Population entities, monthly time, geography or utility capacities.

## 3. Process and scheduling
Player commits generation 0–6. Serve demand with generation first; discharge
battery for deficit. Charge surplus up to capacity and spill remainder. Record
immutable checkpoint with parent ID, inputs and flows. Any unmet demand ends in
failure immediately. Three served waves succeed. Cancel computes no further wave.

## 4. Design concepts
Deterministic conservation: opening battery + generation = closing battery +
served + spill. Demand = served + unmet; closing battery = opening + charge −
discharge. No losses, stochasticity, autonomous agents, network or fuel constraint.
Human actions are explicit inputs; seed 706 is retained for matched comparisons
but consumes no random draws. Narrative wave names have no additional mechanism.

## 5. Initialization
Explicitly load ENERGY_DEMO from `world/hidden-systems/energy-model.js`:
energy-neighborhood-1, battery 2; morning/evening/night demand 4/8/6. These are
artificial assumptions. Default UI has no source and no computed result.

## 6. Input data
Source kind synthetic authored fixture, version energy-neighborhood-1; measured
observations null. Only this exact fixture is accepted. Model/rules/source/seed
and every scenario field remain inspectable. No external data or service required.

## 7. Submodels and reproduction
Executable contract: `world/hidden-systems/energy-model.js`. `dispatchEnergy`
returns frozen children and retains frozen ancestors. Replay recomputes from
pinned source and ordered actions, comparing all retained state/checkpoints;
mismatch returns false without replacing evidence. State lasts for the page
session; reload/restart explicitly begins a new attempt. No durable import or
public score claim. Strategy 6/6/6 wins with battery 4/2/2; 0 fails at wave 1.
Tests: `test/energy-control-room.test.js`, navigation browser suite alongside it.
