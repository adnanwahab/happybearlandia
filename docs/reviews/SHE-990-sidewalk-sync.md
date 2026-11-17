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

Retained canonical controls/social rerun on final PR470 candidate981f7d8d:
`HBL_BROWSER_BASE_URL=http://127.0.0.1:43195 HBL_BROWSER_ARTIFACT_DIR=/private/tmp/she990-final-controls/evidence bun --no-env-file test/she990-controls.browser-smoke.mjs`
and the same command for `test/she990-social.browser-smoke.mjs`: controls19/19
passed; Social→Talk passed (actor/target ledger, outcome and need delta). Both
pageerror/GPU arrays empty. Owned server stopped after checks.

The previous `she990-sidewalk-visibility-repro.mjs` is retained and explicitly
labeled historical: it unconditionally reports non-acceptance and is not the
current regression. Earlier failed observations have not been deleted.

## Composed integration acceptance and review

The fix was replayed onto PR470 without conflict:981f7d8d, preserving all four
existing verification commits and actual `origin/main`c3ec93c5 ancestry. PR474
already descends that same current remote base; its rebase would be a no-op.
Never use the source checkout's unrelated local main/sprint as this base.

Disposable composition `/private/tmp/hbl-she990-pr-review` adds PR474 commits
8f5da6d2/1e259283/fbf4a2aa by conflict-free cherry-pick; candidate
`1adcb31d7f9042f4a86d3b88967117f03d144d48`. No changes to PR474 or its worktree.

- Focused combined unit command: `bun test test/simulation-playback.test.js test/human-renderer.test.js test/legacy-activity-history.test.js test/frame-work.test.js test/pedestrian-performance.test.js test/temporal*.test.js test/future-machine-neighborhood.test.js test/future-machine-resources.test.js test/future-machine-scrub-preview.test.js test/future-machine-scrub-identity.test.js test/future-machine-effects.test.js test/future-machine-scene.test.js test/first-interaction-budgets.test.js`
  **87 passed,1 existing opt-in skip,0 failed,9804 assertions,16files,5.82s.**
- `HBL_STARTUP_SMOKE_PORT=43189 ./node_modules/.bin/playwright test --config=test/startup-smoke.config.js --workers=1`: **6 passed,0 failed,3.4s**.
  Startup pageerror arrays empty; this suite does not collect GPU console errors.
- `bun --no-env-file scripts/verify-temporal-recovery.mjs`: **6 passed,0 failed,9.7s**.
  Four integration cases assert empty JS/GPU arrays; includes canonical recovery.
- `HBL_STARTUP_SMOKE_PORT=43189 ./node_modules/.bin/playwright test --config=test/sidewalk-sync.browser.config.js --workers=1`:
  **2 passed,0 failed,0 skipped,30.0s**, desktop15.7s/mobile13.4s. JS/GPU arrays empty.
  Seed3458994576; desktop walker547 paused error~0.000003m, running0.002536m,
  Follow0.2251m; mobile931 paused~0.0000063m, running0.002995m, Follow0.2762m.
  Both unselected BEFORE screenshots visually reviewed: body actually visible on
  sidewalk. Final root desktop/mobile AFTER screenshots also visually reviewed.
- Diff/whitespace checks passed. Independent review found the pause fix sound;
  its requested running/Follow coverage was added and passed in both profiles.

Artifacts live under each isolated checkout's `test-results/sidewalk-sync`,
startup and temporal output paths. No reliability/physical-device claim.
SHE-990's retained sidewalk blocker is resolved for these acceptance cases.
PR474's strict performance targets still fail (see its own receipt); focused
checks do not override that gate. Neither PR was merged or deployed.
