# Search track — historical ticket 82

## Slice and ownership

Baseline: committed `1b19358`. Worktree: `/Users/wahabma/.codex/worktrees/backlog-search/happybearlandia`. Own only `world/decision/backlog-search/`, `test/backlog-search.test.js`, and this handoff. Shared entrypoints, global backlog and plan are coordinator-owned. The original checkout was never edited.

Acceptance: search loaded, completed Decision records with bounded deterministic grammar, typed metric units, exact scenario/model/seed/month scope, explanation and explicit unsupported/missing states. Preserve current model authority, data and existing numerical search. No provider, prediction, geographic mapping or new outcome generation. Risk: final outcomes must not be projected backward and a missing monthly observation must not fall back to final values.

## Delivered interfaces

`compileRecordedFutureSearch(query, metricDefinitions, selectedScope={})` returns `{version, description, error?, scope, rules, test(run, scenario), explain(run, scenario)}`. Scope supports scenarioId, modelId, modelVersion, seed and month. Input scope and query conflicts fail closed. `explain` returns match/excluded/missing/unsupported plus exact source identity and per-rule recorded evidence.

Supported examples:

- `find futures where rent below 2k USD/month and vacancy above 5%`
- `scenario baseline and seed 0 and model version 1.2.0 and at month 12 and rent < 2000`
- `at month 12 and event: construction delay`

Bare numbers retain the metric's declared units. Typed suffixes must match exactly, except % converts fraction/probability. `$` is accepted only for USD metrics. Exact metric IDs, existing rent/cost/supply/vacancy aliases, unique partial metric names and existing outcomes are retained. Arbitrary prose now reports unsupported instead of silently searching events. Event queries require `event:`. AND only, at most 12 clauses and 1000 characters; no silent truncation. Month 0 and seed 0 remain valid. No interpolation. Duplicate or missing snapshots are missing. Final outcome searches at a selected month are missing. Undated events cannot establish a month-scoped match.

`searchStoredDecisionResults(record, query, metricDefinitions, selectedScope={})` consumes the normal `{experiment,runs}` store/API shape and returns per-run assessments; it preserves the original run reference and inherits experiment-level model provenance. Rejects more than 8000 runs (the existing maximum of 8 scenarios × 1000 runs), rather than silently sampling/truncating. It performs no fetch or writes. The existing visualization compiler supplies numerical and outcome semantics; keep that exported compiler unchanged.

## Exact coordinator integration

In `world/decision/visualizations.js`, add:

```js
import { compileRecordedFutureSearch } from './backlog-search/index.js';
```

Replace only the two `search=compileFutureSearch(searchQuery,metrics)` calls (search input and update) with `search=compileRecordedFutureSearch(searchQuery,metrics)`. Keep the legacy `compileFutureSearch` export because the new adapter delegates numeric/outcome evaluation to it. The module cycle is function-only (no eager calls to either compiler); alternatively extract the unchanged legacy compiler into a shared helper owned by coordinator. Existing `search.test(run,scenario)` and `search.error`/`description` rendering contracts work unchanged. Change the search-note help to `AND comparisons; event: phrase searches recorded events. Use scenario, seed, model version, or at month to scope stored records.` Avoid the former plain-phrase promise. Set the search input maxlength to 1000 if present. The compiler independently enforces this limit.

For selected UI scope pass `{scenarioId,seed,modelVersion,month}` as the third argument only when those are actual selected filters; do not silently constrain all futures to the currently inspected run. `search.explain(run,scenario)` is the detailed explanation hook. Existing run selection/enter-future URLs stay authoritative. For loaded experiment search call `searchStoredDecisionResults(results, query, model.metrics, scope)`; no server or package change is needed.

## Verification and status

Ticket 82: **implemented adapter; integration pending**. General language/provider interpretation remains deliberately unsupported; deterministic grammar is the useful normal behavior. No paid calls.

`bun test test/backlog-search.test.js test/decision-visualizations.test.js test/future-search.test.js` passes (16 tests; final assertion count recorded in delivery). Includes existing City stored-search API integration, existing visualization search regressions, actual housing simulator output and disk-backed Decision save/load checks, immutability, units, ambiguity, selected conflicts, missing and duplicate snapshots, failed runs, event date boundaries and uint32 seed 0. Synthetic housing/test records validate mechanics, not empirical calibration. Existing City search remains a distinct authority and unchanged.

`git diff --check` passes. No repo lint/type scripts are declared. Browser/screenshots: not run; shared UI is not wired by this owned-path commit. Coordinator must run the actual Decision Studio search input with the new compiler and verify an unsupported phrase, typed query, exact month, selected run, and replay link before marking browser acceptance.

Ready-to-apply global plan/backlog status: **82 Partial → bounded typed stored-record search adapter implemented and focused tests verified; shared Decision visualization integration and browser acceptance pending; unrestricted language interpretation unsupported.** Retain other Existing/New tickets unchanged. No claims made about all 198 tickets or empirical predictive validity.
