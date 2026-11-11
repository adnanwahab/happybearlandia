# Statistics track: tickets 95 and 96

Baseline: committed `1b19358`. Original checkout untouched. Owned scope:
`world/decision/backlog-statistics/`, `test/backlog-statistics.test.js`, this document.

## Implemented slice and acceptance

- 95: dedicated responsive numerical PDP SVG plus accessible exact-value table. Consumes existing `runPartialDependence` output, plots executed means, exposes row counts and P10/P90, escapes labels, breaks lines at missing values. Percentiles describe modeled row spread, never confidence intervals. Existing observed bins remain descriptive.
- 96: bounded complete crossed factorial design (1–3 factors, 2–5 unique numeric levels each, 1–8 matched uint32 seeds, ≤128 evaluations). Only independent equal-weight discrete distributions supported. Reject incomplete budgets instead of silently truncating. Exact finite-product functional ANOVA includes every interaction, operates on seed-averaged responses, and uses population variance denominator N. Constant outcomes have undefined shares rather than fabricated percentages. Retains every cell/seed result, failures and cancellation; suppresses decomposition if any evaluation is missing/failed.
- Housing adapter resolves recorded model versions, requires complete effective inputs and explicit horizon, independently reconstructs selected recorded metric, preserves projects/schedules/forks, and does not mutate the source. Full input manifest, source run/scenario, version, units, years, design version and seeds accompany results.

Model runs here are synthetic illustrative housing model evaluations, not observed data or empirical calibration. Seeds are matched replicates, not a fitted shock distribution. The variance decomposes the selected finite input design, not arbitrary historical ensembles, and does not label policy/conditions/shock causal fractions. Retained schedules/forks remain in provenance; follow-up hardening rejects factors that those operations would overwrite or clamp. Unaffected factors remain supported. No Sobol estimator or unsupported continuous distribution is offered.

## Integrator callsites (shared files intentionally not edited)

In `world/decision/intelligence-view.js`:

```js
import { partialDependenceChart, factorialReport } from './backlog-statistics/view.js';
import { runHousingFactorial } from './backlog-statistics/housing.js';
```

In `render()` dependence section, replace the existing `partial.points` table interpolation with:

```js
partialDependenceChart(partial, {
  parameterLabel: model().parameters.find(p => p.id === parameterId)?.label,
  metricLabel: model().metrics.find(m => m.id === metricId)?.label,
  inputUnit: model().parameters.find(p => p.id === parameterId)?.unit,
  outputUnit: model().metrics.find(m => m.id === metricId)?.unit,
})
```

Keep existing method/run IDs/execution count. Chart result must be cleared by the same source/metric/parameter invalidation currently applied to `partial`; no stale chart attribution.

Add explicitly selected two-level factor inputs and an execute action (no automatic reruns). Register `factorial = null` beside `partial`, invalidate and cancel it on source/selection/metric changes, and reuse the existing busy/generation/AbortController discipline. For the selected recorded successful run:

```js
const result = await runHousingFactorial({
  run: selected(),
  scenario: source.scenarios.find(s => s.id === selected().scenarioId),
  years: source.years, metricId,
  factors: selectedFactors, // [{id, levels:[low,high]}], explicit user levels
  seeds: selectedSeeds, // selected run.seed initially; show exact seeds
  budget: 128, signal: controller.signal,
  onProgress: progress => { /* existing generation-guarded status */ },
});
if (token === generation) factorial = result;
```

Replace unavailable variance paragraph with `factorialReport(factorial)`. Retain the unavailable message until an actual complete design is returned. Display the declared levels, equal weights, fixed inputs and seeds from `result.design`/`result.provenance` beside the report (or in an inspectable manifest). Do not infer levels from an arbitrary ensemble without explicit declaration. No new API/server/dependency required. Source scenario identity is preserved; no World entity/time mapping claimed.

## Verification

`bun test test/backlog-statistics.test.js test/housing-fork.test.js test/decision-intelligence.test.js`: 29 pass, 0 fail, 322 assertions (before final scheduled-stress refinement; final rerun recorded below).

Analytical reference functions recover exact variances 4/9/16 for `2x+3y+4xy` under independent ±1 levels, a pure three-way interaction, and constant outcomes. Tests cover seed matching, deterministic replay, budgets/distributions, missing values, cancellation, real housing direct-run equality at uint32 boundaries, immutability, mismatch refusal, approved projects, retained 1.1/1.2 versions and fork handling. SVG output checks accessibility, escaping and missing-value gaps.

