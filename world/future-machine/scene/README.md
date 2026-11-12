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
