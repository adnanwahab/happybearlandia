# First-play UI instrumentation — SHE-8

## Audit and dependency

Baseline b963dd3, branch `mini/SHE-8`. The checkout started clean. SHE-7 is
Done and GitHub PR #113 is merged (merge 6f6aad475533e0def2c32d72fa6d5f9b754c1f84).
This older checkout lacks its three files. They are restored byte-for-byte from
PR head eab98f31c254ba625c98441e469898678eb58d8a, with no schema redesign.
Existing Studio activity and opt-in Universe counters remain separate.

Owned integration paths: `world/future-machine/first-play.js`, the instrumentation
calls in `world/future-machine/main.js`, `test/first-play-funnel.test.js`,
`test/first-play-funnel.browser.config.js`, `test/e2e/first-play.e2e.js`, this document
and the status entry in `docs/implementation-plan.md`. Dependency files belong
to the already merged SHE-7 implementation. No simulation or shared renderer
implementation is changed. No new worker is dispatched or eligibility label added.

## Contract and transition mapping

Read-only `window.futureMachine.firstPlayEvents` returns a defensive copy of up
to seven page-memory milestones. No persistent store, DOM event bus, transmission,
external vendor or cross-session identifier is added. Page disposal clears all
records. After 24 hours the schema rejects further events; reloading creates a
new anonymous session. Missing secure randomness disables instrumentation.

Each record is an `hbl.first-play-ui.v1` wrapper containing `appVersion:
future-machine.ui.1` (explicit UI build version), `scenarioId: future-machine`
(a closed scenario identity, not user input or a saved run ID), actual `renderer`
from stage stats, and the validated SHE-7 `event` envelope (current explicit v2 for City 1.1.0). Renderer
values are webgpu, webgl, canvas2d, inventory-fallback; pending/disposed stages
cannot emit. Simulation model/data versions stay in the recorded facts.

- Landing: initial stage readiness, classifying only direct or parsed shared entry.
- Demo start: successful paired-history load and renderer readiness. Failure and
  cancellation do not emit. Starting the director with existing history is deduped.
- First input: accepted policy configuration, Fork City, timeline/playback or
  evidence selection. Automatic director ticks do not count as user input.
- First divergence: a displayed available paired frame at or after the first
  recorded nonzero metric or physical difference, using the existing comparison
  adapter and exact history seed/model/data versions. No timer-derived outcome.
- WHY: opening a supported recorded divergence or entity event inspector.
- Share: clipboard or native-share promise settles, with truthful success/failure/cancellation. Preparing the
  URL, rerenders and clipboard attempts still in flight do not emit.
- Return: successfully reopening a parsed comparison or explicitly opted-in local resume. This indicates an
  explicit shared entry, not proof of the same person returning.

Each type records only the first valid transition per page session. Repeated
scrubs, demo restarts, WHY clicks and share attempts are intentionally not counted
again. This is a first-play milestone funnel, not a count of every interaction.
No automatic collection from the homepage is added: landing is the playable
Future Machine surface. Export-evidence is not treated as a share action.

Synthetic model disclaimers, recipes, seeds and model results are unchanged.

## Verification

Commands and actual results are recorded in the implementation plan. The real
browser test uses the existing application server, City APIs and Canvas renderer;
it asserts one record per milestone, matching recorded facts, replay deduplication,
and a fresh anonymous session with explicit shared-return entry. No fixture
simulation outcome is substituted. Browser server setup may block this environment;
a committed test is not evidence that the browser assertions passed.

Integration retains progressive data readiness: ordinary controls work before
graphics, while demo-start/return instrumentation waits for a measured backend.
Validated first-only milestone payloads can wait in bounded page memory until
that backend is available, preserving their action time and settled share result.
Pending stages emit no records; disposal clears queued payloads. Exact entity/event jumps and first-construction inspection join the
same WHY milestone. Local continuation consent is separate and never persists
these counters. Current events use explicit `hbl.first-play.v2` for City 1.1.0;
legacy v1 validation remains available without upgrading old facts.
