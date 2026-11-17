# Symphony browser reliability — 2026-11-17

## Scope and acceptance

Owned files: Mini Symphony browser runtime, screenshot integration and worker
instructions; an isolated Playwright job wrapper, acceptance config/test,
regressions and dedicated workflow. No shared implementation plan changes.
Dependencies: existing Mini Symphony runtime PR #445 (7204f5d0). This is a
focused stacked PR, not a copy of that predecessor's changes.

Routine tests use bundled Playwright Chromium (`channel: chromium`), never
implicitly installed Chrome. Installed Chrome is an explicit separate matrix
entry. The eight engine/device jobs are Chromium, installed Chrome, Firefox and
WebKit, each desktop and mobile viewport. Firefox mobile uses touch plus a mobile
viewport; Playwright does not support Firefox's `isMobile` flag. Emulation is not
a real phone; Playwright WebKit is not a physical Safari run.

Before evidence supplied by the owner on MacBook Air M4 / 16 GB: 5/5 sequential
bundled Chromium launches, 3/3 concurrent launches, 6/6 startup smoke cases in
3.9 seconds. A previous installed Chrome 157 crash entered macOS HIServices;
the precise launcher and cause were not captured and remain unknown. These are
owner observations, not newly reproduced measurements or a diagnosed cause.

## Operation

```
bun scripts/run-symphony-browser-tests.mjs --config test/startup-smoke.config.js
bun scripts/run-symphony-browser-tests.mjs --config test/symphony-browser-runtime.config.js --engines chromium,installed-chrome,firefox,webkit --devices desktop,mobile --artifacts /private/tmp/hbl-browser-release
```

The routine default runs Chromium desktop/mobile separately. `--grep` is the only
forwarded Playwright argument. Each job uses one worker and zero assertion
retries. The wrapper preserves suite test selection, expectations and timeouts;
it replaces the browser connection and normal server infrastructure. It accepts
one standard repository `server.js` webServer. Device projects must have explicit
`desktop`/`mobile` names; their context settings and Chromium launch arguments are
preserved. Custom setup and custom/multiple-server suites
require an explicit isolated adapter and fail as incomplete rather than sharing
unrelated servers. Do not treat this bounded entrypoint smoke as sidewalk,
performance or complete feature acceptance; run the corresponding existing suite
through its appropriate adapter and retain its results separately.

`HBL_BROWSER_JOB_LIMIT` defaults to 3 and controls shared host admission across
participating processes. `HBL_BROWSER_JOB_DIRECTORY` selects the shared lease
root; coordinators on the same host must share it. `HBL_BROWSER_MIN_FREE_BYTES`
sets the minimum memory reserve. Low available memory reduces new admissions;
active jobs are never killed for pressure. Host memory measurements and queue
admission decisions are persisted with job evidence. This limits participating
browser jobs, not arbitrary browsers launched outside the runner. Worker prompts
require this runner when present; custom launchers must adopt the same lease API.

Each job has a unique lease/artifact directory. Browser profiles are owned by
Playwright launchServer; each launch creates a fresh temporary profile. Standard
servers bind a separate OS-allocated loopback port and use separate disposable
SQLite/data directories. The brief port-probe handoff can lose a bind race;
startup then fails instead of reusing another service. Evidence retains traces,
screenshots, JSON results and test-process stdout/stderr/exit information.

Startup diagnostics retain attempt number, executable, PID, exit code, crash
signal and stderr. Unobservable fields are null, never guessed. Browser startup
alone may retry a recognized transient failure at most twice with bounded
backoff. Persistent startup failure remains incomplete with all attempts
retained. Missing executables and configuration errors do not benefit from
assertion retries. A launched browser that later crashes fails its tests; the
suite is not replayed. Skipped, absent or flaky test coverage cannot be marked
passed even when a subprocess exits zero.

