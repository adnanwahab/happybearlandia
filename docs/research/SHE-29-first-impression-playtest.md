# SHE-29 five-person first-impression playtest

Status: prepared, not conducted. **0 of 5 sessions observed.** No player findings,
completion rates, or ranked player bugs are available. This packet is a protocol
and empty recording form, not a research result. Planned sprint date: 2026-11-13.

## Baseline and readiness audit — 2026-11-12

Issue: https://linear.app/shel-bernstein/issue/SHE-29/hbl-w1-016-run-a-five-person-first-impression-playtest

Audited branch `mini/SHE-29`, baseline
`b963dd353538294cb0fbf5d34d5283fad6e10e68`. No PR created.
Ownership for this preparation is limited to this new document and the SHE-29
status entry in `docs/implementation-plan.md`; application code is unchanged.
Coordinator confirmation of session ownership and tested build is still pending.

Read `docs/design.md`, the affected implementation-plan sections,
`docs/future-machine.md`, and `docs/BAKERY_JOURNEY.md`. No
`docs/architecture.md` exists in this checkout. The implementation plan explicitly
leaves a five-person playtest as follow-on work. No existing five-player results
were found in repository documentation or the issue attachments.

The normal homepage already links **Play Demo** to
`/world/future-machine.html?demo=1` (`index.html`). Existing demo controller tests
cover pause, resume, replay, and a hold at the supplied recorded divergence.
Existing effect tests cover evidence-backed changes and reduced motion; share
tests cover versioned recipes and deterministic regeneration. The existing
`test/e2e/approved-demo-responsive.e2e.js` exercises the homepage journey, keyboard
controls, Month 0, Month 16, and WHY at 320, 390, and 1440 pixels. These are
automation coverage, not evidence of human comprehension. The bakery mystery is
a separate journey and is not substituted for the homepage demo in this study.

Read-only Linear checks found HBL-W1-010 / SHE-15 **Backlog** and HBL-W1-014 /
SHE-19 **In Review**. The latter depends on SHE-18, also **In Review**. Existing
source overlaps their intended behavior, but their acceptance is not established
by this audit. Keep SHE-29's dispatch gate intact: planner verifies dependencies,
exclusive ownership, and the tested build before moving to Todo/adding readiness.
No issue status or labels were changed.

## Run protocol

1. Have the coordinator confirm prerequisites, an accessible test origin, and the
   exact build SHA. Recruit five people who have never used this application.
   Record only P01–P05 in this repository. Obtain agreement to observation;
   obtain separate consent before any recording. Keep identifying information
   and raw recordings outside the repository in an agreed private location.
2. Moderator preflight: `bun run start` launches the normal application server.
   Verify the origin and homepage before inviting players. Record actual origin,
   build SHA, date, browser, viewport, input/accessibility settings, network, and
   any setup failure. No production deployment is required or authorized.
3. Give each player a fresh browser profile/context at `/`, without saved app
   state or a previously opened replay. Use the same pinned build and entry for
   all five; record deviations. Do not force a renderer, reduced-motion setting,
   scenario, or device unless that is the participant's chosen setup. Capture the
   resulting recipe/model/seed and renderer after the minute, when available.
4. Say only: “You can explore this page for one minute. I'll watch quietly.”
   Start the 60-second timer when the homepage is visible and interactive;
   separately record initial load delay. Do not explain controls, direct them to
   Play Demo, ask them to think aloud, or supply a goal. Include all subsequent
   loading time. If they ask for help, say “Explore as you normally would” and
   log the exchange. Stop if they request it; record a shortened session honestly.
5. Log timestamped clicks, focus moves, pauses, repeated attempts, questions,
   visible errors and navigation. A pause alone does not establish confusion.
   Mark a candidate hesitation as a pause of at least three seconds, repeated
   attempt, or help request; record duration/behavior and the player's later
   explanation separately. This is a protocol convention, not a success metric.
6. At 60 seconds, stop observation and ask, in order: “What was the first thing
   that made sense to you?” “Was there a moment you were unsure what to do?”
   “What do you think this page is showing?” Record exact words. Do not teach or
   correct until those answers are recorded. If nothing made sense, record that.
7. Separate spontaneous statements during the minute from prompted recall.
   Never infer an understanding timestamp from a click. If no spontaneous
   understanding was expressed, its first-minute time remains unknown.

## Five session records — blank, not observations

| Participant | Session state | Actual build/origin/date/setup | First understanding: quote, time or prompted recall | Hesitation evidence and explanation | Evidence reference |
| --- | --- | --- | --- | --- | --- |
| P01 | Not conducted | — | — | — | — |
| P02 | Not conducted | — | — | — | — |
| P03 | Not conducted | — | — | — | — |
| P04 | Not conducted | — | — | — | — |
| P05 | Not conducted | — | — | — | — |

Copy this event form per session. Use “not observed,” “not asked,” or “unknown”
instead of treating absent evidence as success or failure.

| Elapsed seconds / phase | Observed action or exact quote | Visible app state / route | Interpretation, explicitly tentative | Private evidence ID / timestamp |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

Per-session provenance: build SHA; origin; start time/timezone; load delay;
viewport/browser/device; input and accessibility settings; completion duration;
interventions; route at 60 seconds; recipe schema/model version, seed, run ID and
selected month if generated; evidence consent and private reference. Keep the
moderator's interpretations separate from observed behavior and player quotes.

## Synthesis and ranked follow-up bugs — pending observations

After all five sessions, group repeated problems with references to participant
IDs and timestamps. Report counts as n/5 only for questions with five usable
observations; otherwise state the actual denominator and missing sessions.
Five convenience participants cannot establish population rates.

Rank observed blockers first, then major comprehension/control problems, then
minor friction; use recurrence as a tie-breaker and document the reason. For
each candidate, reproduce against the pinned build and search existing issues
before creating a duplicate. Distinguish a participant report from a reproduced
application defect. No bugs have been filed from this preparation.

| Rank | Observed problem | Participant evidence | Reproduction / expected vs actual | Severity and reason | Existing or new issue URL |
| --- | --- | --- | --- | --- | --- |
| Pending | No participant evidence collected | — | — | — | — |

The model uses synthetic City state and schematic geography. The default recipe
in `world/future-machine/contracts.js` pins `future-machine.v1`, the imported City
model version, seed 42, 30 households, 120 months, and a 24-home housing intervention
with illustrative cost 1,000,000 USD. Preserve visible disclaimers. Record the
actual generated recipe rather than assuming defaults. Automated model checks
observed the first mapped physical change at Month 16; that does not show that a
player noticed it or establish a real-world causal effect.

## Verification and remaining work

Executed:

```sh
bun test test/two-futures-demo-controller.test.js test/future-machine-effects.test.js test/future-machine-share.test.js
```

Result: **15 passed, 0 failed, 136 assertions**. Model/effect check reported Month
16 and recorded entity `building-project-policy-1-0`. These are local automated
results, not playtest results. No browser behavior changed; Playwright and new UI
screenshots are inapplicable to this documentation-only preparation. Existing
browser tests were inspected, not rerun. Package scripts define no lint/typecheck.

Remaining: coordinator readiness/build confirmation; five real new players and
an observer; completed session evidence; synthesis and ranked follow-up issues;
final implementation-plan evidence and branch/PR reference. SHE-29 acceptance
criteria for conducting the study remain unmet until those steps are complete.
