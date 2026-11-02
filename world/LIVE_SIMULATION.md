# Live civic simulation

The existing Civic Experiment Lab is the local entry point. This feature compares a
loaded experiment with an edited version using the existing time-stepped HBL civic
model. It does not require a separate project or deployment.

## Run locally

From the happybearlandia repository:

```sh
bun install
PORT=3000 bun run server.js
```

Open <http://localhost:3000/world/experiment-lab.html>. Load the current plan with
**Load from /api/plan**, or paste a saved `civic-experiment.v1` object (an envelope
with a `civicExperiment` property also works) and select **Load pasted JSON**.
The server's `DEAR_CONGRESS_URL` setting selects its Dear Congress API upstream;
the default is the hosted service. Pasted experiments can be explored without
that upstream.

For a local sample, paste this synthesis JSON. The existing lab normalizer builds
an experiment and visibly labels this compatibility path:

```json
{"packages":[{"id":"housing_sample","title":"Housing supply and affordability","summary":"Build affordable homes and streamline permitting near transit.","items":[{"proposal":{"id":"homes","title":"Fund affordable construction and expand transit infrastructure","needId":"housing_cost"}}]}]}
```

Review the live parameter controls, change a connected parameter such as agency
capacity, and compare baseline and current trajectories across the yearly horizon.
Use **Reset all parameters** to return controls to the loaded experiment's
assumptions, or a row's **Reset** to clear that override. Empty numeric input is
marked invalid; finite values outside the declared range are clamped. The lab
debounces edits and discards stale computations. Use the metric selector and year
scrubber or Play button to inspect the trajectory, rather than only its final year.

## Component handoff

The browser components use these interfaces:

```js
const result = await runLiveSimulation({
  experiment, overrides: {}, seed: 42, years: 10, runs: 12,
});
const controls = mountLiveParameterControls(container, {
  experiment, overrides: {}, onChange(overrides) {},
});
controls.setValues(overrides);
controls.destroy();
const view = mountLiveTimelineView(container);
view.setPending(true);
view.update(result);
view.showError('Unable to simulate this experiment');
view.destroy();
```

`world/live-simulation.js` returns baseline and current timelines derived from the
existing simulator. Comparisons use the same seeds, run count, and horizon. The
baseline remains tied to the loaded experiment while current receives overrides.
Reloading a different experiment establishes a different comparison baseline.
Baseline means the loaded experiment with its original uncertainty assumptions;
it is not a no-policy counterfactual. Native-unit numeric overrides, or objects
with `baseline`/`value`, fix the selected parameter in current ensemble runs. The
runner retains original ranges for normalization, clamps finite values, and reports
ignored invalid or unknown overrides in `warnings`. Its safety bounds are 1–50
years and 1–64 runs; the lab uses 12 paired worlds and the experiment's horizon.
Controls and rendering live in `world/live-parameter-controls.js` and
`world/live-timeline-view.js`; the lab owns scheduling and request ordering.

Dear Congress supplies the plan/experiment contract through the existing API path.
Frozen snapshot links use
`/world/experiment-lab.html?simulation=SNAPSHOT_ID&seed=42&years=10`. The lab fetches
`/api/dear-congress/simulation-snapshots/SNAPSHOT_ID`, normalizes that frozen plan,
and records its snapshot identifier as provenance without requesting a fresh
synthesis. An unavailable snapshot leaves a visible error and allows manual load.
For manual handoff, copy the experiment envelope into the lab's JSON input.
Existing saved-record and Pensieve flows are separate capabilities; do not assume
that viewing a live comparison persists its full result or sends it upstream.
Review a revision before explicitly sending it through the existing feedback flow.

## Browser verification

```sh
bunx playwright install chromium
bun run test:e2e -- test/e2e/live-simulation.e2e.js
```

The Playwright configuration launches the existing server on port 3100. Keep that
port free. The test uses a local housing experiment rather than a remote synthesis
request. It checks parameter response over multiple years, stable paired baseline,
reset, invalid input, and rapid edits. Failure traces are retained in `test-results`.
The snapshot handoff browser case mocks the HBL proxy response: it verifies URL
loading and provenance, not the Dear Congress database or cross-service network.

## Interpretation limits

These are illustrative, non-predictive trajectories from modeling assumptions,
heuristic parameter extraction, causal bindings, and synthetic uncertainty. A
displayed year is a model time step, not a dated forecast. A parameter without a
binding to model mechanics may have no effect; that absence is not evidence of
real-world irrelevance. Ensemble min/max ranges represent scenario spread, not
forecast confidence intervals. Paired seeds reduce comparison noise but do not establish
causation, validate coefficients, or make the small run ensemble representative.
Inspect assumptions, metric direction and units, modeled pathways, and uncertainty
before drawing conclusions. No simulation result automatically authorizes policy
action or proves an expected real-world outcome.