Browser screenshots: none; shared production entrypoint is coordinator-owned and not yet wired. String/adapter tests are not browser acceptance. Integrated Studio run, real plotted output screenshot, factor controls and cancellation/missing UI acceptance remain coordinator prerequisites.

## Ready-to-apply global status

| Ticket | Implementation | Verification | Remaining acceptance |
| --- | --- | --- | --- |
| 95 | Dedicated numerical PDP SVG/table delivered | Chart contract and existing actual PDP regressions pass | Coordinator wires chart in normal Intelligence entrypoint and verifies actual browser result |
| 96 | Complete bounded equal-weight factorial ANOVA and real versioned Housing adapter delivered | Analytical references + direct real Housing comparisons pass | Coordinator wires declared-factor execution/report and verifies integrated browser controls; do not mark fully verified before that |

No changes to global plan/backlogs, shared hooks or other namespaces. No deployment, production writes, external calls, PRs or pushes.

Final verification after adding the actual scheduled budget-cut case: 29 tests passed, 0 failed, 322 assertions across 3 files. `git diff --check` passed. Coordinator can cherry-pick the statistics commit from this managed worktree; no shared-file changes are included.

## Follow-up: numerical hardening and production browser acceptance

Result: **INTEGRATION-READY**. This follow-up adds working code and new regression/acceptance tests; normal route acceptance is still pending the coordinator mount.

Changes:

- Compensated, offset-centered summation and direct orthogonal cell effects replace subtraction of nearly equal closed variances. Analytical `1e12 + 2x + 3y + 0.125xy` retains the small interaction variance exactly.
- `reconstruction` records component total, residual, and tolerance: `max(1e-12, 1e-10 * totalVariance)`. Nonfinite arithmetic/overflow or failure to reconstruct suppresses decomposition with `numerical-failure`. This is a numerical tolerance, not statistical uncertainty. Unequal factor level counts retain proper equal-product weights.
- A final cancellation check prevents an abort on the last progress callback from publishing completed results. Missing and failed cells continue to suppress decomposition. Zero variance keeps shares undefined.
- Source and design seeds must be uint32. Retained scheduled stress and fork stress are checked using the recorded version's actual `applyStressPresets`; affected levels are rejected if clamped. Fork `set_parameter` on a varied factor is rejected (including normalized scenario/parameters targets). Unaffected factors still run with retained projects, schedules and fork semantics.
- Housing provenance discloses `reconstructionExecutions: 2` for the source helper's validation reruns, in addition to at most 128 crossed-design executions; validation executions are not design cells.
- Reports now include an inspectable exact design/input/provenance/reconstruction manifest, raw displayed variance values and stable data attributes. No additional shared-file work is needed for those report attributes.

### Smallest production mount contract

Keep the earlier `partialDependenceChart(...)`/`runHousingFactorial(...)` callsites. For an initial single explicitly selected factor, expose these ordinary UI controls (or map equivalent selectors through `HBL_STATISTICS_SELECTORS`):

| Element | Selector | Behavior |
| --- | --- | --- |
| Factor select | `[data-statistics-factor]` | Registered Housing parameter ID |
| Low/high numeric inputs | `[data-statistics-low]`, `[data-statistics-high]` | Explicit finite levels in native units |
| Seed text input | `[data-statistics-seeds]` | Comma-separated uint32 values, validated without coercing empty tokens to zero |
| Execute button | `[data-di-action="factorial"]` | Execute after explicit click; use existing busy/cancellation/generation guards |

Use the helpers' returned HTML; it provides `[data-statistics-pdp]`, `[data-statistics-report]`, `[data-statistics-total]`, `[data-statistics-variance]` and `[data-statistics-manifest]`. Do not synthesize a successful result on exceptions. Show the override/budget/mismatch error from the adapter.

### New browser files and exact command

Owned new files: `test/backlog-statistics.browser.config.js` and `test/backlog-statistics.browser.e2e.js`. Config reads `HBL_STATISTICS_SOURCE_ROOT` to run the actual coordinator source with its actual `server.js`, isolated temporary Decision store, one Chromium worker and overridable port 3196. It refuses source with no production helper wiring. It never edits coordinator source, stubs a model API, injects a mount, or substitutes synthetic route HTML.

From this statistics checkout, once Playwright is installed using the existing package dependency and the coordinator mount is ready:

