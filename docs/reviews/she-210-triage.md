# SHE-210 review follow-up triage

Date: November 12, 2026. Inspected application source:
`b963dd353538294cb0fbf5d34d5283fad6e10e68`.

This is coordinator triage of [SHE-210](https://linear.app/shel-bernstein/issue/SHE-210),
not an implementation or dispatch receipt. The parent and SHE-213–SHE-218 were
read from Linear and all remain Backlog. No labels, statuses or production data
were changed. I3 remains with SHE-182; D05 remains accepted with additional
polish deferred.

## Sources and scope

The referenced `docs/reviews/claude.md` is absent from this checkout. The review
at `f1174eb` / application `2c9d973` could not be read directly. The complete
parent and child issue descriptions supply the reported findings; the source
files below independently establish the current implementation patterns.
Read alongside `docs/design.md`, `docs/implementation-plan.md`, and the module
READMEs in `world/future-machine/{diff,scene,story,ui}`. There is no
`docs/architecture.md` in this checkout.

Keep the monthly City engine authoritative, exact collection/entity IDs,
integer months 0–120, matched seeds, and attached provenance. These fixes do not
need a new model, invented intermediate floors, or cross-model identity joins.

## Disposition and proposed integration order

| Order | Ticket | Disposition and current evidence | Acceptance before closure |
| --- | --- | --- | --- |
| 1 | SHE-213 / I1 | Accept reliability fix. `main.js:setMonth` calls `updateURL` on every month; URL exceptions share the catch with inspector refresh. `scene/index.js` imports Three and OrbitControls before handling renderer fallback. | Persist URL on explicit navigation/pause/stop/share; fresh share URL; rate-limit-emulated full demo and timelapse; canonical Firefox/WebKit journey; explicit Canvas mode makes no Three requests. Record physical iPhone evidence separately. |
| 2 | SHE-218 / I2 | Accept readiness fix. `run` sets loading again and awaits `stage.whenReady` after history/diffs/chart are available. Scene imports have no deadline. | Controls, KPI, timeline and WHY usable within 1 s of data readiness while Three is delayed 30 s; late graphics preserve current month/selection/camera; blocked imports reach accessible fallback. Guard late completion against replaced runs and disposal. |
| 3 | SHE-215 / D01 | Accept consolidation and presentation fix. `main.js:physicalStop`, `scene/effects.js:firstPhysicalStop`, and `story/index.js:buildStory` contain separate selection logic. Director emits every 50 ms; selection does not increment demo generation; no visibility handler pauses the clock. | One shared deterministic selector, including same-month ties; seed 42 selects Month 16 / `building-project-policy-1-0`; hidden-tab hold test; pending-readiness selection survives; unchanged-month household options have zero child mutations; caption-only live announcements. |
| 4 | SHE-214 / D04 | Accept navigation fix. `jump` calls `setMonth`, which rebuilds the inspector, then replaces it with the jumped entity. The browser test reselects the Month-120 building before policy/project clicks. | Retain exact anchor and node IDs across policy → project → completion → units without reselection; show viewed and anchor month; Return restores anchor month; manual Month-0 scrub hides future receipts; unchanged anchor playback does not rebuild trail. |
| Separate UI slice | SHE-217 / D02 | Accept control/chart fix. `ui/outcome-timeline.js` creates a second month range, replaces chart children and rewrites a polite live summary for each month update. | One month range; paths unchanged during playback; cursor/selected point updates only; zero autoplay live-summary changes and one per manual selection; exact-values table and chart clicks still synchronize scene/KPI/WHY. |
| After resource evidence | SHE-216 / D03 | Accept renderer-only fix. `scene/index.js:rebuild` releases all meshes; `draw` replaces labels and reads widths. Canvas stats hard-code layout v1 while scene documentation describes v2. | Inspect U03 measurements first; retain meshes by arm/collection/ID/ghost and labels by identity; stable geometry memory across two scrubs; still camera stops drawing within 1 s; reverse 16→15 removes building immediately; forward 15→16 shows recorded floors; Canvas reports shared layout version. |

The sequence is a recommendation, not an assertion that Linear dependencies or
dispatch approval exist. SHE-213, SHE-218, SHE-215 and SHE-214 share `main.js`:
integrate them serially under one owner. SHE-218 and SHE-216 also share
`scene/index.js`; finish readiness lifecycle changes before mesh retention.
SHE-217 can be developed separately with a defined manual-versus-playback
update contract, then integrated after the main month-control changes. Its
source-level independence does not itself authorize dispatch. No agents were
launched for this audit.

## Verification performed

Executed locally on the inspected source with Bun 1.4.2:

```sh
bun test test/two-futures-demo-controller.test.js test/future-machine-diff.test.js test/future-machine-story.test.js test/future-machine-outcome-timeline.test.js test/future-machine-construction-progress.test.js test/future-machine-scene.test.js
bun test test/future-machine-evidence-trail.test.js test/future-machine-effects.test.js
```

First command: 38 passed, 1 skipped, 0 failed, 210 assertions. The skipped test
is the browser-dependent outcome timeline test. Second command: 10 passed,
0 failed, 75 assertions. These 48 passing tests establish a baseline for pure
modules, deterministic recorded outcomes, missing data and boundaries. They
do not establish that the integration defects are fixed. In particular, the
passing tween test does not prove production retains a mesh, and the pure trail
test does not prove repeated browser navigation keeps its anchor.

No browser behavior changed in this documentation slice, so Playwright was
skipped. No WebKit limit failure, physical iPhone support, graphics-delay
readiness, memory plateau, or live-region mutation count was measured here.
`test/demo-followup.browser.config.js` already accepts Chromium, Firefox and
WebKit through `HBL_DEMO_FOLLOWUP_ENGINE`; reuse that infrastructure where
appropriate. `test/two-futures-sprint.browser.config.js` still selects Chromium
for the canonical journey. Browser configuration support is not passing-browser
evidence.

## Remaining work

Implement and verify the child tickets, preserving their distinct acceptance
gates. Retrieve the missing original review if its precise reasoning is needed;
do not fabricate it from this audit. Check the actual U03 resource evidence
before starting SHE-216. Reconcile completion only after integrated browser
evidence is recorded. Leave I3 dispatch-ledger changes with SHE-182 and do not
add `hbl-agent-ready` as a consequence of this triage.
