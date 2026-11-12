# Future Machine controls

`createUI(container, callbacks)` implements the frozen v1 interface. Load `ui/styles.css` in the coordinator's page. Mount the scene into `ui.stageElement` and the story into `ui.storyElement`. Call `ui.update` with partial coordinator state and `ui.dispose` on navigation. Rendering and the playback timer belong to the coordinator. Native range keyboard controls select the same Month 0–120 for both arms. The calendar is illustrative January 2026–January 2036.

The City selector exposes the one bounded synthetic generator permitted by v1. Policy choices are the supplied intervention or a null intervention for a matched unchanged control. No additional policy parameters or geometry are fabricated. Cards consume the diff's `housingUnits`, `meanTravelMinutes`, and `capitalSpending` fields, preserving units and unavailable values. The Commute card explicitly explains that this engine measurement is link travel time, not household commute time. Household JSON uses exact monthly City IDs and shows missing arms as null. The evidence inspector reports comparison counts; recorded causal details belong to the mounted story inspector.

The optional `callbacks.onCancel()` extension exposes Cancel run during loading. Without it the button stays hidden: the frozen coordinator interface has no cancellation callback, and hiding it avoids falsely promising cancellation. The coordinator must abort its request and settle its own state when using this extension. Progress is indeterminate unless an actual bounded fractional measurement is supplied; the UI never estimates simulation completion. Error text is live-announced; Fork City retries and clears it. Share/export are disabled until a frame is available. Shared URLs are restricted to HTTP(S).

`mountFutureMachineUI` is the lower-level view with optional self-contained playback, useful for isolated embedding. The exported `createUI` always delegates playback to the coordinator. Both factories create DOM only when called and clean up listeners/timers on disposal.

## Acceptance and verification

- `bun test test/future-machine-ui.test.js`: calendar endpoints, input bounds, zero/missing/nonfinite measurements, signed and zero deltas.
- `HBL_FM_BROWSER=1 bun test test/future-machine-ui.test.js` runs the committed Chromium test (with installed `@playwright/test`); `HBL_PLAYWRIGHT_MODULE` can point to an existing module installation. The full run passed 5 tests / 28 assertions.
- Chromium smoke exercised native range End to Month 120, delegated play/blink/director/share/export, Fork City, loading disablement, error announcement, unsafe share URL rejection, disposal, and 390px/1440px layouts with no horizontal overflow. This smoke used injected recorded-shape fixtures; it did not exercise the unfinished combined application or real API runs.
- Browser import and DOM construction defer all simulation work to callbacks. No third-party UI dependency, network request, server change, or production write is introduced.

Integration owner must include the stylesheet, mount the scene/story, and verify the full API journey. Add `onCancel` to coordinator composition if user-visible request cancellation is required. No shared contracts or implementation plan were edited here.

## One City, Two Futures additions

The v1 adapter preserves the existing stage, story, timeline, Fork City and native control selectors. Its title is now **One City, Two Futures**; the plan field is labeled **Plan** and the travel metric **Link travel time**. Left/right legends read WITHOUT PLAN / WITH PLAN. Every available metric has a native WHY button; `onMetric(key)` receives `housingUnits`, `meanTravelMinutes`, or `capitalSpending`. Unavailable measurements remain unavailable and their WHY buttons are disabled. All values and units still come directly from the supplied diff; this UI makes no simulation calls.

Coordinator additions (no shared contracts edited):

- `onDemo()` starts or restarts the coordinator-owned guided sequence, including at idle before a frame exists. `.fm-demo-play` remains the stable selector; text is Play Demo or Restart Demo.
- `onDemoPause()` toggles the coordinator-owned sequence. Update `demo:{status,paused,caption,elapsedMs}`. Active statuses are playing/running/paused/preparing/loading; complete restores Play Demo and offers manual exploration. The pause button reads Pause demo / Resume demo. Caption is live-announced; elapsedMs is displayed as elapsed whole seconds, never estimated compute progress.
- `onMode('difference')` is dispatched by **Differences only**; the scene/coordinator must implement this mode. Existing split/baseline/plan callbacks are preserved.
- `provenance:{seed,modelVersion,experimentId}` updates the always visible `.fm-run-provenance` alongside current month. Missing values are explicit, with recipe seed/version as fallback. Nested demo/provenance updates merge partially.

