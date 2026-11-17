# SHE-63 release matrix follow-up — 2026-11-14

**Acceptance incomplete: no current matrix journey reached a browser.** This is
an execution-blocked verification increment, not release approval. Candidate:
`cdb773a19acb5f68cd949dab2b8af148a0e1aefe`, branch `mini/SHE-63-r3`, base
`sprint/one-city-two-futures-20261111`. No new PR published.

## Audit and bounded ownership

Read root AGENTS/README, product design, relevant implementation-plan entries,
release checklist, review instructions, Future Machine data/fallback contracts,
the existing matrix config and its three selected test files. No
`docs/architecture.md` exists. Working tree initially contained only five
untracked `.mini-symphony-evidence/SHE-63-r3-before*` files; preserved untouched.
Ownership here is this review, `docs/evidence/she63-r3/`, the matrix config and a
narrow implementation-plan status addition. No application or model change.
These verification tasks share one server/config and need no delegated workers.

GitHub read confirms [prior matrix PR #118](https://github.com/adnanwahab/happybearlandia/pull/118)
merged head `ac3b8e8a`. Its report records blocked execution, not acceptance.
The existing five selected tests already exercise the requested behaviors:

| Existing source | Behavior checked when execution is possible |
| --- | --- |
| `test/e2e/two-futures-sprint.e2e.js` — real paired runs | Equal Month 0, changed Month 120, +24 homes/+1,000,000 modeled USD, deterministic refresh and independent run |
| Same file — guided controls | Pause/resume, shared camera, difference view, recorded completion and metric WHY with seed/model/experiment and synthetic disclosure |
| Same file — forced unavailable WebGL | Actual Canvas2D fallback and selection retain paired metrics |
| `test/e2e/two-futures-compatibility.e2e.js` — 320px Canvas | Narrow viewport, timeline, metrics, WHY, no horizontal overflow |
| `test/e2e/future-machine-share-reliability.e2e.js` — actual saved replay | Share/reopen at Month 16 retains identity, recipe, hashes, metrics and recorded event |

HBL-W1-046/SHE-59 is represented by merged PR #32 in local history; the prior
matrix report records it Done. This is historical status, not a new acceptance
decision. Read the actual [SHE-44 report](SHE-44.md) and
[fallback benchmark](../low-end-fallback-benchmark.md).
[PR #319](https://github.com/adnanwahab/happybearlandia/pull/319) is merged at the
candidate SHA, but reports no successful benchmark measurements. Its entrypoint
screenshots do not establish benchmark or matrix acceptance. Earlier integrated
sprint renderer evidence in `docs/evidence/she-11-sprint-host-20261114/` concerns
World startup, not all five Future Machine journeys. Per the sequencing
correction, those acceptance gaps did not prevent this matrix attempt. SHE-44
performance acceptance and SHE-64 final recording remain unresolved.

## Current platform matrix

All five requested behaviors are **NOT RUN** in every row below; there are no
application assertion failures or passes to infer from startup failure.

| Environment | Observed availability / execution result |
| --- | --- |
| Installed Chrome 157.0.8103.52, macOS arm64 | Standalone Playwright launch aborts, SIGABRT; candidate server also cannot listen |
| Installed Safari 18.6 | Installed; no candidate server and no available browser access host; native journey unavailable |
| Installed Firefox 155.0.1 | Installed; native journey unavailable through browser access host; not the patched Playwright build |
| Playwright Firefox revision 1543 | Required executable absent; no download attempted because server bind independently blocks every lane |
| Playwright WebKit revision 2359 | Executable present, launch aborts (exit 134); WebKit is not installed Safari evidence |
| Mobile 320×640 CSS viewport | Existing emulation case selected but not run; no physical-device claim |
| Physical iOS/Android | No accessible device established; `adb`/`idevice_id` absent and `xcrun xctrace list devices` exits 72 |

CUA inventory returned `Browsers: Error: The browser access host is unavailable`.
No native UI fallback could reach a candidate page. No new screenshot exists;
no UI changed. The pre-existing before screenshots have no candidate provenance
in their manifest and cover home/World only; they are not matrix evidence.

## Reproduction and actual evidence

First `bun install --frozen-lockfile` failed with tempdir EPERM.
`TMPDIR=/private/tmp bun install --frozen-lockfile` succeeded (74 installs,
86 packages, no dependency changes). The first matrix attempt then resolved a
dependency-provided Bun launcher whose postinstall had not run. The config now
accepts `HBL_BUN_EXECUTABLE`, matching other repository browser configs, and
`HBL_SHE63_ARTIFACT_DIR`. Outputs default to `/tmp/hbl-she63-matrix` rather than
overwriting the committed historical `test/test-results` report. That historical
file was restored byte-for-byte after the initial attempt. Canonical tests and
the 15-case selection are unchanged.

Exact final execution command (exit 1 before any test):

```sh
TMPDIR=/private/tmp HBL_BUN_EXECUTABLE=/Users/wahabma/.bun/bin/bun HBL_SHE63_ARTIFACT_DIR=/private/tmp/she63-r3 bunx --no-install playwright test --config test/she63-release-matrix.config.js
```

[matrix.log](../evidence/she63-r3/matrix.log) records server.js:440 listen
EADDRINUSE on 54663. Independent probe confirms a permission restriction:

```sh
python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()); s.close()'
```

Exit 1, `PermissionError: [Errno 1] Operation not permitted` in
[socket-probe.log](../evidence/she63-r3/socket-probe.log). No escalation is
available under this session's never-approval policy.

Standalone `chromium.launch({channel:'chrome'})`, `firefox.launch({})`, and
`webkit.launch({})` were attempted via `TMPDIR=/private/tmp bun -e` importing
`@playwright/test`; exact launch arguments and failures are retained in
[engine-probe.json](../evidence/she63-r3/engine-probe.json). The probe exits 0
because each error is caught for inventory; every row says unavailable. That
exit code is not a browser pass. App versions were read using
`/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString'` on each app's
`Contents/Info.plist`.

```sh
TMPDIR=/private/tmp bunx --no-install playwright test --config test/she63-release-matrix.config.js --list
node --check test/she63-release-matrix.config.js
TMPDIR=/private/tmp bun test test/future-machine-canvas.test.js test/future-machine-backend.test.js test/future-machine-scrub-identity.test.js test/future-machine-data.test.js test/future-machine-paired.test.js
git diff --check
```

Discovery: exit 0, 15 cases across three engines
([discovery.log](../evidence/she63-r3/discovery.log)); JS syntax passed.
Contracts: exit 0, **32 passed, 1 existing opt-in browser skip, 0 failed,
880 assertions**, five files. Results are retained in
[contracts.log](../evidence/she63-r3/contracts.log). Whitespace check passed.
No repository-wide lint/typecheck script exists and no TypeScript was changed.
Lock SHA-256 remains
`43291a19e81c5ea0e2c3ee463d66273e66bdef30794fae3e144711cdba270b4d`.

Simulation data, identities, model/rules versions, seed and disclosures are
unchanged. Seed-42 City runs in contract tests are synthetic modeled results,
not browser measurements or real-city observations. Detailed history remains
manifest recomputation, not independent recorded-checkpoint equivalence.

## Remaining work and preserved policy

Run the same command on a host that permits listeners and browser processes;
retain per-case JSON/screenshots/traces and exact SHA/runtime versions. Provision
the patched Firefox build there, and exercise installed Safari separately.
Inspect each baseline/changed-month/WHY/share/fallback result rather than using
process completion as acceptance. Physical hardware remains optional and must
stay explicitly unavailable until actually tested. Resolve SHE-44 measurements
before consolidated acceptance; SHE-64 cannot use this blocked matrix as a pass.

Inspected `.github/workflows/auto-merge.yml`: autonomous merge job remains under
literal `false`. Existing vote/auth/check requirements and release gates are
unchanged; remote branch protection was not independently certified. No Linear
mutation, external message, workflow dispatch, merge, deploy or production action.
