# Urban Noise Playground — urban-noise.v1

Normal entry: `/world` → Ambient sound → Urban Noise Playground. Opt in to
illustrative traffic, raise the shared Sound volume, then move the view using
normal World navigation. The listener is the orbit/view target (`x,z`), not a
resident's ears. This is a separate toggle from cosmetic ambience and the shell's
Sound pill; the shared Sound volume mutes this demo. It resets off every visit.

## Contract and provenance

`proximity({x,z}, fixture=FIXTURE)` takes finite local World coordinates. Fixture
`{version:'urban-noise.v1',seed:null,source,segments:[{id,ax,az,bx,bz}]}` has 1–32
finite segments. Version mismatch, absent listener, empty/malformed source data
returns null and the UI explicitly reports missing data while muting playback.
A zero-length segment is a point. No RNG, clock or simulation authority is used.
The frozen representative fixture in model.js is the versioned reproduction input.

Observed acoustic sources: **none**. World geography, where sourced, is context
only. The two authored road segments are a synthetic local-coordinate exercise,
not an extraction of the visible streets or a count of vehicles. They stay fixed
as the view moves. No correspondence to real roads is asserted.

Computed effect: shortest 2D point-to-segment distance, then artistic strength
`1/(1+(distance/40)^2)` within 400 world units; zero outside. Height, barriers,
reflections, materials, traffic rates, hearing and atmospheric effects are omitted.
The displayed 0–1 strength has no physical calibration or decibel interpretation.

Decorative audio: seeded procedural avenue loop from ambient/mixer.js (local seed
516), no recordings, speech, music, network requests or simulation RNG consumption.
The demo caps its volume input at .15; the mixer multiplies by .38 and strength,
so the gain target is at most .057. Device volume and perceived loudness vary;
this is not a hearing-safety certification. Existing cosmetic ambience is unchanged.

## Lifecycle and verification

Audio allocates lazily after a gesture. Shared volume starts at zero unless saved.
Hidden pages suspend audio; pagehide disposes sources, buffers, nodes, subscriptions
and DOM via the existing ambient owner. Pending resumes cannot undo disposal or
a newer toggle. Unsupported Web Audio reports unavailable and stays silent.
The reused mixer allocates three fixed 2-second mono loops (529,200 decoded bytes)
per active demo; it does not allocate sources per frame. No new graphics, animation,
social mechanisms, population counts or causal outcomes are introduced; ODD rules
are unchanged. The panel has a viewport-bounded scrolling area.

Checks: `bun test test/urban-noise.test.js test/ambient-sound.test.js test/game-sounds.test.js`;
`bunx playwright test --config test/urban-noise.browser.config.js` for the focused
desktop/mobile normal-entry, labels, keyboard toggle, volume, reset and screenshot.
Consumer-device listening, frame time and resource-disposal profiling are still
required; mock lifecycle tests do not establish hardware results.
