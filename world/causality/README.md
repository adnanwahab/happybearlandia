# Recorded causal inspection

Import `/world/causality/inspector.js` and mount `<causal-inspector>`.
Set `.context` to shared navigation context plus `targetId`, or set `run-id`,
`entity-id`, `tick`, `target-id` attributes. `inspector-navigate` bubbles with
selected context. Standalone: `/world/causality/inspect.html` with canonical URL
parameters. Context survives navigation; stored provenance is displayed verbatim.

The dispatcher `createCausalityHandler({store, extensions})` uses the existing
world SQLite database by default and permits scoped handler injection.
Read routes under `/api/causality`:

- `runs?worldId=&scenarioId=&universeId=&limit=&afterId=`
- `run?runId=` or `runs/:encodedRunId`
- `events?runId=&limit=&afterSequence=`
- `observations?runId=&limit=&afterSequence=`
- `timeline?runId=&entityId=&tick=&limit=&afterSequence=`
- `explain?runId=&targetId=&maxDepth=6&maxNodes=100&maxEdges=200&includeAssociations=false`

Timeline merges stored event/observation sequences, applies a bounded page before
entity/tick filtering, and returns `nextCursor`; even empty matching pages may
have more records. Tick is inclusive. Explain returns recorded nodes, edges,
evidence and missing IDs, plus explicit bounds and incomplete reasons. Correlates
edges are excluded unless requested. Traversal never manufactures a dependency.
Provenance kind distinguishes observed, simulated, assumed and derived records.
No explanation is proof of real-world causation.

The dispatcher also composes the separate replay, paired comparison, deterministic
World scenario and counterfactual modules. Forks remain unavailable until an
explicit authenticated host configures the fork engine. What if displays only
stored comparisons and never synthesizes alternate outcomes.

Checks: `bun test test/causality-read.test.js`; component browser checks:
`bunx playwright test --config test/causality.browser.config.js`.

Use `HBL_FULL_SERVER=1 bunx playwright test --config test/causality.browser.config.js`
to run the same browser check against the complete application.
