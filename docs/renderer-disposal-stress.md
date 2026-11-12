# SHE-39 renderer disposal stress coverage

Branch: `mini/SHE-39`. No PR, merge or deployment performed.

Audit: HBL-W1-025/SHE-38 remains Backlog in Linear, but the checked-in
`renderer-backend.js` already detects the initialized native backend and cleans
failed/late candidates. Scene disposal already removes meshes, controls,
listeners, ResizeObserver and animation work. Canvas lifecycle tests and the
real device-loss suite overlap this issue; neither runs 30 same-document stage
lifecycles. No replacement renderer or simulation changes were needed.

Owned increment: the new disposal browser test/config and this report, plus the
implementation-plan status. No shared renderer interfaces changed.

The new suite opens the normal Future Machine route, runs Fork City, retains its
versioned history, disposes the application, and uses the same exported stage
API for one warm-up plus 30 measured create → split → focus → scrub → dispose
cycles in a single document for each of Canvas, forced WebGL and automatic
selection. Each cycle seeks 16, 120, 15, 0 and 120, including the construction
boundary. Disposal is called twice. No fresh simulation or invented fixture is
substituted for the source history. Synthetic provenance remains in the JSON.

Evidence attachments contain every cycle's live/disposed object, geometry and
texture counts, CDP DOM/listener counters after GC, pending animation frames,
active ResizeObservers, optional JS heap, configured GPU-device count and loss
reasons, browser version, seed/model/recipe/initial hash, errors and warnings.
Assertions require stable live counts, no retained host nodes, zero disposed
objects, no listener/observer/animation growth and at most ten extra DOM nodes
after warm-up. Heap is informational; these counters do not measure all JS
objects or GPU memory. Auto selection is reported honestly and can use fallback.
The existing `pipeline-device-loss.e2e.js` separately tests actual device/context
loss; this suite observes unexpected loss during repeated disposal.

## Actual verification (2026-11-12)

- `TMPDIR=/private/tmp bun install --frozen-lockfile`: passed; no tracked dependency changes.
- `bun test test/future-machine-scene.test.js test/future-machine-backend.test.js test/future-machine-canvas.test.js test/future-machine-effects.test.js`: 32 passed, one browser-gated skip, 172 assertions.
- `TMPDIR=/private/tmp bunx playwright test --config test/renderer-disposal.browser.config.js --list`: three tests discovered.
- `git diff --check`: passed.
- Browser execution attempted with
  `HBL_BUN_EXECUTABLE=/Users/wahabma/.bun/bin/bun TMPDIR=/private/tmp bunx playwright test --config test/renderer-disposal.browser.config.js`.
  Server failed to bind with `EADDRINUSE` on both 39884 and 39979 in the restricted
  session. Earlier setup attempts exposed Bun tempdir permissions and a local
  node_modules Bun wrapper; the explicit tempdir/executable resolved those.

No measured resource-growth numbers, browser console result, GPU availability,
or reproducible leak result are claimed: the browser stress cases have not run.
Run the command above in a host that permits localhost listening and review the
JSON attachments in `/private/tmp/hbl-renderer-disposal` before accepting the
issue. Screenshots are unnecessary because the product UI is unchanged.
