# XRAY-02 isolated road columns candidate

Run from repository root with installed dependencies:

```sh
bun --no-env-file world/city-xray/columns-demo/serve.js
```

Open `http://127.0.0.1:41046/world/city-xray/columns-demo/index.html`.
`?noGPU=1` explicitly exercises the accessible unavailable-graphics state. No
application host, models, external requests or simulation workers are started.
The static server exposes only City X-Ray, the existing camera utility and local
Three package. Native WebGPU is required for the graphic; fallback remains text.

The separate `roadFrame(0)` is accepted schema city-xray.frame.v1. Source
city-grid-road-demo v1, model authored-road-intensity v1, run synthetic-road-v1:0,
seed0, generator city-grid-fixture v1 plus road-field v1. It reuses detached
synthetic road geometry, then authors a new road metric. Original place samples
are never relabeled as traffic. The formula is fixed in frame.js: road-midpoint
distance to three authored centers, 100 × exp(−distance / 420), rounded. One
road is explicitly null; the first is zero. No observed geometry, measured road
traffic, people, trips, recorded model results or new behavioral model is claimed.
The static minute60/tick4 checkpoint is the only frame; no invented playback.

All shafts on a road repeat the same road sample. Full quality uses eight evenly
spaced mid-bin fractions, avoiding shared endpoints. 543 present roads yield
4344 shafts including eight zero-height shafts; null road emits none. Each
shaft resolves run, clock, metric, source road and ordinal; the selector/table
retains all544 samples. The fixed scale is0–100 synthetic-symbols: linear
height0–108 model-units, width0.42, static halo width2.8, linear-RGB
 green→yellow→orange→red ramp. These heights are a declared display encoding,
not physical measurements. Synthetic blocks, ground and Three FogExp2 are
cosmetic schematic context; no photorealistic basemap or particles are supplied.
East/up/south coordinates are used directly. The existing `planCameraPreset`
skyline pose is expanded by5 for full-city framing, targeting the origin. No
coordinate conversion or arbitrary time mapping occurs.

## Future host interface

```js
const layer = mountColumns({scene, renderer, frame, metricId});
if (await layer.ready) {
  layer.setView({camera, stride:1, maxDistance:Infinity});
  // host schedules renderer.render(scene,camera)
}
layer.update(nextFrame, {camera});
layer.setEnabled(false); // releases meshes, instance arrays, geometry, materials
layer.setEnabled(true);  // reallocate within original capacity
layer.resolve(instanceId); // current visible shaft record or null
layer.pick(raycaster); // same record, core geometry only
layer.stats(); // counts and allocated attribute/index bytes, not peak VRAM
layer.dispose(); // idempotent; host still owns renderer and scene
```

Update validates/detaches the whole frame before replacing data, pins source,
model/run/coordinate identity, rejects older tick/value and contradictory clocks
at the same tick. Hosts can supply stricter `expected` pins. Layer capacity is
fixed at mount (at most8192 and frame.display.maxColumns). Later larger budgets
cannot enlarge buffers. Geometry uses one InstancedMesh per core/halo, two draws;
no object per shaft. Camera frustum/distance and deterministic stride apply to
both passes with the same source lookup. Static presentation needs no animation,
including reduced motion. The host should call setView after camera changes.
Renderer device loss releases the layer and refuses re-enable/update; host must
create a new renderer/layer after recovery. Readiness cannot resurrect disposal.

## Verification and evidence

```sh
bun --no-env-file test test/city-xray-columns.test.js test/city-xray-contract.test.js test/city-heatmap.test.js scripts/pr-hygiene.test.cjs
node node_modules/@playwright/test/cli.js test --config=test/city-xray-columns.browser.config.js
node node_modules/@playwright/test/cli.js test --config=test/city-xray-columns-native.browser.config.js
# With isolated static server already running:
bun --no-env-file world/city-xray/columns-demo/performance.js
```

Outputs default to /private/tmp/SHE-1046-browser and SHE-1046-performance.
The native suite explicitly skips software/fallback adapters and checks native
backend, rendered bright/warm pixels and actual on/off pixel differences, GPU
validation errors, desktop1440×1000/mobile390×844 captures, quality/lifecycle and
device loss. Browser assertions alone do not certify GPU visual acceptance.
The performance script uses30warmup +120serial queue-completed samples,
render-pass GPU timestamps when supported, p50/p95, drawing buffer resolution,
adapter information, renderer call counts, allocated attribute bytes and optional
JS heap snapshot. It does not measure peak physical VRAM, a physical phone or
calibrated model performance. A mobile viewport is a desktop adapter measurement.

Compare the exact-commit native screenshots with user download.png SHA256
c471a5dfd8b3540757479f4ffaef42c23d7a83e09245e2f0c13e71dc8a2fac34 and
before `/world/city-xray/fixtures/preview.html` (accepted Canvas2D diagnostic).
Before there was no columns module/demo. Do not invent an earlier native render.
Capture the before diagnostic at the same viewports using this static server.
Retain screenshot/source manifest receipts outside source; trusted CI must recapture
or an approved durable store must bind them to tested head. Human visual/functional
acceptance remains required; draft PR is only a candidate. See issue review for
actual PASS/FAIL/NOT RUN results and host sandbox blockers.

Set `XRAY_HEADED=1` for the performance harness when native WebGPU requires a visible browser. Native acceptance requires explicitly `isFallbackAdapter === false`; missing adapter qualification is not a pass. Native tests also assert two measured additional column draws over the column-hidden context (at most six total including the renderer output pass), on/off rendered-pixel changes, real pointer picking and GPU error-scope evidence.
