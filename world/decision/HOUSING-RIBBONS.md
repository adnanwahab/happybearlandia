# Housing ribbon contract v1

Entry: `/world/decision.html` → run housing example → select a completed future.
`visualizations.js` renders `housing-ribbons.js` alongside selected-run replay.
The panel covers the whole annual horizon, independent of the replay slider.

Only `housing.v1` / `1.2.0` is supported. Read-only inputs are persisted
`run.timeline[].{year,metrics.housing_supply}` (homes) and the unique matching
`run.events[]` with type `annual-accounting`, year, month = year × 12, and
`households` (modeled households). Year zero has no household ledger and is omitted.
Duplicate years/ledgers, missing, negative, nonnumeric and nonfinite values cannot
supply comparisons. Missing values display unavailable. No gap is connected.
Neither vacancy nor homelessness proxies are used to infer demand.

Display assumption: one home per modeled household converts households to home
equivalents. Supply and demand therefore share a zero-based home axis; this does
not assert observed need, occupancy, market equilibrium or demographic counts.
Exact equalities and sign reversals in adjacent annual observations are selectable.
Sign reversals use explicitly labeled linear interpolation, not event timing.
Selection cites bounding model years/months, original array paths and values,
units and run ID. Run JSON and panel identity retain experiment/scenario/seed/model
and engine identifiers. No entity/geographic mapping exists.

The SVG is a static orthographic projection of ribbons with decorative depth and
width, common to both series. The always-visible table is the readable 2D fallback.
No animation, WebGL resources, textures, timers or global handlers are allocated.
Rerender replaces owned nodes; detached button closures become collectible with
those nodes. Actual consumer-device frame timing and disposal measurements remain
unavailable; no performance acceptance claimed.

Observed sources: none introduced. Existing sources/assumptions remain in the
run and [housing model description](../models/housing/README.md). Numbers here are
computed synthetic aggregate outputs. Geometry is decorative. No social/agent
mechanisms, probabilities or causal attribution are added; ODD inventory unchanged.

`test/fixtures/housing-ribbons/crossing.json` is an authored, deterministic synthetic
contract fixture (seed label 42, not an executed run). It deliberately crosses at
interpolated year 1.5 and omits year-three demand. The unit suite separately runs
the real seeded housing model twice. `preview.html` is a local visual fixture;
`test/housing-ribbons.browser.config.js` checks rendering, inspection and mobile
width. Fixture screenshots do not establish the full application journey.
