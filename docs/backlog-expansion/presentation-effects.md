# Presentation effects handoff

Isolated baseline: 1b19358. Owned namespace: world/decision/backlog-presentation-effects; test/backlog-presentation-effects.test.js.

Implemented slice: pure recorded monthly construction interpolation and parent-authoritative fork prefix adapter. No model outcomes, geometry, physics, identities or floors are generated. Fractional floors are visual values only. Missing project records remain unavailable. Metrics/status stay on the preceding recorded snapshot. Synthetic tests validate mechanics, not calibration.

## Ready-to-apply status

- 183 Partial: adapter implemented, 3 focused tests / 9 assertions pass. Renderer integration pending.
- 185 Partial: parent prefix adapter implemented; dedicated animation and playback controller remain pending.
- 186 Blocked on follow-up implementation: event-driven presentation not implemented.
- 187 Blocked on follow-up implementation: sound not implemented.

## Exact shared-file integration

In world/decision/studio.js import constructionFrame and forkFrame from './backlog-presentation-effects/index.js'. At syncConstructionWorld, derive each project frame with `constructionFrame(constructionRun, project.id, constructionMonth)`. Pass `frame.visual` only to a new renderer presentation channel; continue using `frame.recorded` for inspectors, costs, occupancy and status. Existing renderer rebuild uses buildingStateAtMonth and cannot consume interpolated presentation yet: coordinator must own that renderer addition. Display frame.label alongside fractional replay. Reduced motion must use recorded state directly. Do not feed fractional visual floors into authoritative inventory.

For paired fork presentation use `forkFrame({parent, fork, forkMonth, month, projectId})` only when exact project identity and monthly authority are established. Before and at forkMonth the branch uses the parent's recorded prefix. Missing branch states remain null. No invented cross-run entity mappings.

Acceptance prerequisites: coordinator renderer/studio wiring, accessible visual interpolation disclosure, live reduced-motion preference, pause/scrub/cancel/disposal controller, recorded-event-only stress effects, muted-by-default user-activated sound and textual equivalent. No browser acceptance claimed; no production entrypoint changed. Tests: `bun test test/backlog-presentation-effects.test.js` (3 pass, 0 fail, 9 assertions). Browser screenshots unavailable because integration is pending.

## Follow-up delivery (supersedes initial pending implementation above)

183/185/186/187: INTEGRATION-READY module implementation; production acceptance pending coordinator wiring. Added playback.js with createRecordedPlayback, mountStressCue and createSubtleSound. No external dependency or paid calls.

Controller API: `createRecordedPlayback({run,parent?,forkMonth?,projectId,endMonth,onFrame,onCue, motion?})` returns play(monthsPerSecond=1), pause(), scrub(month), cancel() (reset to zero), dispose(), state. Caller supplies an actual recorded horizon; invalid scrubs/rates throw. Recreate/dispose on run or project selection. onFrame receives {month,playing,reducedMotion,frame,events,visualOnly}; frame is constructionFrame or paired forkFrame. Under reduced motion visual fields snap to recorded state. Default matchMedia listener responds live and is removed on disposal. Monthly recorded metrics never interpolate. Events come only from STRESS_PRESET_STARTED records up to the cursor; fork events use parent through forkMonth and branch afterward. onCue fires only when forward playback crosses the recorded boundary. Scrubbing updates visible event text without sound/retrigger; month-zero events appear in onFrame.events without an automatic sound. Resume excludes paused wall time; stale callbacks are generation guarded.

Coordinator usage: import from './backlog-presentation-effects/playback.js'. Create sound=createSubtleSound(), cues=mountStressCue(stressContainer,{sound}). Create player with onCue:cue=>cues.show(cue); onFrame renders the authoritative month/metrics and frame.visual in the presentation channel, plus the visible events as text. Invoke sound.enable() directly within an explicit Enable sound button click; await boolean success and reflect unavailable audio in that control. Muted default. Mute button calls sound.mute(). Pause/scrub/cancel should call cues.clear() and sound.mute() if immediate cue cancellation is desired; playback never re-enables sound. Dispose player/cues/sound on unmount. Cue view uses textContent and role=status, optional 250ms opacity animation; reduced motion disables new cue animation. Coordinator should clear active cues on live reduced-motion change via onFrame to stop an already-running animation.

Checks: `bun test test/backlog-presentation-effects.test.js test/building-lifecycle.test.js test/building-renderer.test.js`: 26 pass, zero failures, 516 assertions. Includes actual Housing seed42 ten-year project monthly states and scheduled recession month37; preserves serialized run, exact state boundaries and no early stress. Also covers pause/resume, reverse scrub, cancel, disposal/listener cleanup, event crossing, horizon clamp, live motion snapping, missing/denied audio and mute resource stopping, safe textual cue rendering. DOM/audio resource tests use injected doubles; empirical calibration and actual browser audio are not claimed. Production/browser acceptance and screenshots remain genuinely blocked by coordinator-owned shared entrypoint integration.
