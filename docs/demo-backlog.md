# Demo execution queue

Scope: the existing **One City, Two Futures** journey and reported first-run defects. This queue is executable work, not a request for another plan. Coordinator owns contracts, queue, integration, entry points and final verification. Six existing Codex chats own isolated worktrees; see `one-city-two-futures-workers.json`. No release merge or deployment is authorized.

Audit: `AGENTS.md`, product design, implementation plan, `world/FEATURE_BACKLOG.md`, current source, worker commits and running-browser evidence were read. The 198-ticket historical backlog spans other models; its “Existing/New” labels are evidence to inspect, not proof of this flagship. Current implementation already has deterministic 121-frame histories, split/difference modes, a 50-second guided demo, metric/structure WHY, graphical Canvas, homepage autoplay and share/replay. Do not rebuild them. Integrated baseline: nine browser journeys and five existing comparison regressions passed. Subsequent native Apple Metal checks passed seven journeys and ten backend tests (104 assertions). R04 mobile overlap and R10 Canvas keyboard journeys are verified. Native mobile pixel proof exposed clipping; coordinator is correcting framing. See status for current checks.

Complexity: S = a focused change, M = several coordinated behaviors, L = substantial integration. Initial READY bootstrap has twelve independently verifiable tasks. Dependencies mean verified prerequisites; a task may be dispatched only with exclusive ownership. Mark RUNNING when dispatched, REVIEW when delivered, VERIFIED only after coordinator checks the integrated result. Replenish READY work from approved objectives and actual failures; never manufacture new product scope merely to keep workers busy.

## READY bootstrap

| ID | Priority / complexity / status | Executable task and acceptance | Dependencies | Exclusive owner / files | Verification |
| --- | --- | --- | --- | --- | --- |
| R01 | P0 / M / VERIFIED | Add an actual native WebGPU renderer factory with bounded WebGL fallback; return the measured backend, preserve same scene/camera and disposal. No fake “WebGPU” badge. | Existing stage API | Worker 3: new `scene/renderer-backend.js`, backend tests; coordinator alone wires stage/import map | `bun test test/future-machine-backend.test.js`; real browser backend diagnostic |
| R02 | P1 / S / VERIFIED | Make KPI styling semantic: zero/missing neutral, costs disclosed, negative rent not a universal welfare claim. Keep exact recorded values and units. | Existing UI metrics | Worker 2: `future-machine/ui/`, UI tests only | `bun test test/future-machine-ui.test.js`; integrated zero/nonzero screenshot |
| R03 | P1 / S / VERIFIED | Audit paired replay at seed 0 and uint32 maximum; detect stale/mismatched inputs and prove no mutation or hidden horizon reduction. Fix demonstrated adapter issues only. | Existing actual City API | Worker 1: `future-machine/data/`, new uniquely named boundary test | Focused data tests; actual seed-matched digest evidence |
| R04 | P0 / S / VERIFIED | Repair observed 390px expanded World-controls/shortcut overlap; clear stale owned disabled-control explanations after re-enable. Preserve keyboard focus and one-sheet behavior. | Reproduced `stalled GPU` test | Worker 4: `first-run-guide.css`, `onboarding/first-run-repairs.{js,css}`, focused helper tests; no `render.js` edits | Actual 390px bounding boxes, Activity/quick comparison, focused tests |
| R05 | P1 / S / VERIFIED | Harden Canvas camera/selection for empty data, pointer cancellation and invalid dimensions; inspect context failures and report wrapper requirements. Never invent substitute entities. | Existing Canvas stage | Worker 5: `scene/canvas-stage.js`, Canvas tests only | `bun test test/future-machine-canvas.test.js`; actual no-GPU click/zoom |
| R06 | P0 / M / RUNNING | Extend real browser proof to native backend, Month 16 screenshot, exact schema and console errors; retain uncut recording and deterministic replay tests. | Existing nine passing journeys; integrate R01/R04 before final run | Worker 6: new follow-up browser test/config only; do not edit canonical suites owned by coordinator | Real app tests and metadata with scenario/seed/event/KPIs |
| R07 | P1 / S / VERIFIED | Gracefully retain accessible recorded inventory if both GPU and Canvas contexts fail; no unhandled promise or false backend claim. | Existing fallback contract | Coordinator: `scene/index.js`, focused failure browser case | Force all contexts unavailable; controls/metrics/WHY remain usable |
| R08 | P1 / S / VERIFIED | Verify same stable schematic IDs and camera across reverse scrub, split/difference and renderer choice; no future inventory appears at Month 0. | Recorded history and existing mapping | Worker 1 after R03: distinct projection/replay regression test only | Real history Month 0/16/120 then reverse; exact ID assertions |
| R09 | P1 / S / REVIEW | Exercise bounded provenance asset failure and independent definitions before slow graphics; expose a useful error and preserve simulation controls. | Early metadata initialization already implemented | Worker 4 after R04: helper regression; coordinator owns runtime wiring | Deadline unit test and graphics-only failure injection browser test |
| R10 | P1 / S / VERIFIED | Verify keyboard-only split/timeline/WHY and Canvas focus without trapping hidden controls at 320px/landscape. | Existing UI semantics | Worker 5 after R05: new Canvas keyboard browser case, no shared config edits | Actual keyboard journey and reduced-motion screenshot |
| R11 | P0 / S / READY | Consolidate actual Month 0 / first divergence / Month 120 / WHY / Canvas images and per-run evidence into one delivery manifest. Never label fixture images as acceptance. | Completed real runs | Coordinator: delivery manifest/report only | Inspect PNGs, JSON identity, playable recording duration |
| R12 | P1 / S / READY | Execute named recording command and audit final candidate diff/commands/resource disposal; publish exact pass/fail and next work. | Final working slice, R01–R11 as applicable | Coordinator: status/plan/report and final integration | `bun scripts/record-one-city-two-futures.mjs`; canonical suites; `git diff --check` |

