# Wander Mode

`/world` exposes an opt-in **Wander Mode** disclosure. The 3D view follows a
four-corner, 344m aerial street loop for at most 24 seconds after its first frame.
Canvas2D and reduced motion use four static views with Next stop. Start again
selects another deterministic candidate, using the town seedKey, `wander.v1`
and a page-local round counter. This hash never consumes a simulation RNG.

The synthetic procedural generator in `../gen.js` defines an 86m grid with
16m streets. The route builder verifies every segment against loaded road
coordinates and every building footprint's bounding rectangle. It selects four
distinct nearby rendered building IDs; labels state their synthetic role and
exact ID. These are cosmetic scene prompts, not observations, accessibility
certification, verified physical pedestrian access or model outputs.

Only `source: procedural` is supported. OSM and saved geometry have no validated
pedestrian access contract and show unavailable. Missing roads/landmarks or any
blocked/flooded building fail closed. Hidden/error geometry invalidates the
selected landmarks before the next camera write. Candidates and route scans are
bounded (64 cells, four stops); selection is cached outside the frame loop.

Escape, End stroll, collapsing the disclosure, page hiding or pointer/wheel/key
input elsewhere stops guidance without restoring or stealing the previous view.
The host render loop supplies time; there is no second loop, timer, fetch,
persistence, analytics, entity remapping or model advancement in this module.
The model continues under its existing playback setting. To compare checkpoint
bytes, pause the model first; natural clock progress is not a Wander edit.

The host adapters change only camera/Canvas2D pan and zoom. No social model rules,
ODD mechanism, seed, input, ID, model clock or checkpoint schema changes. Future
support for sourced maps requires a reviewed walkability/blocked-area contract.
Camera arbitration with pending co-exploration PR #401 needs integration review
before combining those branches.

Checks: `bun test test/wander.test.js`; browser check:
`bun x playwright test --config test/wander.browser.config.js`. See
`../../docs/reviews/SHE-575.md` for actual results and environment blockers.