```sh
HBL_STATISTICS_SOURCE_ROOT=/absolute/coordinator/checkout \
HBL_STATISTICS_PORT=3196 \
bunx --no-install playwright test --config test/backlog-statistics.browser.config.js
```

The journey creates a real experiment via Try Example, reloads its persisted experiment URL, opens normal Intelligence, executes numerical PDP, selects construction capacity 50000/90000 and seeds 0/4294967295, executes the finite design, reads the exact manifest and compares displayed total/component variance against independent version-resolved direct Housing simulations. It attaches actual JSON provenance and a production-page screenshot to the Playwright output. No screenshot exists until this journey passes.

Follow-up checks actually run:

- `bun test test/backlog-statistics.test.js test/housing-fork.test.js test/decision-intelligence.test.js`: **33 passed, 0 failed, 344 assertions**.
- `bun build test/backlog-statistics.browser.config.js test/backlog-statistics.browser.e2e.js --external '@playwright/test' --external '/world/*' --target bun --outdir /tmp/hbl-statistics-browser-parse`: both browser files bundled successfully (syntax/dependency-boundary check only).
- `git diff --check`: passed.
- Mount readiness inspection: this checkout's production `intelligence-view.js` contains neither helper mount (`productionPDPChartMounted=false`, `productionFactorialMounted=false`). Local `@playwright/test` is also not installed. Browser run/screenshot therefore unverified; no route acceptance claimed. Coordinator wiring is the remaining ticket dependency, not an external model/provider blocker.

The original checkout remains untouched. Only assigned modules, uniquely named tests/config and this handoff change.

## Mounted-route follow-up: actual saved runs and arithmetic drift

The coordinator's real `intelligence-view.js` is now mounted. The browser harness was adapted to the observed production JSON textarea `[data-factorial-input]` and selected-recorded-seed behavior; no alternative UI is injected. The previous proposed select/low/high/seed editor contract is superseded by this actual JSON editor. All writable server stores now use isolated temporary paths (`--no-env-file`), including World, City, shares, journals and Decision. The read-only original dependency directory is linked locally and is not committed. One worker uses software graphics, 40 genuine saved Housing runs, and bounded viewport screenshots.

### Observed production results and discovered blocker

- **Ticket 96 numeric report verified**: actual saved experiment URL reopened, declared two-factor design executed, four evaluations and all three displayed components/total matched an independent direct version-resolved Housing calculation. Source run ID, recorded seed, version and years matched persisted provenance. Saved API results remained unchanged. Actual screenshot inspected: `/tmp/hbl-statistics-production-final/backlog-statistics.browser-71d73-actor-report-and-provenance/statistics-production.png`.
- Actual report example: total `25.553054255585213`, construction capacity `23.13939766309407`, permitting months `2.403654550547828`, interaction `0.010002041943316442`. These are synthetic model/design results in percent squared, not observations or empirical certainty.
- **Ticket 95 saved-run PDP exposed a genuine blocker**. The eighth stored Plan A run differs by floating arithmetic between the server and Chromium: rent `1918.5765656519845` vs `1918.5765656519843` (−2.2737367544323206e−13), employment proxy `1216568.0848527807` vs `1216568.0848527804` (−2.3283064365386963e−10), displacement −3.55e−15 and vacancy +1.60e−14. Existing strict equality refuses the entire chart. The successful four-cell factorial check alone did not cover this failure.
- Cross-engine evidence is retained in `/tmp/statistics-cross-engine-audit.json` and `/tmp/hbl-statistics-reconstruction-audit/.../trace.zip`. This is a floating arithmetic observation, not missing sampled inputs or a material model mismatch. Both Bun source reruns reproduce exactly; Chromium identifies the tiny differences.
- Browser incomplete-evaluation contract passed using four actual Housing simulations at seeds 0/4294967295 followed by one explicitly injected missing observation. It retains the three finite outputs, reports one failure and suppresses all variance fractions. This is controlled missing-observation mechanics, not a claim that production Housing itself failed.

### Owned fix ready to integrate

New `world/decision/backlog-statistics/reconstruction.js` exports:

