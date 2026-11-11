# Transitions — INTEGRATION-READY

Baseline `1b19358`; initial owned commit `2293689e451ea22dc58fd53413cead2f0255accd`. Worktree `/Users/wahabma/.codex/worktrees/backlog-transitions/happybearlandia`. Only owned adapter/metadata modules, uniquely prefixed tests and this handoff are edited. Original checkout and coordinator sources were inspected read-only.

## Slice, decisions and interface

Deliver bidirectional viewport flights around the existing selected stored Decision Studio future. Prerequisites: native run selection/trace hydration complete; host supplies exact experiment/run/scenario/model/seed/month and current comparison metadata. Acceptance: enter/return preserves identity, time and comparison; bounded motion; cancel stale/manual work; reduced motion; disposal; no simulation writes.

The SVG outcome plot and construction renderer do not share a geographic camera pose. The adapter truthfully supplies eased viewport travel and a small screen-space zoom/reveal, not a geographic 3D fly-through, model effect, or cross-model entity mapping. Native camera controls are untouched. Existing animations/styles are restored by cancelling the temporary Web Animations effect. Missing effect support retains usable scroll navigation.

`attachFutureTransitions({multiverse,city,getSelection,duration=850,environment=window})` returns `{flyTo(view,{source}),cancel(reason),detach(),running,selection,lastResult}`. `view` is `city` or `multiverse`; source is an optional actual selected plot element. Flight receipts are frozen `{status,reason,view,selection,version}`. The `selection` diagnostic returns frozen metadata only.

`getSelection()` is pure and bounded: nonempty `experimentId`, `runId`, `scenarioId`, `modelVersion`; exact uint32 `seed`; finite nonnegative native `month`; optional host-owned `comparison`. Every frame checks these fields. No run history is cloned, no pair inferred, no playback advanced. Wheel/pointer/touch, scrolling/navigation keys including Tab/Escape, resize, a replacement flight, changed metadata or removed view cancel motion. Reduced motion finishes immediately; a removed view still cancels. Detach clears effects/listeners/RAF, is idempotent and prevents stale callbacks moving the viewport.

`snapshotComparisonMetadata()` supplies a strict, frozen native view metadata contract with axes, projection/rotation, selected run and actual baseline IDs, filters, lasso, paging, grid size and replay index. It rejects incomplete state. Sorted deduplicated lasso IDs prevent order-only differences. It reads no outcomes and invents no pairing.

## Owned paths

- `world/decision/backlog-transitions/{index,metadata}.js`
- `test/backlog-transitions.test.js`, `test/backlog-transitions-metadata.test.js`
- `test/backlog-transitions.browser.js`, `test/backlog-transitions-production.browser.js`, `test/backlog-transitions.browser.config.js`, `test/backlog-transitions-browser-hooks.js`
- `docs/backlog-expansion/transitions.md`

## Current shared integration and exact remaining hook

Coordinator source HEAD observed during verification: `dd2781333256755d5f99185cb686105129d61244` (working integration source, including current mounts). Coordinator mounts now exist in `/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia/world/decision/studio.js`: real Enter/Return invoke the adapter; scrub/playback/reset/entry cancel; pagehide detaches. `visuals.comparisonSelection()` supplies actual axes, filters, selected run and seed-matched baseline IDs.

Its reader currently omits **rotation, unfavorable, page, gridSize, lassoMode and replayIndex**. These controls remain unchanged through navigation (browser checks include the actual DOM controls), but programmatic changes to omitted fields cannot invalidate an in-flight selection. Minimal coordinator-only fix: append these exact native fields to `comparisonSelection()`:

```js
rotation: Number(control('rotation').value),
unfavorable, page, gridSize, lassoMode, replayIndex,
```

Or import the owned `snapshotComparisonMetadata` from `./backlog-transitions/metadata.js` and replace that method with:

```js
comparisonSelection() {
  return snapshotComparisonMetadata({
    selectedRunId: selected?.id ?? null,
    baselineRunId: baselineSeeds.get(selected?.seed)?.id ?? null,
    axes: {x:xKey,y:yKey,z:zKey},
    projection: threeD ? '3d' : '2d',
    rotation: Number(control('rotation').value),
    metricKey,scenarioFilter,unfavorable,outcomeFilter,colorMode,
    searchQuery,gridSize,page,showGhost,showDensity,lassoMode,
    lassoIds:[...lassoIds],replayIndex,
  });
}
```

Optional diagnostics: include `futureTransitions` in existing `window.hblDecisionStudio`. Optional selected-dot reveal origin: pass the selected actual `[data-run-id]` element as `source` to `flyTo('city',{source})`. Neither is required for navigation correctness. Retain existing stored-run validation, URL updates, banners, playback stop and selected-month assignment. Do not call a model or reset a comparison from the animation.

## Verification and browser harness

Deterministic verification: `bun test test/backlog-transitions*.test.js test/decision-visualizations.test.js test/decision-exploration.test.js`. **42 passed, 0 failed, 172 assertions** across four files. Existing seed-paired math, URL selection and immutable fork/optimization regressions are included. Synthetic metadata fixtures prove mechanics, not empirical calibration. No lint/typecheck script exists. Whitespace checks pass.

Final production browser command (no source replacement), run from this owned worktree:

