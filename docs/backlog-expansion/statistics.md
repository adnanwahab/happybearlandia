# Statistics track: tickets 95 and 96

Baseline: committed `1b19358`. Original checkout untouched. Owned scope:
`world/decision/backlog-statistics/`, `test/backlog-statistics.test.js`, this document.

## Implemented slice and acceptance

- 95: dedicated responsive numerical PDP SVG plus accessible exact-value table. Consumes existing `runPartialDependence` output, plots executed means, exposes row counts and P10/P90, escapes labels, breaks lines at missing values. Percentiles describe modeled row spread, never confidence intervals. Existing observed bins remain descriptive.
- 96: bounded complete crossed factorial design (1–3 factors, 2–5 unique numeric levels each, 1–8 matched uint32 seeds, ≤128 evaluations). Only independent equal-weight discrete distributions supported. Reject incomplete budgets instead of silently truncating. Exact finite-product functional ANOVA includes every interaction, operates on seed-averaged responses, and uses population variance denominator N. Constant outcomes have undefined shares rather than fabricated percentages. Retains every cell/seed result, failures and cancellation; suppresses decomposition if any evaluation is missing/failed.
- Housing adapter resolves recorded model versions, requires complete effective inputs and explicit horizon, independently reconstructs selected recorded metric, preserves projects/schedules/forks, and does not mutate the source. Full input manifest, source run/scenario, version, units, years, design version and seeds accompany results.

Model runs here are synthetic illustrative housing model evaluations, not observed data or empirical calibration. Seeds are matched replicates, not a fitted shock distribution. The variance decomposes the selected finite input design, not arbitrary historical ensembles, and does not label policy/conditions/shock causal fractions. Fixed schedules/forks can override a varied input later in a run; their retained semantics remain in provenance. No Sobol estimator or unsupported continuous distribution is offered.

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
