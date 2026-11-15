> November15 steering: World now targets WebGPU only. Earlier WebGL/Canvas fallback browser receipts below are historical; updated tile/audio tests request the ordinary route and assert actual WebGPU. The explicit Canvas2D tile MAP remains a requested game view, not a renderer fallback. See [WebGPU-only scope](she-789-webgpu.md).

# SHE-789 tile view and optional sound — implementation and evidence

New module `world/launch-tiles.js` exports `mountTileView({getFrame,onSelectPerson,onSelectBuilding,onClose,container=document.body})`.
Return API: `{open(),close(),toggle(),dispose(),isOpen()}`. CSS is loaded by the module.
The UI shell should lazily import and mount once, then call `toggle()` instead of navigating to another simulation.

Renderer bridge needed (renderer owner only):

```js
window.hblWorldTileSource = {
 getFrame() { return {
  revision: /* current source run + revision */, minute: /* same source minute */,
  mode: /* 'legacy' or 'living' */, seed: /* current source seed */,
  geometryKey: /* stable town geometry identity */,
  buildings: /* actual town buildings: {id,name,kind,poly:[[x,z]],center:[x,z]} */,
  roads: /* projected world-coordinate polylines {id,pts:[[x,z]],width} */,
  people: /* actual current visible rows {id,name,x,z,doing/activity,needs?} */,
 }; },
 selectPerson(id) { /* existing authoritative selection */ },
 selectBuilding(id) { /* existing authoritative selection */ }
};
```

No new town, worker, clock, simulation state or resident IDs are created. Missing
positions are omitted and reported; geometry is rasterized into 8m cells, whose
classification is a view approximation, not a routing/ownership authority.
Tiles retain all overlapping lot IDs and visible resident IDs for look mode.
Sidewalk tiles derive from road width plus a 2m visual walking strip, explicitly
labeled as a map approximation when exact sidewalk polygons are unavailable.

Verification pending implementation.

Implementation ready: `launch-tiles.js`, `launch-tiles.css`,
`launch-tiles-model.js`, `test/launch-tiles.test.js`.
The optional `onVisibility(boolean)` callback lets the renderer owner suspend
GPU drawing while this cheap view is visible, while continuing the same clock.
The default getFrame/select callbacks use `window.hblWorldTileSource` directly.

Unit verification: 4 tests pass (20 assertions): actual IDs/no mutation, sub-cell
lots, road/sidewalk strips, missing/off-map resident positions, deterministic
raster cells, degenerate segment handling and bounded huge maps. No model rules
are changed and no new ODD state authority is created. Browser integration is
pending the renderer bridge and shell action, owned by the other work chats.

Renderer bridge is now implemented as `window.hblWorldTileSource`; default module callbacks use it. UI action can simply lazy-import `mountTileView()` once and call `.toggle()`. Module API is ready for integration.

`window.hblWorldTileViewActive` is true only while the tile map is open. The renderer owner can skip GPU draw submission while this is true, without skipping authoritative simulation updates. This is a view visibility flag, not model state.

Browser progress: real desktop World bridge test passed in Chromium at1280×800,
with unchanged paused runId/minute/seed/person count and no page errors. Screenshot
`artifacts/she-789/tiles/she-789-tiles.e2e.js-tile--2155a-l-World-authority-at-1280px/tiles.png`
was visually inspected. Full desktop/mobile rerun now additionally covers the
normal shell Tile view launcher and selecting an actual lot into the 3D inspector.
Initial5s ready timeout was insufficient during concurrent profiling; scene-ready
poll now allows60s rather than pretending the geometry loaded.

## Optional sound module

`world/launch-sound.js` now exports `mountWorldSound()` and automatically mounts
one named Sound off/on button into `#launch-playback` when loaded. UI owner can
add `<script type="module" src="/world/launch-sound.js"></script>` after
launch-shell.js, or lazy-import the module after shell mount. No timers, RAF,
AudioContext or audio nodes exist until a player clicks Enable game sound.
The user gesture starts quiet filtered ambient noise, short click sounds and
bounded footsteps from displacement of the actually controlled resident.
Paused/stationary/nonwalking/uncontrolled/teleported/unobserved people are silent.
Tab hiding and pagehide close the context and clear the150ms polling timer.
The source uses current hblPersonCommands and hblWorldTileSource observations;
random noise affects audio only and never simulation state or seed.

Pure audio timing checks plus tile tests:6 passed,30 assertions.

Normal-launch regression found and relayed to UI owner: desktop passes actual
lot selection into the original inspector. At390px the launcher is hidden by
`.launch-footer {display:none}` in mobile shell CSS, so normal mobile entry fails
although the directly mounted mobile tile view passed. UI owner must expose the
Tile view launcher in mobile navigation. This is a real acceptance gap; no test
is changed to force-click or bypass the hidden control.

Audio integration supersedes the standalone-script suggestion above: the shell
owns its existing `[data-launch=sound]` pill. `launch-sound.js` exports
`createWorldAudio(win)` with `{enable,disable,enabled,getState,dispose}` so the
UI-owned `launch-audio.js` can reexport it. Auto-mount is suppressed when the
shell pill exists. Visibility cleanup synchronizes that pill. Parent requested
no further expensive browser runs during the quiet120s performance measurement;
all my browser processes have completed. Prior direct audio lifecycle test
passed; final shell-adapter and repaired mobile-launch tests await integration.

## Handoff status

Delivered view: actual current geometry raster, pixel sprites from visible
resident positions, responsive canvas, tile look mode with actual lot/person
selection, keyboard look/zoom, drag pan, fit, close/focus return, bounded5Hz
observation and ResizeObserver sizing (no recurring read-after-write layout).
No simulation clock, rules or data authority added. Source model version, run,
seed, minute and missing/sample limitations are visible.

Files: `world/launch-tiles{,-model}.js`, `world/launch-tiles.css`,
`world/launch-sound.js`, two unit tests, two e2e tests and
`test/she-789-tiles.config.js`.

Actual checks:6 unit tests/30 assertions pass; browser bundles succeed;
whitespace diff check clean. Chromium direct-bridge tile checks passed at1280
and390px, desktop normal launcher plus actual lot-to-inspector selection passed.
Normal mobile launcher originally failed because shell hid its footer; UI owner
has repaired CSS but rerun is pending the coordinator's quiet performance run.
Audio direct-module gesture/off/dispose lifecycle passed in6.6s; the final
shell-owned-button compatibility test is written and awaits the combined run.
No physical-device or audible output-quality claim is made.

Reproduction with running local server: `bun test test/launch-tiles.test.js
test/launch-sound.test.js`; `HBL_LAUNCH_TEST_URL=http://127.0.0.1:62691 bun
node_modules/@playwright/test/cli.js test --config=test/she-789-tiles.config.js`.
