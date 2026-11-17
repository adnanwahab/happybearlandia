# PR #433 — main/sprint conflict resolution

This isolated integration starts from remote sprint
`740f7e31a5815e6c3041e92ed60da97d6f5ab73c` and merges main
`84b2eea90a4c604e707b7c0e4ef5b9b7e1b861a3`. No uncommitted work or the
coordinator's later local Mini Symphony reliability commit is imported. The
sprint contains 1,543 changed files relative to its merge base; main adds 86
changed files relative to that base. This record describes conflict resolution
and bounded integration verification, not a new acceptance audit of every
historical sprint issue. Deployment and release remain separate decisions.

## Resolved overlap

The 23 conflicts preserve both branches' behavior:

- `index.html` keeps main's reviewed housing-demo copy, CTA, disclosure and
  responsive sizing with sprint's accessible rainbow title and curated Surprise
  Me. `routes.html` retains supplemental destinations plus portals/context hints.
- `server.js` retains main's simulation admission, law-behavior route, GitHub
  previews, Detective, operations observatory, survey and release-experiment
  dispatch alongside sprint's Mini Symphony and session-log routes. The duplicate
  player-feedback import/handler is consolidated; public media remains allowlisted.
- `world/render.js` keeps main's bounded weekly-worker lifecycle and survey
  cleanup alongside sprint's plan-choice refresh/custom-effects payload and scene
  context menu. Main's browser lifecycle tests now enter via the actual More
  tools disclosure before the Classic controls.
- Future Machine `scene/index.js` combines main's shared-resource ownership,
  quiet live status, one-time fallback and complete animation/readiness teardown
  with sprint's decorative neighborhood, event-gated divergence burst, family
  follow and aligned curtain. One shared disposal set spans both scenes.
- `ui/household-timeline.js` retains seeded family ranking/names with explicit
  first selection and main's cached change stops, quiet announcement and
  idempotent disposal. `ui/outcome-timeline.js` retains chapters plus synchronized
  explicit household/month selection. Both module READMEs retain both contracts.
- Coordinator tests retain all playback/preview/cancel/retry regressions and
  add missing spotlight/divergence adapter boundaries required by the real
  coordinator. Main's stronger seed/month/version fixtures remain. Directory
  tests recognize both imports while keeping registry/search/favorites assertions.
- `docs/implementation-plan.md` retains both branches' planning entries. The
  seven `docs/launch-2026-11-14/*.md` reports retain main's later integration
  evidence first and the independent earlier sprint audit under an explicit
  historical heading. Earlier status claims do not supersede later source evidence.

Other conflicted tests: `test/server.test.js`,
`test/world-cycle-lifecycle.test.js`, `test/future-machine-coordinator.test.js`,
`test/e2e/approved-demo-responsive.e2e.js`,
`test/e2e/first-interaction-budget.e2e.js`, and
`test/e2e/launch-landing.e2e.js`. No runtime queue/state or generated map data
needed an ours/theirs resolution.

## Model/ODD review

Compared the inventory and all seven elements of `docs/models/population.md`,
`docs/models/legacy.md` and `docs/models/city.md`, with Population's
`MODEL_CARD.md`/`DATA_FORMATS.md`, `world/laws/BEHAVIOR_PLAYBACK.md`, and the
relevant executable paths: `world/sim.js`, Legacy checkpoint/encounter files,
Population model/generator/runtime/checkpoint/resident-rules/encounter/trip
projection paths, City engine/manifest, and law comparison/playback adapters.

The merge changes none of the sprint's `world/sim.js`, `world/population/`,
`world/city/` or `docs/models/` contents. Conflict resolutions affect presentation,
request dispatch and test integration; no new simulation authority, rule,
coefficient, seed, schedule or identity/time mapping is introduced. Population
keeps its minute clock and resident manifest; Legacy keeps its separate clock and
rules; Future Machine remains a projection of Monthly City. Law comparisons are
bounded, same-seed model runs, not compiled legal text or empirical outcomes.
No new code/ODD discrepancy was found in this integration review.

## Verification

Executed against this resolved worktree:

- Combined 53-file Future Machine, server, World lifecycle, law/Civic, activity,
  Mini API, launch and navigation regression: **261 passed, 6 optional browser
  wrappers skipped, 0 failed; 4,216 assertions**.
- Twelve-file plan-choice, repeat-play, resident-rules, Legacy/Population
  checkpoint/replay, law mechanism and visualization regression: **78 passed,
  0 failed; 1,162 assertions**.
- `bun run test:models`: unchanged housing-stock error baseline
  `6572.376443952206` homes and **106/106 City replay cases passed**.
- Chrome landing: **4/4 passed**, including animation/reduced motion/forced
  colors and actual demo navigation at 1440, 390 and 320 pixels. Inspected the
  320px capture. Civic mobile receipt capture also inspected.
- Chrome Civic context/refusal, recorded law editing/playback, chapter and
  Canvas/WebGL curtain cases: **10 passed**. World real-worker repeat,
  failed-worker retry, cancellation and deadline: **4/4 passed** after updating
  the stale disclosure fixture. Final combined run: **14/14 passed in 38.1s**.
- Six-file challenge, preview, admission, observatory, survey and release dispatch
  regression: **39 passed, 2 optional HTTP wrappers skipped, 0 failed; 410 assertions**.
- Startup smoke now matches same-origin route pathnames while retaining query/fragment
  context, follows the reviewed homepage CTA, and verifies normal More tools/Escape
  disclosure in World. Its helper passed **2 tests / 13 assertions**; the actual
  six-route startup suite passed **6/6 in 3.1s**, with no uncaught startup errors.
  This explicitly requested smoke correction is the only additional scope imported
  from the coordinator after the isolated merge began.
- Browser builds: Future Machine **75 modules**; World **403 modules** with
  served `/vendor/*` URLs external; Constitution City **52 modules**. JavaScript
  syntax checks passed for **50 merged JavaScript files**; whitespace checks passed.
  No root lint/typecheck script exists.

The initial sandbox regression could not bind its server; the normal host rerun
passed. The first merged coordinator/directory test run exposed missing adapter
boundaries; those were corrected without dropping assertions. The first weekly
browser fixture tried the hidden Classic summary directly; it now follows the
normal shell disclosure. These failures are not reported as passing evidence.
Test runs overlap; their totals are not a unique test count or complete product
acceptance. No physical-device, calibrated-model, performance-budget, production
parity, release or deployment result is claimed.

New verification PNGs are retained outside the checkout at
`/private/tmp/pr433-evidence`; no new binary evidence is added to this merge.
Existing tracked historical evidence from the source branches remains intact.
