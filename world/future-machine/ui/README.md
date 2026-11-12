# Future Machine controls

`createUI(container, callbacks)` implements the frozen v1 interface. Load `ui/styles.css` in the coordinator's page. Mount the scene into `ui.stageElement` and the story into `ui.storyElement`. Call `ui.update` with partial coordinator state and `ui.dispose` on navigation. Rendering and the playback timer belong to the coordinator. Native range keyboard controls select the same Month 0–120 for both arms. The calendar is illustrative January 2026–January 2036.

The City selector exposes the one bounded synthetic generator permitted by v1. Policy choices are two bounded inputs to the existing City housing rules: 24 proposed homes for 1,000,000 illustrative USD, 12 for 500,000 illustrative USD, and a null intervention for a matched unchanged control. Both use district d1, delay 0 and compliance 1. The policy note names the monthly City model version and construction/funding constraints; these synthetic inputs are uncalibrated. A loaded nonpreset intervention remains available with its exact inputs under “Loaded recipe intervention”. No additional policy parameters or geometry are fabricated. Cards consume the diff's `housingUnits`, `meanTravelMinutes`, and `capitalSpending` fields, preserving units and unavailable values. The Commute card explicitly explains that this engine measurement is link travel time, not household commute time. Household JSON uses exact monthly City IDs and shows missing arms as null. The evidence inspector reports comparison counts; recorded causal details belong to the mounted story inspector.

The optional `callbacks.onCancel()` extension exposes Cancel run during loading. Without it the button stays hidden: the frozen coordinator interface has no cancellation callback, and hiding it avoids falsely promising cancellation. The coordinator must abort its request and settle its own state when using this extension. Progress is indeterminate unless an actual bounded fractional measurement is supplied; the UI never estimates simulation completion. Error text is live-announced; Fork City retries and clears it. Share/export are disabled until a frame is available. Shared URLs are restricted to HTTP(S).

`mountFutureMachineUI` is the lower-level view with optional self-contained playback, useful for isolated embedding. The exported `createUI` always delegates playback to the coordinator. Both factories create DOM only when called and clean up listeners/timers on disposal.

## Acceptance and verification

SHE-75 follow-up (2026-11-12): the adapter preserves a diff metric's missing
status. Presentation also rejects a nonfinite B−A result even when both arm
values are finite, keeping the card unavailable and its WHY control disabled.
The focused diff/UI suites passed 18 tests, with one browser-gated skip.
An explicit browser run failed before Chromium launch because `Bun.serve`
could not bind its local port (`EADDRINUSE`); no fresh integrated screenshot
or mobile interaction evidence was collected in this follow-up. Earlier
browser evidence below is historical. The coordinator-owned implementation
plan remains unchanged under this worker's file scope; the remaining handoff
is to rerun browser acceptance in an environment that permits local listening.

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

SHE-48: the footer has one `Copy comparison link` button. The optional
`onBrowserShare()` callback exposes a separate `Share comparison` button;
composition supplies it only when `navigator.share` exists. `shareBusy` disables
both actions while the native request is pending. A safe HTTP(S) `shareURL`
also supplies a readonly, labeled Comparison URL field that selects on focus
for manual copying. Feedback uses the existing polite status announcement.

## Recorded outcome chart (SHE-217)

The shared Month 0–120 slider is the sole range control. Chart clicks select the nearest recorded month by x coordinate; exact-values buttons provide a keyboard alternative. Both dispatch the coordinator's manual month callback. Paths and gap geometry rebuild only on metric/mode changes; month updates move one cursor and one highlight (WITH PLAN, falling back to WITHOUT PLAN; delta in delta mode). Axis labels use four significant digits; table and manual summary values retain exact precision.

`createOutcomeTimeline.update(month)` is silent for playback and coordinator refreshes. Manual time inputs call `update(month, {announce:true})`; duplicate text is not reassigned. The live summary retains the last announced selection during autoplay. Recreate the component for a new recorded history.

## Demo KPI source contract (SHE-112)

`bun run test:demo-kpis` checks the exact three-card inventory against mutations
of synthetic monthly snapshot metrics through `getFrame`, `compareFrame` and
`createUI`. It exercises the native timeline callback at Months 16/120 and reverse
time, both arms, units, zero and explicitly unavailable measurements/snapshots.
The same file's three non-browser pipeline tests run in ordinary Bun tests.
Browser execution requires installed Chromium; it is not silently skipped by the
explicit command. Fixtures are synthetic source-contract probes, not forecasts.

## SHE-17 asynchronous tour controls

The existing 50-second presentation clock now exposes preparation separately
from playback. Pause and Restart remain enabled during preparation; pausing
retains intent when the recorded pair and graphics finish loading. Restart
clears that intent and starts a new generation at Month 0. A superseded request
cannot start the presentation. Failure exits preparation and leaves retry
available.

