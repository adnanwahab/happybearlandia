# City Invention Studio

Open `/world/invention/` to search policy plans, combine compatible plans, or pause at a threshold. All views use the same versioned recipe and existing Riverside synthetic City checkpoint at month 2.

- The reverse search evaluates bounded combinations from the same starting checkpoint and seed. Its cost constraint is the sum of proposed catalog costs. The final commute mean uses the trips that were recorded in that month. Trip counts accompany comparisons because the measured group can differ.
- Merge accepts versioned City Plan Replay links from the same seed, horizon, and model. It reruns the baseline, both source policies, and the combined policies. Two variants of the same policy type in one district require the user to choose one.
- Breakpoints evaluate each advanced month and stop after the first matching observation. The pause view shows that month’s system events and policy stages.
- Replay reconstructs a recipe locally. Links preserve the recipe, model version and selected month. Opening a link leaves stored World runs untouched.

Supported policy types are transit capacity, public housing, and zoning capacity. Housing proposals still depend on implementation, construction, and utility headroom. More policy types require corresponding City model support and explicit cost assumptions.

## Neighborhood palette workshop

The hub includes a static SVG schematic with independent architecture, vegetation
and lighting aesthetics (original, cozy, futuristic, whimsical), side-by-side
original/current previews and a textual diff. These are authored synthetic
artwork, not City geometry or verified model outputs. No CityState, budgets,
identities, clocks, seeds or causal records are read or changed. Live World
materials remain owned by the separate renderer feature (SHE-521 / PR #372).

Save stores only the exact `neighborhood-palette/1` recipe with three preset IDs
under browser-local `hbl.neighborhood-palette.v1`. Reload validates the complete
schema and reapplies the same artwork. Unsupported/corrupt recipes and denied
storage show explicit status and leave preview available. Reset restores original
artwork and removes this key; a failed removal is disclosed. No account, network
service or sharing is used. Static bounded SVG requires no WebGL or motion; native
labeled selects/buttons, visible focus and live text diff support keyboard access.
