# Cold-start capture — SHE-11

Status: harness and fixture validation delivered; actual browser measurements blocked.
Owned files: this document, `scripts/benchmark-cold-start.mjs`, and
`test/cold-start-report.test.js`. Branch: `mini/SHE-11`, base `b963dd3`
(`sprint/one-city-two-futures-20261111`). No PR, merge or deployment performed.

## Audit and implementation slice

The existing `scripts/benchmark-renderer.js` waits for more than 30 frames before
starting a scripted benchmark. It is a warmed-frame benchmark, not cold-start
coverage. `world/render.js` already records navigation-relative `performance.now()`
timestamps in `hblWorldStartup`, and `hblCityRenderer.getPerformanceStats()` exposes
the selected backend. Existing progressive-loading browser tests inspect those
startup hooks. The new harness reuses them; no renderer or simulation changes.
No architecture.md or more specific AGENTS.md exists in this checkout. Product
design and implementation plan were reviewed. A last-mile scan of all registered
worktrees found no existing copies of the three exclusively assigned files.

Acceptance: fresh browser and context for each requested path; preserve missing
metrics and failures; record actual backend, renderer identity and environment;
measure through the normal `/world` entrypoint. Prerequisites are installed
Playwright/Chromium and permission to launch it and serve the checkout. Risks:
software fallback, platform-dependent memory APIs, observation latency and machine
load. No thresholds or universal performance claims are introduced.

## Reproduction

From the checkout:

```sh
TMPDIR=/private/tmp bun install --frozen-lockfile
PORT=3111 bun run server.js
# In a second terminal, after confirming that server serves this checkout:
bun scripts/benchmark-cold-start.mjs http://127.0.0.1:3111 /private/tmp/hbl-cold-start.json
bun test test/cold-start-report.test.js test/render-performance.test.js
git diff --check
```

Optional: `HEADED=1` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`.
No unsafe WebGPU enabling flag is used. Both paths request the same demo inputs:
30 people, seed query 42, LOW quality, living=0. The demo uses the existing pinned
procedural town; query seed is recorded, not a claim that every model honors it.
The source label is captured verbatim; synthetic simulation disclaimers remain
unchanged. No API responses or scene data are replaced. The report includes URL,
startup hooks, timestamp, browser version, user agent, viewport and machine data.

## Metric definitions

All times are milliseconds since navigation (`performance.timeOrigin`), not since
module initialization. `appReadyMs` is the existing startup `readyMs` milestone.
`firstUsefulRenderMs` is the first observed subsequent animation-frame callback
after city placeholders and an initial rendered frame exist. It is a sampled
upper bound on useful frame submission, not a measured GPU presentation time.
`firstActionableControlMs` is the first sampled enabled, visible and hit-testable
`#stormBtn` after app readiness. This specific control is a readiness proxy;
it does not claim every control works and does not trigger a simulation mutation.
Animation-frame polling adds observation latency. Partial observations survive a
readiness timeout. Missing and invalid metrics become null; failures exit nonzero.

`performance.memory.usedJSHeapSize`, when supplied, is JS heap only. It may be
coarsened and excludes GPU memory and total process footprint. Unsupported memory
is null. WebGL debug renderer identity is recorded when available; software names
such as SwiftShader are labeled software. An unknown identity is not proof of GPU
acceleration. Requested and selected backend are separate. Native WebGPU is not
measured. Each path gets a fresh browser/context; OS/server/disk caches remain,
and this is a single sample per path, not a statistically stable comparison.

## Actual attempt — 2026-11-12

Host observed: Apple M4, macOS Darwin 24.6.0, arm64, 17,179,869,184 bytes RAM.
Configured viewport: 1440 × 900, device scale 1, headless Chromium.
Attempt timestamp: `2026-11-12T19:45:10.965Z`.
Installed Playwright executable: cached `chromium_headless_shell-1243`.
Browser version could not be queried because launch failed.

| Requested path | Selected backend | Ready ms | Useful render ms | Actionable ms | JS heap bytes |
| --- | --- | --- | --- | --- | --- |
| WebGL | unavailable | null | null | null | null |
| Canvas2D | unavailable | null | null | null | null |

The exact harness command above exited 1 and wrote
`/private/tmp/hbl-cold-start.json` with the launch errors for both paths. This
local artifact is not a committed or portable measurement dataset. Both launch
logs report:

```text
FATAL:base/apple/mach_port_rendezvous_mac.cc:159
Check failed: kr == KERN_SUCCESS.
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.<pid>:
Permission denied (1100)
process did exit: exitCode=null, signal=SIGTRAP
```

The server command also exited 1 with `EADDRINUSE` on port 3111. No navigation
occurred, and the existing listener was not used or attributed to this checkout.
Do not interpret these nulls as zero latency or unsupported renderer hardware.
No laptop/browser performance baseline has been established.

Verification: frozen dependency install succeeded with the explicit writable
temp directory. Focused Bun tests: 13 passed, 0 failed, 69 assertions (4 new
report/observer tests and 9 existing render-performance regressions). Whitespace
check passed. Browser UI is unchanged, so no screenshots were created.

Next action: run the harness on a host allowing Chromium and the local server,
commit the actual JSON evidence here, and independently verify backend identities
before unblocking SHE-40. Coordinator plan update request: record this tested
harness as delivered with measurement acceptance pending; shared implementation
plan was intentionally not edited under the issue's exclusive file ownership.
PR publication to the sprint base remains a trusted-host handoff; this sandbox
has read-only Git metadata and no publication receipt is claimed.
