# SHE-61 dependency and browser risk audit

Audited base: `f1174eb9a5cead6892370d25af97167a0babb54b`,
`sprint/one-city-two-futures-20261111`. Observed November 11, 2026 America/Chicago
(November 12 UTC in machine evidence). This is a present-source risk review, not
release approval, a platform support promise, or a dependency upgrade.
Machine-readable results: [she61-audit.json](evidence/she61-audit.json).

## Ownership agreement and existing work

The user assigned release/backlog coordination. The coordinator allocated only
this report, `ops/dependency-browser-audit.mjs`, its dedicated test, and the JSON
evidence in Linear workpad `7f19f3d6-7c84-40d7-964f-793f805d4f17`, after checking
open PR file lists and retained pipeline reservations. No prior owner's approval
or handoff is fabricated: existing claims are retained, rather than transferred.

`docs/demo-backlog.md` records U13's installed-engine audit as VERIFIED and R01/R06
as delivered. SHE-61 consumes that work without repeating its implementation.
Worker 6's active saved-World/browser repair remains separate (SHE-27).
SHE-26 retains canonical test/config/recording ownership; SHE-63 retains the full
cross-browser release matrix (baseline/changed month/WHY/share/fallback).
Renderer code, canonical suites, CI, shared interfaces, dependencies and lockfile
are read-only here. The dedicated new audit paths do not overlap those claims.
No `symphony-pilot` approval is needed for, or granted by, this manual audit.

## Reproduce without upgrading

Use the checked-in lockfile, the repository's Bun runtime, and installed
Playwright package. The tool reads JSONC `bun.lock`, records SHA-256 for lock and
manifest, runs `bun audit --json`, and checks expected browser executable presence.
It strips integration credential variables from its audit subprocess, persists
no raw stderr or credentials, never installs packages/browsers, and never applies
fixes. The registry subprocess is killed after a 30-second deadline and any timeout
is classified unavailable. Existing output files are not overwritten.

```sh
bun test test/dependency-browser-audit.test.js test/future-machine-backend.test.js
bun ops/dependency-browser-audit.mjs --output /tmp/she61-fresh-audit.json
```

Exit 0 means a successful registry response returned no advisories, 1 means
advisories returned, and 2 means incomplete/unavailable/invalid audit. An error,
missing JSON, unknown JSON schema or contradictory process exit must not count
as a clean audit. A successful empty `{}` is valid npm bulk-advisory evidence;
it is not proof that the application is free of vulnerabilities. Retry network
errors only through an authorized environment; do not suppress the failed attempt.

