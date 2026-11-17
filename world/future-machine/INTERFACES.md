# Frozen Future Machine interfaces v1

Published by integration owner 2026-11-11. Implement these exports in each owned directory's `index.js`; extra exports/files are allowed. Relative import `../contracts.js`. No cross-worker imports required: coordinator composes modules. This file and contracts.js are coordinator-owned. Browser native ESM; Three via import map `three` -> `/vendor/three/three.module.js` and `three/addons/` -> `/vendor/three/addons/`.

## Shared records

Recipe: DEFAULT_RECIPE shape in contracts.js. Only bounded synthetic initial generator v1: seed uint32, households 1–120 (demo default 30), months exactly 120, current modelVersion, intervention null (zero diff) or one validated City intervention. No arbitrary input URL state. Units in METRIC_UNITS. Calendar is illustrative January 2026 at month 0, January 2036 at month 120.

Snapshot: `{month,state,metrics,events,causalRecords,decisions}`. state is exact monthly CityState, metrics from cityMetrics plus `capitalSpending` cumulative `state.systems.finance.capitalExpense` (the top-level finance accumulator is reset); events/causalRecords/decisions are arrays (empty at 0). Do not infer missing records. Month 0 is pre-intervention common initial state; apply intervention before first step, so policies differ only in subsequent snapshots. Paired history: `{schemaVersion,recipe,experimentId,initialHash,modelVersion,seed,baseline:[121 snapshots],plan:[121 snapshots],provenance}`. Replay is recomputation from stored manifest, explicitly labeled; no independent recorded-checkpoint equivalence claim without verification. Initial hash must be stable canonical content digest. State/records treated read-only by consumers.

Pair frame: `{month,baseline:Snapshot|null,plan:Snapshot|null}`. Missing snapshots/metrics remain null/unavailable, never zero. Stable IDs scoped to monthly City; do not link House/Population identities. Synthetic scene positions are schematic only, never latitude/longitude.

Diff frame: `{month,available,entities,metrics,physicalCount,changedCount}`. entities is array `{collection,id,kind:'added'|'removed'|'changed',before:object|null,after:object|null,changedFields:[string]}`. metrics is object keyed metric `{baseline:number|null,plan:number|null,delta:number|null,unit:string}`. delta B-A. Physical count refers buildings/links only. Distinguish physical changes from scalar/household changes. No unsupported causality.

## data/index.js

- `createExperiment(recipe=DEFAULT_RECIPE,{signal,onProgress}={}) -> Promise<History>`: use existing POST city API, poll completion, replay both arms. One run each, 120 steps, common original, matched seeds. Progress callback `{status,message}`. Persisted experiment ID returned.
- `loadExperiment(experimentId,{signal,onProgress}={}) -> Promise<History>`: validate saved manifest, replay both scenarios and normalize 121 snapshots.
- `validateRecipe(recipe) -> Recipe`: reject unsupported versions, unbounded inputs.
- `getFrame(history,month) -> Pair frame`.
Pure normalization helpers and optional local engine helper permitted for tests. Bound in-memory histories to current pair; requests cancellable and deadline bounded. Do not alter City engine/API shared files.

## diff/index.js

- `compareFrame(frame) -> Diff frame`.
- `compareHistory(history) -> Diff frame[121]`.
Exact stable IDs, additions/removals, finite measurements, missing data; deterministic ordering. Exclude provenance-only revision from physical claims.

## scene/index.js

- `createStage(container,{onSelect}={}) -> stage`.
- `stage.update(frame,diff)`; `stage.setMode('split'|'baseline'|'plan')`; `stage.setGhosts(boolean)`; `stage.focus({collection,id}) -> boolean`; `stage.dispose()`.
- Optional `stage.getStats()` measurement object.
`onSelect({collection,id,arm:'baseline'|'plan'})`. Shared camera and scene scale. Explicit synthetic layout legend; only exact building IDs and supported parcel relationships for ghost location. Unknown mapping unlocated. Keep bounded GPU objects, handle resize, cancel RAF/dispose listeners/resources. Render fallback when WebGL unavailable.

## ui/index.js

