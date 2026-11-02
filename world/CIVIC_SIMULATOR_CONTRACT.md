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