Optional `onDemoManual()` backs **Take manual control** during preparation or
playback. The coordinator also takes over on timeline, entity, WHY, mode and
ghost controls. Manual takeover invalidates pending autoplay and stops the
presentation clock; ongoing computation may finish and expose its recorded
comparison without starting the tour. Cancel run separately aborts computation.
The live caption explicitly identifies paused and manual states. The recorded
City model, seed, recipe, results and synthetic disclaimers are unchanged.

## SHE-36 cost and uncertainty disclosure

Cards explicitly describe WITH PLAN minus WITHOUT PLAN, cumulative capital cost,
and recorded housing units. The visible limits note identifies the single
shared-seed synthetic pair, uncalibrated assumptions, absent uncertainty interval
and lack of empirical forecast. Whole-stock mean rent caveats remain in place.
The adapter preserves each metric's `status`, explicit `available:false` and
reason; unrelated missing fields do not suppress a supported metric. Nonfinite
differences are unavailable even if both arm values are finite. No measurements,
seeds or persisted records are altered.

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

## Local continuation

The adapter exposes **Remember this comparison** only when a completed run is
ready, and **Clear saved comparison** even when saved data is invalid. Copy
explains the opt-in and the three locally saved fields. `onRemember` and
`onClearRecent` delegate storage and replay to the coordinator; `remembering`
and `recentMessage` render consent state and live feedback. This control never
persists pending seed/policy edits or simulation results.

## Visible comparison inputs (SHE-31)

The coordinator supplies `comparisonRecipe` and `comparisonInitial` from the
loaded history, independently of pending `recipe` edits. Both arm legends show
seed, horizon, starting population (sum of recorded Month 0 household sizes) and
household count. The plan lists intervention type/district, proposed homes,
illustrative USD cost, delay in months and compliance fraction (0–1); the baseline
lists no intervention and zero added homes/intervention cost. A null intervention
shows the same zero control for both arms. Zero values are displayed directly;
missing history is unavailable. Current-month population never replaces the
starting population. These are model inputs, not realized construction outcomes.

The adapter accepts optional `firstConstruction:{month,entity}` from composition,
which must verify an exact recorded completion receipt. At that positive month
only, a static comparison cue shows the measured homes delta (when finite) and
calls `onFirstConstruction()` for exact-entity inspection. It remains hidden at
Month 0, unavailable comparisons and other months; it adds no animation.

## SHE-22 acceptance follow-up (2026-11-12)

The current checkout already contains the integrated diff and interactive UI. This
bounded follow-up uses the shared `METRIC_UNITS` export and labels both comparison
arms **Identical starting state** at Month 0 only when an available comparison has
zero changed entities and finite, equal measurements with zero deltas. Missing or
divergent comparisons and later months retain the ordinary arm labels.

Acceptance evidence: `bun test test/future-machine-diff.test.js test/future-machine-ui.test.js`
passed 17 tests / 118 assertions, with one browser-gated test skipped. Seed 42's
actual engine fixture confirms first physical divergence at Month 16: one building,
24 homes and 1,000,000 cumulative USD. The explicit browser invocation
`HBL_FM_BROWSER=1 bun test test/future-machine-diff.test.js test/future-machine-ui.test.js`
failed before Chromium launch because `Bun.serve({port:0})` returned `EADDRINUSE`
in this restricted environment. New legend assertions, mobile/keyboard interaction
and integrated screenshots therefore remain pending browser verification; no new
screenshot is claimed. Coordinator-owned plan and shared interfaces are unchanged.

## Optional shared questions

`createChallengeCards(host,{getContext})` mounts three editable policy prompts
(homes, modeled rent, capital cost). Context supplies the displayed immutable
history and month, so pending seed/policy edits do not change the shared run.
Share controls require ready results. Generated anchors use a validated
`canonical-run-receipt.v1` in a `future-question.v1` URL fragment, with a
200-character question and a 120,000-character fragment bound. The receipt
includes synthetic evidence and the question is public to recipients; the panel
warns against personal information. Text renders through native text properties.

Opening validates query/receipt identity, recipe and selected month before
loading, then compares the complete regenerated receipt (including selected and
terminal outcome digests) before presenting results. A missing saved record,
changed rules, corrupt receipt or mismatched replay fails explicitly. Unlike
ordinary comparison links, challenge links never fall back to a new run. Replay
is manifest recomputation, not independently retained checkpoint verification.
Moving to another month removes the receipt fragment; returning to the challenge
month restores it. A new run clears the received question. Link preparation is
invalidated on edits, run/month changes and disposal; startup validation yields
to a subsequent run or cancel.

Verification: `bun test test/future-machine-challenges.test.js` and
`bunx playwright test --config test/future-machine-challenges.browser.config.js`.
The browser suite uses disposable City storage and the normal page/API entry.

## Curated City recipes (SHE-49)

