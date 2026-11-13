# Worker 6 browser acceptance

These tests use the running application and persisted City API, never fixture
model outcomes. No production source or shared contracts are owned here.
The canonical server configuration creates temporary isolated storage and refuses
to reuse an existing server. Override HBL_TWO_FUTURES_PORT if necessary.

Next slice / acceptance: homepage Play Demo, common hashed seed-42 Month 0,
121 snapshots per arm, real changed-building click and WHY context, nonzero
measurements with units, return to Month 0, no-intervention rerun and restored
policy reproducibility. Repeat selection/scrubbing at 1440x900 and 390x844 in
forced Canvas2D, check horizontal clipping and control hit targets, recover from
offline API failure, and inspect disabled controls during an outstanding real
request. Record all page errors and console errors. The optional recording test
waits for the full presentation clock before revisiting evidence frames.

Commands (from repository root):

```
bunx playwright test --config test/one-city-two-futures.browser.config.js
bun scripts/record-one-city-two-futures.mjs --output /tmp/she26-recording --port 41827
```

Requirements: Bun, installed @playwright/test and Chromium, local listener
permission; ffprobe on PATH for recording validation. Video and traces are always
retained, including successful tests. Each capture directory contains scenario.json
and metrics.json from window.futureMachine's actual paired history, with exact
URL, backend, browser, viewport, recipe, seed, model version, experiment ID,
initial hash and provenance. Named screenshots are siblings of capture directories.
The recording script writes a manifest only after successful acceptance and
ffprobe validation. Artifacts are local and are not automatically uploaded.

Current evidence is in execution.json and the adjacent logs. No new measured
outcome or successful media is claimed when server setup fails. Historical
coordinator evidence is not evidence from this run. The requested existing
`test/e2e/world-first-run.e2e.js` is absent in this checkout; the existing adjacent
World journey is `test/e2e/two-futures-compatibility.e2e.js`.

Material risks / handoff: browser assertions added here remain unverified until
run on a host permitting local listening. Native WebGPU, physical phones and
Safari are outside this Chromium gate. Replay is model recomputation; identical
hash/metrics is seed-matched reproducibility, not independent checkpoint proof.
No production code was changed. Coordinator owns any selector/behavior repair
and updates to docs/implementation-plan.md; this ownership-scoped README records
the Worker 6 slice instead of modifying that shared plan.
