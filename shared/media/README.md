# Presentation media pipeline (v1)

Animation and audio acquisition uses `createMediaPipeline().load(id, kind, url)`.
Stable identities deduplicate concurrent loads; conflicting identities reject.
HTTP and budget failures remove their entries so the caller can retry. A scene
owns its pipeline and calls `dispose()` to cancel acquisition and release cache
references. Consumers own decoded Three resources, audio elements and blob URLs.
Only the two browser-safe JS modules are exposed by the server.

| Resource | Enforced engineering budget per mounted scene |
| --- | --- |
| Animation encoded assets | 4 MiB total |
| Audio encoded assets, including codec fallbacks | 2 MiB total |
| Combined encoded assets | 6 MiB total |
| Character clips | 32 clips; 512 tracks; 200,000 keys; 120 seconds per clip |
| Audio voices | One active voice per game/household surface |
| Recorded-divergence cinematic | One active clock; 60 seconds maximum |

Byte counters include in-flight streams and cached assets. Actual chunks enforce
caps even when Content-Length is missing or incorrect. Decoding can temporarily
consume more memory; these are encoded byte and animation-work limits, not total
CPU/GPU/decoder memory measurements. GLBs must embed all buffers and images;
`validateEmbeddedGLB` runs before GLTFLoader parsing. `validateAnimationClips`
checks parsed clips before they become playable. Over-budget bear assets use the
existing capsule fallback; unavailable audio does not block gameplay.

Normal entry points: `/game/1` loads the existing bear (14,456 bytes) and lazily
loads the existing collision sound (86,723 bytes) after volume opt-in. Household
moment cues in `world/house/sound-effects.js` use the same loader, including WAV
fallbacks within the audio cap. The standalone Soundboard remains an audition
page. Static scenery importers retain their existing separate geometry budgets.

`createMediaPreferences` stores `hbl-media-v1` locally: `motion` is `system` or
`reduce`, volume is 0–1 (default 0). Reduced motion always honors the OS preference.
Game and household controls persist the same preference schema; the comparison
scene reads it and observes live OS changes. It snaps camera moves and removes
animated change effects when motion becomes reduced. The game suppresses walking
cycles, rotating lights and collision glow fades. Gameplay physics and recorded
simulation time continue normally. Volume updates the active voice and zero stops
it; pending sound loads cannot start after muting or teardown.

The existing recorded-divergence director supplies play, pause, skip and replay
through `/world/future-machine.html`. Skip reaches recorded Month 120; replay
uses the current matching run from Month 0. The six-second divergence hold and
recorded event identities are preserved. It has no new music or synthetic causal
claims. SHE-157/SHE-164 remain In Review; this checkout's recorded-change effects
are reused rather than inventing a missing cross-entity causal pulse graph.

Focused checks:

```sh
bun test test/media-pipeline.test.js test/game-sounds.test.js test/two-futures-demo-controller.test.js test/future-machine-effects.test.js test/future-machine-ui.test.js test/future-machine-scene.test.js
bunx playwright test test/e2e/media-pipeline.e2e.js test/e2e/game.e2e.js
```

Browser validation must verify audible playback, codec fallback and rendering on
real target devices. No Safari/WebGPU timing or decoder-memory certification is
claimed by the unit tests.

## World cosmetic ambience

`/world`'s Three scene mounts `world/ambient/controls.js`. The ambient checkbox
resets off on every mount, independently of the persisted shared volume. Both
controls are in a keyboard-accessible details panel. Unsupported/embedded
renderers stay silent. No microphone, voice, analytics or network audio is used.
Three local two-second mono 22,050 Hz loops use 529,200 decoded bytes total,
bounded below the shared 2 MiB audio cap, with zero encoded asset bytes. No
pipeline fetch is needed for generated buffers. Three fixed sources and panners
crossfade with a 250 ms time constant; selection samples at most four times per
second. No source allocation occurs during camera or timeline changes.

