# Public Square

Entry: `/world/civilization/` → Public Square. This is a presentation page,
not a social model. Static schematic stage and at most 48 decorative figures;
no animation, GPU context, external asset, timer or simulation mutation.
Reduced-motion users receive the same static scene. Uncheck figures for a text
and stage fallback. View presets change schematic composition, not a model camera.

## Sources

Import a JSON result of the existing culture engine's `snapshot()` (not
`serialize()`). Maximum file size is 1 MiB. The engine currently has no normal
snapshot-download control; supplying this local artifact is an external
prerequisite. This page does not claim to load a saved World run automatically.
No upload, persistence or service is enabled. User-supplied records cannot be
authenticated and are labeled accordingly, never as verified observations.

The read adapter accepts `culture.v1`, a string seed, integer nonnegative minute,
up to 128 active events and 256 retained history rows. It reads festival-category
records from activeEvents and EVENT_STARTED history only. Pending/upcoming
schedules, incidents and absurd events are excluded. Duplicate IDs must agree
on projected fields. Invalid recognized gatherings reject the import; unknown
catalog types are omitted. Title comes from the versioned catalog, not HTML
from a file. All rendered source strings use textContent.

IDs, district IDs, source, seed and `[startMinute,endMinute)` are retained without
mapping them onto Population residents, City runs, wall time or geographic
coordinates. The slider inspects a retained interval only; it cannot replay the
model or establish actual attendance. Retention means the list is incomplete.
Cosmetic stage and crowd positions have no causal meaning. A recorded festival
is not proof of policy success or of people occupying a civic stage.

Fictional festival mode requires explicit selection and permits a session-only
authored name. Its scene is labeled as fiction with no modeled event, seed or
timestamp. Changing modes never writes to the culture engine or other state.

File reads use a revision guard; stale reads cannot replace newer input. Pagehide
invalidates reads, releases imported data, aborts UI listeners and clears crowd
nodes. A back-forward-cache restore reloads to avoid stale records. There are no
GPU buffers, renderer loops or camera controllers to dispose.

## Checks

- `bun test test/square-gatherings.test.js test/culture-simulation.test.js`
- `bun build world/civilization/square/page.js --target browser --outfile /tmp/square.js`
- `node test/square-browser-smoke.cjs` (installed Playwright/Chromium required;
  optional `HBL_PLAYWRIGHT_PATH` for an existing installation).

The smoke script routes repository static files in memory, enters through the
hub, checks desktop/mobile, keyboard, reduced-motion preference, native-format
fixtures, failure, rapid time/view changes and pagehide disposal. It writes
square-specific before/after screenshots. This static transport does not verify
Bun server routing; additionally open the entry path against `bun run start`.
See `docs/reviews/SHE-523.md` for actual results and remaining browser acceptance.
