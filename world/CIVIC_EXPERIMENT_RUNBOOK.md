# Civic Experiment Lab — verification and continuation runbook

This runbook covers the continuation patches after the original Civic Experiment
Lab 01–10 series.

## 1. Restart HBL after applying patches

The `/api/plan` contract is created in `server.js`, so a process that was already
running before `git am` will continue serving the old code until it is restarted.

```bash
# stop the old process, then:
bun run server.js
```

Open:

```text
http://localhost:3000/world/experiment-lab.html
```

## 2. Verify the server contract

The strongest check is the CLI verifier:

```bash
bun scripts/verify-civic-experiment.js
```

It intentionally fails if `/api/plan` does not return a top-level
`civicExperiment` with `schemaVersion: "civic-experiment.v1"`.

A direct check is also useful:

```bash
curl -sS \
  -X POST http://localhost:3000/api/plan \
  -H 'content-type: application/json' \
  -d '{"runs":32,"years":10,"seed":424242}' \
  > /tmp/hbl-plan.json

jq '.civicExperiment.schemaVersion' /tmp/hbl-plan.json
jq '.civicExperiment.worldModel.variables | length' /tmp/hbl-plan.json
```

Expected first result:

```text
"civic-experiment.v1"
```

If the server still returns a raw Dear Congress synthesis, the browser Lab now
normalizes it locally so the UI remains usable and clearly labels the source as
`browser-normalized`. Fix/restart the server anyway: the CLI verifier should stay
red until the server contract itself is correct.

## 3. Run tests

```bash
bun test
```

If the repository's Playwright suite is configured:

```bash
bunx playwright test
```

Also check patch hygiene:

```bash
git diff --check
```

## 4. Browser acceptance test

Use the Lab in this order:

1. Load from `/api/plan`.
2. Confirm the assumption inspector has inferred variables.
3. Lock one variable to an obvious value.
4. Generate worlds with seed `424242`.
5. Generate again with the same seed and confirm the same worlds.
6. Change only the seed and confirm the sampled worlds change.
7. Run simulations.
8. Inspect the outcome landscape and click several realities.
9. Inspect sensitivity/failure modes.
10. Test one plan improvement on the same worlds.
11. Run the Lab self-check.
12. Save a snapshot, reload it, and inspect lineage.
13. Prepare (but do not automatically send) a Dear Congress revision draft.
14. Export a Pensieve handoff JSON.

## 5. Real HBL simulator bridge

The Lab chooses simulation in this order:

1. `window.HBL_CIVIC_SIMULATOR`
2. `window.HBL_CIVIC_SIMULATOR_ENDPOINT`
3. clearly labeled non-predictive implementation stress fallback

### In-process simulator

```js
window.HBL_CIVIC_SIMULATOR = async ({ experiment, world }) => ({
  score: 74.2,
  metrics: {
    median_housing_cost: -0.08,
    housing_units_permitted: 12500,
  },
  events: [],
  timeline: [],
  explanation: {
    positiveDrivers: ["high agency capacity"],
    negativeDrivers: ["high financing cost"],
  },
});

window.HBL_CIVIC_SIMULATOR_META = {
  id: "hbl-domain-simulator-v1",
  label: "HBL domain simulator",
  predictive: false,
};
```

Set `predictive: true` only after the model has an evidence-backed interpretation
that justifies that label.

### HTTP simulator

```js
window.HBL_CIVIC_SIMULATOR_ENDPOINT = "/api/civic-simulate";
```

The endpoint receives:

```json
{
  "experiment": {},
  "world": {}
}
```

and returns a standardized result containing a finite `score` plus optional
`metrics`, `events`, `timeline`, and `explanation`.

See `world/CIVIC_SIMULATOR_CONTRACT.md`.

## 6. Domain metrics

`experiment.outcomes.metricRegistry` is inferred from the plan and explicit Dear
Congress metric IDs. The registry is descriptive metadata; a real simulator is
responsible for calculating the actual metric values.

Do not collapse every policy domain into one generic score once a domain model is
available. Keep the score as a summary and preserve the individual metrics.

## 7. Save/replay and lineage

The Lab stores full snapshots in IndexedDB. A local URL such as:

```text
/world/experiment-lab.html?experiment=<record-id>
```

reopens that record in the same browser profile.

The snapshot includes reviewed overrides, sampled worlds, simulation results,
sensitivity analysis, and paired improvement comparison. It is intended to make
experiments reproducible and to support a future server-backed persistence layer.

## 8. Dear Congress feedback

After a paired improvement test, click **Prepare revision draft**. Review the
journal-shaped payload before using **Send draft to Dear Congress**.

The default write target is:

```text
POST /api/publish_draft
```

If Dear Congress expects another request body, configure a mapper before sending:

```js
window.HBL_DEAR_CONGRESS_REVISION_MAPPER = (draft) => ({
  // Return the exact request body expected by your Dear Congress version.
  entry: draft.text,
  metadata: draft.metadata,
});
```

Nothing is written merely by loading or preparing the draft; sending requires an
explicit button click.

## 9. Digital Pensieve handoff

The Lab can export `pensieve-civic-handoff.v1` JSON containing the entire current
experiment snapshot. Configure the target URL in the Lab or globally:

```js
window.HBL_PENSIEVE_URL = "https://your-pensieve.example/museum/";
```

The receiving application contract is documented in
`world/PENSIEVE_CIVIC_HANDOFF.md`.

## 10. Go/no-go checklist

Before treating the workflow as stable, confirm:

- `/api/plan` itself returns `civic-experiment.v1`
- inferred variables are non-empty and auditable
- overrides and locks work
- same seed produces the same worlds
- a different seed changes unlocked worlds
- all simulation scores are finite
- the outcome landscape renders
- reality inspection works
- sensitivity analysis does not claim causality
- improvement tests keep the sampled worlds fixed
- save/replay restores the same snapshot
- Dear Congress writes occur only after explicit user action
- Pensieve export validates as `pensieve-civic-handoff.v1`