- `auditRecordedMetrics(recorded,reconstructed)` with fixed tolerance `max(1e-8, 64 * Number.EPSILON * max(abs(stored),abs(rerun)))`. This tolerance addresses floating arithmetic only. Every metric's original value, rerun value, signed delta, threshold and acceptance decision is retained. Material/missing metrics still block; inputs and stored outcomes remain unchanged.
- `runHousingDiagnosticCounterfactual(options)` retains the original versioned simulator output and replaces only the reconstruction acceptance audit, with consistent warnings.
- `runHousingPartialDependence({runs,scenarios,years,parameterId,metricId,values,signal,onProgress})` runs the existing actual numerical PDP loop through that adapter and attaches all source arithmetic audits. The chart now renders an inspectable audit manifest when supplied. Housing factorial also uses this audit and includes it in provenance.

Smallest shared change: in `intelligence-view.js`, import:

```js
import {runHousingPartialDependence} from './backlog-statistics/reconstruction.js';
```

Replace ONLY the PDP `await runPartialDependence({...rerun...})` expression with:

```js
const result = await runHousingPartialDependence({
  runs: rows, scenarios: source.scenarios, years: source.years,
  parameterId, metricId, values, signal: controller.signal,
  onProgress: progress => {
    if (token === generation) {
      const status = body.querySelector('.di-status');
      if (status) status.textContent = `Numerical partial dependence: ${progress.completed}/${progress.total} actual interventions.`;
    }
  },
});
```

Do not retain the old strict-equality `rerun` callback around this helper: it would throw before the audit can inspect the values. Keep generation/cancellation handling and `partial = result` unchanged. No model, server, package or data-contract change is required. The `partialDependenceChart` call already mounted will expose the audit automatically after this owned chart module is integrated.

Observed UI polish limitation: the hardcoded JSON textarea resets to its default after render, even while the completed report correctly describes the executed two-factor design. Coordinator can preserve the draft factor JSON in existing view state. Provenance remains authoritative; the harness verifies it against actual displayed numbers.

### Final mounted-route verification evidence

Final focused browser command (actual Node executable avoids Bun worker-runner differences):

```sh
HBL_STATISTICS_SOURCE_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia \
HBL_STATISTICS_PORT=43996 \
HBL_STATISTICS_OUTPUT=/tmp/hbl-statistics-production-verified \
'/Users/wahabma/Library/Application Support/Zed/node/node-v24.22.1-darwin-arm64/bin/node' \
node_modules/playwright/cli.js test --config test/backlog-statistics.browser.config.js \
--grep 'exact two-factor|selection cancellation|module incomplete'
```

**3 passed in 34.6s**, one worker, zero observed page errors in production value/cancellation journeys. Config captured integration source revision `794f23bd48ab3ea9c3c4a61a13760756c4e5030f`. The coordinator checkout is actively advancing other tracks; no modifications were made there by this statistics track.

Exact actual artifacts:

