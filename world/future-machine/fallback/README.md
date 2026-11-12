# SHE-25 integration handoff

This checkout already routes ordinary World through `render.js` and its
`render/renderer/canvas-renderer.js`, and Future Machine through
`scene/canvas-stage.js`. Both accept renderer=canvas2d in their existing hosts.
The issue's pinned skeleton is older than this checkout; no unrelated history
was cherry-picked. The current branch is mini/SHE-25.

`createCanvas2DStage(container,{onSelect})` adds the requested Snapshot-facing
interface over the existing spatial mapping and Canvas implementation. It
retains exact supplied metrics/events and provides accessible inventory when
Canvas creation or drawing fails. It does not simulate. World compatibility
exports reuse its active renderer; `startWorld()` explicitly imports the normal
World entry. They introduce no second engine or automatic bootstrap side effect.

Worker 3: the new fallback export consumes Pair frames, unlike the internal
Canvas stage, which consumes projections. Select this factory in your wrapper
if adopting the requested public interface. The current scene wrapper already
has independent Canvas selection and GPU recovery; it was left untouched.
Worker 4: existing World already loads render.js, so no HTML edit is required.
If migrating to renderer-entry.js, call startWorld() once.

Verification: `bun test test/canvas2d-world.test.js
test/future-machine-fallback.test.js test/future-machine-canvas.test.js
test/world-canvas-renderer.test.js` passed 16 tests, 0 failed (88 assertions) after final review.
Regression checks include context failure, drawing failure after initialization, malformed matched months, empty metrics, difference filtering, camera persistence and disposal.
All model values in the added unit fixture are synthetic test inputs, not an
observed run. No browser recipe/seed/month/metrics or screenshot is claimed.

Worker 6 browser commands:

- `HBL_WORLD_CANVAS_PORT=41927 bunx playwright test --config test/world-canvas-followup.browser.config.js --grep '390px GPU absent=true renderer=auto'`
- `HBL_DEMO_FOLLOWUP_PORT=41928 bunx playwright test --config test/demo-followup.browser.config.js test/e2e/canvas-followup.e2e.js --grep '320x740'`

Both commands were attempted again during this assignment and failed before browser launch: Bun server listen reported
EADDRINUSE (also on default 39891). No passing browser assertion or captured
screenshot resulted. These existing suites cover activity selection and Canvas
keyboard/timeline/selection; policy comparison, month-zero screenshots and GPU
startup recovery still require browser verification. The new adapter itself
requires Worker 3 integration before a normal-route browser test exercises it.
Coordinator-owned scene, HTML, main, contracts and implementation plan were not
modified. This README supplies status evidence for coordinator plan updates.

Scope and acceptance: preserve the existing renderers and model authorities;
provide the approved Snapshot-facing export, exact data inventory, missing-data
labels, changed-ID selection, camera continuity and bounded cleanup. The
prerequisites are the existing scene mapping/Canvas modules. Shared-wrapper
integration and actual-route browser acceptance remain coordinator work.
The implementation plan is coordinator-owned per this assignment; this status
entry is the handoff for its update. No independently measured recipe, seed,
month, metrics, backend detection trace or screenshots are available because
neither browser server started. Test fixture months 0/16/17 are synthetic inputs.

Final review: only the allowed six files are included; no shared interfaces,
HTML, scene wrapper, simulation engine or application data are changed.
