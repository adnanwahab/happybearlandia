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


## Owner-approved merged-source verification — r4, 2026-11-14

**Acceptance remains incomplete: no browser measurements were obtainable.**
This section supersedes the earlier execution-order hold: owner approval permits
collection now, while SHE-40 stays open for measured calibration. It does not
supersede the historical failed attempts above or declare either issue accepted.

Source: `cdb773a19acb5f68cd949dab2b8af148a0e1aefe`, branch
`mini/SHE-44-r4`, target `sprint/one-city-two-futures-20261111`.
Local `git show --stat cdb773a1` confirms merged
[PR #319](https://github.com/adnanwahab/happybearlandia/pull/319), including the
actual retry, API suppression and history-digest assertions. This is a local
merged-source audit, not a fresh remote branch/protection certification.
No new PR was created or external message posted.

Exclusive ownership for this attempt: this report, the fallback benchmark doc
and the narrow implementation-plan status below. Existing untracked
`.mini-symphony-evidence/SHE-44-r4-before*` artifacts were preserved; their routes
are homepage and World, not the fallback benchmark, so they are not acceptance
evidence. No UI, runtime, benchmark contract, simulation, stored data, workflow,
vote requirement or auth/check configuration changed. The scope is one dependent
verification task, so no parallel implementation was needed.

### Audit and intended measurement

Re-read root instructions/README, product design, SHE-44 implementation-plan
entries, review guidance, first-interaction and fallback measurement docs and
Future Machine scene/data/fallback contracts. `docs/architecture.md` is absent.
Checked executable `test/e2e/low-end-fallback.e2e.js`, its dedicated browser
config, `world/future-machine/scene/canvas-stage.js`, renderer backend and data
adapter contracts and focused tests. The existing normal route already covers
the requested functionality; a second renderer or fabricated benchmark is not
needed. No model/ODD rule change is involved.

Intended matrix: 320×844 and 390×844 CSS pixels, DPR 2, mobile/touch emulation,
4× CDP CPU slowdown, desktop Chromium `--disable-gpu`; explicit Canvas and
API-suppressed automatic fallback. No network throttle. Each case must recover
an injected HTTP 503 using Retry comparison, assert canvas2d, scrub 0/16/60/120,
select a recorded building, pan/zoom, then verify unchanged complete history and
+24 synthetic homes. Keyboard camera actions do not establish physical touch
performance. RAF scheduling and clearRect draw rate do not establish displayed
FPS; `displayedFps` must remain null. Canvas hardware acceleration is unproven.

### Provisional comparisons requested by owner

All targets below are **provisional-estimate-not-calibrated**, never measured
baselines or new release limits. No enforcement setting was changed.

| Metric | Laptop estimate | Mobile estimate | r4 observation |
| --- | ---: | ---: | --- |
| Decoded JS | 8 MiB | 8 MiB | unavailable |
| Readiness | 15 s | 30 s | unavailable |
| Slider | 100 ms | 250 ms | unavailable |
| Main-page sampled heap | 512 MiB | 256 MiB | unavailable |

The fallback harness measures automation round-trip interaction latency including
assertions and two RAF callbacks. It does not collect decoded JS, cold readiness
or sampled heap; those belong to the separate first-interaction harness and
cannot be inferred from this run. Its scrub samples also differ from SHE-40's
browser-clock slider metric, so an eventual comparison must retain that caveat.
No target pass/fail is possible without observations. Physical hardware is
**untested**, including physical low-end phones; desktop emulation is not a
hardware benchmark.

### Exact commands and results

The first browser command below failed resolving `@playwright/test` because
this isolated checkout had no local node_modules. A local ignored symlink reused
the existing repository dependency installation (no dependency/lockfile edit).
The second run loaded the configuration and reached server startup.

```sh
HBL_LOW_END_PORT=40944 HBL_LOW_END_ARTIFACT_DIR=/tmp/she44-r4 bunx --no-install playwright test --config test/low-end-fallback.browser.config.js
ln -s /Users/wahabma/happybearlandia/node_modules node_modules
HBL_LOW_END_PORT=40944 HBL_LOW_END_ARTIFACT_DIR=/tmp/she44-r4 bunx --no-install playwright test --config test/low-end-fallback.browser.config.js
node -e 'const s=require("net").createServer(); s.on("error",e=>{console.error(e);process.exitCode=1}); s.listen(0,"127.0.0.1",()=>{console.log(s.address());s.close()})'
bun -e 'import {chromium} from "@playwright/test"; const b=await chromium.launch({args:["--disable-gpu"]}); console.log(b.version()); await b.close()'
bun test test/future-machine-canvas.test.js test/future-machine-backend.test.js test/future-machine-scrub-identity.test.js test/future-machine-data.test.js test/future-machine-paired.test.js
bunx --no-install playwright test --config test/low-end-fallback.browser.config.js --list
node --check test/e2e/low-end-fallback.e2e.js
node --check test/low-end-fallback.browser.config.js
git diff --check
```

- Browser run: exit 1, zero cases executed. `server.js:440:16`:
  `Failed to start server. Is port 40944 in use?`, `syscall: "listen"`,
  `code: "EADDRINUSE"`. This alone does not prove a conflicting application.
- Independent ephemeral Node listener: exit 1,
  `listen EPERM: operation not permitted 127.0.0.1`, `syscall: 'listen'`.
  This establishes a listener permission blocker rather than merely an occupied
  chosen port. Changing ports does not resolve that restriction.
- Standalone Chromium: exit 1 before navigation, `Target page, context or browser
  has been closed`; `mach_port_rendezvous_mac.cc:159`,
  `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.45202:
  Permission denied (1100)`, process signal SIGTRAP.
- Focused tests: **32 passed, 1 opt-in Chromium smoke skipped, 0 failed,
  880 assertions**, 33 cases across five files, 13.89 seconds.
- Discovery: four intended cases listed, exit 0. Both JS syntax checks passed.
  Whitespace check passed. No default lint or repository-wide typecheck exists
  in package.json; no typed code or runtime code changed.

Host observed via Node os: Apple M4, 17,179,869,184 bytes RAM (16 GiB), Darwin
24.6.0 arm64. Node v26.13.0, Bun 1.4.2, Playwright 1.63.0. Installed executable:
`chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
Runtime browser version and actual renderer are unavailable because launch
failed; intended canvas2d is not reported as observed. No successful benchmark
JSON, fallback screenshot, latency, cadence or FPS exists from this attempt.

The passing real-engine tests reproduce seed 42 / `city-systems.1.1.0`, 30
households, 120 months, initial SHA-256
`7767de6b19f3b1c62f218c3a4ee26739157382db2c7ff962dbe141fc160821ae`,
first building completion at Month 16 and 36 versus 60 homes / +1,000,000
synthetic cumulative USD. This is model correctness evidence, not browser
performance evidence. The versioned recipe/provenance and recomputed-history
limitations remain unchanged.

### Remaining work and preserved policy

Run the existing reproduction command on an authorized host that permits both
local listeners and Chromium, retaining all four case reports/screenshots and
failure traces. Inspect actual backend, history digest, all five interaction
assertions and timing definitions before comparing observations to the provisional
estimates. Obtain physical device evidence separately before a physical low-end
support claim. SHE-40 still needs measured calibration; its open review no longer
blocks collecting SHE-44 observations.

Inspected `.github/workflows/auto-merge.yml`: autonomous merge remains under
literal `if: ${{ false }}`; verification job and required-workflow checks in
`.github/scripts/auto-merge.cjs` are preserved. No one-vote quorum was enabled,
no check/auth/release protection was weakened, and no merge, deploy, remote
workflow dispatch or production action occurred. Remote protection settings were
not independently certified.
