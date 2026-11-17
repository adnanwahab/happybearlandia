# SHE-789 performance and bus continuity

Final result: the measured 719/575ms Legacy main-thread freezes are removed, with exact replay preserved. The final native-WebGPU 120-second run had **zero main-page long tasks and zero JS errors**, median16.7ms/p9916.8ms, but **12 rAF frames over 50ms (max100ms)** during the last pan. The strict frame target remains unmet. Detailed final results and artifacts are at the end; earlier traces below are explicitly historical. Residual GPU/compositor/streaming attribution is unconfirmed.

## Implementation (November 15, 2026)

- `world/render/frame-work.js` and `world/render.js`: legacy catch-up runs unchanged whole model minutes with a 4 ms scheduling budget and at most eight minutes per animation callback. Remaining minutes stay in the accumulator. One indivisible model minute can exceed the budget; this is cooperative scheduling, not a hard real-time guarantee. Streaming view checks run at most ten times per second.
- `world/population/economy-panel.js`: retains latest authoritative frames and collection behavior, but creates the household risk table only while its disclosure is open. Opening refreshes immediately from the latest frame.
- `world/population/world-view.js`: hotspot projection reads the canvas rectangle once before presentation writes, rather than once per marker after writes. Other concurrent resident changes in this file are owned by the resident slice.
- `world/render/physical-policy-layer.js`: all bounded configured fleet symbols appear immediately, remain on their reversible road traces, and interpolate between observed simulation minutes. No extrapolation beyond the current model minute; pause/reset freezes/resets presentation. These remain illustrative policy symbols, not actual bus schedules or ridership.
- `world/render/shader-warmup.js`: newly visible shader objects compile through Three's `compileAsync(object,camera,scene)` outside the animation callback, one at a time with at most 128 queued jobs. Unready objects are omitted only for the GPU draw; original visible flags are restored immediately for picking and culling. Rejections and unsupported compilers fail open; a 15-second visibility timeout prevents indefinitely hidden assets. WeakMap state does not retain disposed scene objects. Tradeoff: new visual assets can appear progressively while compiling; a timed-out driver can still hitch on fallback rendering.
- Shader admission caches material/geometry references, versions and attribute references without rebuilding signatures each frame. New buffer objects with the same attribute layout reuse their shader. Different custom material identities are deliberately not merged. This allocation improvement is included in the final frozen-source measurement below.
- The 3D GPU draw stops while `window.hblWorldTileViewActive` is true; authoritative simulation updates continue. Existing startup placeholder drawing is unchanged.

## Historical shader profiling evidence

Captured local Chrome on macOS, 1280×800, headless physical Chrome executable, WebGL fallback, requested seed 42, Houston cached map, default quality. These are local diagnostic samples, not a physical-device acceptance claim. Default entry uses legacy mode (`autoActivate:false`); the `living` profiles explicitly activate the 10,000-resident runtime and set speed 10. After 25 seconds of warmup, every ten seconds a right-button drag pans. Existing context listeners also open the ground action card on those drags, visible in the screenshots. Concurrent coordinating-chat model sweeps and other browser sessions were active, and source changed during this multi-chat integration; comparisons are provisional.

| Capture | Sample | Median frame | p99 | Max | Frames >50ms | Avg fps | Main-page heap start → end |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before legacy | 30s | 33.3ms | 33.5ms | 166.7ms | 1 / 930 | 29.91 | 270.8 → 88.9 MB |
| before Living | 30s | 33.3ms | 33.4ms | 133.4ms | 1 / 937 | 30.08 | 100.7 → 82.8 MB |
| after scheduling, before shader fix | 120s requested (129.4s captured) | 33.3ms | 66.6ms | 516.6ms | 52 / 4,461 | 34.46 | 108.9 → 218.1 MB |

Profiler correction: the initial implementation subtracted `performance.now()` from a possibly stale already-scheduled rAF timestamp. This produced a negative first delta and compensating second gap in Living captures. Raw data is preserved. Excluding exactly those two instrumentation-boundary deltas gives before Living: max 33.5 ms, zero >50 ms /935; after scheduling/pre-shader: max 516.6 ms, 51 >50 ms /4,459; shader-fix smoke: median16.7 ms, p9916.8 ms, max33.3 ms, zero >50 ms /1,839, 59.97fps. The reusable script now initializes only from a fresh callback timestamp at or after sample start. The legacy baseline's166.7ms interior frame remains genuine. This correction does not erase the failing pre-shader run.

