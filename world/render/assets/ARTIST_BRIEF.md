# Close-up city assets

First useful delivery: a small mown-grass clump, a broadleaf tree, and a park bench. Procedural grass already works without any external assets. Custom meshes are an optional visual upgrade.

## Export conventions

- GLB, metres, Y up; apply object scale. Ground-center pivot at (0,0,0).
- Use standard metallic/roughness PBR materials. Embed textures in the GLB.
- UV0 for textures, exported normals; tangents when using a normal map.
- Static meshes for this instanced-detail importer; no rigs/morph targets or baked scene lights/cameras.
- Start with plain GLB geometry and PNG/JPEG textures. Draco/Meshopt and KTX2 need their decoder paths configured before delivery.
- Keep material slots few: each slot is a draw per visible instance batch. Avoid glass transmission and alpha blending for foliage; use opaque geometry or MASK alpha cutout.

## Initial engineering budgets

These are starting budgets to tune on the M4 Air, not benchmarked limits.

| Asset | Suggested dimensions | LOD0 triangles | Materials | Textures |
|---|---|---:|---:|---|
| `grass_clump_a.glb` | 0.3–0.5m footprint, 0.12–0.35m high | 60–180 | 1 | up to 1K shared atlas |
| `tree_broadleaf_a_lod0.glb` | 7–12m high | 1,500–3,000 | 2 | 1K–2K bark/foliage |
| `tree_broadleaf_a_lod1.glb` | same scale and pivot | 250–600 | 1–2 | reuse atlas |
| `bench_a.glb` | about 1.8m wide, seat height 0.45m | 300–800 | 1–2 | 1K shared atlas |
| `shrub_a.glb` | about 0.8m high | 150–500 | 1 | reuse foliage atlas |

For grass, put roots at Y=0 and tips at positive Y. Gentle blade curvature and some dry blades will help. The current procedural grass supplies GPU wind; imported GLB instances remain static, so author a convincing resting silhouette. A separate grass material adapter would be needed to animate custom clumps. LOD files can be supplied now, but automatic GLB LOD switching is not implemented yet.

## Integration

Place files under `world/render/assets/models/` and load the resulting same-origin URL. Example:

```js
const bench = await window.hblCityRenderer.loadDetailAsset({
  url: '/world/render/assets/models/bench_a.glb',
  category: 'props',
  maxDistance: 65,
  maxTriangles: 1000,
  maxParts: 2,
  transforms: [
    { position: [12, 0.3, -8], rotation: Math.PI / 2, scale: [1, 1, 1] },
    { position: [18, 0.3, -8], rotation: Math.PI / 2, scale: [1, 1, 1] },
  ],
});
bench.dispose(); // unload geometry, materials and textures when no longer needed
```

One load shares geometry/materials across all supplied transforms. Reuse that handle rather than loading the same file once per object. The importer filters instances by distance and adaptive density and rejects models over the supplied triangle/material-draw budgets. `getGeometryStats().assets` reports loaded instances and draw counts. Graphics exposes an `assets` toggle for A/B checks.
