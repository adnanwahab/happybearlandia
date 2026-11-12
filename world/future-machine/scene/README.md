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
