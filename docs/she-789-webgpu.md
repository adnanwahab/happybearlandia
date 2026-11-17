> Superseded in part by later November15 user steering: retain the native WebGPU full game, but add a WebGL2 geometry-only city viewer with no simulation. See [current fallback scope](she-789-static-city.md). Earlier WebGPU-only implementation details below remain historical evidence.

# SHE-789: WebGPU-only World rendering

The user explicitly removed the requirement for Canvas2D/WebGL fallback on
November15,2026. Ordinary World, Living Population, saved experiments, embedded
World and business mode now use the same native WebGPU initializer. Old
`renderer=webgl`, `renderer=canvas2d`, `renderer=lite` and `renderer=2d` query
parameters no longer select alternate renderers. WebGPU failure shows a retry
and home recovery state; it never starts a replacement simulation.

The daily Legacy simulation and Living Population continue using their existing
JavaScript/worker authorities. Neither WebGL nor WebGPU defines their state,
random seed or clock. Removing graphics fallbacks does not migrate simulation
computation to GPU or change model rules.

## Removed code and replaced verification

Removed the standalone `world/canvas2d-world.js`, its now-unneeded
`launch-lite-bridge.js`, and the projected-scene
`render/renderer/canvas-renderer.js` after checking all executable references.
The latter was imported only by its two obsolete World unit suites; Future
Machine has its own `scene/canvas-stage.js`, not this renderer. Removed those
World-only suites and the World Canvas followup browser suite/config. Kept
Future Machine's separate tests and modules; the coordinating chat owns any
changes to that surface.

`renderer-entry.js` imports only the main World and provides a requirement/retry
state if its module fails. `world-gpu.js` disables Three's implicit WebGL fallback
and validates the actual native backend. The old city renderer factory now
reexports this single implementation. Partial initialization cleans its backend
directly, avoiding Three's init-retrying full disposal; successful-but-wrong
backend initialization uses full disposal. Cleanup errors never mask the
original initialization error; non-Error/null adapter rejections become readable
Errors so the recovery UI can always read `message`.

The coordinator/performance owner owns `render.js` going forward. One surgical
edit already replaced the old nested GPU→WebGL→Canvas initialization block
with native WebGPU initialization and a bounded timeout/retry message; no other
render changes were made by this task. The UI owner owns fallback control cleanup
(the `world-lite-link` was removed surgically), navigation and remaining copy.
The dead 2D source link was removed from `plan-choices-source.html`.

The requested **tile map remains**: its Canvas2D drawing is a cheap explicit
2D game view of the same active world, not a graphics fallback or alternative
simulation. Minimap, chart, texture and screenshot canvases also remain useful
UI primitives. This follows the coordinator's scope clarification.

## Verification

- Native backend acceptance, disabled fallback, partial cleanup, initialized
  wrong backend disposal, synchronous/asynchronous cleanup failure, null adapter
  rejection and unavailable GPU are covered by `test/world-webgpu-only.test.js`:
  **6 passed,13 assertions**.
- Combined with tile and sound unit tests: **12 passed,43 assertions**.
- Native factory bundle succeeds; entry syntax/bundle succeeds with its runtime
  import external. A full root bundle is not the application's serving/build
  entry and cannot resolve existing browser `/vendor/three/...` imports.
- Tile/sound browser routes no longer request WebGL and now assert actual
  `hblCityRenderer.getPerformanceStats().backend === 'webgpu'`.
- Post-change browser verification is deferred to the coordinator after the
  quiet performance trace; no browser processes were started for this change.
  Earlier Canvas2D/WebGL browser receipts are historical and do not establish
  acceptance of the new WebGPU-only policy.
