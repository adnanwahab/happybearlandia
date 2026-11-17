# SHE-63 r4 — merged-source browser verification, 2026-11-17

Status: **acceptance remains open: 4 passed, 11 failed** on the pinned merged
revision. A scoped test repair is present locally and needs a fresh browser run.
No merge, deployment, production change, external message, or release-gate change.

## Revision, ownership and audit

Branch: `mini/SHE-63-r4`. Local HEAD and remote sprint branch both resolve to
`926d4edde66a2b2aa42e2af6f406978d45c9cda4`. GitHub branch API was read during
this retry; shell `git ls-remote` failed DNS resolution. No pull was necessary:
the requested [PR #418](https://github.com/adnanwahab/happybearlandia/pull/418)
is already the local HEAD. API confirms its November 17 merge and exact SHA.
It supplies infrastructure, not acceptance. No new PR/commit published.

Single worker owns only the two canonical test helpers changed here, this report,
CI excerpt and a narrow implementation-plan status entry. Initial tracked tree
was clean; five pre-existing `.mini-symphony-evidence/SHE-63-r4-before*` files
remain untouched and are not claimed as this verification's screenshots.
Read root AGENTS/README, relevant design and implementation-plan entries,
UI/scrub-preview and fallback module documentation, prior SHE-63/SHE-44 reports,
matrix workflow/config/wrapper, selected tests and merge policy. No
`docs/architecture.md` exists. Existing paired-run, WHY, share and fallback
implementations are reused; no application or model feature reimplemented.

Historical evidence remains in `docs/she63-release-matrix.md` and
`docs/reviews/SHE-63.md`. SHE-59 implementation is present (merged PR #32).
SHE-44's actual `docs/reviews/SHE-44.md` report records incomplete measurements;
merged PR #319 is not acceptance. Sequencing correction authorizes this matrix
without waiting for those tickets. Consolidated fallback acceptance remains open.

## Actual matching CI results

[Run 44063326098, attempt 1](https://github.com/adnanwahab/happybearlandia/actions/runs/44063326098)
executed on Ubuntu 24.04 against the exact merged SHA above. Job 133970525037
completed with failure; install and artifact upload succeeded. Runner logged
Chrome 157.0.8103.78 and Playwright 1.63.0. Firefox/WebKit runtime versions were
not separately printed; do not infer native Safari coverage.

| Selected real-browser case | Installed Chrome | Playwright Firefox | Playwright WebKit |
| --- | --- | --- | --- |
| Saved replay, selected month, identity and exact histories | FAIL | FAIL | PASS |
| 320px Canvas timeline, metrics, WHY, no overflow | PASS | PASS | PASS |
| Matched baseline, changed month, metrics, deterministic refresh | FAIL | FAIL | FAIL |
| Guided controls, shared camera, difference-only, metric WHY | FAIL | FAIL | FAIL |
| Forced unavailable WebGL, paired evidence and selection | FAIL | FAIL | FAIL |

All 15 cases ran: **4 passed / 11 failed / no skipped cases**, 7.6 minutes.
The 320px row is desktop viewport emulation, not physical mobile testing.
Native Safari and physical iOS/Android: **unavailable to this verification**;
no connected physical device or native Safari journey was established.
Desktop software rendering is not a low-end-device performance certification.
Failed cases do not prove later WHY/replay/fallback assertions passed.

Retained [artifact 14319403177](https://github.com/adnanwahab/happybearlandia/actions/runs/44063326098/artifacts/14319403177):
232638568 bytes; ZIP SHA256
`338c490730458ded687748a4ca077b837f7a89b287da505dcc7313895ee4f73f`.
The artifact contains matrix results, screenshots and failure traces according
to the workflow/upload logs. Connector download returned a reusable ZIP file
reference, but fetching its bytes failed (`fetch failed`; curl DNS failure).
Thus **per-case artifact JSON, trace contents and screenshots were not locally
inspected**. Results above are from the complete decoded job log, including all
15 case statuses and assertion failures; a selected excerpt is retained in
[SHE-63-r4-ci-excerpt.txt](SHE-63-r4-ci-excerpt.txt). No invented artifact results.
Retrieve and inspect `results.json` and `tests/**/trace.zip` before final acceptance.

Earlier [PR run 44062753076](https://github.com/adnanwahab/happybearlandia/actions/runs/44062753076)
on head `18da0a10f0e4383ccb1c4bd7d4653a0df7f5ec68` also logged 4 pass/11 fail.
Its artifact 14319312734 was downloaded by the connector to a file reference;
that older source is not substituted for the merged revision.

## Demonstrated failure and bounded repair

Nine failures time out in `two-futures-sprint.e2e.js:6`: expected month 120,
actual 0 for paired/fallback, or 5/3/4 for guided Chrome/Firefox/WebKit.
Chrome sharing expected month 16 but received 0. Firefox sharing compared
month-16 metrics against reopened month-0 metrics. WebKit sharing passed.

Source inspection explains a harness mismatch: `bindScrubPreview` treats input
as preview and cancels any scheduled commit. Native change/release schedules a
120ms commit. Playwright fill is followed by another synthetic input in the old
helpers, cancelling that commit. Sharing also copied immediately without waiting
for the committed month, permitting a race. This does not establish an app-level
simulation or persistence defect.

Repair: select the timeline by its existing test ID, dispatch change after fill,
and poll the committed month before subsequent assertions or copying a link.
No state mutation shortcut, assertion weakening, case removal or timeout increase.
All 15 cases remain selected. Existing preview tests verify release/debounce and
cancellation; real-browser verification of this repair remains blocked locally.
Later failures may emerge after month selection succeeds; they remain unresolved.

## Reproduction and actual local checks

```sh
node scripts/run-she63-browser-matrix.mjs
bunx --no-install playwright test --config test/she63-release-matrix.config.js --list
NODE_PATH=/Users/wahabma/happybearlandia/node_modules bunx --no-install playwright test --config test/she63-release-matrix.config.js --list
bun test test/future-machine-scrub-preview.test.js
bun test test/future-machine-canvas.test.js test/future-machine-backend.test.js test/future-machine-scrub-identity.test.js test/future-machine-data.test.js test/future-machine-paired.test.js
node --check test/e2e/two-futures-sprint.e2e.js
node --check test/e2e/future-machine-share-reliability.e2e.js
git diff --check
```

Wrapper: exit 2, `Cannot allocate a loopback port: EPERM`, zero tests launched.
No fixed-port retry attempted. Initial discovery failed missing local
`@playwright/test`; using the existing repository dependency installation via
NODE_PATH discovered all 15 cases, exit 0, without modifying dependencies.
Preview tests: 2 pass, 1 opt-in browser skip, 12 assertions. Focused simulation,
Canvas/backend and replay tests: 33 pass, 1 opt-in browser skip, 884 assertions.
Syntax and diff checks pass. Root package has no lint/typecheck script; no TS
interface changed. No new UI screenshot because no UI changed locally.

Tests preserve seed 42, `city-systems.1.1.0`, original hash
`7767de6b19f3b1c62f218c3a4ee26739157382db2c7ff962dbe141fc160821ae`,
24-home intervention and 1,000,000 illustrative cumulative USD. These are
synthetic model results, not observations or predictions. Source histories,
identities, manifests, provenance and disclosures remain unchanged. Replay is
manifest reconstruction, not independently verified recorded checkpoints.

## Remaining action and policy

Run the repaired candidate with `bun scripts/run-she63-browser-matrix.mjs` on a
permissioned host, or inspect its exact-SHA CI artifacts after review publication.
Review all 15 per-case JSON/results and traces, plus any further failures;
retain native Safari/physical-device unavailability. Resolve SHE-44 measurement
gaps for consolidated acceptance. SHE-64 final recording remains gated.

Configured merge policy is preserved: `.github/workflows/auto-merge.yml` merge
job has literal false safety hold. Existing draft/review/hold/current-head CI,
fresh-base and auth/voting/check requirements are untouched. No one-vote quorum,
auto-merge activation, branch protection or remote policy change was performed.

## Firefox guided-controls follow-up — November 17

Working slice: existing PR422 rebased from926d4edd onto actual sprintdd9f6b68,
not main. Preserved latest planning entries when resolving the append conflict;
original test repair and all15 selected browser cases remain intact. Own Canvas
selection diagnostics, targeted regressions, evidence metadata and this report.
Acceptance: normal pointer selection of the exact plan building after camera
and mode changes, immutable seed42/history/month120, all15 Chrome/Firefox/WebKit
cases on the permissioned GitHub runner, exact SHA artifacts and broader CI.
No SHE64 dependency, human review, merge or deployment gate is removed.

Inspected exact PRheadcab89f62 CIrun44065051655/job133976475503, downloaded
artifact14319069818 (50814803bytes; service digest
7c18c109eb0e9d5d42e4fa9b5e2df24326fe3afc92acf0e58fff6b6031bdcab8).
Actual result14pass/1fail. Locally retained artifact directory
`/private/tmp/hbl-she63-ci-44065051655`. Opened Firefox failed screenshot and
parsed Playwright trace/network/action records. Screenshot explicitly labels
Canvas2D at Month120 and visibly paints the added plan building, partly clipped
on the right. Trace reports WebGL2 creation unavailable (`AllowWebgl2:false`),
then successful camera drag and Difference-only→Split before the target lookup.
This is not missing simulation inventory or an asynchronous seek failure.

Actual source divergence: Canvas renders and picks the correct recorded polygon,
but `canvas-stage.js:getStats` exposes no targets, while `scene/index.js:getStats`
overwrites diagnostics with a list built only from native Three meshes. That
list is empty on Firefox's valid Canvas fallback. The test also assumes each
entity's projected center remains inside its viewport after a pan; here the
center can be clipped although a selectable portion is visibly painted.

Fix: derive Canvas targets from the same polygon projection, arm/curtain clip
and native Canvas hit test, exposing a verified interior point of the visible
polygon. The stage forwards the active Canvas diagnostics. No artificial target
for missing/ghost/offscreen geometry, camera recentering, forced click, assertion
removal, timeout increase or backend substitution. Original guided pointer and
PROJECT_COMPLETE assertions remain unchanged. Unit cases cover clipping, mode
changes, actual pointer selection, triangles, curtain, offscreen/reset/dispose
and model-input immutability. Monthly City rules/ODD remain unchanged because
this is a read-only presentation diagnostic over the same versioned records.

Fresh GitHub exact-revision acceptance remains pending until recorded below.

Trace camera evidence: before drag{x:36,z:0,zoom:7.3895348837209305};
after drag{x:26.526451132837128,z:-2.029897718332022,zoom:7.3895348837209305},
unchanged through both view switches. Target lookup then returned undefined.
New guided evidence records backend/month/camera/all targets and canvas bounds
before the unchanged real scene click; target viewport bounds are now asserted
additionally. All15 matrix traces are retained, including successful cases.

Focused checks:29 passed,1 existing opt-in browser skip,0failed,327 assertions
(`bun test test/future-machine-canvas.test.js test/future-machine-scene.test.js test/future-machine-scrub-preview.test.js test/future-machine-scrub-identity.test.js`).
Discovery lists exactly15 tests across installed Chrome, Firefox and WebKit.
Syntax and diff checks pass.

Independent review: no blocking defect for the reproduced failure; every candidate
is rechecked by the normal picker. Candidate points are diagnostic samples, not
an exhaustive pixel search: a thin visible rim around another occluding polygon
can still be normally selectable while omitted. Target coordinates are local
logical CSS pixels in the standalone canvas; CSS-transformed embedding hosts must
apply their own local-to-page conversion. Reused the Canvas stats snapshot for
object count to avoid redundant targeting work.
