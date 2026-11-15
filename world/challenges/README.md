# Synthetic city mission cards

`/world/challenges.html` exposes the existing `city-challenge.v1` contract through
`editor.js` and the shared `panel.js`. Choose one of two small, authored month-zero
City fixtures (`checkpoints.js`, seeds 42 and 73), one or more registered metrics,
a 2–120 month horizon, a capital cap and a reference policy selection. Changing
the checkpoint discards the current card and comparisons. All fixtures and policy
costs are synthetic assumptions, not empirical measurements.

Criteria use the existing Pareto rule: improve at least one selected metric and
worsen none beyond its registered tolerance, while preserving population, housing
access and employment guards. Arbitrary formulas, scores and thresholds are not
accepted. Empty/duplicate/unknown metric sets refuse in `contract.js`. Actual
capital spending uses the complete monthly finance ledger. Missing observations
remain unavailable rather than zero. Some authored puzzles may be impossible;
the editor does not certify solvability.

Export uses the existing bounded local file/link transport; links reopen this
page. The complete initial state, engine version, seed, month, IDs, action costs,
metrics, guards and horizon travel together. Recipients recompute both plans in
a Worker. Caller-provided scores are rejected. SHA256 provides integrity, not
authentication or leaderboard certification. No network upload or sharing service
is introduced, and the editor offers only disposable synthetic checkpoints.
Unsupported imported versions/invalid files refuse. Worker-unavailable devices
can export the frozen terms and verify elsewhere; no main-thread simulation
fallback stalls the UI. No animation or 3D capability is required.

The six older illustrative arithmetic missions retain their separate behavior.
There is no mapping of their families/districts to this monthly City authority or
to daily World/Population IDs. No model rules or ODD descriptions changed.

Checks: `bun test test/mission-editor.test.js test/challenge-contract.test.js
 test/challenge-ui.test.js test/city-systems.test.js`.
Browser journey: `playwright test --config test/mission-editor.browser.config.js`.
