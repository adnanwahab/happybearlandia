# Synthetic particle diagnostic (SHE-1053)

This is isolated proof infrastructure, not final product integration. SHE-1048 owns the World entry point. No shared renderer, model, columns or accepted fixture changes.

From the repository root:

```
bun test test/city-xray-particles.test.js test/city-xray-columns.test.js test/city-xray-contract.test.js
bun build world/city-xray/particles-demo/app.js --outdir /private/tmp/SHE-1053-build --target browser
bunx playwright test --config test/city-xray-particles.browser.config.js
```

For manual viewing: `XRAY_PORT=41053 bun --no-env-file world/city-xray/particles-demo/serve.js`, then `/world/city-xray/particles-demo/index.html`. `?noGPU` exercises disclosure. Artifacts go outside source to `/private/tmp/SHE-1053-browser`; upload with the exact committed source SHA through trusted CI before external acceptance.

## Host API

`mountParticles({scene,renderer,frame,metricId,seed:1053,capacity:18000,reducedMotion:false})` returns `ready`, `update(frame)`, `setTime(seconds)`, `setEnabled(boolean)`, `stats()`, `data`, `dispose()`. Host owns rendering, camera, frame scheduling and reduced-motion preference. Await `ready` (false on initialization failure); `dispose` is idempotent, including before ready. A lost device releases resources and cannot be re-enabled; remount after host recovery. A fallback renderer may mount this layer, but never qualifies as native acceptance. No renderer or scene disposal by the layer.

`update` pins identity, coordinates and the exact source clock; cosmetic time never substitutes for a source checkpoint. A changed source run/checkpoint requires remounting. Invalid updates fail before replacing data. `setTime` accepts finite nonnegative seconds, modulo 12 for the pulse, supports reverse seeking and repeat without instance uploads. Pause means stop calling `setTime`. Reduced motion fixes shader phase zero even when selected time changes. There is no animated travel or recorded-history interpolation. Disabling releases all layer buffers/material; re-enabling reconstructs the same seeded distribution and phase. Updating static frame data rebuilds transforms; do not do that per frame.

Versioned display generator `road-spark-v1` uses its own uint32 LCG. It samples roads uniformly; 65% of lights cluster near endpoints, 35% lie along arc-length road segments, with bounded lateral jitter and height 1–4 local units. Fixed declared synthetic intensity / maximum maps color using the existing column ramp. No metric-to-population mapping exists; density is a display assumption independent of intensity. Zero/null/absent road values produce no lights. Only synthetic-demonstration provenance and synthetic-symbols metrics are accepted. Capacity 0–24000 is a host quality budget; default18000. At most one instanced plane draw, no textures, one radial additive TSL falloff, real depth test and no depth writes. `stats` counts live CPU-backed attribute/index bytes, not peak VRAM, driver allocations or total process memory. Additional renderer output passes are outside this structural draw budget.

Reference is download.png SHA256 c471a5dfd8b3540757479f4ffaef42c23d7a83e09245e2f0c13e71dc8a2fac34. Schematic diagnostic has no photographic buildings/basemap. Host visual review must judge light size, intersection density and additive glow in the integrated scene. Current ground-oriented sprites target the aerial view; near-horizontal views foreshorten them.

The browser performance test excludes30 warmup frames and reports p50/p95 of120 CPU render+GPU queue completion samples. These are not GPU timestamp durations. Native tests require nonfallback adapter and on/off pixel differences at1440×1000 and390×844. Physical phones and peak VRAM are not measured. GPU loss/cleanup is unit-tested with a controlled device-loss promise; real device loss remains a host check.
