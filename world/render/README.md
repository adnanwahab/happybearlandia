# City rendering

`/world?demo=1` uses the installed Three.js 0.186 WebGPURenderer, with its WebGL2 backend fallback. `?renderer=webgl` forces fallback. All Three modules are served locally through the curated vendor routes; there is no CDN version mismatch.

The Graphics button or F3 opens performance and graphics controls. Lighting defaults to a sunny daytime presentation; choose Simulation clock to follow the resident clock, or select golden hour/night. These are visual overrides only. The scene uses a procedural blue sky and cloud layer, muted masonry palettes, dark weathered roof materials, reflection-tinted windows, and instanced multi-lobe park/street trees. Double-click a building to focus it; its inspector provides Focus and Cutaway. Geometry detail is independent of render resolution. Photo mode temporarily chooses ULTRA and restores the previous preset.

## Close-up vegetation and artist assets

Grass is actual instanced blade geometry on park surfaces, with anchored GPU wind, root-to-tip shading, deterministic variation and a dithered distance fade. It stays clear of road/sidewalk corridors. Aerial cameras above 42m skip it completely. Presets cap density/radius; CPU patch generation is incremental, and the distribution cache is bounded. The `grass` checkbox is available for A/B profiling. `getGeometryStats().grass` reports blades, triangles, tile cache occupancy and draw calls.

Static artist GLBs can be loaded through `loadDetailAsset({url, transforms, category, maxDistance, maxTriangles, maxParts})`. One GLB load shares its geometry/materials across all supplied transforms and returns an unload handle. Nearby instances are filtered by distance and adaptive density. Skinned/morphing models and over-budget assets are rejected. This importer does not yet add automatic asset LOD switching or custom grass wind to GLBs.

See [the artist brief](assets/ARTIST_BRIEF.md) for dimensions, pivots, PBR/export conventions and the first useful assets. `assets/models/bench-preview.glb` is a generated 60-triangle integration sample, not a final art asset.

## Host API

`window.hblCityRenderer` exposes `renderCity`, `updateCity`, `focusBuilding`, `focusDistrict`, `enterCity`, `leaveCity`, `setTimeOfDay`, `setWeather`, `setQuality`, `getPerformanceStats`, `getGeometryStats`, `setGeometryDetail`, `setCutaway`, `setPhotoMode`, `setFeature`, `setAdaptiveQuality`, and `startBenchmark`.

`updateCity` accepts visual state: `selectedBuilding`, `trafficDensity` (0–1), `vacancy` (0–1), `occupancy` (0–1), `timeOfDay` (hours), `weather` (`clear`, `cloudy`, `rain`), and `constructionProjects`. Construction entries supply `id`, `x`, `z`, `width`, `depth`, `height`, `progress`, and `phase`; optional `floorsBuilt` and `facadeFloors` describe the structural frame and installed facade. The resident simulation and approved construction bridge continue to own their clocks and outcomes. The construction benchmark uses detached visual fixtures.

Cutaway occupants and floor layouts are illustrative, not estimated housing metrics. Time/weather overrides affect rendering only.

## Geometry boundary

`geometry/building-generator.js` exports `generateBuildingGeometry(building, quality)`. Inputs support `footprint` or `poly`, `floors`, `floorHeight`, `height`, `setbacks`, `roofType`, `cornerStyle`, `archetype`, `id`, and `worldRevision`; architecture parameters may also be nested under `architecture`. Floats are in metres. Real shell height is retained when supplied. Simple concave polygons work; holes and self-intersecting footprints are not supported.

Generators return transferable `{ positions, normals, uvs, metadata }` typed arrays. `toBufferGeometry` uploads these on the main thread. Building generation runs in a module worker, with a bounded 32 MiB LRU cache and a yielding fallback when workers are unavailable. Selected/near architectural detail is requested asynchronously; existing shells remain visible until ready. Roof, facade, podium, road, sidewalk, intersection, construction, prop, HLOD and LOD modules are separately reusable.

Building geometry includes setbacks, tower podiums, eight roof profiles, large entrance awnings, near balcony slabs, and selected-building corner chamfers. Repeated rooftop and street props share instanced box geometry. Windows, room depth, furniture silhouettes, blinds, per-window lighting and glass roughness are TSL effects, rather than room/window meshes. Stable seeds use building ID and world revision.

Road ribbons contain raised sidewalks and curb faces. Orthogonal junctions split the ribbons and receive a single intersection polygon; the network is consolidated into two material groups. Arbitrary-angle junction polygon unions and GIS courtyard holes remain future work.

Geometry debug controls show LOD colors, selected wireframe, triangle heatmaps and geometry memory. Metadata records category, LOD, triangles and priority. Initial budgets are engineering configuration, not hardware measurements.

