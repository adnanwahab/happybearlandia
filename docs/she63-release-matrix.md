# SHE-63 release matrix — November 12, 2026

Status: **blocked / no current browser pass**. Source
`b963dd353538294cb0fbf5d34d5283fad6e10e68`, branch `mini/SHE-63`.
Issue: https://linear.app/shel-bernstein/issue/SHE-63/hbl-w1-050-run-desktop-and-mobile-cross-browser-release-matrix
No commit or PR created during this run. No production request, deployment,
main merge, release-gate change or Linear status change.

## Slice, prerequisites and ownership

Scope is an isolated matrix config and this evidence report. Existing application,
canonical browser tests, CI and coordinator-owned implementation plan are read-only.
This report carries the issue-specific plan/status for coordinator integration;
it does not claim a coordinator ownership agreement or ready-for-dispatch status.
Read product design, affected implementation-plan entries, release checklist,
SHE-61 audit and release-backlog ownership record before editing.

Linear read on this date: HBL-W1-046 / SHE-59 is Done; HBL-W1-031 / SHE-44 is
Backlog. Thus the imported prerequisite gate remains unresolved. No worker was
dispatched and no ready label added. Acceptance needs real baseline, changed-month,
WHY, shared reopen and fallback evidence on each accessible platform, with exact
source provenance and explicit unavailable rows. Risks: sandbox server binding,
missing engine builds, physical device access and renderer differences.

## Existing coverage reused

SHE-61 already inventories engines and records limited Chromium evidence on older
source; those passes are historical, not passes for this SHA. Existing tests cover
all five requested behaviors. The new `test/she63-release-matrix.config.js` selects
five unchanged tests across three canonical files:

- `two-futures-sprint.e2e.js`: matched baseline, month120 divergence and refresh;
  guided controls/camera/WHY; forced unavailable WebGL with actual Canvas fallback.
- `two-futures-compatibility.e2e.js`: 320px Canvas comparison and WHY without overflow.
- `future-machine-share-reliability.e2e.js`: real saved replay, selected month,
  identity and exact history hashes after refresh.

Tests retain actual seed42 City results, model/recipe/initial-state identifiers,
24-home intervention and synthetic/uncalibrated disclosure assertions. No outcome,
model, seed, renderer implementation or disclosure changed. Failure injection
only changes graphics availability. A narrow viewport is desktop emulation, not
physical mobile evidence. Browser record JSON and screenshots are emitted by the
existing tests only if they actually reach those steps.

## Observed platform matrix

| Platform | Inventory observed | Current result |
| --- | --- | --- |
| Installed Chrome, macOS arm64 | 157.0.8103.52 | NOT RUN: local server bind denied before browser launch |
| Installed Safari, macOS arm64 | 18.6 | NOT RUN: no reachable candidate server; no Safari journey executed |
| Installed Firefox, macOS arm64 | 155.0.1 | NOT RUN: no reachable candidate server; installed Firefox is not the patched Playwright build |
| Playwright Chromium | revision1243 executable exists | NOT RUN; presence is not compatibility evidence |
| Playwright Firefox | revision1543 expected executable absent | UNAVAILABLE for configured automation; no install attempted |
| Playwright WebKit | revision2359 expected executable absent | UNAVAILABLE for configured automation; not equivalent to installed Safari |
| 320px Canvas viewport | selected existing Chrome test | NOT RUN; emulation only |
| Physical iOS/Android | no accessible device established | UNAVAILABLE to this run; xctrace unavailable, adb and idevice_id absent from PATH |
| Native GPU / device-loss | not part of a completed run | UNVERIFIED; no hardware support claim |

Application versions came from each installed app's `Info.plist` using
`/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' <app>/Contents/Info.plist`.
Playwright executable paths were checked with `existsSync(type.executablePath())`.
Device tooling absence does not establish that no physical phone exists.

## Commands and actual results

```sh
bunx playwright test --config test/she63-release-matrix.config.js
HBL_SHE63_PORT=54664 bunx playwright test --config test/she63-release-matrix.config.js
python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname())'
bunx playwright test --config test/she63-release-matrix.config.js --list
shasum -a 256 bun.lock
```

Both execution attempts exited1 during server startup, before any test executed.
Bun reported `EADDRINUSE` at server.js:433 for ports54663 and54664. The independent
ephemeral-port Python probe returned `PermissionError: [Errno 1] Operation not
permitted`, establishing a bind permission blocker rather than evidence that both
ports were occupied. No request for escalation is available under this session's
never-approval policy. Do not count unexecuted tests as application failures or passes.

Initial test discovery passed: five selected Chrome tests in three files. Final
config also explicitly exposes Playwright Firefox and WebKit projects for a
host with those engines; listing them is not running them. The server uses
`bun --no-env-file`, a fresh temporary directory for each persisted test store,
and `reuseExistingServer:false`. Traces/screenshots are retained on failure;
the JSON reporter writes `test-results/she63-matrix-results.json`. No screenshot
was generated because no candidate page was opened, and no UI changed.
Lock SHA256: `43291a19e81c5ea0e2c3ee463d66273e66bdef30794fae3e144711cdba270b4d`.
No package lint or typecheck script exists.

## Remaining acceptance and exact next action

### Follow-up verification in the restricted workspace

On November 12, reran the installed-Chrome lane against the same source SHA
and `mini/SHE-63` branch. The two matrix files were already untracked at entry;
existing application code, canonical tests and shared implementation plan were
preserved. Re-read the full Linear scope and inspected the selected tests:
they already exercise the requested normal Fork City, timeline, WHY and Share
comparison entry points. No feature reimplementation is needed.

| Exact command | Observed result |
| --- | --- |
| `bunx playwright test --config test/she63-release-matrix.config.js --project installed-chrome` | Exit 1: server.js:433 listen failed with EADDRINUSE on 54663; zero browser tests executed. |
| `python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname())'` | Exit 1: PermissionError / Operation not permitted; confirms local bind restriction. |
| `bunx playwright test --config test/she63-release-matrix.config.js --list` | Exit 0: 15 cases, five per engine, in three canonical files. Discovery is not execution. |
| `shasum -a 256 bun.lock` | Exit 0: same checksum recorded above. |
| `xcrun xctrace list devices` | Exit 72: xctrace utility unavailable. `adb` and `idevice_id` also absent from PATH. No accessible physical device established. |

Rechecked all three installed app versions and Playwright executable paths;
the platform inventory above remains unchanged. Linear still reports SHE-59
Done and SHE-44 Backlog. No ready label, dispatch, issue status transition,
release approval, commit or PR was created. This follow-up adds evidence only;
all platform acceptance remains unresolved. No UI changed and no page opened,
so no new screenshot exists. The shared implementation plan remains untouched
under the ownership restriction recorded above; this report holds actual status.

On a permitted host run:

```sh
bunx playwright test --config test/she63-release-matrix.config.js --project installed-chrome
# After provisioning the Playwright builds on that host:
bunx playwright test --config test/she63-release-matrix.config.js --project playwright-firefox --project playwright-webkit
```

Record exact candidate SHA, browser versions, results and retained artifacts.
Separately exercise installed Safari and Firefox through their supported UI or
native automation, and an accessible physical phone: fork seed42, inspect month0,
seek120, open WHY Homes and its recorded event/disclosure, share and reopen the
selected month, then verify Canvas fallback against the same recorded results.
Playwright WebKit cannot close the installed Safari/physical iOS rows. Resolve
SHE-44 prerequisite and coordinator ownership before dispatch/readiness. Keep
release approval blocked pending the actual platform evidence; this report is a
reviewable preparation increment, not completion of the release matrix.