[Bun's audit documentation](https://bun.sh/docs/pm/cli/audit) explains its lockfile
input, npm advisory endpoint, read-only behavior and raw JSON output. The direct
runtime query in this audit returned `{}`, exit 0, with no stderr. Both dependency
files were unchanged. The earlier sandbox DNS failure was recorded as unavailable
and was followed by an authorized network run, not relabeled as success.

## Dependency findings

The lock contains 85 package entries and eleven direct dependencies including one
dev dependency. Exact direct versions are retained in the JSON; no version range
was mistaken for an installed version. The lock SHA-256 is
`43291a19e81c5ea0e2c3ee463d66273e66bdef30794fae3e144711cdba270b4d`.

| Classification | Observed result | Implication |
| --- | --- | --- |
| Confirmed application vulnerability | None demonstrated in this audit | No exploit testing was performed; do not call this a security certification. |
| npm registry advisories for the locked inventory | None returned at the recorded time | Requery on every release/lock change; advisories evolve. Do not invent a remediation upgrade. |
| Unscanned surfaces | Bun/Docker/OS, Fly runtime, remote services, CDN-delivered modules outside the lock, and private application logic | This npm audit cannot clear those surfaces. Review them in the release risk record. |
| Reproducibility | Frozen lock and manifest unchanged; Dockerfile uses `bun install --frozen-lockfile` | Keep the lock hash with build evidence. Do not use an unreviewed floating install to clear an advisory. |
| Scope of dependencies | Ten production declarations, one Playwright dev declaration | Declaration is not proof of route reachability or browser shipment; assess actual use before calling a finding exploitable. |

No bulk upgrade, override, ignore list or CI weakening was performed. If a future
advisory is returned, record its URL/range, exact dependency path, affected runtime
route, remediation candidate and focused regressions before changing versions.

## Browser evidence and compatibility risks

[Playwright's browser documentation](https://playwright.dev/docs/browsers) explains
that each Playwright version requires matching browser revisions. Merely finding
an executable does not establish application compatibility. Mobile emulation is
not a physical device; Playwright WebKit is not installed Safari.

| Engine/platform | Inventory and actual evidence | Remaining limit |
| --- | --- | --- |
| Chromium, macOS arm64 | Playwright 1.63.0 expected executable exists (revision1243). Two existing actual app journeys passed on this base. | Limited local journeys; not every route, browser release or production deployment. |
| Firefox | Expected executable absent | Not run, not declared unsupported. Full matrix remains SHE-63. |
| Playwright WebKit | Expected executable absent | Not run; no Safari/iOS equivalence claim. Full matrix remains SHE-63. |
| Installed Safari / physical iOS and Android | No platform journey executed by SHE-61 | Untested. A 320px viewport is not a phone/hardware test. |
| Native WebGPU | No new hardware proof here | R01 source attempts native initialization, then WebGL; Canvas/inventory fallback remains part of the existing design. A native badge/API presence is not measured hardware support. |
| Chromium Canvas2D fallback | Actual 320px comparison reached WHY with recorded 24-home change and no horizontal overflow | Validates only this fallback journey, source and engine. |

Current `playwright.config.js` selects Chromium and one worker. The core-journeys
workflow installs Chromium only and currently uses `ubuntu-latest` on this base.
PR [#25](https://github.com/adnanwahab/happybearlandia/pull/25) proposes Ubuntu24.04;
it is unmerged and cannot be described as current sprint CI configuration.
Its [run43146084856](https://github.com/adnanwahab/happybearlandia/actions/runs/43146084856)
was inspected by the coordinator: dependencies, units and Chromium installation
passed, then three existing release-browser assertions failed (saved Worldline
return link, legacy fallback expectation, registry count29 versus31). Subsequent
steps were skipped by job failure. This is not a green release check. The existing
owner is repairing those paths; SHE-61 neither edits nor weakens their assertions.

The Future Machine import map uses local `/vendor/three/*` paths and pinned
Three0.186.0. Its renderer factory bounds native initialization and handles
missing `navigator.gpu`, forced WebGL and failed native startup. Source fallbacks
are mechanisms, not proof of every browser's support. Existing backend unit
regressions were rerun without modifying those interfaces.

## Actual checks and remediation ledger

- `bun test test/dependency-browser-audit.test.js test/future-machine-backend.test.js`:
  **15 passed, 0 failed, 1 existing browser-gated skip, 74 assertions**. The six
  new tests cover network/schema failure, contradictory exits, scoped versions,
  advisory classification, absent engines and a real stalled subprocess deadline. The skip is retained, not waived.
- `bun ops/dependency-browser-audit.mjs --output <new-path>`: final authorized
  network run **exit0, no advisories returned**, with lock/manifest unchanged.
- Two unchanged existing browser journeys, credential variables removed:
  **2 passed, 0 failed, 6.7s**, one worker, loopback54561, disposable stores.
  Command and local artifacts are recorded in the JSON. Initial sandbox bind
  failure was corrected using authorized local server/browser execution.
- No package lint/typecheck scripts exist. `bun build ops/dependency-browser-audit.mjs --target=bun --external '*'`
  and `git diff --check` passed separately; no lint/type check is invented.

| Priority / owner | Tracked next action | Gate |
| --- | --- | --- |
| P1 / existing SHE-27 repair owner | Reproduce/fix the three real hosted release-browser failures and verify exact PR HEAD in CI | Release remains blocked until real checks pass; SHE-61's audit report can be reviewed independently. |
| P1 / SHE-63 matrix owner | Run declared baseline/changed-month/WHY/share/fallback matrix on available Firefox/WebKit and physical platforms as required by release policy | Do not advertise support from Chromium-only evidence. |
| Per-release / dependency owner | Rerun the pinned advisory audit; if nonempty, triage reachability and test a narrowly scoped fix | No automatic upgrade or ignored advisory. |
| Release coordinator | Audit Bun/image/OS and approve explicit supported-browser policy with evidence | npm advisory result cannot clear image/platform risks. |

The report's implementation and limited verification are complete; broader
release, full browser matrix, production measurements and hosted repair remain
separate gates. No merge, deployment or production write was performed.


## Current-base revalidation after upstream integration

The parent coordinator losslessly merged current sprint
`f794ba25e89ee1db9c1ee3a6bdc562e404ca1965` into this issue branch; the original
SHE-61 commit `75ce8d489c1d6a2c597026e8449c5c46ebedb8d8` remains in history.
At merged HEAD `607694a87ba14b6c3abe585429ca5f69a58339dc`, the exact targeted
unit/backend command passed **15 tests, 0 failures, 1 existing browser-gated skip,
74 assertions**. The same two unchanged Chromium journeys passed **2 tests,
0 failures, 6.3s**, with credential variables removed, disposable local stores
and the isolated54561 server. The first sandbox bind attempt failed; the
authorized rerun passed without stopping another service.

`package.json` and `bun.lock` are unchanged from the original audit, and both
SHA-256 values still match the recorded receipt. No new advisory request was
made: the original query remains a time-qualified receipt, not a refreshed
registry result. Current source includes the upstream manifest/replay fixes and
saved-World/browser assertion repairs. The PR25 run and remediation ledger above
are historical evidence from the original base; they must not be read as proof
those three failures still exist on this current base. The current workflow still
uses ubuntu-latest. Full canonical-suite validation and current hosted CI remain
their existing owners' gates; SHE-61's limited rerun neither duplicates nor
certifies them. Firefox/WebKit/Safari/physical-device/native-WebGPU limitations
remain unchanged. No new ownership transfer, dependency upgrade or CI weakening
was performed.
