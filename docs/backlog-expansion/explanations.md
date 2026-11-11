# Explanations track — integration handoff

Baseline: `1b19358`. Worktree: `/Users/wahabma/.codex/worktrees/backlog-explanations/happybearlandia`.
Only owned paths changed: `world/decision/backlog-explanations/`, `test/backlog-explanations*`, this document. Original checkout and global plans/backlogs untouched.

## Next integrated slice and acceptance

Prerequisite: coordinator mounts the companion in Advanced Studio and forwards the existing immutable context. Accept when the ordinary Decision Studio selected stored future drives clustering, metric query, event playback and source-event jump; repeat with no selected run/missing metric/version mismatch. The component uses the same Housing authority and monthly clock, with no cross-model mapping or new simulator.

Implemented adapters are tested. Shared production mount is pending; none of these tickets is claimed end-to-end closed yet.

| Ticket | Delivered and evidence | Remaining gate / ready-to-apply status |
| --- | --- | --- |
| 89 Failure clustering | Independent deterministic farthest-first k-means, disjoint memberships on evaluated failures, effective-input min/max scaling, constant dimension removal, complete-case exclusion IDs, centroids in native units, iteration/error audit, scenario/version separation; order-invariance and two-cloud synthetic mechanics test | Implemented adapter; mount and test stored production experiment. Synthetic cloud proves mechanics, not empirical calibration or cluster validity. |
| 107 Ripple visualization | User-controlled dated recorded-event playback, range selection, source index callback, SVG registered dependency associations, unchanged registry IDs/equations, cutoff and version checks, omitted undated count | Implemented component; mount and verify source jump. No invented event-to-event causal chain or simulated propagation timing. |
| 108 WHY query | Bounded natural-language intent + registered metric-name resolver; actual selected checkpoint value, metric-specific drivers at final horizon, version-matched rule expressions/source paths, exact dated event indices; ambiguity and missing data states | Implemented adapter; production UI mount pending. Unsupported vocabulary requests a named metric; no general freeform AI narrative. |
| 109 What-changed query | Named metric comparison using actual completed equal-seed/equal-version/equal-horizon futures and exact selected checkpoint; native units, reference identity, deltas; missing/unequal input rejection | Implemented adapter; production comparison interaction pending. Difference is explicitly distinct from causal attribution. |

## Exact shared integration

Owner: integration coordinator only. `world/decision/advanced-studio.js` currently imports/mounts `mountIntelligence` at line 92, updates at 116, destroys at 126. Add:

```js
import { mountBacklogExplanations } from './backlog-explanations/view.js';
// Immediately after existing intelligence mount; reuses that pane.
const explanations = mountBacklogExplanations(find('[data-as-pane="intelligence"]'), {
  onSelectRun: run => onSelectRun?.(run),
  onEvent: ({ run, month }) => onEnterFuture?.(run, { month }),
});
// In update(next), after intelligence.update(next):
explanations.update(next);
// In destroy():
explanations.destroy();
```

The existing Studio `enterFuture(run, {month = constructionMonth} = {})` at studio.js line 517 already validates the stored run, loads its trace, sets the exact month, synchronizes the scene and updates continuity. Forward the options object unchanged; do not pass month as a positional number. This provides the source-event jump without a new route or checkpoint.

Context `update({results:{experiment,runs,model}, input?, selectedRun?, referenceRun?, month?, nodeId?, registry?, clusterFeatures?})`. Uses baseline of matching seed/version by default; optional explicit reference overrides. Three registered effective inputs default to construction capacity, permitting months, interest rate. `clusterFailures` is pure; 1–12 registered features, 1–6 clusters, at most 10000 input rows, 50 iterations. Results remain immutable. No provider/network calls, edits, randomness, analytics or spending.

## Actual verification

- `bun test test/backlog-explanations.test.js test/decision-intelligence.test.js test/decision-exploration.test.js`: **23 passed, 0 failed, 174 assertions**.
- Browser command (reuses existing dependencies read-only): `HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test/backlog-explanations-browser.mjs`: **passed**, actual current Housing simulator results with explicit synthetic failure threshold; Chromium 390px; query, source callback, recorded playback, selection reset, disposal, no horizontal overflow and zero page errors. Port default 39931, overridable with `HBL_EXPLANATIONS_PORT`.
- Screenshot `/tmp/hbl-backlog-explanations-mobile.png`: inspected after correcting observed preformatted equation overflow. This is isolated component evidence, **not production route acceptance**. No screenshot committed.
- No repository lint/typecheck scripts exist in package.json. Existing JavaScript imports executed by tests/browser. `git diff --check` passed.

## Limitations and risks

Clustering uses user-selected features and k; no inferred ideal k, holdout quality, population probabilities or statistical significance. Empty/constant feature variation can yield one cluster; missing inputs exclude a record rather than assign zeros. Groupings describe associations. Event type-to-rule links are the existing registry's broad associations (annual-accounting can link many rules); they cannot establish which event caused another event. Playback displays these limits and retains original event indices. Queries have bounded deterministic vocabulary and metric matching, not unrestricted language reasoning. Same-seed comparison does not independently establish source checkpoint or scenario treatment equivalence; this adapter claims only stored numerical comparison. Production route browser acceptance and final global backlog status belong to coordinator.
