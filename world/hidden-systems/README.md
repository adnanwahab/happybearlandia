# Hidden Systems presentation

`model.js` runs the existing monthly City engine twice with a shared seed and
explicit synthetic fixture assumptions. It projects project cost and delay
overrun directly from City state; neither represents an actual spending ledger.
The recipe, model clock, events, IDs and simulation rules are unchanged.

`choreography.js` selects only same-project, exact-month construction start,
topping-out or completion events. Any delay in that checkpoint suppresses the
sequence, even when City records partial progress. No intermediate milestone,
delivery measurement or site observation is inferred. `theater.js` presents a
labeled cosmetic overlay, with a maximum three-second CSS sequence, a keyboard
Skip sequence button, no frame loop, and reduced-motion/save-data suppression.
Geometry remains schematic. The CSS elevation works without Three.js/WebGL.

Every render replaces the previous effect; camera actions do not start it.
`pagehide` stops playback, terminates the active worker and destroys all views.
The theater disconnects its observer, removes its media listener, and disposes
geometry, materials and WebGL context. A bfcache return reloads the disposed view.

Verify with `bun test test/hidden-systems*.test.js` and
`bun --bun x playwright test --config test/hidden-systems.browser.config.js`.
Browser configuration uses disposable in-memory World data. No live services are
required. The browser suite includes before/after captures from HEAD and the
working source; those are evidence only after a successful actual run.

Energy Control Room is linked from this page at `energy.html`. It uses a separate
pinned aggregate toy (`energy-model.js`), never City utility records. Source,
assumptions, versions, seed, flows and immutable checkpoints are visible. Session
replay verifies retained evidence; restart discards only this attempt. See
`docs/models/energy-control-room.md`. No measured grid observations exist.
