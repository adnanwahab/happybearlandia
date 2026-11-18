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

Context `update({results:{experiment,runs,model}, input?, selectedRun?, referenceRun?, month?, nodeId?, registry?, clusterFeatures?})`. Uses baseline of matching seed/version by default; optional explicit reference overrides. Three registered effective inputs default to construction capacity, permitting months, interest rate. `clusterFailures` is pure; 1–12 registered features, 1–6 clusters, at most 10000 input rows, 50 iterations. Results remain immutable. No provider calls, edits, randomness, analytics or spending. Comparing a compact reference row reads its full trace via the existing same-origin Decision client GET endpoint; optional `loadRunTrace(row)` can reuse the host trace cache. Returned identity/version/seed are checked and responses after update/destroy are discarded.

## Actual verification

- `bun test test/backlog-explanations.test.js test/decision-intelligence.test.js test/decision-exploration.test.js`: **23 passed, 0 failed, 174 assertions**.
- Browser command (reuses existing dependencies read-only): `HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test/backlog-explanations-browser.mjs`: **passed**, actual current Housing simulator results with explicit synthetic failure threshold; Chromium 390px; query, source callback, recorded playback, selection reset, disposal, no horizontal overflow and zero page errors. Port default 39931, overridable with `HBL_EXPLANATIONS_PORT`.
- Screenshot `/tmp/hbl-backlog-explanations-mobile.png`: inspected after correcting observed preformatted equation overflow. This is isolated component evidence, **not production route acceptance**. No screenshot committed.
- No repository lint/typecheck scripts exist in package.json. Existing JavaScript imports executed by tests/browser. `git diff --check` passed.

## Limitations and risks

Clustering uses user-selected features and k; no inferred ideal k, holdout quality, population probabilities or statistical significance. Empty/constant feature variation can yield one cluster; missing inputs exclude a record rather than assign zeros. Groupings describe associations. Event type-to-rule links are the existing registry's broad associations (annual-accounting can link many rules); they cannot establish which event caused another event. Playback displays these limits and retains original event indices. Queries have bounded deterministic vocabulary and metric matching, not unrestricted language reasoning. Same-seed comparison does not independently establish source checkpoint or scenario treatment equivalence; this adapter claims only stored numerical comparison. Production route browser acceptance and final global backlog status belong to coordinator.


## Follow-up hardening — INTEGRATION-READY

Observed fixes in the owned follow-up:

- Group iteration order is now deterministic across multiple scenario/version/experiment/engine groups; no locale-dependent ID sorting. Tests reverse mixed-group input order and compare complete outputs.
- `maxIterations` is validated in 1–50, with `iterationLimit` and `converged` audit fields. The UI labels nonconvergent bounded output provisional. A deliberately shifting synthetic cloud hits the one-iteration bound; the ordinary bound converges. Constant/all-missing inputs remain covered.
- Comparison now requires known equal experiment ID and engine version, matching model version, seed and recorded horizon. Unknown or unequal authority, invalid/duplicate clocks, missing exact checkpoints are unavailable. This intentionally declines cross-experiment comparisons because no starting-state equivalence contract is provided.
- Selected-month WHY explicitly omits final drivers, future event records and duplicate checkpoints. Sentinel driver/future-event tests prove no leak.
- Compact reference traces hydrate on query through existing `createDecisionClient().run(experimentId,runId)`. Async identity mismatch errors surface, and update/destroy invalidates pending answers. Browser test covers a successful summary hydration and delayed stale response after context update.

### Actual follow-up evidence

`bun test test/backlog-explanations.test.js test/decision-intelligence.test.js test/decision-exploration.test.js test/decision-client-traces.test.js`: **29 passed / 0 failed / 206 assertions**. `git diff --check` passed.

`HBL_EXPLANATIONS_PORT=39933 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test/backlog-explanations-browser.mjs`: passed Chromium component smoke, hydration and stale-response rejection, source/playback, update/destroy, 390px no overflow and zero page errors. `/tmp/hbl-backlog-explanations-mobile.png` remains isolated component evidence.

NEW normal-route harness: `test/backlog-explanations-route.mjs`. Command:

```sh
NODE_PATH=/Users/wahabma/happybearlandia/node_modules HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test/backlog-explanations-route.mjs
```

