# City rendering

`/world?demo=1` uses the installed Three.js 0.186 WebGPURenderer, with its WebGL2 backend fallback. `?renderer=webgl` forces fallback. All Three modules are served locally through the curated vendor routes; there is no CDN version mismatch.

The Graphics button or F3 opens performance and graphics controls. Lighting defaults to the active simulation clock; select daylight/golden hour/night for manual visual overrides. These are visual overrides only. The scene uses a procedural blue sky and cloud layer, muted masonry palettes, dark weathered roof materials, reflection-tinted windows, and instanced multi-lobe park/street trees. Double-click a building to focus it; its inspector provides Focus and Cutaway. Geometry detail is independent of render resolution. Photo mode temporarily chooses ULTRA and restores the previous preset.

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

## Global illumination (GitHub44 / SHE-250)

The GLOBAL ILLUMINATION button opts into local Three.js SSGI on WebGPU. It starts
off; off bypasses the scene/GI passes entirely. This screen-space approximation
adds indirect lighting and occlusion using visible color, diffuse color, normal
and depth buffers. It cannot see offscreen light or replace path tracing. The
bounded24-sample preset has additional GPU cost and no temporal filter. Targets
follow renderer size/pixel ratio; page exit disposes pipeline, GI and scene pass.
WebGL2/Canvas2D show UNAVAILABLE and retain direct rendering. Initialization or
render failure disables GI and restores the direct path. Simulation inputs,
clocks, saved state and hashes are never read or written by this presentation
control. `window.hblGlobalIllumination.getState()` reports the current capability
and toggle state for diagnostics.

### Simulation lighting (SHE-262)

Fixed authored solar hours (06–20), twilight palette and weekend tint follow the
active World authority, with Monday at elapsed day zero. These are presentation
assumptions, not observed astronomy. Population `buildingHomeCounts` includes
every assigned individual, independently of the visible sample: `residents`
and `atHome` use homeLocation ID and the House `personAtHome` predicate.
Façades use atHome/residents; stable shader cells approximate that fraction.
Visitors do not inflate resident counts. Synthetic home anchors may have a
nonresidential geographic kind. Work/office lights are closed outside weekday
08–18 even when the synthetic model assigns homes there. Buildings without
residents use current recorded occupancy during allowed hours. Unmapped buildings remain dark. Street lamps and decorative
vehicle headlights fade in at dusk. Vehicles remain illustrative traffic.
Canvas2D uses the same scene sky color, without window or lamp shading.

## Dual budgets (SHE-165)

Graphics/F3 separates `RENDER` from `SIMULATION`. `getPerformanceStats().simulation`
is a read-only Population projection while Living City is active, otherwise null.
The host supplies `setSimulationSource(readSnapshot)`; this reader cannot drive a
step. Renderer features and quality settings do not receive the runtime.

Render FPS is animation cadence; the frame callback CPU estimate includes host
work/submission and is not GPU execution time. GPU values only come from the
supported asynchronous timestamp-query profiler; unavailable stays unavailable.
Geometry buffer bytes are a partial estimate, not total device memory. Textures
have counts but no byte accounting. Visual instances, HLOD and blades are never
agent counts.

Population reports allocated independent resident states separately from weighted
represented residents. **Active changed residents is unavailable**: the current
snapshot has no full-state, per-window change counter under SHE-141 semantics.
Interactions/s is also unavailable: events, social memories and sampled avatars
are not a complete validated pair-interaction counter. No reference-fixture rates
are substituted for live production work. Simulation memory is unavailable.

Compute step is a CPU wall-clock estimate: elapsed live advance request divided
by its fixed-step batch size, including queue, transfer, packing and snapshot work.
It is not worker-only compute or GPU compute. The last committed sample includes
batch size and age, remains visibly paused when paused, and clears on reset or
checkpoint restore. Timing is outside serialized model/checkpoint provenance.
Model version, seed, runtime/revision, tick and modeled minute are retained in the
projection. The overlay is supported on WebGPU and WebGL2. It is **disabled on the
separate Canvas2D fallback**, which never mounts `mountCityRenderer`.

Verification: `bun test test/dual-budget.test.js test/render-performance.test.js
test/gpu-readback.test.js`; browser journey/recording:
`HBL_FM_PORT=39966 bun x playwright test --config test/dual-budget.browser.config.js`.
The browser test hashes full decoded model checkpoints before/after graphics
changes and records before/after screenshots plus video. See
`docs/reviews/SHE-165.md` for actual execution limits; the test existing is not
proof it passed.
