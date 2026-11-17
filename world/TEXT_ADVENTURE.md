# Renderer-independent text inspection

Open `/world?text=1` (also linked from World and the WebGL fallback). The server
selects a dedicated document before the generic World static route. It loads no
World renderer, audio, session recorder or sharing surface. It executes the
existing Population worker, initially paused, with 16 people, seed 42,
`snapshotId: text-adventure.v1`, empty geography context and 30-minute steps.
All remaining parameters are the Population version's defaults; the UI exposes
the complete validated config, resident rules, model version, source provenance,
reset inputs and committed runtime identity/tick. Model assumptions are described
in [the Population model card](population/MODEL_CARD.md).

This is fresh synthetic state starting at midnight, not an existing saved World,
real people, or geographic observations. Additional query parameters and hashes
are rejected before worker creation to avoid substituting synthetic evidence for
saved, restricted or foreign runs. No request to a saved-run API occurs. This
refusal is not a saved-run authorization implementation.

Look lists finite-position resident records within 500 world meters of (0,0),
sorted by distance and exact ID, from the runtime's retained visible sample.
Inspect selects the same worker actor. Advance commits one existing model step;
no automatic clock or new resident commands are introduced. Early at midnight,
residents may have no retained decisions; advance through their modeled day.
Decision events use only `decisionTrace` entries whose actor matches the resident;
current inspect-only alternatives never become recorded events. WHY shows the
exact event's retained inputs, alternatives, random draw and reason codes, with
missing inputs explicit. Resident and household count summaries use the actual metrics with explicit units.
Other raw metric fields are expandable and labeled as such;
no units, causal edges, observations or narratives are inferred by this view.

`mountTextAdventure({root,runtime})` accepts an existing Population-compatible
runtime (getSnapshot, inspectPerson, step, destroy). The caller owns identity,
authorization and clock mapping. Only the fresh synthetic entry is wired today;
City, housing, saved World and House adapters are not claimed. No model rules
or ODD mechanism changed. Clearing destroys the local worker and removes its
inspection; no persistence or sharing is created. Reload begins a fresh run.

Controls are native buttons, grouped as allowed commands. Each navigation moves
focus to its new heading; failures return focus to Look after controls unlock.
The layout has no animation, canvas, pointer-only interaction or audio.

Checks:

```
bun test test/text-adventure.test.js test/world-webgpu-only.test.js test/population-world-view.test.js
HBL_BUN_BIN=/absolute/path/to/bun bunx playwright test --config test/text-adventure.browser.config.js
```

`HBL_BUN_BIN` avoids an uninitialized optional `node_modules/.bin/bun` when
dependencies were installed with scripts disabled. `HBL_PLAYWRIGHT_PORT` can
select a free port. Browser checks use temporary local stores and Chrome.