Uses a fresh temporary Decision store and overridable port `HBL_EXPLANATIONS_ROUTE_PORT` (39932 default), bounded 200 real simulator runs, actual create/start/results APIs, then ordinary `/world/decision.html?experiment=...` navigation. It does **not** inject the component. After coordinator mount, it exercises saved failure cluster selection, full trace hydration, month-12 WHY with no final drivers, exact same-seed metric delta, recorded source-event jump, 390px overflow, navigation during playback and page/console errors.

Actual baseline run created `decision_122d2f9d-e583-47ce-946f-8d3fdbfe064f`, selected evidence failure `plan-a_0001`, saved **200 actual completed runs**, opened the normal studio with **zero page errors**, and exited **2 / INTEGRATION-BLOCKED** because `.backlog-explanations` is absent in coordinator-owned `advanced-studio.js`. It made no injected mount or production-route acceptance claim. Artifacts: `/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-explanations-route-Z5au8I/normal-route-mount-pending.png` and adjacent server log/store. The explicit threshold 100 is a synthetic test assumption, not an empirical failure definition.

Status for all four assigned tickets: **INTEGRATION-READY**, normal-route completion pending shared mount and rerun. No external service or authorization blocker. Initial listener attempts in the sandbox reported EADDRINUSE; local-server permission allowed the bounded browser checks. Original checkout untouched; no shared production modules or global plans modified.

## Coordinator-source correction and observed shared context defect

The previous mount-absent result was against this track's own source root and is **not evidence that the coordinator checkout lacks the mount**. Coordinator `world/decision/advanced-studio.js` already imports the module and mounts it at line 95, forwards update at line 119 and disposes it. The harness now accepts `HBL_EXPLANATIONS_SOURCE_ROOT` explicitly, reports it at every stage, bounds actions/navigation and captures failure evidence. It never injects a component.

Actual coordinator-source command:

```sh
NODE_PATH=/Users/wahabma/happybearlandia/node_modules \
HBL_EXPLANATIONS_SOURCE_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia \
HBL_EXPLANATIONS_ROUTE_PORT=39949 \
HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs \
bun test/backlog-explanations-route.mjs
```

Result: real mounted component found; 200 actual saved runs completed; failure cluster button selected `plan-a_0001` through its normal callback; stored monthly trace hydrated. The existing scrubber was moved to Month 12. **FAILED** exact checkpoint assertion: expected `recorded as 1830.5124249767582`, received `recorded as 1800` with zero dated events. This is Month-0 context retained after the UI scrub, not missing data in the saved run. First coordinator-source attempt also reached queries but timed out waiting for a source-event button because stale Month 0 had no dated event.

Source evidence: coordinator `studio.js` line 479 calls `syncConstructionWorld()` on `#building-month` input without `updateAdvancedStudio()`. The latter (line 491) is where `month: constructionMonth` is forwarded to explanations. Coordinator production modules remain untouched by this track.

Minimal shared patch for coordinator (replace the existing month input handler, preserving its transition cancellation):

```js
$('#building-month').addEventListener('input', () => {
  stopConstructionPlayback();
  futureTransitions.cancel('scrub');
  constructionMonth = Number($('#building-month').value);
  syncConstructionWorld();
  updateAdvancedStudio();
});
```

Also keep explanation context synchronized at discrete selected-month changes in construction playback and scenario/run reset paths; do not continuously rerun clustering for fractional visual interpolation. A separate authoritative integer selected-month context is preferable if playback remains fractional. The current explanations contract intentionally rejects fractional query checkpoints rather than interpolate evidence.

The inspected coordinator explanations `evidence.js` still had the initial `clock` implementation, so it had not yet integrated follow-up `cf0237d` (authority/horizon hardening, reference summary hydration, stale-response protection). Cherry-pick that owned commit before completing the remainder of this harness. The normal-route harness now asserts the exact Month-12 stored metric before comparing or jumping, so an accidental equal delta cannot conceal stale month context.

Latest focused check: `bun test test/backlog-explanations.test.js test/decision-intelligence.test.js test/decision-client-traces.test.js`: **22 passed, 141 assertions**. Prior full focused four-file run remains **29 passed, 206 assertions**. Status: **INTEGRATION-READY with reproduced shared wiring defect**, not absent-mount blocked and not end-to-end DONE. Next coordinator action: integrate cf0237d, apply the above month-context patch, rerun the absolute/source-root harness. Remaining assertions cover actual reference comparison, source jump, no-overflow and playback navigation disposal.

