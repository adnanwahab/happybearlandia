# Storm execution and display

`/world/storm/` runs both comparison arms through `execution.js`. It tries WebGPU,
then a module worker, then the bounded CPU reference on the main thread. The live
run status names the selected fallback and why the previous path failed. A failed
second GPU arm causes both arms to be recomputed on the worker so a comparison
uses one backend. Worker construction, posting, execution, decoding and 15-second
timeout failures terminate the worker and select the reference solver.

`gpu.js` derives requirements from the validated grid and step count, including
the full readback allocation. It checks adapter and device limits for storage
bindings, individual buffers, binding counts, uniform settings, workgroup size
and dispatch count. It requests the default device without raised limits. Cached
devices are checked again for each run. Insufficient or unknown limits select the
CPU path; hardware constraints never shrink the model grid or change the recipe.

Computation and visualization are independent. `scene.js` draws the same selected
frame with Three.js/WebGL or Canvas2D when 3D setup or rendering fails. CPU fallback
keeps `heightfield-water.v1`, accounting, input recipe, and selected step intact.
The storm scenario remains synthetic; visual cells do not count as independent
agents or measured interactions. Other application renderers are outside this slice.

Checks:

- `bun test test/storm-execution.test.js test/storm-physics.test.js test/storm-scenario.test.js test/storm-impacts.test.js test/storm-recovery.test.js test/storm-treaty.test.js`
- `bun --bun x playwright test --config test/webgpu-limits.browser.config.mjs`

The browser suite simulates missing GPU, a 1-byte storage binding limit, worker
startup failure and unavailable WebGL; it checks visible fallback, flood outcomes
and replay. Its real GPU success case skips when Chromium exposes no adapter.
Unit injection tests verify limit boundaries and reference equality; they do not
measure hardware performance. Local browser execution evidence and limitations
are recorded in `docs/implementation-plan.md` under SHE-168.

### Optional depth cutaway (SHE-517)

Open **Flood and drainage fields → Water depth cutaway**. The selected grid row
appears as a vertical depth profile above a schematic local-ground datum. Each
column is a native button, sharing selection with Grid row/column and both maps.
The recorded arm/step and recipe/model/seed provenance are reused unchanged.
Depth always uses metres even when the separate hazard picker shows drainage.
The 0–1 m vertical scale and 0/.10/.40 m colour thresholds never rescale between
arms or steps. Values above 1 m show an arrow and an unclipped numeric reading;
missing cells show a gray × and “missing”; zero remains dry. Readings round to
0.001 m; positive depths below half that precision display `<0.001 m`.

This is a synthetic depth profile, not surveyed terrain, underground geology,
calibrated risk or a forecast. Structural uncertainty remains unquantified.
The DOM/CSS 2D path is used at every quality level, including unavailable WebGL
or Canvas2D. It adds no assets, GPU allocations, timers, animation or camera.
Work is bounded to the selected row (32 columns in the current storm); a closed
lens does no projection work. Horizontal scrolling contains the columns on mobile.
Timeline updates reuse buttons to retain focus. Page departure destroys both
inspectors and the terrain renderer, disconnects its observer and stops playback
and ensemble work; back/forward-cache return reloads the recipe/step route.

Checks: `bun test test/storm-cutaway.test.js test/hazard-field.test.js test/storm-*.test.js`
and `node node_modules/playwright/cli.js test --config test/storm-cutaway.browser.config.mjs`.
The browser suite records actual storm-route baseline/current desktop and mobile
captures, exercises reduced motion, forced 2D, keyboard selection, rapid timeline
and arm changes, no-canvas/missing/empty/overflow and idempotent disposal.
