# HBL civic simulator contract

The Experiment Lab accepts either an in-page simulator or an HTTP simulator.

## In-page registration

```js
import { registerHblCivicSimulator } from "/world/hbl-simulator-bridge.js";

registerHblCivicSimulator(window, async ({ experiment, world }) => {
  return {
    score: 74,
    metrics: {
      housing_units_permitted: 1200,
      median_housing_cost: 1850,
    },
    events: [{ year: 2, type: "permit-backlog-clears" }],
    explanation: {
      positiveDrivers: ["high agency capacity"],
      negativeDrivers: ["high interest rates"],
    },
  };
}, {
  id: "housing-sim.v1",
  label: "HBL housing simulator",
  predictive: false,
  modelClass: "housing-system-dynamics",
});
```

Only set `predictive: true` when the model has actually been calibrated/validated for that use.

## HTTP registration

Before loading `experiment-lab.js`, set:

```js
window.HBL_CIVIC_SIMULATOR_ENDPOINT = "/api/my-real-simulator";
window.HBL_CIVIC_SIMULATOR_META = {
  id: "housing-sim.v1",
  label: "HBL housing simulator",
  predictive: false,
};
```

The Lab POSTs a `civic-simulation-request.v1` object containing `experiment`, `world`, and `options`.
The endpoint may return the result directly or as `{ "result": { ... } }`.

Required result field:

- `score`: finite numeric summary used by the current outcome landscape.

Optional fields:

- `metrics`: numeric/domain outputs keyed by metric id.
- `events`: causal/event log.
- `timeline`: time-indexed outputs.
- `explanation`: model-specific explanation object.

Unknown metric ids are allowed so a simulator can evolve before the registry catches up, but invalid/non-finite values are rejected.

## Built-in HBL civic dynamics model

When neither an in-page simulator nor an HTTP endpoint is registered, Experiment Lab now uses the built-in `hbl-civic-dynamics.v2` adapter rather than the older implementation-only stress score.

The built-in model:

- advances the experiment one year at a time for the configured horizon;
- uses the sampled world conditions as deterministic inputs;
- models rollout delay, implementation capacity, political continuity, and deterministic shock events;
- generates domain-aware metrics from the experiment metric registry;
- returns a yearly `timeline`, an `events` causal log, final `metrics`, and driver explanations;
- is deterministic for a given experiment/world pair.

It intentionally reports `predictive: false`. It is a structural scenario model for comparing plans and stress-testing assumptions, not a calibrated forecast of real-world policy outcomes.

Adapter precedence is:

```text
window.HBL_CIVIC_SIMULATOR
        ↓
window.HBL_CIVIC_SIMULATOR_ENDPOINT
        ↓
hbl-civic-dynamics.v2
```

The legacy implementation stress adapter remains available programmatically through `createImplementationStressAdapter()` or by resolving with `{ preferStressFallback: true }`.


## Causal graph and feedback loops

`hbl-civic-dynamics.v2` evaluates `experiment.worldModel.causalEdges` every simulated year. The graph maps reviewed world assumptions into derived system states such as delivery capacity, political durability, supply capacity, cost pressure, private response, public confidence, financial capacity, and disruption resilience.

The built-in graph includes damped feedback loops so cycles remain bounded:

- implementation → confidence → political durability → implementation (reinforcing)
- private response → supply → cost pressure → private response (balancing)
- resilience ↔ public confidence (reinforcing)

These are modeling hypotheses, not claims of real-world causality. The Reality Inspector surfaces the strongest modeled pathways and active feedback loops so users can audit why the simulator produced an outcome.
