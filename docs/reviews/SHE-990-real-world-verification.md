# SHE-990 real World verification — November 17

Source: fresh `origin/main` c3ec93c5, isolated checkout. Canonical route:
`/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline`.
Native installed Chrome, headless, Metal + WebGPU; actual backend `webgpu`.
No fixture actors, callback replacements, model setters or invented residents.

Real social check: paused at minute360, seed3458994576,1233 synthetic Legacy
residents. People → Carlos Diaz0 → Social… → Talk with Theo Kim442,16m away.
Returned outcome: Theo misunderstood Carlos's joke. Inspector recorded tie0↔442,
with modeled Connection rising from69.3568 to77.3568. This is a modeled outcome,
not a factual observation about people or a promise of positive conversation.
The existing resident-social-menu e2e uses mocked callbacks and alone cannot
establish this integration.

Real controls:19 bounded assertions passed:4× advances to exterior residents;
Find someone outside selects actual resident; Follow + zoom and nonzero human
geometry; Quests, Legends, Search and Time panels open/close; Sound toggles;
Tile view opens/closes; World and More tools expose advanced tools; Laws opens;
Build opens; Activity opens/closes; Overlay changes its actual selector;
speeds1/2/4 affect playback; mobile390×844 People panel fits viewport.
This is not a claim that every button or every advanced tool is verified.

At6:00 all1233 observed residents were idle/waking up, with0 exterior. After
normal4× playback,6:03 People panel reported65 exterior, and31 human instances
had nonzero actual rendered scale under normal density thinning. Find someone
outside selected Rosa Smith412, whose actual body is visible in the close-up
beside her residence. That building-access trip is **not sidewalk acceptance**.
Both completed actual-route runs had0 uncaught JavaScript errors and0 WebGPU
console errors. Desktop and mobile use the same live model, without population
or rules changes. Mobile footer controls remain present through the existing
horizontal navigation CSS override.

Reproduction: start a disposable local app server using `bun --no-env-file run
server.js`, then run `HBL_BROWSER_BASE_URL=http://127.0.0.1:PORT node
test/she990-social.browser-smoke.mjs` and the analogous
`test/she990-controls.browser-smoke.mjs`. Chrome must be installed; these checks
require native WebGPU and do not accept a static-city redirect. Scripts write
external screenshots/JSON to `/private/tmp/she990-main-evidence`. They return
nonzero for assertion failures, control failures or collected JS/GPU errors.
The original successful commands were `node probe-she990.mjs` and
`node probe-she990-controls.mjs`; retained scripts add explicit outcome/ledger
assertions and failure exit status. Syntax checks and retained entry-point reruns pass (see final receipt). No production model, ODD mechanism, UI or deployment change.

Evidence (external, not committed): `desktop-initial.png`, `desktop-social.png`,
`exterior-follow.png`, `mobile-people.png`, `probe.json`, `controls.json` under
`/private/tmp/she990-main-evidence/`. Sidewalk verification exposed the unresolved blocker below; do not interpret
exterior counts or nonzero geometry alone as visible sidewalk people.

## Final acceptance receipt

Retained entry points were run against the isolated normal app: real social
**passed**, including returned outcome, exact selected-actor/target ledger and
+8 social need; controls **19/19 passed**, including a fresh mobile reload.
Both retained runs collected0 JS errors and0 WebGPU console errors.
All three retained scripts pass `node --check`. No browser remains running.

**Visible sidewalk acceptance remains false.** A further normal4× run reached
minute394 (6:34), seed3458994576. Actual synthetic resident Mei Kim77 was walking
to Mensah Noodle Bar, `mapped-sidewalk`, `pathI=3` of54,480.3429m planned trip.
The body mesh exists at nonzero scale1.08 and asset status ready. But the
street-angle capture and final overhead rotation both occluded the body behind
a building; a route label and nonzero mesh do not prove visible pedestrians.
Final overhead screenshot and full route/model/render records are external
`sidewalk-closeup.png` and `sidewalk.json` in the evidence directory.

Model position was[-361.81299,-13.52896] while rendered position was
[-381.08231,-12.13246], approximately19.32m apart. Source lead:
`world/render.js:2422` sets interpolation factor0 while paused; the camera's
Follow target uses that smoothed rendered position (`world/render.js:2440`).
The initial repro incorrectly waited for Follow to reach model coordinates and
timed out; the corrected read-only assertion follows the actual matrix instead.
This establishes an interpolation/occlusion discrepancy, **not proof that the
mapped route intersects a building**. Investigate paused rendering synchronization
and test actual ray occlusion/sidewalk geometry before choosing a product fix.
No model or renderer change is made on this verification branch.

`test/she990-sidewalk-visibility-repro.mjs` retains the bounded normal-route
reproduction, writes `visibilityAccepted:false` and `manualReviewRequired:true`,
and intentionally exits nonzero after capture rather than equating matrix
presence with visual acceptance. Its capture logic was run successfully; the
final acceptance-report/exit wrapper was syntax checked, not rerun to consume
another browser window. A human must inspect the screenshot; this script is a
known-blocker reproduction, not an automatic passing visual regression.

The separate temporal worker observed native GPU errors with its different
browser launch configuration. This receipt describes only these installed Chrome
runs and cannot override that independent failure. No blanket all-buttons or
cross-browser acceptance claim is made. Next action: review the retained source
and unresolved sidewalk discrepancy; preserve strict GPU/error reporting.
