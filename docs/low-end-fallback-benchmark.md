# SHE-44 mobile Canvas fallback benchmark

Branch: `mini/SHE-44`. No PR or deployment created.

The existing Future Machine route already supports Canvas fallback, recorded
monthly City histories, timeline selection, camera controls and retry through
Fork City. Existing `future-machine-canvas`, `future-machine-backend`, and
`future-machine-scrub-identity` tests cover projection identity, camera stability,
gestures, disposal, backend failures and reverse scrubbing. This slice adds a
measurement harness rather than a renderer or simulation implementation.

## Reproduction

From the repository root with Bun, Playwright and Chromium installed:

```sh
HBL_LOW_END_PORT=40944 bunx playwright test --config test/low-end-fallback.browser.config.js
```

The dedicated config starts the ordinary server with temporary isolated stores.
Artifacts default to `/tmp/hbl-low-end-fallback`; override with
`HBL_LOW_END_ARTIFACT_DIR`. Each case writes `benchmark.json` and
`mobile-canvas.png`; failures retain a Playwright trace. The JSON is also attached
to the Playwright result. A custom Chromium binary can be selected using
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Four cases cover 320×844 and 390×844 CSS pixels at DPR 2, each with explicit
`?renderer=canvas` and automatic fallback after suppressing navigator.gpu and
WebGL/WebGPU contexts. All cases launch desktop Chromium with `--disable-gpu`
and CDP 4× CPU throttling. These are synthetic browser conditions, not physical
low-end phone measurements; Canvas acceleration is not guaranteed absent.

Each case injects one HTTP 503, retries with Fork City, asserts the actual backend
is canvas2d, scrubs months 0/16/60/120 three times, selects a recorded building,
and checks ten keyboard pans and zooms. It then sends 120 alternating pan events
on RAF callbacks, counts Canvas clearRect draw invocations, and verifies that the
serialized source history is unchanged and the recorded final housing delta is
24. The recipe, seed, model version, initial hash and provenance accompany the
measurements. The default City recipe remains explicitly synthetic.

Latency measures wall-clock Playwright dispatch, readiness assertions and two
RAF callbacks, with raw samples, median, p95 and maximum. Retry has one sample,
so its percentiles are descriptive only. RAF Hz measures scheduling cadence;
Canvas draw calls per second measure on-demand draw invocations using one
clearRect per draw in the current renderer. Neither proves displayed FPS or
input-to-photon latency; displayedFps remains null. Scripted key events exercise
camera handlers, not physical touch input. No network throttling is configured.

## Verification on 2026-11-12

- `bunx playwright test --config test/low-end-fallback.browser.config.js --list`:
  four cases discovered successfully.
- `bun test test/future-machine-canvas.test.js test/future-machine-backend.test.js test/future-machine-scrub-identity.test.js`:
  19 passed, one existing opt-in Chromium smoke skipped, 289 assertions.
- `git diff --check`: passed.
- Browser execution attempted at ports 39978 and 40944: server could not bind
  (`EADDRINUSE`). An independent `Bun.serve({port:0,...})` probe also failed to
  bind. This environment therefore blocks the local server before browser tests
  run. No FPS, latency, screenshot, or interaction-pass evidence was obtained.

SHE-40 / HBL-W1-027 remains an unresolved performance-budget dependency according
to the existing workspace plan. This harness collects observations without a
speed threshold or budget-pass claim. Run the command in an environment that
permits local listeners, inspect all four reports and screenshots, and apply the
agreed budget only after that dependency is resolved. Physical devices, Safari,
large histories, sustained thermal pressure and production networks remain
unmeasured.
