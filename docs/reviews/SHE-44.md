# SHE-44 acceptance follow-up — 2026-11-14

Status: benchmark integration improved; measurement acceptance **incomplete**.
Branch `mini/SHE-44-r3`, starting commit `cd3dadbf`. Target:
`sprint/one-city-two-futures-20261111`. No follow-up commit/PR published.

## Audit, overlap and ownership

Read root instructions/README, product design, affected implementation-plan
entries, fallback benchmark and first-interaction documentation, Future Machine
data/scene/fallback module docs and review guidance. `docs/architecture.md` is
absent. Audited executable Canvas keyboard/gesture/draw code, adapter history
and provenance, retry UI/main callbacks and existing tests.

[Prior PR #162](https://github.com/adnanwahab/happybearlandia/pull/162) is merged;
GitHub metadata confirms head `fc65092b`, which is present locally. It added the
four-case benchmark and documentation, not successful measurements. Its body
explicitly distinguishes process completion from acceptance. Existing Canvas2D
rendering, automatic fallback and source-history APIs already work in contract
tests; none were reimplemented. The previous disk-full attempt and November 12
listener failure are not browser evidence.

Initial worktree was clean. Read-only coordinator status found an unrelated
modified `docs/implementation-plan.md`; it was not touched there. Exclusive local
ownership is limited to the benchmark test/config, dedicated workflow, benchmark
documentation, this report and a narrow plan addition in this isolated checkout.
No independent work required delegation. No source identities, simulation rules,
stored results, schema contracts, policies or secrets changed.

## Delivered increment

- The actual visible Retry comparison button recovers an injected HTTP 503 and
  must clear the error alert. Previously the harness clicked Fork City twice.
- Simulated-no-GPU cases now assert navigator.gpu and WebGL/WebGL2 are unavailable
  and retain those observations in the report, alongside actual canvas2d backend.
- Successful reports explicitly mark physical hardware untested, include a
  SHA-256 of the serialized history, and retain recipe/seed/model/initial hash
  and model-manifest provenance. Full-history equality across interactions is
  still asserted. This digest includes run identities; it is not a cross-run
  normalized comparison digest.
- The dedicated workflow installs Chromium, runs fallback contracts and all four
  cases, and uploads JSON results, per-case measurements/screenshots and failure
  traces. Permissions are contents:read, with no deployment/merge step. It has
  not been executed remotely. The config now emits machine-readable test results
  even when the benchmark fails; failed test output is not passing evidence.

No application UI changed. No screenshot exists because no page could open.
The browser assertions added here remain unverified in a real browser.

## Commands and observed results

```sh
bun test test/future-machine-canvas.test.js test/future-machine-backend.test.js test/future-machine-scrub-identity.test.js
bun test test/future-machine-data.test.js test/future-machine-paired.test.js
bunx --no-install playwright test --config test/low-end-fallback.browser.config.js --list
node --check test/e2e/low-end-fallback.e2e.js
node --check test/low-end-fallback.browser.config.js
HBL_LOW_END_PORT=40944 bunx --no-install playwright test --config test/low-end-fallback.browser.config.js
HBL_LOW_END_PORT=40944 HBL_LOW_END_ARTIFACT_DIR=/tmp/she44-r3-final bunx --no-install playwright test --config test/low-end-fallback.browser.config.js
bun -e 'const s=Bun.serve({port:0,fetch(){return new Response("ok")}}); console.log(s.port); s.stop()'
bun -e 'import {chromium} from "@playwright/test"; const browser=await chromium.launch({args:["--disable-gpu"]}); console.log(browser.version()); await browser.close();'
git diff --check
```

Fallback contracts: **22 passed, 1 existing opt-in browser smoke skipped,
313 assertions**, exit 0. Data/replay: **10 passed, 567 assertions**, exit 0.
Discovery: four cases, exit 0. JS syntax and whitespace checks passed.
No repository-wide lint/typecheck script exists; no TypeScript interface changed.

The data tests use the actual City API handler and temporary SQLite storage;
seed 42, 30 households, 120 months, model `city-systems.1.1.0` reproduce Month-16
36/60 homes, +24 homes and +1,000,000 synthetic cumulative USD. Initial hash:
`7767de6b19f3b1c62f218c3a4ee26739157382db2c7ff962dbe141fc160821ae`.
These are synthetic model results, not browser measurements or observations of a
real city. Detailed history is manifest recomputation, not independently verified
recorded-checkpoint recovery.

Browser command exits 1 before tests: Bun server.js:437 reports EADDRINUSE on
40944. Independent port-0 probe also exits 1. Standalone installed Chromium exits
1 at MachPort rendezvous: Permission denied (1100), before navigation. There is
no FPS, latency, screenshot or passing interaction result to report.

Host: Apple M4, 16 GiB, Darwin 24.6.0 arm64; Bun 1.4.2, Playwright 1.63.0,
installed Chromium headless-shell build 1243. Browser runtime version unavailable
because launch fails. Intended matrix: 320×844 / 390×844 CSS pixels, DPR 2,
mobile/touch emulation, CDP CPU throttle 4×, --disable-gpu, explicit Canvas and
API-suppressed automatic fallback. No network throttling. Desktop software
conditions cannot establish physical low-end phone behavior or absent Canvas
acceleration. RAF cadence and on-demand draw-call rate cannot establish displayed
FPS; displayedFps remains null. Latency includes automation and two RAF callbacks,
not input-to-photon delay; retry/selection each have one descriptive sample.

## Remaining acceptance and preserved gates

SHE-40 / HBL-W1-027 remains blocked on independently verified cold-start evidence
and reviewed numeric limits: both profile limit objects are empty. Its merged
PR #317 does not resolve that evidence gap. This work collects observations
without claiming budget compliance or bypassing that dependency.

Next action: run the dedicated workflow or reproduction command on a host that
permits the server and Chromium, inspect all four JSON reports/screenshots and
scrub/selection/pan/zoom/retry assertions, then compare against reviewed limits
after SHE-40 is resolved. Physical devices, Safari, thermal pressure, larger
histories and production networks remain unmeasured. Keep SHE-44 incomplete.

Inspected `.github/workflows/auto-merge.yml`: autonomous merge job remains under
literal false; existing review/vote/auth/check protections are unchanged. Remote
branch protection configuration was not independently certified. No merge,
deployment, external message, workflow dispatch or production action occurred.