## Prioritized upcoming work

These are decompositions of the approved demo/compatibility goals, not newly promised product features. Promote after prerequisites and ownership are available. Keep unrelated historical backlog work out of this sprint.

| ID | Priority / complexity / status | Task, acceptance and verification | Dependencies / intended owner |
| --- | --- | --- | --- |
| U01 | P1 / S / UPCOMING | Native backend failure before/after init selects truthful fallback without leaked half-renderer. Factory rejection/disposal tests plus browser context failure. | R01 / Worker 3 |
| U02 | P1 / S / UPCOMING | Native renderer resize preserves both viewport scales and camera; no clipped changed building. Desktop→390px browser screenshot. | R01 / Worker 3 |
| U03 | P1 / S / READY | Compare repeated scrub/focus/dispose memory and object counts after native integration; report measured values, not target FPS. | R01 / Worker 6 |
| U04 | P1 / S / VERIFIED | Stop/restart default guided demo while a changed recipe is loading; stale response cannot resume another recipe. Real API cancellation browser check. | R03 / Coordinator |
| U05 | P1 / S / UPCOMING | Neutral KPI styles agree with zero-control, missing metric and negative delta semantics. Renderer-independent UI behavior test plus browser assertion. | R02 / Worker 2 |
| U06 | P1 / S / UPCOMING | Make household before/after rent/savings units and new-inventory caveat readable without expanding raw JSON; exact identity only. | R02 / Worker 2 |
| U07 | P1 / S / READY | Show selected recorded construction stage/progress, never animate an uncompleted building as finished. Inspect actual project months and tests. | R01 / Worker 3 |
| U08 | P1 / S / READY | Ensure reduced-motion disables animated pulses but keeps selected entity and measured change visible. Real media preference toggle test. | R01/R05 / Worker 5 |
| U09 | P1 / S / UPCOMING | Validate share reopen after saved record missing, model mismatch and recipe corruption after latest UI/backend integration. Existing browser regression suite. | R01/R03 / Worker 1 |
| U10 | P2 / S / READY | Audit narrative receipt deduplication and historical-month labels after repeated selection; preserve exact arm-scoped IDs. | R11 / Coordinator |
| U11 | P1 / S / RUNNING | Ordinary World Canvas current resident selection and Activity filter/export retain the daily authority and seed; actual runtime only. | R04/R05 / Worker 4 |
| U12 | P1 / S / RUNNING | Check no-GPU default Living mode separately from legacy demo; explicitly report unsupported paths, never silently substitute a model. | R05 / Worker 5 |
| U13 | P2 / S / VERIFIED | Audit browser engines installed locally; run only available engines, report missing Safari/Firefox without claiming support. | R06 / Worker 6 |
| U14 | P2 / S / READY | Compare gallery/registry unique routes and navigation safety after every added verified entry; preserve the original catalog. Registry + actual homepage tests. | R04 / Worker 4 |
| U15 | P1 / S / UPCOMING | Review external suggestions from `docs/reviews/` only for architecture-compatible, testable approved objectives. Record accepted/rejected/deferred reasons; do not wait for reviews. | Any review arrives / Coordinator |
| U16 | P0 / S / UPCOMING | Final frozen-scope pass: all accepted changes, screenshots, video, commands, commit/worktree references and remaining release blockers agree. | Final candidate / Coordinator |

## Additional approved decompositions

- U17 (P1/S, RUNNING → integration review): expose existing uint32 next-run seed input, keep displayed provenance/share attached to the actual run, preserve pending configuration across scrubs, then rerun seed0/default through actual API. Owner Worker2 UI; coordinator authorizes optional `onConfigure(recipe)` and owns runtime wiring. No new simulation/model.

## Evidence updates

