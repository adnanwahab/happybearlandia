# World continuity receipt v1

`contract.js` is a strict navigation transport, separate from canonical Universe
browsing context. `continuityURL(surface, payload)` accepts only World, Future
Machine and Decision Studio destinations. `readContinuity(url)` distinguishes
missing, invalid and carried payloads; duplicate/oversized/future payloads fail
closed. It does not set native experiment/run/month parameters or infer a seed.

Fields: version `world-continuity.v1`, original sourceSurface (`world`,
`future-machine`, `decision`), authority, runId, checkpointId, modelVersion,
entity (null or namespace/kind/id), camera (null or mapping/version and exact
three-component position/target), clock (id/unit/origin/nonnegative integer tick).
IDs are opaque references, not credentials. Do not put private data in a URL.
Clock origin identifies the simulation epoch; equal integer ticks are insufficient.
Camera coordinates are meaningful only in the named versioned mapping; schematic
layout coordinates must never be silently interpreted as geographic coordinates.

`resolveContinuity(payload, authority)` validates against destination-owned loaded
state. Supply the authoritative run/checkpoint/model, exact clock, entity inventory
and supported versioned mappings. Never construct that argument from the receipt.
Compatible returns a detached receipt. Other statuses return no applicable payload:
invalid, unsupported, authority-mismatch, stale, model-mismatch, clock-mismatch,
unresolved-entity, unsupported-mapping. It performs no conversion or model mutation.
A null camera/entity means no requested selection; it does not mean coordinate zero.

The standalone native navigation disclosure uses this transport on the three routes
(including Living World's alternate route). It says that context is carried only
and restoration is unavailable. Missing/invalid context has an explicit fallback
to each destination's native starting view. It uses native details/links with no
animation or storage dependency. Incoming payloads are untrusted: the UI makes no
compatibility claim from URL metadata, even when validation succeeds structurally.

## Remaining adapter prerequisite

No cross-authority camera/entity/clock mapping is established here. Before enabling
restoration, model owners must capture from live selection, resolve actual saved
run/checkpoint, validate before rendering, and apply camera/entity/time atomically
only after resolveContinuity succeeds. Validate native and canonical query conflicts
then too. A recomputed City manifest must retain its recomputation label; do not
invent a recorded checkpoint ID. An enabled contract test uses a synthetic test
inventory, not evidence that World Population and Decision housing are equivalent.
No simulation rules, seeds, source identities or modeled outcomes change.

Checks: `bun test test/world-continuity.test.js`; optional DOM integration uses
`HBL_NAV_DOM=/absolute/path/to/happy-dom/lib/index.js bun test
test/world-continuity-view.test.js`. Type contracts: `tsc -p
world/continuity/tsconfig.json`. Browser interaction: `bunx playwright test
--config test/world-continuity.browser.config.js` (source-document transport,
no model API mocks). No browser execution success is implied by test discovery.