- `createUI(container,callbacks={}) -> ui` creates controls, stage and story mounting containers. `ui.stageElement`, `ui.storyElement` DOM nodes.
- callbacks `onRun(recipe)`, `onMonth(month)`, `onPlay(boolean)`, `onMode(mode)`, `onGhosts(boolean)`, `onDirector()`, `onShare()`, `onExport()`.
- `ui.update({status,message,recipe,month,playing,mode,ghosts,frame,diff,experimentId,shareURL,error})`; `ui.dispose()`.
Partial updates allowed. Run button text Fork City; timeline label Month; accessible native controls. Controls disabled while data is loading, cancel/retry error clear. Data-ready comparisons remain usable while graphics load; the guided demo waits for stage readiness. UI owns CSS in ui/. Show units, synthetic assumptions, unavailable metrics, no physical difference. Coordinator handles playback timer. Share link visible when shareURL provided.

## story/index.js

- `buildStory(history,diffs) -> {stops:[Stop],summary,limitations:[string]}`; Stop `{month,title,summary,entity:{collection,id}|null,evidence:[object]}`. First then largest supported divergence, deterministic bounded stops.
- `describeSelection(frame,diff,{collection,id,arm}) -> {title,summary,evidence:[object],limitations:[string]}`.
- `renderStory(container,description,{onJump}={}) -> disposer function` accepts story or selection. onJump(stop). Recorded events and narrative interpretation separately labeled; no fabricated causal edges. Household cards use exact IDs and observed B-A fields.

## share/index.js

- `encodeRecipe(recipe) -> string`; `decodeRecipe(string) -> Recipe` (strict bounds and model validation).
- `createShareURL({recipe,experimentId,month},baseURL=location.href) -> string`; `parseShareURL(url) -> {recipe,experimentId,month}|null`. Use search keys `fm`, `experiment`, `month`. fm is encoded recipe; experiment optional saved record. Preserve same route; exact selected month. Invalid supplied context throws explicit error.
- `createEvidenceReport(history,{month,diff,story}={}) -> JSON-serializable object`.
No server write required: versioned bounded recipe supports rerun if saved record unavailable; coordinator must visibly label fallback. Export recipe/provenance/model/initialHash and limits; never pretend recomputation is independent replay verification. Include demo storyboard as owned Markdown if useful.

## Composition and ownership

Coordinator owns main.js, HTML, homepage, server/config, plan and integration tests. Workers own data/, diff/, scene/, ui/, story/, share/ respectively and matching tests. Do not commit copied frozen files in worker branches. Integration order data+diff, scene+UI, story+share. Modules must import cleanly in Bun when pure; DOM/WebGL creation deferred to factory invocation. No production deployment or production data changes.

Integration clarification: the data generator `future-machine-synthetic.v1` declares private parcel capacity zero, utility capacity 200 per district/network, and annual growth zero. These assumptions must be visible with results. Optional UI callback `onCancel()` cancels browser work; submitted City jobs may still finish in storage.

## One City, Two Futures presentation additions

The monthly City contract and stored recipe are unchanged. `createUI` adds `onDemo()`, `onDemoPause()`, `onMetric(metricKey)`, and `onMode('difference')`; update accepts `demo:{status,paused,caption,elapsedMs}` and `provenance:{seed,modelVersion,experimentId}`. Prominent cards use homes, mean unit rent (including new inventory), and cumulative capital expense; link travel remains in raw evidence rather than implying a material commute benefit.

`createStage(container,{onSelect,history})` accepts optional complete paired history for a stable camera fit that includes all recorded structures. It exposes `getCamera()` and `getStats().camera/targets`; both WebGL halves use the same camera. Difference-only filters actual changed entity IDs. The Canvas renderer receives the same projection and diff and preserves its shared orthographic camera across time. `renderer=canvas` explicitly selects low fidelity; WebGL failure switches automatically. Canvas style differs from 3D; no output metrics or identities change.

The 50-second `demo-controller.js` is a presentation clock, not a simulator. It selects only stored/recomputed monthly frames, pauses/resumes elapsed time, highlights the first recorded building divergence, and returns to manual exploration. `evidence.js` uses the City-owned `housingProjectBuildingId` function to join completed structures to recorded project completion events through the selected month. Historical receipts remain labeled with their actual event month. No Population/House identity or arbitrary geographic join is introduced.

## Approved follow-up presentation contracts

