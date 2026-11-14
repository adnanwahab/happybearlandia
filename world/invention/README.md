# City Invention Studio

Open `/world/invention/` to search policy plans, combine compatible plans, or pause at a threshold. All views use the same versioned recipe and existing Riverside synthetic City checkpoint at month 2.

- The reverse search evaluates bounded combinations from the same starting checkpoint and seed. Its cost constraint is the sum of proposed catalog costs. The final commute mean uses the trips that were recorded in that month. Trip counts accompany comparisons because the measured group can differ.
- Merge accepts versioned City Plan Replay links from the same seed, horizon, and model. It reruns the baseline, both source policies, and the combined policies. Two variants of the same policy type in one district require the user to choose one.
- Breakpoints evaluate each advanced month and stop after the first matching observation. The pause view shows that month’s system events and policy stages.
- Replay reconstructs a recipe locally. Links preserve the recipe, model version and selected month. Opening a link leaves stored World runs untouched.

Supported policy types are transit capacity, public housing, and zoning capacity. Housing proposals still depend on implementation, construction, and utility headroom. More policy types require corresponding City model support and explicit cost assumptions.

### Street Sketch (SHE-562)

The Studio links to `/world/invention/sketch/`. Click/tap vertices or use arrow
keys and Enter on the pencil; Backspace or Undo removes the last vertex, and
Redraw clears the sketch. Points snap to a bounded 20-unit schematic grid.
The SVG and textual preview have no animation or GPU dependency.

`city-street-sketch.v1` accepts 2–32 nonconsecutive-duplicate vertices within one
authored district strip. New roads, cross-district edits, mismatched catalog
costs and unsupported transit options refuse before simulation. Supported
proposals map to the existing district transit catalog (capacity +4/+8/+12,
cost 80,000/160,000/240,000 illustrative USD). The geometry has no geographic
scale and does not change network routing. Costs are policy assumptions, not
length-derived estimates or immediate invoices. Existing funding and construction
gates still apply. The comparison uses seed 2911 and months 2–14.

Download retains geometry, cost units, sketch version, complete City recipe,
scenario/model versions and both recomputed arm summaries with event provenance.
This is a local JSON artifact; no persistent city is edited. Editing clears the
old result/download. No geometry replay/import contract is supplied.

Checks: `bun test test/street-sketch.test.js test/street-sketch-ui.test.js
 test/city-invention-plan.test.js`. Native browser checks:
`bunx playwright test --config test/street-sketch.browser.config.js`
(set `HBL_BUN` to an installed Bun path if local package binaries shadow Bun).
