# Future Machine scene

`createStage(container, {onSelect})` implements the frozen scene API in `../INTERFACES.md`. It accepts the coordinator's paired snapshots, never runs a model, and never mutates records. Native imports are lazy; the host must map `three` to `/vendor/three/three.module.js` and `three/addons/` to the same installed version's addons.

One camera and one WebGL renderer render both arms with matching scale and viewport proportions. `setMode('baseline'|'plan')` provides A/B blink; `split` restores comparison. `setGhosts(true)` shows wireframe inventory present only in the other arm. The coordinator owns playback/month changes and blink timing. `focus({collection,id})` highlights and focuses only a currently rendered exact City building/project ID, returns false otherwise, and does not invent a household location. Selection callbacks carry exact collection, ID, and arm. ResizeObserver resizes the stage; the native effects loop is disposed with the stage; Canvas draws on demand. Disposal releases geometries, materials, renderer, controls, observers and listeners, including during deferred imports.

## Geometry and assumptions

Sourced footprints require a City building's own `source:'osm'`, nonempty sourceId, finite closed GeoJSON Polygon with one ring, and unique source identity within each arm. Coordinates are projected into local metres from one persistent origin. Holes, unsupported or ambiguous geometry use the separate schematic inventory rather than an incorrectly sourced footprint. Project parcel links do not establish a construction footprint: inferred parcels may merely proxy an existing building. No arbitrary cross-model identity join is performed.

Unlocated City buildings and active housing projects use stable session slots in an explicitly labeled **synthetic layout**. When mixed with sourced footprints the schematic sits beyond their eastern extent, rather than overlaying an unrelated real building. Synthetic slots are nongeographic and are not an exported entity location. Slots persist through scrubbing within a stage; create a fresh stage when replacing the entire experiment. Rendered building heights use an explicitly illustrative 3 metres per recorded floor. The scene does not infer unit density, roads, residents, landscaping, or causal mechanisms. Unfinished housing projects appear as schematic markers; their recorded progress/duration ratio appears in the selectable inventory. The stage now presents an explicit recorded work gauge and stage label; it never grows unfinished floors from this ratio. Layoutv2 reuses the exact model-owned housing project/building schematic slot.

The physical-difference message concerns recorded building presence, footprints, and floors. Scalar project changes alone do not claim a physical building difference. The diff/HUD can separately report supported links or other metrics. Missing snapshots clear the scene. Failed Three loading, WebGL creation, or context loss leaves selectable recorded inventory available with a visible 3D-unavailable message.

## Acceptance evidence

`bun test test/future-machine-scene.test.js`: 9 passing tests / 22 assertions, including zero differences, additions/removals, stable slots, immutable inputs, sourced/ambiguous/unsupported geometry, mixed layout separation, recorded progress, missing records and mismatched months.

A temporary localhost harness exercised the module in Chromium with the installed Three 0.186 import map: split stage produced six GPU meshes (including ghosts); selection, plan mode, ghost disable, known/unknown focus, missing-frame update and repeated disposal passed without page errors. A second run forced `getContext()` to return null: selectable inventory, identical host controls and disposal passed without page errors. This is module smoke evidence, not verification of the coordinator's final application route or hardware performance. No production changes were made.

## Remaining integration checks

Coordinator should run the real route with City replay data and verify UI-to-stage wiring, responsive framing, director focus, and 120-month playback. Large imported geometries and Safari/device performance are unmeasured. Current integration uses bounded native WebGPU→WebGL→Canvas rendering, then accessible inventory if all contexts fail. AppleMetal native and desktop390/320 Canvas journeys are verified in the sprint status; Safari/device performance remains unmeasured.

## Retained native rendering (SHE-216)

Native meshes and their effect state persist by `arm:collection:id:ghost` across
monthly updates, focus, and mode changes. Missing entities release mesh, edge,
gauge and effect resources immediately. Recorded height/footprint changes replace
only that entity's geometry; the same mesh supports the recorded-height tween.
New buildings appear at their full recorded height. Project gauges reuse their
geometry and scale the work bar independently of building floors. Native labels
are keyed and reused; label widths are measured only when text, emphasis or viewport width changes. Difference
mode hides unchanged retained inventory. `getStats().draws` counts native stage
draws; target diagnostics include mesh identity, recorded box height and scale.
Effects finish with a final draw and settle after900ms without pulse resets on
unchanged monthly rows. Canvas reports the same `LAYOUT_VERSION` as the mapping.