The normal Future Machine page includes **Three playable what-if recipes**.
Each link uses the existing versioned share contract, preserves the selected
renderer, and starts a saved paired City experiment at Month 120. Small infill,
District expansion, and Housing after a wait vary supported housing scale,
district, cost and delay. The common seed is 42. Catalog assumptions and limits
are visible with each link; these are authored synthetic inputs, not forecasts.
The saved manifest and evidence export retain the actual recipe, generator,
model manifest, initial digest and replay limitations. Catalog metadata and local
recorded completion evidence are in `docs/evidence/she49-recipes.json`.

`bun test test/future-machine-recipes.test.js` checks deterministic replay,
immutable matched starts, share round trips and distinct completion records.
`bunx playwright test --config playwright.recipes.config.js` exercises each
normal catalog link on forced Canvas, timeline/blink, evidence download and
saved share/reload using an isolated temporary City store. Browser acceptance
remains pending if the local server cannot bind.

## Combined replay and control behavior (November 12, 2026)

The integrated coordinator keeps data-ready comparisons usable while graphics
finish loading. Pause during tour preparation survives the data and renderer
waits; restart resets pause intent, while manual takeover invalidates delayed
autoplay without canceling a useful pending comparison. Skip/replay, hidden-tab
time accounting, reduced motion, exact evidence anchors, rent decomposition,
Butterfly Ledger and the outcome chart remain composed on the same history.

The housing amount editor preserves the selected preset's other policy fields,
and changing presets resets its amount/validity. Month-0 matched-start labels
update only the arm headings, retaining the visible recorded A/B inputs beneath
them. Pending input edits never replace displayed-run provenance or share context.

A failed rerun retains the previous completed history: timeline, WHY and copying
or native-sharing that displayed pair remain usable, with the load error visible.
Retry retains the exact failed recipe/run/month or strict receipt/challenge;
receipt and challenge replay never fall back to a new experiment. Challenge
hashes survive retry and are restored only at their verified selected month.
Explicit shared links take precedence over demo entry, and `?demo=1` takes
precedence over opt-in recent context. Only bare entry resumes recent context.
Local storage retains no question text or first-play events.

First-play records remain bounded to seven first-only milestones in page memory.
Closed, validated actions made while graphics are pending retain their action
time and settled share result until a measured backend is available. Disposal
clears deferred records. City 1.1.0 facts use explicit event v2, while legacy v1
validation remains restricted to City 1.0.0; no historical fact is relabeled.

`discovery-quest.js` mounts the optional session-local three-step quest. The
coordinator explicitly marks successful user-requested runs; automatic replay or
demo loading cannot start it. Manual timeline/director visits and exact-entity
inspection consume the same monthly diffs as the scene. Native quest buttons
visit and inspect the recorded target, and hide/show preserves progress. An
unchanged comparison leaves discovery unavailable with an explicit explanation.
If the visitor explores another month after visiting the target, Inspect quest
entity explicitly returns to the recorded target month before selecting it and
announcing that month. Completed progress never leaves an enabled no-op action.

## Canvas year shortcuts

With the city canvas focused, Page Up advances 12 months, Page Down retreats
12 months (bounded to Months 0–120), and D jumps to the first available recorded
entity difference, including policy and nonphysical changes. A comparison with
no divergence announces that state without moving. Keys stop playback through
the coordinator's manual selection path. Text controls, modified shortcuts,
composition and loading are ignored. Arrow keys retain camera navigation.

## SHE-88 reset

`onReset()` and `originalRecipe` are additive coordinator contracts. The original
is the page-entry shared/resumed recipe or DEFAULT_RECIPE and remains fixed across forks.
Reset to original clears invalid seed text and restores the complete detached
recipe, including null policy and nonvisible fields. It does not run a simulation.
The coordinator preserves displayed history, provenance, evidence export and share
URL until Fork City completes a replacement. Reset is disabled while busy and
without an onReset callback. Reloading a shared comparison establishes that
comparison's recipe as the new original.

## SHE-85 provenance

Each comparison card has a category badge, native category/source tooltip and
expandable source detail (keyboard Enter/Space or touch activation). The lower-level
view accepts optional `metric.provenance:{category,source,limitation}`. Categories
are observed, synthetic and modeled; absent/unknown metadata stays explicitly
unavailable. The City adapter labels engine outputs modeled with synthetic,
uncalibrated inputs; recording a model output never makes it an empirical
observation. The retained selected chart point title and persistent note use the same
source description. Numeric formatting and stored records are unchanged.


## Simulation explanation (SHE-116)

The native **How this simulation works** disclosure is mounted beneath the header
by both UI factories and remains available in idle, loading and error states.
It covers the synthetic monthly City scope, generator assumptions, metric caveats,
matched seeds, version constraints, share fallback and recomputed replay limits.
Supporting links open an audited repository revision in a new tab with an explicit
label. The panel does not compute outcomes or use pending configuration as run
provenance. Native summary keyboard behavior and wrapping are covered by the
opt-in Chromium test; this workspace could not execute that test because its
local server bind was rejected (EADDRINUSE).
