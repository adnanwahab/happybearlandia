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
