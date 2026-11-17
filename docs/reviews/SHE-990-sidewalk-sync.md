# SHE-990 sidewalk synchronization

Isolated slice from origin/main c3ec93c5; preserve the dirty sprint checkout.
Trace the retained canonical legacy walker through model, view and picking.
Fix presentation only; no simulation coordinates, rules, seeds or LOD exceptions.
Acceptance: real Playwright desktop/mobile canonical World, natural mapped walk,
body on a sidewalk outside building polygons, rendered/model position equality
on pause, visible body pixels and unobstructed body pick, selection by pointer,
resume/repause synchronization and camera movement. Retain JS/GPU errors.
Prerequisites: full Chromium, normal server, cached mapped geography.
Risk: access legs can be indoors and camera lines can cross buildings; measure
actual geometry rather than inferring visibility from route labels or selection.

The retained reproduction is legacy/main-thread, not Population worker state.
world/sim.js advances world.people in whole minutes; hblWorldTileSource returns
that same authority. world/render.js smooth[] previously froze with k=0 on pause,
so body matrices, Follow, halo and picking stayed behind model coordinates.
The fix settles that view to the final observed coordinates (k=1) while time
remains paused. The separate Population worker renderer is unchanged.

## Coordinate and visibility trace

- `world/sim.js:step` owns legacy coordinates and consumes the 40m/min walking
  budget across waypoints. The live model is main-thread. Workers for geometry,
  comparisons and Living Population do not own this legacy person's position.
- `world/render.js:hblWorldTileSource.getFrame` returns the same legacy people.
  `world/population/world-view.js:receive` and `population/renderer.js:updateFrame`
  handle the distinct worker sample and are not on this reproduction path.
- The legacy frame uses exponential presentation smoothing while running. A
  paused frame must settle to its latest observation, as the existing observed
  policy clock already does. Previously k=0 retained an arbitrary older position
  indefinitely. Body, selection ring, Follow and camera subject share smooth[].
- `human-renderer.js` writes those x/z values to body instance matrices. Its
  bounding spheres are invalidated after writes and body parts disable frustum
  culling. No bounding-volume workaround is needed.
- Legacy density sampling in render.js remains in force; the regression chooses
  an already drawn unselected walker. Selection does not manufacture visibility.
- `hblWorldContext.pick` and native click handlers compare body ray distance with
  building meshes. Geometry stays depth-tested. The regression verifies a real
  straight sidewalk lane (not a synthetic building access connector), excludes
  building polygon interiors, projects the body inside the viewport, verifies the
  actual first accepted scene pick and checks screenshot pixels against adjacent
  sidewalk. Desktop/mobile screenshots are also visually inspected.

ODD check: `docs/models/legacy.md`, `world/sim.js`,
`world/population/pedestrian-routes.js`, `world/workers/README.md` and
`world/render/geometry/{road-generator,sidewalk-generator}.js` reviewed. No rule,
clock, coordinate, route, seed, worker contract or model-state mutation changed;
the existing model description remains accurate. Sidewalks remain synthetic
9m carriageway / 2m sidewalks on sourced geography; no universal collision-free
route claim. A camera behind a building can still occlude a resident normally.

Test development failures were retained outside git. The strengthened assertions
caught (1) unrendered density candidates, (2) a walker traveling beyond the
stationary close-up camera and (3) the test toggling pause after a speed button
already resumed playback. Corrected the test to wait for an ordinary drawn lane
walker, revisit its new location, and use actual launch-shell resume semantics.
No product failure was filtered or model repositioned.

## Verification results

- Original pause behavior negative control: desktop and mobile both fail at the
  paused coordinate assertion after the full 30s poll. Observed persistent errors
  22.3556980024m desktop and 7.3886985164m mobile; same canonical route, actual seed
  3458994576. Retained JSON/error contexts/traces:
  `/private/tmp/she990-negative-control`. The shell restores the fixed source
  after this intentionally failing run; its trailing restore exits zero, while
  Playwright itself reports 2 failed. This is negative evidence, not acceptance.
- `bun test test/simulation-playback.test.js test/human-renderer.test.js test/legacy-activity-history.test.js`: 17 passed, 0 failed, 141 assertions.
  Includes seed-matched complete legacy/Population state and event digests over
  0.25x–8x and pause/resume. Initial command also named two nonexistent files;
  Bun ran these three discovered files. No claim of tests in absent files.
- `bun test test/frame-work.test.js test/pedestrian-performance.test.js`: 5 passed,
  0 failed, 373 assertions, including 502 byte-identical routes.
- Renderer and Playwright test syntax checks and `git diff --check` passed.

The test observes ordinary 40m/min discrete movement while playback runs and
requires smoothing to converge below 1m before repause; paused and camera-moved
positions must match the authority within 1mm (Float32 instance precision).
It does not claim every intermediate render equals a whole-minute model jump.

Final standalone acceptance (with Follow, running convergence and native touch):
`HBL_STARTUP_SMOKE_PORT=43193 bunx playwright test --config test/sidewalk-sync.browser.config.js`
**2 passed, 0 failed, 0 skipped, 36.6s** (desktop15.5s, mobile20.1s). Both assert
empty pageerror and WebGPU console-error arrays. The ordinary Follow target stays
within1m while running and converges within1cm after pause; screenshots before
selection and after repause/camera movement are retained with coordinate JSON.
Artifacts: `test-results/sidewalk-sync` under the isolated checkout. Earlier
passing reduced assertions are superseded by this final result. Mobile is
Chromium device emulation (390x844, DPR1, touch), not physical-device validation.
