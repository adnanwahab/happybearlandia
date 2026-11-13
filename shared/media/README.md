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
