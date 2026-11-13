# SHE-71 executable browser acceptance

## Combined PR integration — 2026-11-12

PRs #155 (SHE-26) and #172 (SHE-71) now share four real-API journeys. The
combined suite retains the existing sprint regressions (19 tests discovered in
this checkout), full uncut presentation timing, capture provenance, paired
Month 0/120 checks, actual native/Canvas building clicks, metric WHY context,
no-intervention and deterministic reruns, viewport control checks, and offline
recovery screenshots. Scrubbing intentionally follows demo completion because
manual timeline input stops the presentation director. No production UI was
changed to make these tests pass.

The recording command runs all four SHE-71 journeys and requires named evidence,
nonempty video, positive duration/dimensions and decoded frames. Its generic
`one-city-two-futures-recording.v1` manifest retains artifact paths, byte counts,
codec/stream metadata and duration. The five negative CLI tests pass; a stub
runner's successful exit still cannot establish a successful recording.

The combined config launches a fresh server with disposable stores and explicit
`NODE_ENV=test`, `HBL_TEST_SIMULATION_PER_CLIENT=120` and
`HBL_TEST_SIMULATION_TOTAL=600`. Independent browser journeys share one loopback
address and need a batch budget; admission remains enabled and production keeps
six/client/minute and sixty/process/minute. The default HTTP burst/recovery test
and test-mode configuration checks pass (six admission tests).

Raw SHE-26 evidence and its original README/execution record are preserved in
[`she26/`](she26/); the original SHE-71 logs remain alongside this file. Their
conflicting socket-probe records are both retained byte-for-byte. The historical
handoff below describes the original SHE-71 checkout, not a new browser result.
Current verification covers 19-test discovery, syntax, 11 admission/recording
unit and HTTP tests (234 assertions), and byte preservation. Browser startup is
blocked in this environment before page creation by Chromium's socket EPERM;
no new screenshot, successful browser journey or playable recording is claimed.
Current scenarios record their actual model version and provenance rather than
substituting the historical model version described below.

## Original SHE-71 handoff

This directory contains tooling regression tests and **attempt logs**, not recorded
application results. No model responses are mocked by the acceptance journeys.
The command tests deliberately stub the Playwright process to verify that an exit
code of zero cannot masquerade as a successful recording with missing, empty or
corrupt media. Their placeholder files are temporary and are not browser evidence.

## Slice and acceptance

Own only the assigned browser suite, browser config, recording command and this
fixture directory. Preserve the current integrated sprint and existing canonical
regressions. No production code or shared interface changes. The two pre-existing
workspace edits (the new journey and config override) were retained and completed.
The implementation plan is coordinator-owned; this scoped handoff records status
without editing that shared file.

The added journeys use the homepage Play Demo link and real City API; assert
loading controls, matched Month 0, seed/hash and 121 snapshots per arm; finish the
uncut demo; scrub to Month 120 and the first added building; inspect its WHY record;
run the no-intervention control and restore the housing intervention to verify
reproducibility. Two forced Canvas2D journeys click a recorded building at actual
projected coordinates, scrub, and check overflow and control occlusion at 1440×900
and 390×844. A separate test holds an outgoing real request, takes the browser
offline, verifies failure and retries online. Interception delays requests only;
it never fulfills requests or creates model results.

The intended recipe is seed 42, 30 synthetic households, 120 months,
`city-systems.1.0.0`, housing amount 24, illustrative cost 1,000,000 USD. Expected
home delta is +24 at Month 120. These are assertions from the frozen contracts,
**not newly observed measurements**. No new experiment/run ID or measurement exists
until the browser journeys execute. Synthetic layout positions are schematic;
City identities are not joined to House/Population.

## Run on a host that permits listening sockets

From the repository root (choose unused ports):

```sh
HBL_TWO_FUTURES_PORT=40171 bunx playwright test --config test/one-city-two-futures.browser.config.js
bun scripts/record-one-city-two-futures.mjs --output /tmp/she71-recording --port 40172
bun test test/fixtures/one-city-two-futures/recording-command.test.js
```

