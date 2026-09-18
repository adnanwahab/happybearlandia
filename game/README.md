# Editing the game scene

`scene.json` is loaded before the game starts. An external editor can read and
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

Playwright starts and stops a separate Bun server on port 3100. The tests open
both `/game` and `/game/` in Chromium, check that the scene JSON loads, wait for
the multiplayer welcome and a visible canvas, and run several animation frames.
JavaScript exceptions, console errors, failed requests, and HTTP errors fail
the test. Internet access is required for the game's Three.js and Jolt CDN
imports. Failed runs retain a trace and browser error attachment under
`test-results/`.

The `*.e2e.js` filenames keep these tests separate from Bun's unit test discovery.