```sh
HBL_TRANSITIONS_PORT=40973 \
HBL_TRANSITIONS_PRODUCTION_ONLY=1 \
HBL_TRANSITIONS_APP_ROOT=/Users/wahabma/.codex/worktrees/backlog-integration/happybearlandia \
HBL_TRANSITIONS_TOOLS_ROOT=/Users/wahabma/happybearlandia \
HBL_TRANSITIONS_OUTPUT=/tmp/hbl-backlog-transitions-production-final \
bun /Users/wahabma/happybearlandia/node_modules/playwright/cli.js test \
  --config test/backlog-transitions.browser.config.js
```

The config uses one worker, overridable port/output/app/dependency roots and isolated temp World/City/share/Decision/journal stores. The server and Chromium require sandbox escalation on this host. With `HBL_TRANSITIONS_PRODUCTION_ONLY=1`, no route interception or application/module replacement occurs. A browser `scrollTo` observer records calls; the actual integrated modules and handlers, real server/kernel, persisted completed experiment, saved-record reopen, keyboard plot selection, monthly replay slider, Enter button and Return button are exercised. Production teardown dispatches pagehide and checks no later scrolling. Manual interruption uses actual `page.mouse.wheel`; rapid actual handler calls test supersession.

The separate diagnostic suite (omit `HBL_TRANSITIONS_PRODUCTION_ONLY`) routes only owned candidate modules and adds an attachment observer for receipts. Shared studio/visualization modules remain untouched. Its final run passed **2 tests in 55.1s**, zero page/console errors, including the owned removed-destination/reduced-motion fix. This diagnostic proof supplements, not replaces, the entirely unmodified production journey.

`HBL_TRANSITIONS_CANDIDATE_HOOKS=1` is a separate opt-in preliminary mode that serves strict single-match shared-source replacements in memory. It was used before coordinator mounts existed (2 tests passed in 37.2s). It is **not** the final acceptance run. Production-only mode requires the actual production hooks and never replaces any module source. The test no longer assumes a slider index means a year: hydrated monthly replay index 24 selects Month 24, while the annual view uses index 2.

Browser evidence preserves experiment input seed **0**, actual derived stored run seed **110210400**, `plan-a_0001`, housing model **1.2.0**, Month **24**, metrics and URL, plot projection/rotation and all rendered comparison control values through city→multiverse. No manufactured saved run seed 0 is inserted. Exact run seed 0 and uint32 maximum are separately tested in deterministic fixtures. Other browser checks cover manual wheel interruption, supersession, live/initial reduced motion, 390px screenshot, double detach and no queued scroll after disposal.

## Ready-to-apply status

| Ticket | Implemented and verified | Remaining |
| --- | --- | --- |
| 111 | Exact stored future entry via actual integrated Enter handler and viewport flight; seed/time/model retained; deterministic stale/manual cancellation. | Coordinator adds omitted metadata keys above, then reruns harness. Continuous geographic 3D flight unsupported. |
| 112 | Actual Return button retains stored run/month, metrics, URL and plot controls; native manual controls preserved. | Same metadata reader completion for full programmatic-state invalidation. |
| 184 | Eased scroll/reveal, bounded duration, reduced motion, replacement cancellation and disposable resources tested. | Same small shared reader hook; keep viewport/3D distinction explicit. |

No release merge, push, deployment, production writes, outbound messages or paid provider actions. No new agents/chats. Next action: integrate owned follow-up commit and the exact reader fields, then repeat the production-hook harness.

## Final acceptance evidence

- Final unmodified-production journey: **1 passed in 52.6s**, **zero page errors and zero console errors**. `sourceReplacement:false` is recorded in the evidence JSON. Actual saved experiment `decision_73318a96-ac0d-4a4d-83ec-0c6848b7c4ad`, experiment seed 0, run `plan-a_0001`, run seed 110210400, model 1.2.0, Month 24. This acceptance does not rely on in-memory source modifications.
- Final owned adapter diagnostic suite: **2 passed in 55.1s**, zero page/console errors; artifacts `/tmp/hbl-backlog-transitions-integrated-final/`.
- Final Bun suite: **42 passed / 0 failed / 172 assertions**. `git diff --check` passed. No repository lint/typecheck scripts exist.
- Final production artifacts: `/tmp/hbl-backlog-transitions-production-final/backlog-transitions-produc-7e38e-reduced-motion-and-teardown/` contains `production-evidence.json`, `production-saved-month24-city.png`, `production-saved-month24-multiverse.png`, `production-saved-month24-reduced-mobile.png`. Corrected 390px city screenshot visually inspected; selected future/model/seed and Month 24 are visible. Resizing alone intentionally preserves manual scroll; the screenshot harness explicitly re-enters the city after resize.
- The earlier failed harness run used annual index 2 on monthly replay (selected Month 2); corrected to the actual monthly index 24. A later scheduling assertion required more than two animation frames; removed because host scheduling may deliver only two. Deterministic tests verify interpolation; browser gates verify navigation/state rather than minimum frame rate. Final runs above include these corrections.
- Remaining architectural limitation: viewport flight only, no geographic camera mapping or cross-model handoff. Remaining shared integration task is precisely the six metadata fields listed above. Owned code includes a tested guard for a destination removed just before a live reduced-motion change, plus immutable receipt diagnostics and the complete native metadata contract. Integrate these owned files with the reader completion, then rerun the same command.
