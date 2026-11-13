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
