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

### Decorative atmosphere (SHE-512)

The heightfield-water.v1 snapshot has no wind speed, wind direction or cloud
cover. The scene explicitly marks these unavailable (speed would use m/s if a
future model supplied it). Five CSS marks provide decorative wind/cloud layers;
the authored phase follows the selected step, wraps every 24 steps and carries
no physical time, direction, strength, cloud coverage or probability meaning.
Rainfall, flood depth, seed and comparison arm never scale the decoration.
No new model fields, contracts, identifiers or random calls are introduced.
A checkbox hides the layers. Reduced motion freezes their position and removes
transitions; both terrain renderers share the same pointer-transparent overlay.
Empty/invalid step selection hides it. No assets, timers or additional render
loop are allocated; scene teardown removes the marks and listener. Page hide
stops playback/ensemble work and destroys the scene unless entering bfcache.

Checks: `bun test test/storm-atmosphere.test.js` and
`bunx playwright test --config test/storm-atmosphere.browser.config.js`.
The browser suite captures HEAD and edited scene screenshots at the storm route,
then checks mobile layout, keyboard toggling/scrubbing, rapid arm/view changes,
reduced motion, empty snapshots and teardown. See the review for execution limits.
