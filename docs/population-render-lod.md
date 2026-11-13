# Population display LOD v1 — SHE-155

Living City's normal People layer uses camera-to-orbit-target distance in world
metres. Below 350m it retains bounded worker-provided individual positions;
350–899m uses 9-pixel sprites at centroids of fixed 40m sample cells; at 900m
and above it shows worker district population heat. The selected sampled
resident remains individual at every distance. Other analysis layers retain
existing rendering. No model step or random draw happens during LOD selection.

Heat is the full synthetic district resident count, not current street occupancy.
It remains unfiltered when sample filters change. Clusters summarize only the
filtered sample (maximum 500), never all residents; their IDs cannot be selected
as a person. Heat has no invented individual identity. Cluster cell membership
uses received positions; individual movement retains existing interpolation.
Thresholds are initial display choices, not measured hardware optima. There is
no hysteresis yet. Fixed district heat scales are recomputed per frame, so this
is not a cross-run comparative heatmap.

The persistent toolbar counts worker synthetic resident records separately from
drawn individuals, cluster marks and heat cells. These are submitted display
items, not pixel visibility after occlusion. A multipart human counts once.
Represented population weights, independent updates and interaction rates cannot
be inferred from these counters. Missing resident totals are unavailable. This
adapter does not satisfy the million-interacting-agent claim in agent-counts.md.

Low capability path: the existing explicit Living City WebGPU requirement
remains. The non-WebGPU Living City path is disabled with a visible notice and
retry link; no Canvas2D crowd or fallback model execution is claimed. Other host
surfaces retain their existing fallback. A Canvas2D Population adapter remains
follow-on work.

Deterministic fixture: three synthetic received positions, 10,000 worker
resident records, one district; no RNG (seed not applicable), display rules
population-display-lod.v1. Tests traverse all levels against the identical
serialized frame, conserve sampled identities, test thresholds, selected ID,
disabled counts and cleanup. Existing marker/picking tests explicitly request
resident mode to retain their specific coverage.

SHE-261 extends the middle distance: current travelers remain individual moving
points (or nearby mode instances), while only stationary sampled residents enter
clusters. Individual and cluster counters reconcile separately. At >=900m the
existing heat/selected-person policy remains. Car/bus/rail shapes use committed
mode and endpoints for heading; bus/rail shapes identify passengers, not shared
vehicle services. Hover shows synthetic name, destination activity and planned
minutes; a normal unhandled click selects and follows, while existing person
command interception and manual-pan cancellation remain supported. Trip geometry
is still a straight-line model approximation, not a road or sidewalk path.
