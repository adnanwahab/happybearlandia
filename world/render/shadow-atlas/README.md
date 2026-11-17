# Tree-Shadow Atlas

3D `/world` → Graphics / F3 → Tree-Shadow Atlas. Drag the native sunlight
range or use arrow keys. The control sets the existing visual hour only, without
stepping the simulation. The scene sun and atlas use `visualSun(angle)`.
The separate Canvas2D fallback has no atlas.

Contract: `atlasGeometry(buildings, sun)` accepts loaded town buildings with
stable `id`, `kind`, `poly: [x,z][]` in projected world metres and finite positive
`height` in scene metres. Parks are receivers, never elevated casters. Invalid
footprints are omitted; missing heights produce footprint only. Preserve IDs.
Town `source` and attribution are displayed verbatim as text. OSM footprints can
be observed source geometry; scene heights may be synthetic. Procedural/synthetic
towns are assumptions, not observations. No tree inventory adapter exists. Null
or missing tree data means unavailable, never zero surveyed trees. Existing
procedural vegetation is decorative and excluded.

`flat-ground-extrusion-v1`: for sun vector (x,y,z), translate roof points by
(-x*h/y,-z*h/y), then project every wall quad. No shadows below the horizon.
The vector is the authored visual light trajectory (06–20 visual hours), not
astronomical time or a geographic ephemeris. Ground is flat y=0. Walls/roofs are
opaque extrusions. No canopy, terrain, occlusion exposure, solar energy, health
or comfort model. Opaque shared shadow color prevents overlap darkness encoding
an unsupported metric. SVG clips long shadows to footprint extent plus 20m.
First 500 valid loaded footprints only; streamed geometry isn't ingested.
Missing all geometry displays Unavailable. No RNG, social agents or run mutation.

Fixture: `test/fixtures/shadow-atlas.json`, versioned synthetic park and 10m
building, seed null (no randomness). Tests assert exact projections, determinism,
source identity, reverse direction, invalid/missing input and night.

Work occurs only while the atlas is expanded and angle changes; no new frame
loop, GPU buffers or textures. Destroy removes listeners and DOM. Hardware
frame-time and resource-disposal measurements are unavailable; DOM removal is
covered by the pending focused browser check, not proof of GPU acceptance.