The read-only adapter uses camera height/target, building centers/kinds, and the
active legacy or Living clock in minutes. Above 100 m selects skyline; a park
center within 65 m selects park; four building centers within 100 m selects an
avenue mood; otherwise skyline. Night is before 06:00 or from 20:00. These are
cosmetic assumptions, not traffic measurements, noise estimates or model rules.
Stereo position is an authored target-x bias, not geographic acoustic simulation.
Empty geometry uses skyline; missing target/time yields silence. Audio remains
smooth under reduced motion; it adds no visual animation. Hidden documents
suspend audio and pagehide stops/disconnects sources, releases buffers, closes
the context and removes controls/subscriptions. Audio API failure leaves gameplay
silent. Target-device listening and browser verification remain required.

## Presentation motion (SHE-443)

`motion.js` exports the frozen canonical `motionTokens`: feedback 180 ms,
transition 250 ms, instant 0; standard easing; content/navigation/inspector layers.
`motion-entry.js` mounts these as `--hbl-duration-*`, `--hbl-easing-*` and
`--hbl-layer-*` properties on the homepage, Future Machine and Decision Studio.
Homepage card feedback and Studio button/reveal transitions consume those values.
Existing title hue cycles and recorded cinematic holds have separate semantic
purposes and are not UI transition durations.

Same-origin full-document navigation opts into native View Transitions when the
browser supports it; other browsers retain normal navigation. Local UI updates
can use `createMotionAdapter({document,preferences}).transition(update,{focus})`.
Updates run exactly once, errors propagate, optional focus follows the committed
update, and overlapping commands commit immediately. Dispose cancels capture.
No links are intercepted, no history entries or context IDs are rewritten.

Reduced motion is OS reduction OR the existing local `reduce` preference; a
local setting cannot override an OS reduction. Live changes skip active adapter
transitions. Root captures, migrated feedback/reveal and homepage hue animation
are suppressed; essential updates and simulation clocks continue. Full-document
transitions cannot promise programmatic focus continuity across documents;
native browser navigation semantics apply. Local adapter focus is opt-in.

The native **Transition inspector** disclosure shows the canonical values and a
presentation-only preview. Enter/Space uses native controls, Escape closes and
returns focus to its summary; preview returns focus to its button. It is in
normal flow to avoid covering simulation controls. It never reads/writes model
snapshots, seeds, evidence, or recorded time.

Verification: `bun test test/motion.test.js`; browser checks:
`bunx playwright test --config test/motion.browser.config.js`. The latter includes
keyboard, live OS reduction, canonical computed values and desktop/mobile image
capture on all three normal routes. Screenshot capture is evidence only when the
suite actually runs, not when a test is merely added.

## Interruptible navigation (SHE-629)

The shared motion adapter now cancels the previous request before accepting a new
one. `transition(update, {prepare, rollback, focus})` resolves true on completion,
false on cancellation, and rejects failures after rollback. `prepare(signal)` owns
asynchronous acquisition and must release its resources on abort; keep visible
scene/history mutations in the commit. Route commits and rollbacks are synchronous;
legacy asynchronous updates remain supported but must honor the supplied signal
before any delayed side effect. Cancellation cannot undo arbitrary application work.
`cancel()` and `dispose()` skip capture and abort preparation; reduction skips only
presentation. A five-second watchdog bounds waiting (shell: ten seconds). A timeout
after successful commit skips animation without reverting the stable scene.

The homepage shell retains its current scene during iframe acquisition, deduplicates
pending destinations and commits history with the selected scene. Back/forward,
Close, a visible Cancel navigation button and Escape can interrupt loading. Failure
restores the last stable URL; no history entry is pushed before load. Native iframe
load is document availability, not proof of model readiness: HTTP error documents
may fire load and application-level failures need an explicit app readiness protocol.
Full-document portal links retain browser-owned history/failure handling. No model
state, context IDs, seeds, clocks or outcomes are transformed by this coordinator.

Focused checks: `bun test test/motion.test.js test/universe-shell.test.js` and
`bunx playwright test --config test/transitions.browser.config.js`. Set
`HBL_BUN_EXECUTABLE` when a package-manager shim cannot run Bun.