Use an installed Playwright Chromium, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible Chrome executable. The
recording validator requires `ffprobe` (FFmpeg) on PATH. It decodes/counts frames
and checks positive video duration before writing `recording-manifest.json` and
reporting success. The script selects all four SHE-71 journeys, including Canvas,
and propagates browser/test/server failures. No successful recording is claimed
from an exit code alone.

The config retains the existing canonical suite and adds four SHE-71 tests (18
total discovered). It starts `bun --no-env-file run start` with isolated temporary
City, World, share and Decision stores, refuses server reuse, records video and
trace for every test, and uses 1440×900 by default. The mobile test changes its
viewport to 390×844; video remains a 1440×900 recording surface, with actual page
viewport saved in metadata.

## Output layout

Under each Playwright test output directory:

- `browser-log.json`: page errors, console errors, failed requests, route and viewport,
  including the deliberately induced offline request failures.
- `video.webm` and `trace.zip`: uncut per-test recording and trace.
- `month-0/`, `first-divergence/`, `why-open/`, `canvas2d/` where applicable:
  named PNG, `scenario.json` and `metrics.json` captured from `window.futureMachine`.
- The homepage journey additionally saves `month-120/`, `no-intervention/` and
  `rerun/`. Scenario metadata identifies recipe, seed, model, experiment, initial
  hash, exact URL, backend, viewport and browser user agent. Metrics identify
  selected month, baseline/plan/delta/unit and first added building.

Canvas metadata and screenshots belong to the two Canvas tests; the homepage
journey retains its actual selected renderer. Videos and screenshots are generated
only by the real running app. Outputs are local and have not been uploaded.

## Actual verification on 2026-11-12

Checkout: `mini/SHE-71`, starting HEAD `b963dd3`.

- `bun test test/fixtures/one-city-two-futures/recording-command.test.js`: **5 passed**,
  18 assertions. See `tooling-tests.log`.
- Playwright `--list`: **18 tests discovered**, four added SHE-71 journeys. This is
  discovery only. See `test-list.log`.
- Node syntax checks for the journey and recording script, and `git diff --check`:
  passed.
- Full required Playwright command: **failed before browser execution**, exit 1.
  See `browser-attempt.log`.
- Required recording command: **failed before browser execution**, exit 1. See
  `recording-attempt.log`. No playable file, screenshots, trace, scenario or
  measured metrics were produced in this session.
- Local socket probe: `listen(0, '127.0.0.1')` returns **EPERM**. See
  `socket-probe.log`. Bun reports `EADDRINUSE` even at an alternate selected port;
  the independent OS error establishes the local server setup blocker.
- The referenced `test/e2e/world-first-run.e2e.js` is absent from this checkout.
  Existing canonical World fallback/Activity smoke remains included but unrun
  because the same server prerequisite blocks it.

All browser acceptance remains unverified here, including actual selectors,
Canvas pixel hit testing, responsive screenshot inspection, measured metrics,
console cleanliness, offline recovery and recording playback. Highest priority
handoff: run the commands on a socket-enabled host, inspect PNGs/video, and give
any failing selector/behavior evidence to coordinator issue #13. No production
repair is inferred from a tooling blocker. No merge, release or deployment.

GitHub readback confirmed issue #19 is open with `hbl-agent-ready`; a search of
all PR states for head `sprint/oc2f-browser-qa` returned no matches. The local
checkout/worktrees were inspected without creating a second worker. Historical
browser QA integration is recorded separately in the existing sprint manifest.

Commit/publication blocker: `git add` failed with exit 128 because the sandbox
cannot create `/Users/wahabma/happybearlandia/.git/worktrees/SHE-71/index.lock`
(`Operation not permitted`). Changes remain unstaged on `mini/SHE-71`; no commit
or PR was created. Host-side staging/commit and browser verification are required.
A standalone diff including new files is available at `/tmp/she71-qa.patch`.