The dedicated GitHub Actions workflow has eight separate jobs, fail-fast false
and max-parallel 3. It checks out the exact PR head and retains artifacts even
when testing fails. It installs engines explicitly. No automatic merge or
production deployment is enabled. Required checks and human review still apply.

## Verification evidence

Integrated host regression command, with `HBL_BROWSER_RUNTIME_REAL=1`:
`bun test tools/symphony/mini-bun/browser-runtime.test.ts tools/symphony/mini-bun/screenshots.test.ts test/symphony-browser-config.test.js test/symphony-browser-result.test.js`
— **16 passed, zero failed/skipped, 112 assertions, 4.43s**. This includes an actual
bundled Chromium pointer click, real before/after desktop/mobile screenshots,
six independent processes reaching exactly three concurrent admissions, pressure
recovery, startup crash retries, cancellation races and owned-process cleanup.
The initially sandboxed browser runs were incomplete due to process permissions;
host reruns are identified separately, not relabeled sandbox passes.

Final local eight-job acceptance (17 November, 14:08:07–14:08:24 UTC), no assertion
retries: **6 passed, 2 failed, zero skipped**. All eight browser startups succeeded
on attempt one and exited normally. Individual results and exact executable/PID/
exit/signal records are in
[symphony-browser-reliability-20261117-evidence.json](symphony-browser-reliability-20261117-evidence.json).

| Engine | Desktop | Mobile viewport/touch |
| --- | --- | --- |
| Bundled Chromium | FAIL: unhandled native view-transition cancellation | PASS |
| Installed Chrome | PASS | FAIL: same native view-transition cancellation |
| Playwright Firefox | PASS | PASS |
| Playwright WebKit | PASS | PASS |

Both failures say `Transition was aborted because of invalid state. ViewTransition
opt-in disabled`, with an empty native stack. The normal navigation and enabled
Fork City checks completed before the zero-page-errors assertion failed. Traces
and screenshots are retained. The earlier host run was 7/8, with this error on
Chromium desktop. **This intermittent application/native-navigation error is not
resolved or filtered.** Owner: universe portal/navigation code maintainer; next
action: investigate transition promise timing from these traces, repair the cause
and rerun all eight entries. The previous installed Chrome HIServices startup
crash was not reproduced; its root cause remains unknown.

Existing committed startup smoke, unchanged on base 7204f5d0: desktop **4 passed /
2 failed** in 65.60s; mobile **4 passed / 2 failed** in 64.68s. Both fail the exact
`a[href="/world"]` link assumption and visible `#top` assumption; the latter is
attached but hidden. The owner's supplied 6/6 observation used a different local
state; unrelated root working-tree repairs were not copied into this PR. Owner:
startup-smoke suite maintainer; next action: review those independent test repairs
against the current navigation/control contract, then rerun without weakening
behavioral assertions. Neither startup profile is passing acceptance here.

Early wrapper verification caught a worker/server URL mismatch, now covered by
the reload regression, and lost source-suite environment descriptors, now
preserved. Failed first-run artifacts remain in `/private/tmp`; later successes
do not erase them. New invocations allocate unique run directories even with the
same `--artifacts` parent, so concurrent jobs cannot overwrite previous failures.
Local final artifacts: `/private/tmp/hbl-browser-reliability-final-20261117/run-YEG1Nq`.
Startup artifacts: `/private/tmp/hbl-browser-startup-r2-20261117`.

Coordinator/project/publication/auto-debug integration: **29 passed, zero failed,
269 assertions, 32.02s**. Bun runtime bundle builds (13 modules, 89.22 KB);
syntax and diff checks pass.

The focused PR is eligible for review, not merge: matrix acceptance remains
failed, exact published-head CI is pending, and physical iOS/Android/Safari tests
are unrun. No merge/deployment or running coordinator replacement was performed
for this browser-runtime work. Existing SHE-63
release evidence remains independent: its exact 77dc15bb matrix had 9 passes and
6 HTTP429 admission failures. The original Firefox guided-controls case passed;
SHE-63 is not complete and SHE-64 remains held.