## Performance controls

BALANCED is the default. Pixel ratio is capped at 1.5 before adaptive scale (0.65–1). Sustained overload lowers shadows, resolution, vegetation, traffic, particles and visual pedestrian density; recovery requires 600 stable frames. Simulation population is never reduced. Manual benchmark recording freezes adaptation for reproducibility.

128m render chunks provide frustum/distance culling. Distant buildings use chunk-local BatchedMesh shells with LOD hysteresis and selected-building overrides. This is an initial resident-data partition, not network-backed async district streaming. Geometry generation is asynchronous; map loading remains the existing host path.

GPU time uses asynchronous timestamp-query readback when the backend supports it. Otherwise it remains `null`/unavailable. CPU time covers the animation callback, including simulation and render submission; it is not GPU time. Texture count comes from renderer info; texture bytes remain unavailable rather than fabricated. Geometry memory reports original building vertex buffers, not total GPU/process memory.

## Benchmarks and checks

Permanent routes:

- `/world/bench/aerial-city`
- `/world/bench/downtown`
- `/world/bench/construction`
- `/world/bench/rush-hour`
- `/world/bench/night`
- `/world/bench/rain`

`bun scripts/benchmark-renderer.js http://localhost:3000 aerial-city /tmp/report.json [baseline.json]` warms the renderer, records a fixed 30-second aerial → downtown → tower → street → construction → night camera path, and exports frame percentiles, CPU/GPU metrics, 1% low FPS, slow/drop counts and rendering statistics. `HEADED=1`, `RENDERER=webgl`, `QUALITY=LOW`, `GEOMETRY=HIGH`, and `OFF_FEATURES=interiors,shadows` configure comparisons. Run with and without one feature on the same hardware, browser and viewport. Baseline comparisons reject >15% p95 regressions; missing GPU timing falls back to frame p95.

- `bun test test/render-performance.test.js test/procedural-geometry.test.js test/building-renderer.test.js`
- `bunx playwright test --config playwright.renderer.config.js`

## Validation still required

The 60 FPS target has not been certified on an 8-core M4 Air or Safari. Headless Chromium here selects WebGL2 and exposes no timestamp queries; its performance must not be treated as an M4 GPU benchmark. Features are toggleable for hardware A/B acceptance.

This implementation does not complete the full 12-week backlog. Remaining work includes actual streamed district resource eviction, production KTX2/Basis assets (the loader/cache boundary exists), full asset vehicle/tree LOD libraries, skinned near pedestrians, water, SSR, AO/bloom/post pipeline comparisons, compute experiments, richer construction equipment, utility/bridge infrastructure, and Safari/WebGPU hardware regression baselines. The procedural environment map supplies HDR reflections; authored HDR sky assets and local probes can be added later.

### Bounded timing readback (SHE-173)

City timing requests run at most every 250 ms with one unresolved request. The
animation callback never awaits a transfer. `getPerformanceStats().readback`
reports support, enabled/pending state and the latest completed result with
`requestedAt`, `completedAt`, `ageMs` and `requestFrame` (performance-clock ms).
These are transfer timestamps: requestFrame is the submission-side frame marker,
not a promise of the exact GPU source frame. Three.js 0.186 resolves its bounded
query batch and returns the last recorded frame duration. Backend-internal errors
may return its last value; these timestamps do not establish an exact GPU capture
time. No simulation counter or checkpoint is inferred from a render timing.
GPU percentile exports count each completed transfer once (`gpuSamples`), exclude
pre-recording requests, and leave unavailable measurements null. The UI retains
the last observation alongside its age; it is not a current-frame observation.

Use `?readback=off` or `setReadbackEnabled(false)` to disable both timestamp
recording and explicit transfers (preventing Three's full-pool auto-resolve).
Disabling or destroying invalidates late results; an unresolved request retains
its slot rather than growing a timeout/retry queue. Unsupported timing stays off.

Reproduce a paired frame-time comparison on the same device/browser:

```sh
READBACK=off bun scripts/benchmark-renderer.js http://localhost:3000 aerial-city /tmp/readback-off.json
READBACK=on bun scripts/benchmark-renderer.js http://localhost:3000 aerial-city /tmp/readback-on.json /tmp/readback-off.json
```

The script compares **frame p95**, even when both reports have GPU timings.
Reports include readback mode/interval, browser, viewport, backend, scene URL and
quality settings. Repeat in reverse order to assess thermal/order noise. This is
a visual synthetic scene comparison with the existing deterministic camera path,
not a simulation throughput or model/run comparison. No hardware performance
improvement is certified by unit tests.