Focused unit regressions pass; the added normal-route native browser regression
is pending because local server startup returned EADDRINUSE on three ports.

Graphics readiness is independent of comparison readiness: `update()` immediately
renders the selectable inventory. Three and OrbitControls imports share a
10-second deadline, followed by the existing bounded backend setup or
Canvas/inventory fallback. Late imports after the deadline are ignored. Pending
entity focus is applied when a camera attaches; framing uses the full history,
not the month at which graphics happened to finish. `whenReady()` resolves on
backend/fallback readiness or disposal; it must not gate ordinary data controls.

## SHE-23 follow-up (2026-11-12)

The supplied workspace already contains the integrated paired renderer rather
than only the pinned coordinator skeleton. This bounded follow-up preserves that
implementation and the frozen contracts. Scene ownership excludes the shared
implementation plan, so the work record and integration handoff live here.

Acceptance slice: label recorded building changes accurately, explicitly mark
schematic entities unlocated, clear native overlays and Canvas inventory when
snapshots disappear, and deliver only exact entity identities from mesh picks.
Raycasting ignores decorative child edges and construction gauges; inventory
buttons retain keyboard access. No City simulation or metric contract changed.

Verification: `bun test test/future-machine-scene.test.js
 test/building-renderer.test.js test/future-machine-effects.test.js` passes
25 tests / 100 assertions. Includes matched month-zero geometry, stable slots,
zero-change effects, reduced motion, material cleanup, missing snapshots,
exact inventory selection, idempotent disposal, and changed/removed label cases.
`git diff --check` passes. The new stage lifecycle test uses a DOM double;
it does not verify browser pixels, Canvas clearing, resize, or GPU picking.

Reproduced synthetic recipe:
```json
{"schemaVersion":"future-machine.v1","modelVersion":"city-systems.1.0.0","seed":42,"households":30,"months":120,"intervention":{"type":"housing","districtId":"d1","amount":24,"cost":1000000,"delay":0,"compliance":1}}
```
The actual engine test finds first physical divergence at month 16, building
`building-project-policy-1-0`, and +24 homes / 1,000,000 illustrative USD
cumulative capital expense at month 120. These are modeled results.

Browser handoff remains pending: both attempted local server launches (ports
39823 and 41873) failed with `EADDRINUSE`. No new screenshots, browser WHY click,
resize check, measured FPS or GPU memory readings were obtained in this run.
Coordinator should capture month 0 and month 16 on the normal application route,
click the changed structure through WHY, and verify missing-frame clearing in
both native and forced `renderer=canvas2d` modes. Existing historical evidence
above is not a measurement of this follow-up. No release or deployment occurred.

## Comparison camera bookmark (SHE-94)

The stage exposes native **Save view** and **Restore view** controls. Both arms
render through the same camera, so restoring applies the same target, orbit
position, rotation quaternion and zoom to both 3D panels. Canvas restores its
shared x/z target and zoom; its orientation is fixed. Camera bookmarks do not
change the selected month, comparison mode, run data or share URL.

`saveCameraBookmark()` / `restoreCameraBookmark()` return false when unavailable.
`getCamera()` returns a detached snapshot; 3D snapshots now also include
`quaternion` and `zoom`. Optional `onCameraInteraction()` lets the coordinator
stop its guided tour/playback before either bookmark action. Saving freezes an
active focus transition at the current pose; restoring cancels that transition.
One bookmark lives in the current stage only, is replaced by another save, and
clears on a new comparison, reload, disposal or GPU-to-Canvas fallback. Inventory
fallback has no camera bookmark. Controls announce save/restore status and are
disabled before graphics/frame readiness or before a first save.

`bun test test/future-machine-bookmark.test.js` exercises the real stage with a
DOM/Canvas adapter, including replacement, detached state, timeline/mode changes,
missing frames, disposal and inventory fallback. The route-level Playwright test
is `test/e2e/future-machine-bookmark.e2e.js` (Canvas and WebGL); execution requires
a host that can bind the application servers.

## SHE-74 verification — November 12, 2026

Historical verification of `b963dd3` and City 1.0.0; these measurements do not
replace the later integrated City 1.1.0 evidence above.

The assignment's scene/effects implementation is already integrated in this
checkout; this verification does not introduce a second implementation or change
the City model or shared interfaces.

- `bun test test/future-machine-scene.test.js test/building-renderer.test.js`:
  17 passed, 0 failed, 46 assertions.