- `createStage(container,{onSelect,history})`: optional history pre-registers stable schematic slots and fits full recorded inventory without rendering future entities. `whenReady()` resolves measured backend readiness. `focus(entity,{animate=false})` reuses one camera in both views; reduced motion is immediate. `resetCamera()` restores deterministic demo framing. `getStats()` reports measured backend/reason/resources. Native WebGPU is rendering only; City CPU simulation remains sole authority. Explicit WebGL/Canvas modes and accessible inventory fallback remain supported.
- `createOutcomeTimeline(container,{history,onMonth}) -> {update(month),dispose()}` consumes the same immutable121snapshots. Point/keyboard selections emit integer recordedmonth through coordinator manualMonth; no independent clock/simulation. Metric units from METRIC_UNITS; unavailable measurements stay gaps.
- `recordedConstructionProgress(snapshot)` returns recorded stage/work/units and exact model-owned housing-project building identity. Work ratio is not elapsed calendar fraction or completed housing. Actual inventory determines building presence; layoutv2 preserves one schematic slot across supported project completion.
- `buildEvidenceTrail(history,{collection,id,month})`: arm-scoped nodes/edges contain exact record, first observed month, eventID and unavailable reasons. `renderEvidenceTrail(container,history,selection,{onJump})` presents those records. Completion jumps retain building selection; all evidence jumps stop demo presentation. Independently verified causal dependency traces are explicitly unavailable.

Address-bar synchronization occurs on initial load, manual seeks, pause/stop,
completion and share, never on automated monthly frames. Share computes its URL
from the current displayed frame. Browser history failures leave rendering and
inspection usable. Explicit renderer=canvas or canvas2d bypasses Three and
OrbitControls loading entirely.

SHE-215: `diff/index.js` exports `firstDivergence(history,diffs) ->
{month,entity:{collection:'buildings',id}}|null`. It uses the scene's exact mapping,
earliest paired month and exact ID ordering. Demo and first physical story stop
share it. The director exposes `setHidden(boolean)` to exclude hidden-tab time
while retaining manual pause. Caption text and elapsed seconds are separate DOM
nodes; only caption text belongs to the live region.

## Opt-in local continuation

`recent.js` reuses strict share validation and owns only
`hbl.future-machine.recent.v1` in browser localStorage. Its `readRecent`,
`saveRecent`, and `clearRecent` functions accept a Storage object and propagate
storage/validation errors for visible feedback. The JSON contains exactly
`{recipe,experimentId,month}`. No full URL, account, resident, observation,
result, or private text is retained. Recipes remain the bounded synthetic v1
contract. There is no time-based expiry; incompatible versions fail explicitly.

`createUI` adds `onRemember()` and `onClearRecent()` callbacks, plus
`remembering` and `recentMessage` state. Remember is available after a completed
comparison. That choice enables subsequent completed-run/month updates on this
browser. Unrun input edits do not change the saved recipe. Bare entry resumes
local context; explicit comparison links take precedence and update the recent
reference if consent is already active. Missing records follow existing labeled
recipe recomputation. Clear removes only the local reference, disables further
writes, and leaves the displayed comparison and server records available.
Storage errors are announced; failed removal does not falsely claim success.

### SHE-157 cross-scale shot

The director emits `onShot({month,entity,scale})` at the first physical divergence:
`neighborhood` at reveal and `building` three presentation seconds later. Both
use the held exact monthly frame; skipped holds do not emit shots at a later month.
`focus(entity,{animate,scale})` frames the same exact entity with wider schematic
context or a building close-up; both arms share the camera. Neighborhood framing
is presentation context, not geographic evidence. Canvas uses immediate shared
orthographic framing; reduced-motion native rendering also moves immediately.
The Automatic camera checkbox suppresses demo camera reset and both shots and
cancels an active transition. Evidence inspection still runs when it is disabled.
No shader/effect changes or new simulation state are introduced.

`stage.setQuality('standard'|'power-saving')` selects a session-local rendering resolution cap (Standard: existing 1.5 GPU / 2 Canvas DPR cap; Power saving: 0.75). The native Rendering quality selector is always above the scene, including Canvas fallback. `getStats()` reports `quality` and `pixelRatio`. The Canvas adapter's `setPixelRatio(number)` resizes only its backing buffer and preserves camera and inventory. Presets do not touch simulation timing, histories, receipts, recipe or shared URLs; actual energy savings depend on the device and are not measured.

## Optional first-play diagnostics (SHE-103)

`diagnostics.js` owns the release constant `APP_VERSION` and the strict
`hbl.first-play-diagnostic.v1` allowlist. Update that constant when shipping a
new app revision. Bundle fields are schemaVersion, appVersion, renderer,
errorType and traceId only. Renderer is a measured backend enum (unknown at
boot); error type is a call-site category, never an exception name or message.
Trace IDs are random local 128-bit IDs and have no server correlation contract.
No URLs, stack traces, recipes, input, timestamps, device strings or remote
collection. Preview is read-only; checkbox consent gates clipboard writes and
resets on each failure/retry. Clipboard denial selects the report for manual
copy. Entry points cover boot import/initialization, comparison and invalid
share failures. Module download failure before diagnostics loads still requires
browser refresh; successful renderer fallback is not an application failure.