The synthetic mapping and generator assumptions remain visible beneath the city: zero private parcel capacity, utility capacity 200 per district/network and zero annual growth. The UI does not claim a real geographic mapping or empirical causal certainty.

Latest focused verification: `HBL_FM_BROWSER=1 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test test/future-machine-ui.test.js` passed 5 tests / 33 assertions. Includes idle demo, pause/resume, two WHY metric keys, difference-mode dispatch, provenance, keyboard timeline, loading/cancel/error, unsafe URL, disposal, and no overflow at 390px/1440px. Desktop test-fixture screenshot: `/tmp/future-machine-ui-desktop.png`. This is component evidence with an intentionally empty stage, not an actual model run screenshot. Full engine values, synchronized city, 45–60 second runner, integrated screenshots and browser recording remain coordinator acceptance work.

## R02 / U05 / U06 semantic measurements

Owned follow-up from integrated base `c64ce56`: KPI `data-tone` is neutral for zero and whole-stock mean rent, unavailable for missing/nonfinite measurements, cost for changed capital spending, and change for other nonzero measurements. No direction is styled as an inferred welfare gain. Additional capital cost is explicit. Display unit `USD total` means the same cumulative USD supplied by the diff; the detail retains cumulative capital-spending meaning. Tiny nonzero quantities are shown numerically rather than rounded to zero; recorded data is untouched.

Household summaries now expose separate arm observations with USD/month income and rent, USD savings, and rent / positive monthly income in percent. Rent requires one unit with exact reciprocal household ID, unit ID and occupied status; absent, duplicate or inconsistent joins are unavailable. Zero rent and savings remain valid; zero income gives unavailable burden. Missing households are identified as unmatched. The whole-stock rent/new-inventory caveat remains visible without opening raw JSON. Existing callbacks, test IDs and control selectors remain unchanged.

Focused browser evidence is component-only: `/tmp/future-machine-ui-semantic-mobile.png` and `/tmp/future-machine-ui-semantic-desktop.png` use explicit fixture values and an empty stage. Coordinator must capture integrated actual-run screenshots after cherry-pick. No engine, main, scene, shared API, entry point or queue changes are included.

## U17 pending seed configuration

`onConfigure(recipe)` is additive and receives a detached configured recipe on valid seed changes or policy edits. The visible **Seed for next run** field (`data-testid="future-machine-seed"`) accepts decimal uint32 integers including 0 and 4294967295. Empty, nonnumeric, fractional, negative and out-of-range input remains visible with an error, never becomes zero, never dispatches configuration and blocks Fork City through native validity. `onRun(recipe)` receives the configured recipe, not the displayed run recipe. Busy runs disable seed editing.

Pending edits survive ordinary `update` calls, including repeated old `recipe` values on timeline/inspection updates. A recipe matching valid pending configuration acknowledges it; a changed nonempty experiment ID plus an explicit recipe replaces it for a newly displayed run. The run provenance reads `provenance` or the coordinator's displayed `recipe`, never the pending seed. The coordinator owns validation/persistence and must keep saved history/share URLs tied to the actual run, supplying recipe and experiment ID when switching runs. No main/shared contract changes are included.

## SHE-35 housing edit loop

**Proposed homes for next run** edits the existing housing intervention amount
(whole numbers 1–120) through `onConfigure` and `onRun`. Other intervention fields
remain unchanged, including illustrative total cost; this is a bounded synthetic
assumption edit, not a cost estimate or promise of completed homes. The control
is disabled for no intervention, other intervention types and busy runs. Invalid
input blocks native form submission. Pending edits survive scrubbing while
provenance and sharing refer to the displayed history. Fork City recomputes both
arms from the configured seed and versioned generator; unchanged seed/population
preserve the original baseline. Existing request guards reject stale completion.