The last capture **fails** the no-frame-over-50ms target and is not evidence of improvement. Heap values are transient JS used heap, not RSS, GPU memory, worker heaps or retained-object measurements. The increase alone does not establish a leak. The reproducible script now explicitly collects GC after the timing sample and records `heapAfterGC` to support a retained-heap follow-up.

The 120-second trace isolates the longest main `frame` call at 437.691 ms. V8 CPU samples attribute **419.898 ms** to `getProgramParameter → _completeCompile → createRenderPipeline → Three render → global-illumination.render → frame`. This is synchronous shader program completion in the WebGL fallback. Nested trace events show no long Layout in that frame. Therefore the measured spike is neither a mesh-count diagnosis nor a worker-result callback: it is driver shader linking on newly rendered variants. Median render CPU was 3.9 ms; average GPU query 7.10 ms. This directly motivated async warmup.

Before Living's longest sampled main `frame` call was 14.374 ms. Worker `self.onmessage` work reached 1003.6 ms on the separate population worker thread. Its main-page long-task observer saw one 51 ms task. The previously reported 433–468 ms main-thread priority-pool handler was not reproduced in these baselines; no worker-pool behavior or replay contracts were changed without evidence.

## Artifacts and reproduction

`artifacts/she-789/performance/` contains raw metrics, screenshots and gzip-compressed Chrome traces. Decompress a `*.trace.json.gz` and load the JSON in Chrome DevTools Performance to inspect the flame chart. `before-living-flame.svg` is an actual V8 sampled aggregate main-page CPU flame graph (idle/program/GC excluded), not an illustrative diagram. The full traces preserve worker/main-thread distinctions.

Run after other heavy checks stop:

```sh
HBL_PROFILE_URL=http://127.0.0.1:62691 \
HBL_PROFILE_OUTPUT=/private/tmp/she-789-final \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
bun scripts/performance/profile-world.js final-living 120
```

Final profiling requires the native WebGPU game and checks `renderer.backend`; historical WebGL fallback captures above describe earlier source and cannot be requested through the final entry point. The script records errors, rAF deltas, long tasks, actual renderer CPU/GPU stats, heap, warmup counters and a raw CPU/timeline trace. It does not silently assert a performance pass. Repeat the same 120-second duration on stable before/after source with no competing workload for a calibrated comparison. Physical phone, old laptop and Safari ten-minute video acceptance remains the coordinator's final verification scope.

## Checks

- `bun test --timeout 15000 test/frame-work.test.js test/physical-policy-layer.test.js test/population-scheduling.test.js test/worker-platform.test.js test/household-risk.test.js`: 26 passed, 0 failed. A prior concurrent run hit the existing five-second worker future-inspection deadline; the unchanged test passed at 8.6 seconds with the repository-style 15-second worker timeout.
- `bun test test/shader-warmup.test.js test/frame-work.test.js test/physical-policy-layer.test.js`: 10 passed, 0 failed (four shader tests); covers off-frame compilation, visibility restoration on thrown render/rejected compile, unsupported backend, bounded queue, and visibility timeout.
- Targeted `git diff --check`: passed.

Shader-fix Living 30-second smoke: median 16.7 ms, p99 16.8 ms, max 250 ms, 1/1,841 frames over 50 ms, 60.05 average fps; CPU median 3.2 ms, GPU average 5.84 ms; heap 95.8 → 101.4 MB, zero main-page long tasks and zero JS errors. City visibility verified in the screenshot. Source/UI integration differed, so this is not a calibrated before/after result. Quiet integrated profiles are recorded below; do not mark SHE-789's frame-budget acceptance complete from these results.

## Historical default-renderer follow-up

Normal renderer selection used **WebGPU** in both local 120-second Living runs (10,000 residents, speed10), with zero JS errors and visible city screenshots:

| Capture | CPU tracing | Frames | Median / p99 / max | >50ms | Avg fps | CPU median / GPU average |
| --- | --- | --- | --- | --- | --- | --- |
| final-default-living | on | 7,129 | 16.7 /33.3 /116.8ms |47 |57.96 |1.9 /5.40ms |
| acceptance-default-living | off, corrected fresh-rAF baseline |7,238 |16.7 /16.8 /100.1ms |15 |59.13 |3.0 /3.85ms |