## Snapshot integrity extension (SHE-86)

Persisted adapter snapshots additionally carry `identity: {experimentId,
scenarioId,runIndex,runId}` verified against the City replay response. The run ID
is `${scenarioId}-${runIndex}`, scoped to `experimentId`; Future Machine uses
baseline/plan index 0. Month 0 states are identical with distinct arm identities.
Persisted histories require all 121 snapshots in order with matching state
month/seed/model and exact arm identities before rendering. The stage validates
history at construction and frame identity/clock compatibility at update. Missing
unpersisted diff inputs remain unavailable. Replay responses without the identity
envelope are rejected, so frontend/backend releases must be coordinated.

Canonical receipt v1 retains its existing simulation snapshot digest semantics:
the new top-level transport identity is validated by the full history integrity
check, then excluded from selected/terminal hashes. The receipt's experiment,
scenario, seed/model and saved-outcome verification remain strict. This preserves
previously exported City 1.1 receipts without excluding any recorded simulation
data or changing the receipt version.

## SHE-98 permalink preview extension

`createShareURL` accepts optional `landing:{version:1,mode,ghosts,camera}`;
`parseShareURL` returns it when supplied. The bounded JSON `landing` query key
rejects duplicates, unknown fields, unsupported versions and nonfinite/out-of-range
camera values. Existing links remain supported. Camera is null (unavailable),
Canvas `{x,z,zoom}`, or perspective `{position:[x,y,z],target:[x,y,z]}`.
`stage.setCamera(camera)` restores a compatible representation after `whenReady()`;
false means unsupported renderer, which the coordinator visibly discloses.

Preview comparison link pauses presentation and opens a focused preview of a detached
URL/context from the displayed history, excluding pending recipe edits. UI state
`sharePreview:{url,context}` and callback `onCopyShare()` expose a separate explicit
copy action. Subsequent exploration retains that exact preview until Preview comparison link is
clicked again; starting another run clears it. Opening a link restores view,
ghosts and camera after scene readiness and lands paused. Camera compatibility
across Canvas and perspective renderers is not asserted.

Direct Copy comparison link and optional native Share comparison remain available.
Preview uses onPreviewShare and its explicit copy shares the settled-result telemetry
and clipboard failure handling. Camera bookmarks retain their full local pose; v1
permalinks deliberately serialize only perspective position/target. Shared camera
restoration waits for graphics and yields to intervening manual input. Pausing or
taking over freezes any active camera shot; actual camera gestures take manual
control, while programmatic focus/restoration never trigger takeover.

Optional follow-up: `follow-up.js` offers one housing revision per page session
when a ready replay reaches Month 120. `followUpRecipe(recipe)` validates inputs
and returns a recipe with 12 more proposed homes and proportional rounded budget,
or null when unsupported/out of bounds. It preserves every other recipe field.
`createFollowUp(root,{onAccept})` owns accept/dismiss controls and disposal; main
reruns via the existing paired API. Both added and total illustrative costs and
synthetic scaling assumptions are visible. Dismissal lasts for the loaded result;
reload can offer again. Acceptance consumes the page-session offer. The existing
saved result is immutable. No recipe schema or multiple-policy support is added.

## Local demo performance diagnostic

`window.futureMachine.stats.demoTiming` is null until a successful Play Demo
attempt has valid paired history, a ready graphics backend and a visible canvas
across two animation frames. Then it exposes `{version:1,source,renderer,state,
durationMs,endpoint:'visible-city-after-paint'}`. Source is `homepage` or `button`;
state is `cold` (needs default history) or `warm` (history reused), independent of
HTTP cache. Duration includes offscreen/hidden waiting. This paint-opportunity
proxy does not claim a GPU presentation timestamp. Inventory-only fallback does
not count. Values stay local; the only session storage is a single-use homepage
click timestamp with a 60-second handoff lifetime. No upload or identifiers.

Timing integration: warm reuse requires a ready default comparison. A failed or
pending run starts a fresh bounded attempt. Manual takeover and disposal cancel
measurement; terminal inventory fallback settles without a graphics timing result
or continued paint polling. Storage acquisition is inside the optional-storage
failure guard. The shared visibility/readiness rules do not treat initial preview
inventory as a completed paired comparison.
