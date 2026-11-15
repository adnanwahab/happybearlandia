# SHE-789: rendering-only WebGL2 fallback

The user's latest November15 instruction restores a **WebGL2 city viewer only**,
without the simulation. It supersedes the earlier blanket WebGPU-only graphics
policy. The full playable World still requires native WebGPU; Canvas2D renderer
fallbacks and their simulation adapters remain removed. The requested explicit
2D tile map remains a separate game view.

## Normal entry and state boundaries

`renderer-entry.js` first checks `renderer=webgl2` or unavailable WebGPU. Those
paths redirect to `static-city.html` before importing the full game. When GPU is
present, the entry initializes the native renderer before importing `render.js`;
an adapter/device failure or8second timeout redirects to the same city viewer.
The native renderer is passed once via `hblPreparedWorldGraphics`, consumed and
deleted by the coordinator's `render.js` hook. Late timeout/pagehide results are
disposed. Errors after the game module starts are normal game recovery errors,
not grounds for silently replacing a running simulation with another authority.

The standalone page imports standard Three.js WebGLRenderer and OrbitControls,
with an explicit WebGL2 context. Its import map uses `three.module.js`, not the
full game's WebGPU-only Three bundle. It imports no simulation/runtime code.
The geometry adapter reuses `buildTown` with maxPeople0, then strips mutable
building state and exports only footprint/road geometry, map origin and source.
It creates no residents, workers, model clock, needs, gameplay controls or replay
claims. There is no animation loop: draw occurs on camera changes, resize,
selection and fit. Idle drawing is asserted to remain unchanged.

The viewer offers orbit/pan/zoom, city fit (including narrow-screen aspect and
tall buildings), building picking and an accessible inventory. It draws supplied
footprints, parks and road polylines. Road widths, heights and uses may be
illustrative and are labeled. Procedural geography is identified explicitly when
real-map coverage is absent. OpenStreetMap geometry retains source attribution.

All query/hash context is preserved across redirection. For saved experiments,
the page fetches the saved base geometry and recorded origin, and prominently
states **not a checkpoint replay**. It never restores actors, model time,
outcomes or edits. Missing/invalid saved geometry shows an error and does not
start a replacement city. A Try the full game link retains the original context
while removing the viewer's rendering flags. No raw adapter exception is put in
a URL. Text is rendered via textContent, not injected HTML.

## Files and integration

New: `world/static-city{,-model}.js`, `world/static-city.html`,
`world/static-city.css`; changed `world/renderer-entry.js`. Coordinator owns the
small prepared-renderer hook in `world/render.js`. No simulation rule or ODD
state authority changes. Native factory remains strict WebGPU and is reused.

Tests: `test/static-city.test.js`, `test/e2e/static-city.e2e.js`,
`test/e2e/static-city-native.e2e.js` and two focused browser configs.
Use a running local server; configs honor `HBL_LAUNCH_TEST_URL` (default39972).

## Actual verification

-4 pure geometry/route tests,25 assertions: deterministic footprints, no resident
  records or mutable simulation state, preserved experiment/geographic context,
  invalid coordinates, exact saved synthetic footprint and unchanged inputs.
-6 native factory tests,13 assertions remain passing: strict native backend,
  partial cleanup, wrong backend rejection and null/error recovery.
- WebKit render-only browser suite: final result recorded below. Checks include
  actual WebGL2 version, explicit and automatic unavailable-GPU routing, null
  adapter rejection, desktop/mobile geometry selection, demand-driven idle,
  zero Worker constructions, no sim.js/render.js/population/playback requests,
  absent simulation globals, saved-preview success and missing-save failure,
  and explicit missing-WebGL2 retry state.
- Chrome native smoke passed: full ordinary game still reports webgpu, its game
  observation API is present, only one requestAdapter occurs, and prepared
  graphics are consumed/deleted.1 passed in4.1seconds.
- Desktop and390px screenshots visually inspected. A fit-camera issue exposed by
  the first phone screenshot was corrected using the narrower horizontal/vertical
  field of view. No physical-phone or old-device performance claim is made.

Final WebKit run: **7 passed in7.5seconds**, zero failures. Focused pure/native
unit run: **10 passed,38 assertions**. Browser bundle and whitespace checks pass.
Artifacts: `artifacts/she-789/static-city/*/city-view.png` (desktop and phone-width
geometry views); native smoke artifacts under `artifacts/she-789/static-native`.
