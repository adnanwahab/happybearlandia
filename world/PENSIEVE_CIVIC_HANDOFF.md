# Pensieve civic handoff contract

HappyBearLandia can export a complete civic experiment snapshot using
`pensieve-civic-handoff.v1`.

The receiving Pensieve UI can accept either:

1. a downloaded JSON file, or
2. a `postMessage` event from an opener/embedded HBL page.

```js
window.addEventListener("message", (event) => {
  if (event.data?.type !== "hbl:pensieve-civic-handoff") return;
  const handoff = event.data.payload;
  if (handoff?.schemaVersion !== "pensieve-civic-handoff.v1") return;

  // Build museum exhibits from:
  // handoff.snapshot.experiment
  // handoff.snapshot.overrides
  // handoff.snapshot.worldBatch
  // handoff.snapshot.simulationBatch
  // handoff.snapshot.sensitivity
  // handoff.snapshot.improvementComparison
});
```

Suggested museum rooms:

- Journal / original plan
- Reviewed assumptions
- 1,000-world outcome landscape
- Selected reality / timeline
- Failure modes and sensitivity
- Revision lineage / before-vs-after comparison

The URL query parameters `hbl_record`, `hbl_experiment`, `hbl_plan`, and
`hbl_handoff` are identifiers only. The full snapshot is transported as JSON or
via `postMessage`; do not try to place it in the URL.
