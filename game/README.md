# Editing the game scene

## Honey Trail

`/game/1` includes an optional eight-drop collection challenge. Follow the
glowing gold rings from the spawn area toward the shallow stairs. Move with
WASD, jump with Space, and drag to look. The timer starts on the first pickup
and freezes on completion. Restart trail restores the pickups and timer while
keeping the player in place; the best time lasts until the page is reloaded.
Lava respawns retain progress. Time measures active simulation updates, pauses
during conversation/poker dialogs, and is local to each player, not a shared
multiplayer leaderboard. The challenge does not appear on other scenes.
Markers respect the existing Reduce motion setting without changing collection
rules or the timer. Keyboard restart retains button focus; pointer restart returns
to ordinary movement controls.

`honey-trail.js` owns the authored v1 coordinates and collection rules;
`honey-trail-view.js` renders nonphysical markers and the challenge panel.
Update the authored coordinates if moving the playground floor or stairs.
Verify rules and scene/UI integration with `bun test test/honey-trail.test.js`.

## Scene format

`scene/1.json` is loaded before the game starts. An external editor can read and
write this file without generating JavaScript. Reload the page after editing;
restart the server too when changing the networked cube's initial transform.

Top-level fields:

- `gravity`: acceleration `[x, y, z]`.
- `playerSpawn`: initial player position `[x, y, z]`.
- `respawnPosition`: player position after touching lava.
- `objects`: flat array of boxes, including individual stair steps and slopes.

Each object has a unique `id`, `type: "box"`, `position: [x, y, z]`, and
`size: [width, height, depth]` (full dimensions, not half extents). Coordinates
use Y up, with positions at box centers. Optional fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `rotation` | `[0, 0, 0, 1]` | Unit quaternion `[x, y, z, w]` |
| `motion` | `"static"` | `"static"` or `"dynamic"` |
| `color` | `"#ffffff"` | Hex RGB color |
| `mass` | Automatically calculated | Positive mass for dynamic bodies |
| `friction` | `0.2` | Nonnegative friction |
| `speed` | `5` | Conveyor velocity along X, for the `conveyor` object |

Example of an additional object:

```json
{
  "id": "platform",
  "type": "box",
  "position": [10, 2, 0],
  "size": [6, 1, 6],
  "color": "#88aa44"
}
```

Keep the IDs `lava`, `conveyor`, and `teal-cube`: the existing game logic uses
them for respawning, conveyor movement, and cube sound/glow/multiplayer.
`teal-cube` must remain dynamic. Other IDs can be freely added or removed.
The existing `behavior` and `networked` fields are descriptive metadata;
they do not enable new gameplay behaviors or multiplayer objects.

`scene-loader.js` validates the data before any geometry is built and exports
`validateScene` for tools to reuse. Invalid files produce an on-screen startup
error. This format currently supports boxes only; behavior code stays in
`index.js`, while geometry and initial physics values live in JSON.

## Browser integration test

From the repository root:

```sh
bun install
bunx playwright install chromium
bun run test:e2e
```

To use an already installed Chromium instead of downloading Playwright's browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium bun run test:e2e game.e2e.js
```

Playwright starts and stops a separate Bun server on port 3100. The game smoke
test opens `/game/1`, checks the scene API response, waits for the multiplayer
join broadcast and a visible canvas, and runs several animation frames.
JavaScript exceptions, console errors, failed requests, and HTTP errors fail
the test. It also blocks external HTTP requests to catch new CDN dependencies.
Failed runs retain a trace and browser error attachment under `test-results/`.

After `bun install --frozen-lockfile` (Bun 1.4 or newer for the current lockfile),
game startup requires no CDN access. The server builds `/game/main.js` from JSX
and the installed React dependencies on request, so edits take effect on reload.
Three.js uses the existing `/vendor/three/` routes. The narrowly scoped Jolt
route serves the installed `wasm-compat` distribution, which embeds its WASM.
No generated bundles or additional build step are required. The optional globe
view still uses external deck.gl and GeoJSON resources; it is outside this smoke
test's startup workflow.

The `*.e2e.js` filenames keep these tests separate from Bun's unit test discovery.

## Animation and sound

Character clips and collision audio use the [shared media pipeline](../shared/media/README.md).
The bottom-left settings expose reduced motion and persisted volume (muted by
default). The shared loader enforces encoded-byte budgets before assets become
playable; the bear importer additionally enforces decoded clip/track/key limits.
