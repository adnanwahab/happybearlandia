# Housing comparison track — tickets 87, 117, 119

## Slice and acceptance

Implement a stored-record adapter and simultaneous schematic housing views for the selected Decision Studio future and its exact same-seed baseline. Preserve model identity/version and month; distinguish missing snapshots from zero; use the same stock/height/vacancy scales on both sides. Reuse `storedMetricSnapshot` and `buildingDimensions` from the existing building renderer. Do not infer Population parcels or empirical vacancy. Shared Advanced Studio edits are coordinator-owned, so normal-entrypoint wiring remains an explicit integration dependency.

Owned files: `world/decision/backlog-comparison/model.js`, `world/decision/backlog-comparison/view.js`, `test/backlog-comparison.test.js`, this document. Base `1b19358`. Worktree `/Users/wahabma/.codex/worktrees/backlog-comparison/happybearlandia`.

## Delivered interfaces

`pairedHousingScene({results,selectedRun,month})` reads existing full Decision results. Returns availability/reason, exact arm records with provenance, common whole-history supply maximum, vacancy domain 0–100 percent, and selected-minus-baseline supply difference. Only housing.v1 versions 1.0.0/1.1.0/1.2.0 and completed runs are supported. It never simulates or mutates the input. Missing exact months are unavailable, even if an earlier snapshot exists. Trace-summary-only results must first be hydrated through the existing selected-run trace path; otherwise the view displays missing records.

`mountHousingComparison(container,{onMonthChange,onInspect})` returns `{update(context),destroy()}`. Context is `{results,selectedRun,month?}`. One SVG viewBox contains both arms; no independent cameras or render loops. Aggregate stock is a homes bar, vacancy a percent bar, and recorded construction appears in stable project-ID slots. Exact recorded floors determine construction height on a shared physical height scale. Shapes are schematic, not geographic buildings. First 12 lexicographically sorted project IDs are displayed; aggregate metrics still include all projects and the bound is disclosed. Project click/Enter/Space emits `{runId,projectId,month,state}`. Identity remains scoped to that housing run. The UI labels the model as exploratory and explicitly disclaims parcel vacancy and empirical calibration.

## Exact coordinator integration

In `world/decision/advanced-studio.js`:

```js
import { mountHousingComparison } from './backlog-comparison/view.js';
```

Add `<section data-as-housing-comparison></section>` after the median details in `root.innerHTML`. After constructing robustness/intelligence/exploration:

```js
const housingComparison = mountHousingComparison(find('[data-as-housing-comparison]'));
```

At the end of `update(next)` after `renderShortcuts()`:

```js
housingComparison.update({results: currentResults(), selectedRun: currentRun()});
```

In `destroy()` call `housingComparison.destroy()` alongside the existing sibling destruction. This uses stored experiment scenarios, never pending input scenarios. Its own month control synchronizes both halves. To synchronize with another host timeline, pass `onMonthChange` and update with an explicit month; do not map a Population or City clock into it. Optional onInspect must open exact run/project/month evidence rather than a cross-model inspector.

## Ready-to-apply status section

| Historical ticket | Implemented | Verified | Remaining |
| --- | --- | --- | --- |
| 87 Scenario overlays | Paired simultaneous schematic housing scenes, same stored seed/month and fixed viewBox/scales | Actual housing-engine zero/nonzero and reverse data tests; browser bundle | Coordinator wires Advanced Studio, then actual browser acceptance/screenshots |
| 117 Housing supply reflected in buildings | Recorded aggregate stock displayed separately from exact recorded project construction; no illustrative stock-to-context-building inflation | Exact supply and construction state assertions at months 0/120, stable scale on reverse | Normal-entrypoint browser check; geographic building stock unavailable in this model |
| 119 Vacancy represented visually | Exact recorded aggregate vacancy percent bar, common 0–100 scale, missing neutral | Zero versus missing assertions and missing-month test | Normal-entrypoint browser check; parcel vacancy remains unsupported |

Verification: `bun test test/backlog-comparison.test.js test/housing-model.test.js test/housing-fork.test.js test/advanced-studio.test.js`: **39 pass, 0 fail, 2520 assertions**. `bun build world/decision/backlog-comparison/view.js --target browser --external /vendor/three/three.module.js --outfile /tmp/backlog-comparison-view.js`: **pass**, 4 modules. Vendor import is served by the existing app; a bundle without that external flag cannot resolve its absolute browser URL. `git diff --check`: pass. No new dependencies. Tests use generated synthetic housing scenarios to validate mechanics, not empirical calibration.

No screenshots or browser acceptance are claimed: shared normal-entrypoint wiring is deliberately left to the integration owner. Coordinator should run actual stored experiment → selected plan → comparison at month 0/120 → reverse 0, keyboard project inspection, missing trace path, and narrow viewport inspection. This track does not alter Future Machine, global plans/backlogs, server, or original checkout.

## Follow-up browser acceptance — INTEGRATION-READY

