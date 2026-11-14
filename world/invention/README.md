# City Invention Studio

Open `/world/invention/` to search policy plans, combine compatible plans, or pause at a threshold. All views use the same versioned recipe and existing Riverside synthetic City checkpoint at month 2.

- The reverse search evaluates bounded combinations from the same starting checkpoint and seed. Its cost constraint is the sum of proposed catalog costs. The final commute mean uses the trips that were recorded in that month. Trip counts accompany comparisons because the measured group can differ.
- Merge accepts versioned City Plan Replay links from the same seed, horizon, and model. It reruns the baseline, both source policies, and the combined policies. Two variants of the same policy type in one district require the user to choose one.
- Breakpoints evaluate each advanced month and stop after the first matching observation. The pause view shows that month’s system events and policy stages.
- Replay reconstructs a recipe locally. Links preserve the recipe, model version and selected month. Opening a link leaves stored World runs untouched.

Supported policy types are transit capacity, public housing, and zoning capacity. Housing proposals still depend on implementation, construction, and utility headroom. More policy types require corresponding City model support and explicit cost assumptions.

## Tabletop Block (SHE-567)

`/world/invention/diorama/` is a separate, synthetic local housing-model sandbox.
Two stable `block-home-*` building-proposal.v1 identities occupy a 200 m square.
DOM miniatures use footprint-square dimensions in meters; the table needs no
WebGL, animation or remote service. Select with the inspector or a handle; drag,
use arrow keys in 5 m increments, enter coordinates, or rotate 45 degrees.
Pointer cancellation rolls back that gesture. Escape/Exit discards unconfirmed
changes and restores the local schematic view transform and entry-button focus.
This is not the camera of a saved World runtime.

Only Confirm calls `confirmBlock`, which checks all proposals, pairwise overlap,
bounds and unique IDs before running housing 1.2.0 for seed 42/months 0–120.
Every run starts from the same model baseline; confirmation replaces this local
experiment rather than accumulating homes. Proposal IDs and native lifecycle
approval events/monthly states remain in the returned run. Moving a building
changes placement validation but does not model neighborhood location effects.
Estimated costs/subsidy are synthetic assumptions, and actual spending and delivery
come from the model. There is no zoning, utility, road or ownership validation;
the UI displays these existing validator limitations. No new agent model, model
rule, cross-model ID mapping, persistence, or saved-World mutation is introduced.

Checks: `bun test test/block-diorama.test.js` and
`bunx playwright test --config test/block-diorama.browser.config.mjs`.
Browser acceptance and before/after screenshots require a host that permits server
binding and Chromium launch; see `docs/reviews/SHE-567.md`.