**The strict no-frame-over-50ms target remains unmet.** The tracing run had zero main-page long tasks; trace-free acceptance had two (51 and64ms), near the end. Its frame gaps cluster around115–121 seconds. This is not enough evidence to attribute all residual gaps to a single app mechanism, nor to claim a hardware-calibrated improvement.

Heap: traced run89.5 →191.6MB →100.4MB after forcedGC; trace-free80.5 →349.7MB →104.2MB afterGC. Most growth is temporary allocation, but neither endpoint pair proves absence of a leak. Worker, GPU, native/RSS and retained-object inventories remain unmeasured. Warmup was2,378 completed,0pending,0failed at the trace-free endpoint. Per-object shader signature allocation was subsequently removed as described above; the cache optimization and final metadata hooks are included in the final Legacy measurement below.

Use `HBL_PROFILE_TRACE=0` for an acceptance sample without CPU tracing overhead. Leave it unset for diagnostic traces. Latest script records initial Git HEAD and SHA256 for affected source files. Earlier captures occurred during multi-chat integration; metadata/hook changes and the final signature-cache patch followed source capture, and must not be presented as a stable comparative benchmark.

Code ownership is now released to the coordinator. No deployment, production write, merge or commit was performed. This slice does not mark the launch checklist complete.

## Integration hooks

`window.hblWorldTileSource` (alias `hblTileWorld`) exposes read-only `getFrame()` with source run/revision, geometry key, clock, seed, model, actual buildings, projected road `pts:[[x,z],…]`, actual visible people and limitations, plus authoritative person/building selection. `window.hblSessionLogState()` returns geometry-free actual minute, numeric seed or null, mode, camera and target. `window.hblWorldContext.pick(event)` picks the nearest actual person/building or ground, and `buildAt(event)` calls the existing bridge. Legacy people now receive actual social encounter heading, speech and age-band presentation fields. No simulation authority or model record is created by these bridges.

## Legacy departure freeze investigation and exact-cache fix

The coordinating chat's later normal-entry acceptance exposed real 719/575ms main-thread tasks. A new 120-second native WebGPU Legacy trace (`diagnose-legacy`) reproduced a740.828ms `frame` call. Actual V8 samples identify248.081ms nearest sidewalk lookup,343.205ms sidewalk heap search (`shortest`/`pop`/`push`),49.291ms road A*, and33.972ms nearest road-node lookup, all under `tripPlan → decide → minute → world.step`. This was a new route-planning cold burst at synchronized morning departures, not compositor-only behavior. The previous no-long-task Living results did not establish Legacy acceptance.

`artifacts/she-789/performance/legacy-route-stall-flame.svg` and its JSON contain the actual sampled stacks within that740.828ms frame. Reproduce from the raw trace with `python3 scripts/performance/trace-flame.py INPUT.trace.json OUTPUT.svg`.

The final fixes preserve route coordinates, heap comparison/tie behavior, decisions, RNG consumption, clocks and model state:

- Exact sidewalk nearest lookup uses a derived AABB tree and retains exhaustive scan tie order; it allocates one projection instead of one per lane. Projection cache:4,096 entries per network.
- A typed binary heap resumes the same sidewalk Dijkstra frontier across candidate destinations from the same access point. Source tree budget: **32MiB per network**, including cost/predecessor arrays and retained heap-frontier capacity, at most2,048 origins. Full route cache separately has a4MiB estimated retention budget and4,096 entries. Inactive Legacy and active Population workers can retain separate networks/caches; these are not global process caps.
- Road endpoints have a4,096-entry cache. Road paths use bounded FIFO eviction rather than clearing all4,096 paths at once. Their budget is4MiB estimated retention with at most16,384 entries. Road A* now uses a typed stable priority heap: equal scores retain the original open-list insertion rank, including decrease/reopen behavior. Search scratch arrays are reused.
- `world.warmRouteSource(point)` computes only derived geometry lookups. The renderer calls it for one actual stationary resident origin per background job. It warms the sidewalk source plus normal geometry advertisement destinations (assigned home/job/school/business and six nearest food/shop/park locations), checking a4ms budget between road queries. It never calls activity scoring/selection or consumes RNG. Target lists retain at most2,048 origin records; source/run changes and clock rollback clear these queues. The background loop skips moving positions, pauses for inactive/hidden pages, and cancels on page exit. An indivisible origin initialization can exceed the4ms cooperative budget; diagnostic counters report the actual maximum.
- Right-button pointerdown/up now bypass renderer vehicle/person/building selection ray picks. The coordinating chat separately fixed context handling so right-drag pans do not open menus. These are input fixes, not frame-sample filtering.