New owned harness: `test/backlog-comparison.browser.e2e.js` and `test/backlog-comparison.browser.config.js`. It creates and starts an actual saved housing experiment using the production API with model `housing.v1` version from the installed housing model, seed 0, 10 runs per scenario, 10 years, real baseline/plan-a scenarios, and one approved 310-home model proposal. It reopens the persisted experiment through `/world/decision.html?experiment=...&run=...&readonly=1#futures`. It does not import/mount the view into the page or substitute API/model responses.

The 390px/320px cases require the production mount, successful requests for both exact same-seed run traces, month 0 → actual first completed construction month → reverse 0, exact displayed supply and vacancy, shared SVG fit, keyboard inspection receipts, lifecycle disposal, and no page/console errors. Evidence includes full actual recipe/results/run/seed/month/metrics JSON attachment and PNGs. A separate case aborts the baseline trace request (network failure injection, no fake response) and requires explicit missing stock and snapshot states. Error injection case checks page errors; expected network console errors are not incorrectly counted as application exceptions.

Review found project buttons could silently invoke no callback. The view now always emits bubbling `housing-comparison:inspect` with exact `{runId,projectId,month,state}` and then calls optional `onInspect`. A focused DOM-contract regression verifies Enter prevents default, emits exact recorded provenance, invokes the callback, and destroy removes the view with subsequent updates ignored. Coordinator should consume that event or supply an inspector callback for the final evidence panel.

Actual follow-up checks: focused tests **5 pass, 36 assertions**; previous four-suite run **39 pass/2520 assertions** before adding the new fifth test. Browser view bundle and browser harness syntax bundle both pass. `git diff --check` passes. Browser invocation `bunx playwright test --config test/backlog-comparison.browser.config.js --list` is blocked locally because `@playwright/test` is missing from this fresh worktree. No browser execution or PNGs are claimed. The production Advanced Studio mount is also absent in this baseline, verified by source search. These are concrete integration dependencies; the harness intentionally fails its mount assertion until wired.

Coordinator run command after wiring and dependency availability:

```sh
HBL_COMPARISON_PORT=39983 HBL_COMPARISON_STORE=/tmp/hbl-comparison-store-review bunx playwright test --config test/backlog-comparison.browser.config.js
```

Port, artifact directory (`HBL_COMPARISON_ARTIFACTS`), store, and Chromium executable are overridable. One worker; no separate party server. The isolated temp store retains actual run records for evidence. Ticket status remains 87/117/119 **INTEGRATION-READY**, not DONE: normal entrypoint trace-pair hydration, browser execution, and screenshots require coordinator integration. In particular, the existing studio hydrates only the selected run; coordinator must use its two-trace cache to hydrate the exact matched baseline too, and preserve both through current results merging. Never hydrate an unrelated seed or pretend summary trace omission is an observed zero.

## Actual integrated-source browser investigation (follow-up)

Reused the existing original checkout `node_modules` via an ignored symlink; no packages or engines installed. Config now accepts `HBL_COMPARISON_SOURCE_ROOT`, uses `bun --no-env-file`, and isolates World/City/share/journal persistence as well as Decision persistence in temporary stores. Local server/browser execution required sandbox escalation. Actual source under test: `/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia`; port 40187. No coordinator files were modified.

Actual integrated run: **2 failed, 1 passed**. Both 390px/320px cases reached real saved experiment output and failed at month 42 because the baseline full trace was never hydrated. Expected baseline `1,041,794.48 homes · vacancy 0%`; actual `Missing homes · vacancy Missing%`. Both also exposed that the coordinator had not integrated the inspection-event change in `19d18e0`; Enter receipt was undefined. The missing-state case displayed Missing with no page exception, but this is not accepted as proof of network failure handling: the loader never requested the baseline, so the abort was unused. Harness now explicitly requires an actual aborted baseline request. One 320px trace archive also reported a truncated stream; do not claim that archive is usable.

Exact saved evidence from the later focused reproduction: experiment `decision_b2975487-e978-4a5a-9b6d-5737fe514c33`, model `housing.v1`/`1.2.0`, experiment recipe seed 0, actual paired run seed **110210400**, selected `plan-a_0001`, baseline `baseline_0001`, first recorded completion month **42**, completed project homes **310**. At month 42 actual full API records report baseline supply **1041794.4841261826**, selected supply **1046812.4348985602**, vacancy **0%** in both. Distinguish experiment seed from sampled run seed. Full persisted recipe/results/monthly/project records: `/tmp/hbl-comparison-final-failure/backlog-comparison.browser-c3b20--paired-traces-and-reverses/actual-housing-records.json`. Initial and per-month PNGs live beside that file; prior two-viewport evidence is in `/tmp/hbl-backlog-comparison-proof/`.

Visually inspected actual 320px initial scene PNG: both arms fit but the original side-by-side text is too small. Owned view now stacks schematic arms below 600px while retaining the exact same coordinate and quantitative scales. Unit contract verifies 320px viewBox/transforms and cleanup. This owned fix is not yet browser-verified in coordinator source. Inspection-event fix is already in `19d18e0`.

