# Compute, worker and render failure boundaries

SHE-108 source audit, 2026-11-12. This is an inventory of the shared boundaries
below, not a claim that every legacy worker has equivalent coverage. Observations
come from the checkout; injected failures are synthetic, not hardware incidents.
No model versions, seeds, inputs or simulation results change in this slice.

| Boundary / source | Failure and current behavior | Recovery / remaining limit |
| --- | --- | --- |
| `world/workers/priority-pool.js` | Worker crash, queue limits, deadline, cancellation and task error settle submitted tasks. Existing worker-platform tests exercise real crash recovery. | Only explicitly deterministic work with safe input ownership can retry; retries are bounded. A task error is not a crash retry. Caller owns presentation. |
| `world/city/worker-call.js` | Constructor/post errors, worker error, malformed result, abort and timeout reject; disposable worker terminates and handlers clear. | City API catches rejection and returns an error response. No automatic replay of interrupted operations. `messageerror` has no dedicated handler; deadline remains the bound. |
| `world/population/runtime.js` | Advance failure rolls back pending tick count, calls `onError`, and rejects explicit calls. Clock loop consumes rejection after reporting. Future failures become failed rows. | Host must wire `onError` for visible live errors. Failed rows must not be treated as completed forecasts. |
| `world/render/geometry/geometry-cache.js` | Worker unavailable at construction uses yielding main-thread generator; runtime worker error rejects pending jobs and disables worker. | Later requests use local generator. Failed current requests are not automatically retried. No worker deadline; post failure can leave pending bookkeeping until disposal. |
| `world/render/renderer/webgpu-renderer.js` | City renderer initialization failure attempts WebGL2 unless explicitly forced; second initialization failure rejects. | Caller owns final presentation. Fallback initialization disposal remains a separate gap. `world/render/README.md` describes this renderer, not a universal World guarantee. |
| `world/world-gpu.js` | Main World requires GPU backend; initialization failure displays acceleration/browser/reload guidance with Try again and home link, then throws. | No implicit CPU/WebGL simulation or rendering substitution. Callers still own consumption of the rejection. |
| `world/future-machine/scene/index.js` | Device/context loss invokes scene failure path; Future Machine has Canvas fallback. | Existing `test/e2e/pipeline-device-loss.e2e.js` covers this distinct surface; do not infer other routes inherit it. |
| `world/render/gpu-particles.js` | Unsupported backend rejects enablement without allocating GPU particles. | Capability error, not fabricated particles or reduced simulation population. Existing particle test covers WebGL. |
| `tools/webgpu-demo-runtime.js` | Shared tools require WebGPU. Init failure rejects to page-level `showWebGPUError`. Device loss stops animation and disposes resources. | This slice ensures individual cleanup throws cannot suppress the actionable alert or reject the device-loss callback. A rejected loss notification also shows reload guidance. No WebGL substitution or automatic model rerun. |

The shared demo lifecycle is used by scene reconstruction, timeline viewer, edit
game, ambient sensing, augmented reality and play-go. Reload restarts the demo;
it does not promise preservation of unsaved edits or reconnection to the lost
device. Resource cleanup is best effort: every discovered resource is attempted,
and cleanup failure is visible. A disposed page ignores late device notifications;
a bfcache pagehide preserves the runtime.

## Reproducible verification

Run from repository root:

```sh
bun test test/webgpu-demo-runtime.test.js test/city-worker-call.test.js test/gpu-particles.test.js test/worker-platform.test.js
```

Observed: Bun 1.4.2, 29 passed, 0 failed, 180 assertions. Four new focused
integration tests invoke the exported demo lifecycle and actual alert builder
with synthetic DOM/device boundaries: ordinary loss, throwing animation/resource
cleanup, rejected device notification, and bfcache/final disposal with late loss.
Bun reported no unhandled rejection. Existing tests include real disposable City
workers, API abort/slot recovery, deterministic seed-42 replay and pool crashes.
No physical GPU, full tools-page browser journey, or browser layout claim is made.
Focused integration tests provide this slice's browser-facing verification;
Playwright was not run. There are no configured lint or type-check scripts.

Follow-ups are the geometry deadline/post bookkeeping gap, City message decoding
errors, and auditing every host's error presentation. These are independent
changes and are not claimed fixed here. No deployment or production data change.
