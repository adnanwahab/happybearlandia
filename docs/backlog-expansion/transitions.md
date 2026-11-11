# Stored future view transitions — integration handoff

Baseline: `1b19358`. Isolated worktree: `/Users/wahabma/.codex/worktrees/backlog-transitions/happybearlandia`.
Owned files: `world/decision/backlog-transitions/index.js`, `test/backlog-transitions.test.js`, this document. No shared entrypoint, Future Machine stage, global backlog or global plan changed.

## Slice and acceptance

Implement bidirectional viewport camera motion around Decision Studio's existing stored-run selection. Prerequisites: the existing `enterFuture` selection/trace load must finish; the host must provide its exact current identity/month/comparison metadata. Acceptance: bounded eased scroll and screen-space reveal in both directions, frozen selection receipts, seed 0 and uint32 maximum retained, stale frame isolation, manual controls, reduced motion, detach and no model mutation. Risk: there is no shared camera pose between the SVG outcome plot and construction renderer. This adapter intentionally supplies a screen-space flight, not invented geography or a continuous 3D camera fly-through.

## Actual implementation and evidence

`attachFutureTransitions({multiverse, city, getSelection, duration=850, environment=window})` returns `{flyTo(view,{source}), cancel(reason), detach(), running}`. `view` is `city` or `multiverse`. `flyTo` returns a promise resolving `{status,reason,view,selection,version}`. Selection must contain nonempty `experimentId`, `runId`, `scenarioId`, `modelVersion`, exact uint32 `seed`, nonnegative finite `month`; optional `comparison` carries host-owned synchronized state. It is copied and frozen; never infer or supply a baseline pair that was not selected. Every frame verifies these fields against `getSelection()`. Selection reads must be pure and bounded (metadata only, not run histories).

New flights supersede old ones; wheel, pointer/touch, navigation keys (including Tab/Escape) and resize cancel without preventing defaults or stealing focus. A dynamic reduced-motion preference immediately finishes valid motion; an initially reduced preference produces no animation. Removal of a destination cancels. Detach removes all listeners, animation effects and RAF handles; stale queued frames cannot scroll. Existing inline visual styles are restored by cancelling the temporary Web Animations effect. Scroll remains available if that effect is unsupported. Both existing native model/camera controllers remain untouched.

Verification command: `bun test test/backlog-transitions.test.js test/decision-visualizations.test.js test/decision-exploration.test.js` — **32 pass, 0 fail, 148 assertions**. Includes 15 new deterministic transition tests; existing visualization paired-seed/URL and fork/optimization tests retained. `git diff --check` passed. No lint/typecheck scripts exist in package.json. Synthetic selection fixtures prove mechanics only; they are not empirical calibration or real saved-run browser acceptance.

## Exact shared-file integration

Coordinator owns `world/decision/studio.js` and `visualizations.js`.

1. Import and attach after state/view initialization:

```js
import { attachFutureTransitions } from './backlog-transitions/index.js';
const futureTransitions = attachFutureTransitions({
  multiverse: $('#futures'), city: $('#physical-world'),
  getSelection() {
    const run = state.selectedRun || constructionRun;
    return {
      experimentId: state.results?.experiment?.id,
      runId: run?.id, scenarioId: run?.scenarioId,
      modelVersion: run?.modelVersion, seed: run?.seed,
      month: constructionMonth,
      // Include host-owned comparison selection when exposed; never invent a pair.
      comparison: readCurrentComparisonSelection(),
    };
  },
});
```

`readCurrentComparisonSelection()` is the one host integration dependency: expose a pure metadata reader from the existing visualizations closure (its current projection/filter/metric/rotation/paired selection), or provide the actual existing comparison state from the host. It is not an existing function in this baseline. Keep that state in its current owner; this adapter reads it and never reconstructs it. If no comparison is active pass `null` explicitly. Do not claim complete comparison-state guarding until the real state is passed.

2. In `enterFuture`, call `futureTransitions.cancel('selection-loading')` before asynchronous reopen/select. Preserve existing run validation, stale selection token, sync, URL, banner and `updateAdvancedStudio()`. Replace **only** the final `$('#physical-world').scrollIntoView(...)` with:

```js
const source = [...document.querySelectorAll('#futures [data-run-id]')]
  .find(node => node.dataset.runId === run.id);
void futureTransitions.flyTo('city', { source });
```

Call after `updateAdvancedStudio()` if that changes layout. Existing `selectRun` sets `constructionMonth=0`; keep the existing subsequent explicit selected month assignment. Animation must never call `selectRun`, rerun, advance, or reset comparison state.

3. In the existing `#return-multiverse` click handler, preserve stop/banner/URL changes. Replace its final smooth scroll with `void futureTransitions.flyTo('multiverse')`. Do not clear the selected run/month. Stop playback using the existing handler so time does not advance during motion. Return is also permitted after a completed flight; no separate animation state needs resetting.

4. Cancel at existing experiment reset/reload and playback/scrub entrypoints, and call `futureTransitions.detach()` on page teardown (e.g. the existing teardown owner). Pointer/keyboard paths already cancel automatically, but explicit model-update entrypoints should cancel synchronously too. Existing native cameras must retain control; do not disable OrbitControls or simulation widgets for this flight.

5. Coordinator browser gate: use a genuinely saved experiment through `/world/decision.html`; choose a nonzero month and seed 0, enter and return, compare exact URL/run/seed/month/metrics and all comparison controls before/after. Supersede an in-flight entry, change selection/time, scrub or wheel, toggle reduced motion, then tear down. Capture desktop/mobile screenshots and console errors. No browser screenshots delivered here: shared-file wiring is deliberately outside ownership and the isolated checkout has no installed Playwright package. Do not treat deterministic tests as mounted browser proof.

## Ready-to-apply global status

| Ticket | Delivered / verified | Remaining status |
| --- | --- | --- |
| 111 | Bidirectional viewport-flight adapter: entry direction, exact stored metadata, stale/manual cancellation deterministically tested. Existing entry URL/paired math regressions pass. | Partial pending shared entrypoint wiring and actual saved-run browser evidence. Continuous geographic 3D flight unsupported by current interfaces. |
| 112 | Return direction retains frozen run/seed/month/comparison, restores ordinary manual control; deterministic round trip and disposal tests pass. | Partial pending replacing existing return smooth scroll and browser comparison-state check. |
| 184 | Eased viewport motion, bounded zoom/reveal, reduced motion including live preference changes, supersession and listener/effect cleanup implemented and tested. | Partial pending mounted browser proof; not a cinematic multiverse 3D fly-through claim. |

No deployment, release merge, push, production writes, outbound messages, or paid provider calls performed. Next action: cherry-pick owned commit, wire the described callsites and pure comparison reader, then run the saved-run browser gate. No simulation rules, entity mappings, seeds or stored outcomes changed.