Minimal shared-file artifact: `docs/backlog-expansion/comparison-hydration.patch` adds one import and four lines in the existing `hydrateVisibleRun` path. Coordinator should first integrate the new owned `hydration.js`, then review/apply the patch against its current studio. `hydrateComparisonBaseline` uses the existing bounded two-trace cache to request only the completed same-seed, same-version baseline after selected trace hydration. It tolerates baseline failure, checks stale selection before/after loading, and lets the existing cache merge retain both exact traces. Generation is rechecked in the shared patch before results merge. It never installs a synthetic baseline. Focused regression covers exact identity, failed load, stale selection, and no request for mismatched seed.

Current combined regression: **41 passed, 0 failed, 2533 assertions** across comparison/housing/fork/advanced studio. Browser view bundle passes. Status remains **INTEGRATION-READY** with demonstrated shared hydration/inspection integration defects, not a missing-dependency blocker. Apply shared patch + owned responsive/event changes, then rerun the browser harness to get actual acceptance and final screenshots.

## Integrated acceptance rerun — 2026-11-11

The coordinator applied the shared baseline hydration and inspection fixes in `/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia`. Real production rerun with isolated port **40291**, Decision store `/tmp/hbl-comparison-accepted-40291`, all other stores freshly isolated by config: **3 passed in 2.7 minutes**. Both **390px and 320px** passed saved experiment → paired trace requests → month **0 → 42 → 0**, exact arm supply/vacancy, 310-home completed project, Enter inspection receipt with exact run/project/month/state, scale fit, disposal, and **zero page/console errors**. Missing-trace case passed an actual aborted baseline request, explicit Missing stock/difference, no stale selected-month snapshot substitution, and zero page exceptions; network failure console messages are expected for that case.

Acceptance experiments: 390px `decision_d707682e-09bf-4eef-81de-4b8ac23c3fd0`; 320px `decision_c890961b-35eb-4aaa-b856-4df55d067d97`; missing baseline `decision_13df558f-4368-4e6d-b5ad-4228c1badd34`. All use model **housing.v1 / 1.2.0**, recipe seed **0**, actual paired seed **110210400**, selected `plan-a_0001`, baseline `baseline_0001`. Completion month 42: baseline **1041794.4841261826 homes**, selected **1046812.4348985602 homes**, selected-minus-baseline **5017.950772377546 homes** (UI 5,017.95), vacancy **0%** both, recorded project completed homes **310**. The stock difference includes scenario policy effects, not only the direct project.

Evidence directory `/tmp/hbl-comparison-accepted-40291-proof/` contains each mobile case's `actual-housing-records.json`, initial PNG, `housing-390-month-42.png` / `housing-320-month-42.png`, reverse-month-0 PNG, and missing case `missing-baseline-trace.png`. Visually inspected both actual mobile completion PNGs: stacked arms, text and bars readable, exact 310-home project visible, common quantitative scales. Missing PNG SHA256 `bb68ef07d61be70b4da1644ad4c50422d709f2d3ef654b9599929a31693928d1`. These are actual production-route captures, not fixtures.

Harness follow-up adds overridable `HBL_COMPARISON_WIDTHS` (default `390,320`), persistent keyboard receipt/month-metric JSON for subsequent runs, persistent missing-request metadata, and 180-second per-case ceiling to accommodate observed local browser contention. No polling correctness assertion is relaxed. Owned regression rerun remains **41 pass / 2533 assertions**, diff check pass.

Tickets 87/117/119 are **DONE for the scoped stored-housing schematic comparison acceptance** after coordinator integration. Geographic city buildings, parcel vacancy, cross-model resident mapping, and empirical calibration remain unsupported and explicitly labeled, not implied by this acceptance. Shared coordinator changes were tested as an uncommitted working tree; this chat commits only its owned harness/evidence changes, with no release or deployment.

Desktop follow-through: **1 passed in 1.5 minutes** at **1440px**, isolated port/store 40293. Actual experiment `decision_27aa5b21-8f1e-42a4-b1fb-a56fc648062a`; same model/version and paired seed. All month **0 → 42 → 0**, keyboard receipts, exact metrics, trace requests, cleanup and zero-console-error assertions passed. Visually inspected actual desktop completion PNG; simultaneous side-by-side scales and completed 310-home project are clear. Evidence: `/tmp/hbl-comparison-desktop-40293-proof/backlog-comparison.browser-d4334--paired-traces-and-reverses/housing-1440-month-42.png`, full `actual-housing-records.json`, and persistent `acceptance-receipts.json` (three exact recorded inspection receipts, arm metrics, successful trace URLs, empty errors list). Combined actual browser acceptance: **4 passed** (three requested cases plus desktop).

SHA256 `housing-1440-month-42.png`: `a1df8f24e427538375e61fe2fc676faca0540af80189c0ea27ec25b8ed648a41`.

SHA256 `acceptance-receipts.json`: `e4d500cd6b055aa37bfd7b89447e71bca11e6f13947870924808ce3df5f9f2e4`.