Repeated coordinator-source run on unique port 39950 reproduced the identical wrong value with **zero page or console errors**. Artifacts `/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-explanations-route-JWlYlw/`. Inspected `failure.png` shows the actual mounted mobile component and 100 evaluated failures / 200 saved records, split into 34/32/34 clusters. This is normal-route evidence for mounted clustering/selection, not passing evidence for WHY/source/month acceptance. Both comparison and source-jump acceptance remain gated by the shared month refresh and follow-up module integration.

## Final normal-route acceptance — DONE for bounded 89 / 107 / 108 / 109

The coordinator integrated follow-up `cf0237d` and fixed month-context synchronization (`ef67f11` and subsequent integration). Actual source at the successful run was `/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia`, observed HEAD `bc0850e` before launch. No shared production files were edited by this track.

Normal route command used the same explicit source-root command above with port **39951**. **PASS / DONE**, exit 0: actual create/start/results persisted 200 model runs; cluster selection chose `plan-a_0001`; full monthly trace hydrated; Month 12 WHY matched the exact stored value and excluded final drivers/future events; comparison used the matched baseline, correct seed/authority/version/horizon; source-event button navigated through the real host into the recorded month; 390px no horizontal overflow; playback followed by normal navigation disposed without page or console errors.

Exact successful run: experiment `decision_6f788e61-642a-4914-ba72-fcc0cb60c25a`, selected `plan-a_0001`, baseline `baseline_0001`, **run seed 110210400** (master experiment seed 0), model `1.2.0`, engine `hbl-decision-kernel.v1`, Month 12 `median_rent`: selected **1830.5124249767582 USD/month**, baseline **1830.5124249767582 USD/month**, delta **0**. Zero is the real early-horizon comparison, not missing data or an invented intervention effect. The failure threshold 100 remains a synthetic test assumption for exercising evaluated failure records.

Artifacts: `/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-explanations-route-2Z0lGA/`. Inspected `normal-route-mobile.png`: actual mounted 390px content width 320px, **100 evaluated failures / 200 records**, **34/32/34 clusters**, assignment converged in **5/50** iterations, recorded **Month 12 annual-accounting** associations and working source inspection. This is production-route evidence; earlier own-source mount-absent result and coordinator stale-month failure are superseded by this successful run, retained above as correction history.

Latest full focused regression command: `bun test test/backlog-explanations.test.js test/decision-intelligence.test.js test/decision-exploration.test.js test/decision-client-traces.test.js`: **29 pass / 0 fail / 206 assertions**. `git diff --check` passed. No new production defect found in the successful normal-route run. Limits remain intentional: deterministic supported metric queries, statistical clustering with missing-case disclosures, rule associations rather than fabricated causal event chains, synthetic model mechanics rather than empirical policy validation.

Evidence-enhanced repeat on port **39952** also passed / exit 0 against recorded source HEAD **55e236dd5e3a182f0a19bc30e3c3b70c9b98896d**. Experiment `decision_90f92a7e-a07b-440c-923e-b892222e53c0`; same selected/reference IDs, run seed and Month-12 numeric values as above. Source jump confirmed exact **Month 12**. WHY contained exactly one supporting dated event, `plan-a_0001[0] @ month 12`, one registered rent rule and **0 final mechanisms**. Comparison was exact zero, explicitly labeled a modeled numerical comparison.

Artifacts `/var/folders/xg/07bxfbg503v0hglrq2y8b8700000gn/T/hbl-explanations-route-SVLW3v/`: `evidence.json` retains source HEAD, identities, versions, clock, metric/unit, exact selected/reference/delta, WHY text, comparison text, source-jump month and empty page/console error array. `month-12-why.png` and `month-12-comparison.png` were visually inspected: native styled text readable with wrapped equation/source and no clipped values. `normal-route-mobile.png` records mounted clusters/ripple. Harness now writes this machine-readable evidence and both query screenshots automatically on success.

Ready-to-apply global status: **89 / 107 / 108 / 109 DONE for the bounded implementation described here**, verified on normal Decision Studio entrypoint with actual saved runs. General freeform language generation, empirical cluster validity, inferred causal event propagation, and cross-authority comparisons remain outside this bounded acceptance and are not claimed complete.
