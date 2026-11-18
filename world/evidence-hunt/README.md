# Neighborhood Evidence Hunt v1

Entry: `/world` → **Neighborhood Evidence Hunt** → **Open pinned demo**.
The module mounts independently of WebGL. Five ordered, keyboard/touch buttons
open a named, focusable Mechanism inspector: housing allocation, a transport
link closure, flood damage, business viability and a household-linked resident
month. Only displaying the exact source JSON credits that clue. There are no
streaks, timers, random rewards, score uploads or automatic simulation actions.
Cancel aborts loading and clears the inspector; already inspected progress stays
local. Reset clears this route’s progress. Storage denial leaves a session-only
hunt with an explicit warning. Local progress is user-editable, never a verified
score or claim that the player understood the mechanism.

`demo.json` is an independently stored, SHA-256-pinned archive recorded by
`record.js:recordDemo`, using Monthly City `city-systems.1.1.0`, seed 714,
30 synthetic households and three integer monthly steps. It retains the complete
initial state and all step outputs/checkpoints, not a recipe substituted at read
time. No measured observations are present. Fixture assumptions: all private
parcel capacities zero; d1 flood risk one; a severity-one d1 flood starts in month
one for two months. All other initial inputs come from the pinned archive.
These are toy-model assumptions, not a real neighborhood or flood forecast.

The route uses a single archive run identity, exact native entity/event IDs,
month and JSON source pointers. Inspector records are unmodified model output;
transport trace rows have no native event ID, so their identity is the exact
archive pointer. Business viability is the existing `demand - cost` rule and
uses its month-three business checkpoint, not an invented closure event. The
resident record retains the Monthly City household/worker identity and before,
after and input fields; it does not map to a daily World Population person.
There is no verified street/location adapter, geographic camera jump or claim
that these sources describe the city currently rendered underneath the panel.
The route wording is scripted flavor; records are simulated outputs, and no
additional causal edge or observed source is inferred.

Runtime fetches only this static archive on explicit request. Hash mismatch,
missing data, timeout and cancellation award no new progress. Old/malformed
progress is ignored or restricted to its valid ordered prefix, scoped to the
archive hash. The browser checks archive integrity, not live model replay.
`test/evidence-hunt.test.js` independently re-executes City from the recorded
initial state and compares all three steps with stored checkpoints. A changed
engine must not silently refresh this fixture: review the model/rules version,
archive, hash, provenance, source pointers and progress namespace together.
No parent checkpoint, City rule, RNG draw or normal run is mutated by this view.

Checks:

- `bun test test/evidence-hunt.test.js test/city-systems.test.js`
- `HBL_HUNT_DOM=/absolute/path/to/happy-dom/lib/index.js bun test test/evidence-hunt-panel.test.js`
- `bun --bun x playwright test --config test/evidence-hunt.browser.config.js`
- Listener-free component fallback: `bun --bun x playwright test --config test/evidence-hunt.component.config.js`. This serves the real World HTML and hunt assets through Playwright routing but suppresses unrelated scripts, so it cannot establish renderer integration.

Native desktop/mobile visual acceptance and browser reload remain dependent on a
working local listener and browser launch. See `docs/reviews/SHE-714.md` for actual
results. The checked-in browser suite is not evidence that it ran successfully.