A temporary64MiB source cap was tested while investigating source count; telemetry showed399 trees/19.85MB, so the final cap returned to32MiB. In the pre-road-warm acceptance, main JS heap after GC was99.1MB and CDP backing storage40.2MB; the latter includes typed buffers. Main heap excludes worker heaps, RSS/native/GPU allocations, and does not include all backing-store memory. Source/cache telemetry is necessary alongside heap samples.

Exact checks:702 recorded route queries match the previous algorithm byte for byte, including equal-cost ties, repeated origins, crossings and off-map access. A4,500-query eviction sweep preserves the same answers. A cached Houston geometry fixture with1,233 residents, seed42, journals and activity history was run150 unchanged model minutes before/after the optimizations and scheduled prewarm; full checkpoints matched exactly, including RNG, social events and histories. Latest standalone Bun sample reduced departure423 from1667ms to34.18ms and455 from1120ms to23.36ms; all150 steps were at most34.18ms. These CPU-only numbers are not browser acceptance and include a different execution engine.

`bun test --timeout 15000 test/route-prewarmer.test.js test/pedestrian-performance.test.js test/resident-launch.test.js test/frame-work.test.js test/physical-policy-layer.test.js test/shader-warmup.test.js`:28 passed,0 failed,528 assertions. The controller tests cover one origin per job, moving-origin exclusion, source changes/disposal and unchanged geometry/routes. The final quiet native-WebGPU Legacy120-second measurement on the complete fix is recorded below.

Current source follows the user's later **WebGPU-only** instruction. The WebGL fallback traces above are historical measurements of earlier source. The profiler no longer offers a WebGL override, waits for a ready actual game, and rejects a non-WebGPU backend; no fallback acceptance can be produced by final source.


## Final frozen-source normal-entry result

`final-road-warm-legacy`, native WebGPU, no CPU tracing, ready actual game plus 15s settling,120seconds requested idle/pan sample: **7,271 frames; median16.7ms; p9916.8ms; max100ms;12 frames over 50ms;59.398fps; zero JS errors; zero main-page long tasks**. The previous719/575ms main-thread departure freezes were not present. All12 remaining rAF gaps occurred together at 118.08–118.98seconds, during the final pan. Render CPU median5.5ms, GPU query average6.743ms. This establishes removal of the measured long JavaScript tasks, **not** the stricter zero-frame-over 50ms acceptance target, which still fails. The residual render/scheduling burst needs separate GPU/compositor/streaming evidence before assigning a cause; no claim that it is OS-only is supported.

Memory (main page):189.42MB start,279.47MB end,100.79MB used after forcedGC. CDP backing storage40.19MB afterGC; worker/RSS/GPU memory remain unmeasured. Actual source cache19.80MB/398trees against its32MiB per-network logical retention budget; road cache0.91MB/3,355paths against4MiB; full route cache4.19MB estimated against4MiB;415 projections;1,596 bounded road-warm origin records. Background jobs13,968, observed max6.8ms (cooperative4ms budget, indivisible source initialization). Cache retention includes buffer capacity plus estimated key/object costs; budgets are not a process RSS ceiling. Temporary memory grew during the run and GC reclaimed most of that growth; this is not a retained-object leak audit.

Final artifacts: `artifacts/she-789/performance/final-road-warm-legacy.{json,png}`. JSON records actual backend, source SHA256s, raw positive rAF deltas, errors, long tasks, startup state, renderer metrics, forcedGC heap/backing storage, and cache/prewarmer counters. Other captures remain historical and explicitly labeled. App source ownership is released to the coordinator for combined review and ten-minute browser/device-emulation soaks; no further app changes were made after this capture started.

Read-only next-work observation: `world/render/map-streamer.js` already routes building attachments through `createProgressiveLoader`, whose shared JavaScript frame allowance is 4ms across loaders. Tile road/base creation and GPU uploads/pipeline work are separate. The last-pan rAF cluster needs camera/map-stream progress plus a GPU-process/compositor trace before assigning a streaming-upload cause or changing those paths. Source inspection alone does not establish that cause.
