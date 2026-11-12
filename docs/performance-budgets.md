# City performance checks

Start the normal app with `PORT=3198 bun run server.js`, then run
`bun run profile:performance`. Optional arguments are base URL and output directory:
`bun run profile:performance http://127.0.0.1:3198 test-results/performance`.
Use a fresh output directory per invocation when retaining historical local runs.
`HBL_PERF_BACKENDS=webgl2` selects the software-compatible CI matrix; the default
runs both `webgl2,webgpu`. A requested WebGPU backend falling back is a failure,
not evidence of WebGPU coverage. No streaming implementation is included.

The six permanent `/world/bench/*` routes each have a backend-specific budget in
`scripts/performance/budgets.js`. Every metric is independently enforced with a
nonzero exit on excess or missing measurements. Tests verify boundary equality,
individual excess, and invalid/missing observations. PR CI runs those contracts
and six real WebGL2 route measurements. Configure the Performance budgets check
as required in repository branch protection to prevent bypassing a failed check;
this change adds the workflow but does not modify remote protection settings.

Measurements use Chromium at 1440 × 900, DPR 1, 500 synthetic residents, BALANCED
quality with adaptation frozen during the scripted recording. Initial load uses
the app's normal default quality. Each route gets a fresh browser context.

- `loadMs`: navigation start to renderer reporting more than three frames;
  includes startup, scripts and scene initialization, not just HTTP response time.
- `p95FrameMs`: existing renderer's actual frame interval p95 from its fixed
  30-second scripted benchmark after warmup. CPU profiles do not replace frame timing.
- `peakHeapBytes`: maximum CDP JSHeapUsedSize observed at roughly 100 ms intervals
  through navigation and recording. This is sampled main-target JS heap, excludes
  worker heaps, native allocations and GPU memory, and can miss short peaks.

Reports retain requested and actual backend, browser/platform, route, viewport,
quality, population, limits, raw heap samples, benchmark statistics and failures.
Each case saves `.json`, DevTools `.cpuprofile`, and Playwright `.trace.zip` files;
`summary.json` aggregates cases. Profiles/traces are saved before budget evaluation,
including navigation or recording failures when the browser remains responsive.
CI uploads artifacts even on failure for 14 days. A browser-launch failure cannot
produce a CPU profile and fails the job. No production data is used.

The initial 30-second load, 250 ms frame p95 and 512 MiB heap limits are provisional
headless regression guardrails, not measured SHE-40 hardware baselines or a 60 FPS
claim. Keep browser, hardware and settings fixed when calibrating limits from
saved runs. CPU profiling/tracing adds overhead. Real laptop/mobile profiles,
WebGPU hardware validation, and adapters for non-city surfaces remain required
before claiming application-wide performance coverage.
