# House Studio

Open a saved house with `&internal_tool=true`. The malformed `?home=…?internal_tool=true` form is also accepted. This flag reveals a local authoring workspace; it is not an authentication mechanism. Normal house pages do not mount the tools or start their worker.

Studio pauses the live game, takes its complete checkpoint, and restores a disposable copy into a dedicated worker. All mutation, scenarios, batch jobs, authored activities, and forward replays use the production population/household rules. There is no “apply to live save” action. Browser IndexedDB stores scenario graphs, activity definitions, payoff reviews, and playtest markers separately from autosaves. Exported bundles contain the full synthetic city and should be shared intentionally.

## Tools

- **Resident Why?** Actual needs, intention/phase, command origin, targets, reservations, blockers, recorded decision traces, availability checks and recent events. Conditional stop rules watch long blocks, repeated blockers and queues that disappear without completion/cancellation.
- **Scenario lab** Eight generated four-resident situations, exact captured moments, reset, seed/need/trait editing, bounded simulation advance and run-until-event. Captured scenarios can be imported/exported.
- **Feature registry** Registered production actions and systems plus the live page's actual entry points, dependencies, room/age/participant constraints, duplicate labels and related scenario launchers. Desktop/tablet/phone scene width preview and read-only menu placement preview.
- **Recorder & replay** Game events plus observed need/relationship changes, retained snapshots for investigation forks, complete bug-bundle export and deterministic command replay.
- **Object workbench** Actual rendered bounds, seats, approach points, motion segments, occupancy, capacity and supported interactions. Debug gizmos, real interaction/competition tests, furniture edits/moves and cancellation.
- **Activity author** Editable versioned JSON, cast substitution, real action/system/queue/wait/cancel primitives, success/interruption/failure branch command lists and saved/exported definitions. Outcomes only come from game rules.
- **Animation & sound** Real action rehearsal, two-resident interactions, normal scene camera, simulation speeds, snapshot-based minute scrubbing and delayed sound preview.
- **Visible payoff** Request/intention/action/reaction/consequence/memory review with planned/connected/verified status, evidence notes and scenario context. Verification is a human assessment.
- **Relationships** Both directions, actual tie dimensions, directed feelings, memories, sentiments and recent source events; disposable tie edits and conversation tests.
- **Batch & balance** 1–20 copies, 1–10,080 minutes per run, future-choice seed variations, totals/completions, blocked and critical-need measurements, game validation and restorable run states. Cancellation yields between simulation steps.
- **Performance** Browser frame interval history, WebGPU backend/resource/triangle counters, visual settings, viewport/browser metadata, a camera benchmark and actual worker step timing.
- **Save validator** Production schema validation, missing action/queue references, saved scenario checks and restore/advance testing.
- **Playtest review** Timestamped observations, selected resident, recent events, screenshots and session export.
- **Export context** Expected/observed behavior, initial/final snapshots, commands, events, versions, captured external context, screenshot, activity definition, source paths and reproduction steps.

## Boundaries

The engine exposes recorded decision traces and present-time action availability; it does not invent autonomy scores or an unrecorded retry timestamp. Cosmetic movement stages are separate from committed simulation activity. The geometry overlay is the rendered interaction layout, not a certified walkability/navmesh solver. GPU timing, individual decision/pathfinding timings, automated asset-reference validation, and an embedded browser trace viewer are not instrumented. Backward inspection restores one of eight retained snapshots; forward replay uses the original snapshot and full recorded commands. No network call is made during replay. Scenario setup rejections remain visible in the recorder.

Batch metrics include per-minute activity samples, critical-need and blocked person-minutes, total activity deltas, completion counts and end-state blocked/critical needs. Repeated sampled activities are design measurements, not evidence of failed decision loops. This is a working internal baseline for every proposed tool area; the document's optional visual graph editor and deeper instrumentation can build on the same worker protocol.

## Verification

`bun test test/house-studio.test.js`

Run `test/e2e/house-studio.e2e.js` with Chromium WebGPU enabled (`--enable-unsafe-webgpu --use-angle=metal` on the tested Mac). Browser tests cover all fourteen panels, disposal-copy isolation, geometry gizmos, scenario switching, and both URL forms.
