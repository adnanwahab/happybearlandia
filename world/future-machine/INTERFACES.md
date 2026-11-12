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
Partial updates allowed. Run button text Fork City; timeline label Month; accessible native controls. Controls disabled while loading, cancel/retry error clear. UI owns CSS in ui/. Show units, synthetic assumptions, unavailable metrics, no physical difference. Coordinator handles playback timer. Share link visible when shareURL provided.

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
