# World Visual Pass interfaces v1 (frozen)

Base: 6c3330f. Referenced PR10 object 6dd2dd9b8022 is absent. Implement an equivalent slice using existing legacy World/cycle.worker.js without replacing Future Machine or importing a different base. No architecture.md exists. All modules are browser ESM with dependency injection and no top-level scene/DOM access.

## Ownership
Integration exclusively owns render.js, this contract, implementation-plan and report. Other paths follow dispatch ownership. Do not edit other workers' files. New modules may expose additional helpers but preserve the exports below.

## Quick controller
`createQuickDemoController({ waitForReady, observeResident, runComparison, revealComparison, onState, now })` returns `{ start(), stop(), replay(), getState(), dispose() }`. `now` defaults performance.now. start/replay return completion promises (caught errors reflected in state). Each start gets unique runId and AbortController. Call observeResident({signal,runId}) immediately after readiness, then runComparison({signal,runId,onProgress}). Comparison callback returns immutable actual cycle result. revealComparison(result,{signal,runId}) may be async. All callbacks may be async. onState receives `{status,runId,progress,error,result,timings}`. Status idle/waiting/observing/computing/revealing/completed/stopped/error. Timings use milliseconds: readinessMs, observationMs, workerStartupMs, computationMs, revealMs,totalMs; unknown values null. Progress `{stage, fraction}` actual worker messages. Ignore stale completions and abort work on stop/replay/dispose. Worker adapter may report startup/computation via result metadata or progress; never invent durations.

## Guide and feedback
`mountFirstRunGuide({container, onQuickDemo,onStop,onReplay,onInspect,onCompare,onStorm,onTour,onExperiment,panelManager})` returns `{update(state), show(), hide(), dispose()}`. It creates `#firstRunGuide` with `[data-testid=quick-demo]`, `[data-testid=quick-demo-stop]`, `[data-testid=quick-demo-replay]`, `[data-testid=quick-demo-status]`, `[data-testid=quick-demo-inspect]`. Buttons and state updates use textContent. State includes controller fields plus `observation`, `feedback`. Initial quick-demo is disabled until state.ready===true. Guide owns its DOM; index includes CSS only (no duplicate guide markup).
`createFeedbackAdapter()` returns `{configured(input), observed(input), measured(result,provenance)}`; each returns presentation data with explicit kind/label, no inferred identity mapping. observed input `{authority:'legacy-world'|'population',residentId,name,minute,activity,mood,needs,position}`. measured gets existing cycle result with `avg.noPlan`, `avg.withPlan`, `improved`, `worse`, `best`, `worst`, `scores`; provenance supplies seed/origin/modelVersion/days/year/proposalIds and mapping limitations. Guide update receives these returned values.

## Panels
`createPanelManager({document, panels, onChange})` returns `{register(id, element, options), open(id,{trigger}={}), close(id), closeAll(), getActive(), dispose()}`. panels optional; register options `{onClose}`. Manages at most one active sheet and restores triggering focus. IDs guide/inspect/cycle/experiment/activity. Existing renderer may request open immediately after setting legacy display. Do not hide top/scene/HUD. Visibility must account for hidden and legacy inline display. Guide registers itself if panelManager supplied. Manager handles Escape/dismiss; accessibility module may enhance but not duplicate Escape handlers.

## Accessibility
`mountWorldAccessibility({document, panelManager, getActivePanel, onDismiss})` returns `{announce(text), dispose()}`. getActivePanel returns element or null; onDismiss closes it. Trap focus only in active modal sheet, preserve keyboard scene navigation, respect reduced motion; no scene ownership. Can export standalone helpers for tests.

## Camera and highlight
`createCameraDirector({camera,controls,reducedMotion,getResidentPosition,now})` returns `{focusResident(id), update(time), cancel(), dispose()}`. getResidentPosition(id) returns actual `{x,y,z}` or null. Cancel immediately on user input (integration binds pointer/wheel). No invented geometry. `createSpotlight({THREE,scene,getResidentPosition,reducedMotion})` returns `{showResident(id),update(time),clear(),dispose()}`. Only highlights actual legacy selected resident by explicit ID lookup; no monthly City/Population mapping.

## Integration authority and diagnostics
Quick-demo always compares legacy scene town via a dedicated fresh cycle worker; never uses/changes full civic tour's worker/waiter. Does not silently activate or map Population. If Population is active, explicitly switch to legacy using established toggle before observation or label observation separately; integration will prefer legacy demo route. Select actual resident and focus in first seconds, observe current mood/activity without attributing to policy. No promise of changed mood. Full tour remains demoBtn/runDemo and ten-year experiment remains runExperimentBtn.
`window.hblVisualPass` exposes `{controller,getState,inspectResident, panels}` for browser verification, with controller state including feedback and observation through getState. `window.hblVisualPass.ready` true after actual startup.readyMs. Use actual app route `/world/?demo=1&synthetic=1&people=80` for bounded real computation tests; no worker mocks for acceptance. E2E tests should avoid depending on timing target until measured. Worker errors surfaced; stop terminates dedicated worker and rejects pending promise. Results are detached/frozen before reveal. The paired worker's indexes map only within deterministic legacy buildTown using same origin/area/maxPeople; do not present results as current-time resident outcomes.

## Integrated decisions and verification notes

SHE-51 extends the guide with optional `onChangeYear(year)` and test IDs
`quick-demo-year` / `quick-demo-change`. After a completed matched comparison,
the prompt offers implementation years 0, 1, 3, 5 and 10. The current year cannot
be submitted. Integration changes only the captured local recipe's year and
starts the existing controller/worker flow; Replay then repeats that recipe.
Town inputs, proposal IDs and seven-day horizon stay fixed. This is a fresh
detached same-start comparison, not a continuation of live playback. The guide
preserves a pending selection across updates for the same completed run.

The integration uses a fixed **local Balanced** recipe (year 3, seven measured days) to avoid remote-package startup delays. It explicitly switches from Population to legacy before observing the scene; no identity map is inferred. The first progress latency includes initial work and is labeled as such. `rulesVersion` is null because policy.js declares none; its source path is retained. Reproducibility across future source updates is not claimed without a versioned build recipe.

Integration-owned `integration.css` suppresses legacy docks during an active sheet. Guide secondary actions are moved into “More city actions” by renderer glue; first-run-guide.js remains owned by its original worker. The actual-position ring is drawn through occluders and labeled as a locator including indoors. Main-world WebGPU failure falls back to WebGL2; unavailable graphics expose accessible recovery. The integration browser config includes the actual accessibility filename (the worker config used a mismatched filename) and additional real error/touch/tour/pacing checks.