- `/tmp/hbl-statistics-production-verified/backlog-statistics.browser-71d73-actor-report-and-provenance/statistics-production.png` (inspected real report screenshot).
- `/tmp/hbl-statistics-production-verified/backlog-statistics.browser-71d73-actor-report-and-provenance/statistics-production-provenance.json` (source revision, executed design, original inputs, direct numerical reference, exact displayed components).
- `/tmp/hbl-statistics-production-verified/backlog-statistics.browser-71d73-actor-report-and-provenance/cross-engine-reconstruction-audit.json` (eight actual recorded source rows, including the eighth row's arithmetic differences).
- `/tmp/hbl-statistics-production-verified/backlog-statistics.browser-467a8-publish-stale-decomposition/statistics-cancelled.png` (inspected: selected financing input, no stale completed report after cancelling a live 125-cell design).
- Saved-run PDP test deliberately remains in the full four-case suite. It actually failed against the currently mounted strict comparison. Trace: `/tmp/hbl-statistics-production-final/backlog-statistics.browser-c0c8c--actual-numerical-PDP-chart/trace.zip`. Do not describe the filtered three-test pass as a complete four-test pass. After wiring the audited helper, rerun the same command without `--grep`; that test independently checks displayed PDP means against actual version-resolved model reruns and writes its screenshot/value JSON only if it succeeds.

The first cancellation attempt read the detached pre-render section and falsely observed an enabled button. Harness corrected to read live post-render DOM and dispatch the real selection change in the same task; final cancellation acceptance passed. One earlier full-page screenshot timed out under shared browser load; final bounded viewport screenshots passed with software graphics. No 3D/rendering claim is inferred from these numerical UI checks.

Final candidate unit/regression command: `bun test test/backlog-statistics.test.js test/housing-fork.test.js test/decision-intelligence.test.js`: **35 passed, 0 failed, 356 assertions**. New arithmetic-audit tests accept and disclose tiny drift, reject material/missing metrics, retain exact source values and exercise real numerical PDP with the audited adapter. Browser-source bundling, browser harness bundling and `git diff --check` pass.

Ready-to-apply status now:

| Ticket | Evidence-backed status | Next action |
| --- | --- | --- |
| 95 | INTEGRATION-READY: chart is mounted, actual saved-run browser test exposed cross-engine exact-comparison blocker; owned audited fix and regression tests delivered | Integrate `reconstruction.js` plus chart audit output, replace shared PDP call with `runHousingPartialDependence`, rerun unfiltered four-test suite. Keep ticket open until it passes. |
| 96 | Production numeric report/provenance, unchanged saved records, invalid-design handling and real selection cancellation verified; incomplete-result suppression verified as explicit browser module fault injection | Integrate latest owned numerical/audit hardening as applicable. Model failure injection is not an observed production incident. JSON draft-preservation polish remains coordinator-owned. |

Only owned namespaces, unique tests/config and this handoff are committed. No release, deployment, paid provider, production data, external messages, or original-checkout edits.

## Final closure verification: full mounted suite passes

**DONE for tickets 95/96's assigned numerical behavior.** This section supersedes the earlier open PDP blocker and draft-reset limitation: the coordinator has integrated the audited PDP helper and persistent next-design draft.

The complete **unfiltered** production browser command passed:

```sh
HBL_STATISTICS_SOURCE_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia \
HBL_STATISTICS_PORT=43996 \
HBL_STATISTICS_OUTPUT=/tmp/hbl-statistics-full-audited \
'/Users/wahabma/Library/Application Support/Zed/node/node-v24.22.1-darwin-arm64/bin/node' \
node_modules/playwright/cli.js test --config test/backlog-statistics.browser.config.js
```

**4 passed, 0 failed, 29.8 seconds**, one Chromium worker. Source revision captured by the config: `d489ee23f0c17042dfeecd473d180b9a9c67a82a`. No tests excluded and no model/UI substitutes injected.

Acceptance actually verified:

1. Saved experiment reopened through its normal production URL. Four executed two-factor cells, all three variance components and total independently match direct retained Housing model calculations. Source seed/version/horizon and source run match the manifest; persisted results stay unchanged. Original declared-factor JSON survives execution/render. Editing a different next draft and triggering a normal explanation-form render preserves that next draft while the completed report/manifest retain the original executed factors and exact values.
2. Invalid JSON remains editable after validation/render; an unsupported four-factor design is refused. A live 125-cell design is cancelled through the actual input selection change and cannot publish a stale completed report afterward.
3. Four real Housing model runs at seeds 0/4294967295 followed by explicitly injected missing observation retain the finite evidence and suppress decomposition. This remains controlled module mechanics, not a claim of a production model outage.
4. The saved-run PDP renders five numerical points with eight matched source rows each. Every displayed count/mean matches an independent direct numerical rerun. Eight source arithmetic audits are present, all source metrics pass the declared arithmetic tolerance, and the actual nonzero differences from the previously blocked row are retained. No observed page errors in value/cancellation/PDP journeys.

Actual verified artifacts (report and PDP screenshots inspected):

- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-71d73-actor-report-and-provenance/statistics-production.png`
- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-71d73-actor-report-and-provenance/statistics-production-provenance.json`
- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-71d73-actor-report-and-provenance/cross-engine-reconstruction-audit.json`
- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-467a8-publish-stale-decomposition/statistics-cancelled.png`
- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-c0c8c--actual-numerical-PDP-chart/statistics-pdp.png`
- `/tmp/hbl-statistics-full-audited/backlog-statistics.browser-c0c8c--actual-numerical-PDP-chart/statistics-pdp-values.json` (five displayed points, direct reference means, full eight-source audit and exact source revision).

For the inspected synthetic example, mean affordability at the first/last declared construction-capacity values is `68.14525119853266` / `75.14069093391215` percent. These are conditional illustrative Housing model outputs, not empirical policy effects, forecasts, or confidence intervals.

This follow-up modifies only the unique browser test and this handoff. Browser-test bundling and `git diff --check` pass; prior unchanged production adapters have 35 passing unit/regression tests (356 assertions). No extra shared-file integration change is requested for this follow-up. Coordinator owns final global backlog/plan status and any release decisions.
