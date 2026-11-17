# City Invention Studio

Open `/world/invention/` to search policy plans, combine compatible plans, or pause at a threshold. All views use the same versioned recipe and existing Riverside synthetic City checkpoint at month 2.

- The reverse search evaluates bounded combinations from the same starting checkpoint and seed. Its cost constraint is the sum of proposed catalog costs. The final commute mean uses the trips that were recorded in that month. Trip counts accompany comparisons because the measured group can differ.
- Merge accepts versioned City Plan Replay links from the same seed, horizon, and model. It reruns the baseline, both source policies, and the combined policies. Two variants of the same policy type in one district require the user to choose one.
- Breakpoints evaluate each advanced month and stop after the first matching observation. The pause view shows that month’s system events and policy stages.
- Replay reconstructs a recipe locally. Links preserve the recipe, model version and selected month. Opening a link leaves stored World runs untouched.

Supported policy types are transit capacity, public housing, and zoning capacity. Housing proposals still depend on implementation, construction, and utility headroom. More policy types require corresponding City model support and explicit cost assumptions.

## Neighborhood blueprints (SHE-565)

`/world/invention/blueprint/` edits a session-local design, exports copyable or
downloadable JSON, and previews imports before an explicit replacement. The
recompute link passes only accepted catalog policies to the existing City Plan
Replay. Nothing writes to saved worlds, households or a live service. Reloading
discards the session; export before leaving.

The `neighborhood-blueprint.v1` contract in `blueprint/model.js` requires an exact
City model version, `living-city-commute.v1` source scenario, seed, month-2 start,
1–36 month horizon, synthetic source label and fixed locale-neutral units.
At most nine policies reference exact `parcel-d0`/`d1`/`d2` identities and their
matching districts; amounts and illustrative USD costs come from the versioned
catalog. These parcel IDs identify authored fixtures, not real parcels. Arbitrary
worlds and geographic remapping need a separately verified adapter.

Three optional parcel palette choices are cosmetic swatches only; they do not
alter model state or travel with policy replay links. JSON export retains them.
Imports reject unknown fields, unsupported units/versions/parcels, conflicting
policy scopes, duplicate cosmetics, malformed JSON and payloads over 8192 UTF-8
bytes. No partial application or implicit migration. Confirmation revalidates and
replaces the design, making duplicate imports idempotent. Editing the payload
invalidates its preview. Native labeled form controls and static text provide the
keyboard/reduced-motion/low-end path; no graphics or animation dependency.

Verification:

```sh
bun test test/neighborhood-blueprint.test.js test/city-invention-plan.test.js test/reverse-simulator.test.js test/worldline-merge.test.js test/reality-breakpoints.test.js
bunx playwright test --config test/neighborhood-blueprint.browser.config.mjs
```

An optional DOM interaction check runs with an installed `happy-dom` module:
`HBL_DOM_MODULE=/path/to/happy-dom/lib/index.js bun scripts/check-neighborhood-blueprint-dom.mjs`.
This check does not verify browser layout, keyboard focus or touch behavior.

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

## Raised boundary preview (SHE-670)

Tabletop Block's inspector opens a static isometric SVG extrusion of the selected
`building-proposal.v1` footprint. Proposed X/Z offsets translate that same square
polygon in meters; the reading retains exact numeric coordinates, sqft, the
0.09290304 m²/sqft conversion and model building height. Extrusion thickness is a
visual cue only. `previewBoundary` clones the current drafts and calls `checkDraft`,
including its pairwise overlap and world-bounds checks. Invalid offsets disable
Apply, which revalidates before replacing the local draft. Cancel/Escape clears
the preview and restores focus. Existing Confirm remains the simulation boundary;
Exit discards unconfirmed offsets. No persisted geometry is read or written.

**Parcel editing is unsupported:** blueprint parcel IDs have no boundary geometry.
The preview cannot certify legal parcels, zoning or ownership. A verified parcel
source, identity mapping and parcel-edit validator are prerequisites to full
SHE-670 acceptance. This local increment introduces no synthetic parcel locations,
resident actions or location-dependent model effects.

Rendering coalesces input into at most one pending animation frame and performs
no idle animation. The visible diagnostic reports update count and maximum frame
wait in milliseconds locally; no analytics are sent. Closing, rerendering or
pagehide cancels the pending frame and removes SVG nodes. The static text/form
path is unchanged by reduced-motion preferences and needs no WebGL.

Checks: `bun test test/boundary-preview.test.js test/block-diorama.test.js test/building-proposal.test.js`;
`bunx playwright test --config test/boundary-preview.browser.config.mjs`.
Set `BUN_EXECUTABLE` if the package-local Bun shim cannot start the server.
Optional interaction check:
`HBL_DOM_MODULE=/path/to/happy-dom/lib/index.js bun scripts/check-boundary-preview-dom.mjs`.