- R03/R08: worker ea4c5a7 integrated as01d55e8; coordinator12test/264assertion rerun passed. Boundaryseed0/4294967295 retain immutable originals, exacthorizons, +24homes and supportedphysicalMonth16.
- R02: semantic UI4f0955f integrated as130b1c4; actualpaired-run browserpassed and asserts one cost-tonedcapitalcard.
- R07: real browser test `all graphics contexts unavailable preserves recorded comparison controls without page errors` passed against the production route with actual City API output. At Month 120 the inventory and WHY still show the added building/completion event and +24 homes. No page errors. Artifacts: `/tmp/hbl-all-contexts-proof/`.

## Scheduling and review rules

Integrate each reviewed worker commit in dependency order. A delivered worker receives the next eligible READY task; verify its previous result before handoff. Maintain at least six eligible tasks while meaningful approved work remains. If a task is already correct, record the audit/test evidence and move forward rather than rewriting it. External Claude/Gemini files are proposals: no new model, cross-model mapping, empirical claim, infrastructure spend, release merge or deployment becomes authorized by a review file.

Feature freeze applies to the final verification/recording phase. During freeze, execute only integration, correctness fixes, compatibility, visual clarity, regression and evidence tasks. The success gate is the actual homepage→Play Demo→matched divergence→timeline→measured outcomes→exact WHY journey; a queue entry, plan or passing fixture alone is not completion.

## Approved decisions — implementation assignments

| ID | Priority / complexity / status | Exclusive ownership and interface | Acceptance / verification |
| --- | --- | --- | --- |
| D01 | P0 / M / RUNNING | Coordinator: demo-controller.js, scene/index.js, main.js; optional stage.focus(entity,{animate}) | Actual first physical stop held six seconds; shared camera eases1200ms, reduced motion immediate. Clock2passed/13assertions; actual timed browser2passed32s, seed42 Month16 +24. Mobile pixel fit remains in review. |
| D02 | P1 / M / RUNNING | Worker2: new ui/outcome-timeline.js + dedicated tests. createOutcomeTimeline(container,{history,onMonth})→update(month),dispose(). Coordinator existingUI wiring. | Exact121 matched snapshots; metric selector, baseline/plan/delta, units/missing; click synchronizes both scenes/KPIs. Focused units + real320/390 browser. |
| D03 / U07 | P1 / M / RUNNING | Worker3: new scene/construction-progress.js, mapping.js if required, dedicated tests; coordinator stage integration. | Only recorded stage/progress, exact model-owned building mapping, completion16, reverse0/15/16 correct; no fabricated floors. |
| D04 | P1 / M / RUNNING | Worker1: new story/evidence-trail.js + dedicated tests. buildEvidenceTrail(history,{collection,id,month}); coordinator rendering/wiring. | Actual policy/project/completion/housing chain; missing links unavailable, no future leakage; event16-0 jumps16. |
| D05 | P0 / M / RUNNING | R04/R10 VERIFIED prerequisites. Worker6 new approved-demo-responsive browser files; coordinator camera polish. Existing Canvas worker U12 continues. | Desktop390/320 actual Canvas journeys, controls/timeline/KPIs/WHY usable. Native390 pixel clipping must be resolved separately. |

Additional current regression: U11 actual Activity filter/export passes behavior but exported authority seed is missing. Worker4 owns narrow export repair, preserving actual string authority seed; no substitution of City seed42. New features do not interrupt U12.

### Integrated follow-up evidence

- D01 native timed actual browser normal/reduced motion:2passed32.0s; after D02/D03/D04 integration combined paired-run + timed demo3passed32.7s. Replay resets the synchronized camera; evidence jumps stop presentation playback.
- D03 adapter/mapping integrated `bacfa28`, D04 adapter `49a764a`, D02 chart `b43f6a1`; coordinator rendering/wiring now present. Actual screenshot `/tmp/hbl-integrated-decisions-proof/.../cinematic-month-16.png` shows24-home structure and evidence trail. D02 delta-series/compact refinement RUNNING; independent D03/D04 interaction proofs RUNNING.
- D05 combined Canvas1440/390/320:3passed17.8s; nativeMetal1440/390 pixel proof:2passed13.0s. Fixes include bounded FOV, per-viewport label clamping, static universe navigation. Test selectors now identify the primary timeline and exclude collapsed evidence controls from visible overlap assertions.
- Activity actual export seed repair integrated `a8973b1`, tests `fb7657f`: independent3browserpassed4.0s; visible and exported authority seed both `29.7286,-95.4746`; zero browser errors. Living Canvas six-case worker proof integrated `a15ccc7`; FPS mobile overlap repair remains assigned.
- Focused integrated suite:98passed,3browser-gatedskips,815assertions across18files. Actual browser checks execute separately; build25modules and diffcheck pass.

Next eligible READY verification tasks: compact delta chart interaction; native/Canvas construction reverse scrub; evidence completion jump; final50srecording; current-branch artifactmanifest; main overlap audit. Owners remain those in D01–D05; no new productscope.