- `bun test test/future-machine-effects.test.js test/future-machine-construction-progress.test.js`:
  11 passed, 0 failed, 87 assertions. These exercise changed-entity effects,
  reduced motion, material cleanup, exact project/building identity, and recorded
  construction observations against the actual monthly engine.
- The synthetic seed-42 housing recipe (30 initial households, 120 months,
  district `d1`, 24 homes, 1,000,000 illustrative USD, delay 0, compliance 1;
  model `city-systems.1.0.0`) first produces
  `building-project-policy-1-0` at Month 16. The model-backed effects test
  verifies the +24-home delta. Month 15 records 11/12 construction work and
  no completed building; Month 16 records completion and actual inventory.
- Attempted the existing Playwright paired-run, shared-camera/click, and
  reduced-motion divergence tests with the one-city-two-futures configuration.
  The server exited before browser execution with `EADDRINUSE` on both ports
  39974 and 49974. No fresh screenshots, click/resize verification, FPS or GPU
  memory measurements were obtained. Earlier browser evidence above remains
  historical evidence, not a result of this verification.

Integration follow-up: rerun those browser checks in an environment where the
isolated server can bind, retaining Month 0 and Month 16 screenshots and the
exact-ID selection evidence. No release or deployment was performed.

## Exact construction previews (SHE-159)

The month immediately before a recorded policy-owned housing PROJECT_COMPLETE
shows a separate wireframe/dashed preview of the next snapshot's building.
This is a rendering preview, never current inventory or a predicted outcome.
The inventory button names its exact event ID and policy ID and opens that
completion month and building's WHY evidence. Both adjacent snapshots, an exact
project/building mapping, recorded event time and actual absence/presence are
required. Preview meshes are nonselectable; the explicit button works in native,
Canvas2D and inventory-only fallback. The Ghost differences toggle controls
preview geometry. Current support covers housing creation only; modifications
without an explicit model-owned event/identity contract remain disabled.

Integration keeps preview meshes under distinct retained keys from recorded
inventory and other-arm ghosts. The explicit completion action carries its
arm, event ID and month; the coordinator verifies that exact receipt before
manual navigation, URL update and selected-month announcement. Canvas legends
identify next-month previews separately from current recorded changes.

## Replay ownership audit (SHE-106)

A stage owns its meshes, edge buffers, project gauges, grid buffers/materials,
renderer, controls and effects. Rebuild disposes the prior mesh trees; effects
first restore the original materials and dispose their private clones. No
textures are created by the current inventory scene. The disposal helper handles
shared geometry/material/map references once within a tree, including material
arrays. It is for stage-owned assets, not externally cached textures.

Fallback now releases both scene grids as well as inventory, removes the context
listener and relinquishes the WebGL context. Normal disposal does the same and
clears frame/projection/camera-fit references; deferred renderer completion also
relinquishes its context. Missing frames clear the Canvas projection and labels.
No City rules, recipe, persistence contracts or model outputs changed.

Reproduce the acceptance test with:
`bunx playwright test --config test/future-machine.browser.config.js --grep SHE-106`.
It runs 30 sequential Fork City actions at seed 42 using the default versioned
synthetic recipe, compares SHA-256 of both complete normalized histories and
seed/model version, and samples Chromium heap after explicit CDP garbage
collection at Month 120. Proposed bound: every sample <= first warmed sample +
32 MiB; geometry and texture counts must remain equal to the first run. The JSON
attachment records every sample and digest. Counts are allocation diagnostics,
not GPU byte measurements; this local default-recipe check makes no Safari,
WebGPU, maximum-recipe or physical-device claim.

Verification in this restricted checkout: 38 focused tests passed, 1 opt-in
Chromium test skipped (215 assertions). Browser acceptance is **unverified**:
Playwright's server initially resolved an uninitialized package-local Bun; a
throwaway configuration selecting installed Bun then failed to bind both ports
39884 and 39986 with EADDRINUSE (no listener observed on 39986). Temporary
configuration was removed. No 30-replay heap measurement or passing browser
result is claimed. Run the above test on a host able to start the isolated
server before considering the issue accepted.

Integration preserves the retained mesh/effect cache, keyed labels, exact
construction previews, camera bookmarks and quality/media controls. Resource
release now clears both scene trees and owned contexts on fallback/disposal;
disposal also drops the history reference. The thirty-run test waits for actual
WebGL readiness and hashes normalized model frames separately from each newly
allocated experiment identity. Per-run experiment IDs remain in its evidence.
