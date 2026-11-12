# First 100 to 1,000 players: prepared experiment

SHE-68 / HBL-W1-055 · prepared November 12, 2026 · protocol `launch-v1`.
Status: preparation complete; recruitment and spend held. No participant results
have been collected. All thresholds below are proposed decision rules, not forecasts.

## Baseline and ownership

This slice owns this brief and the SHE-68 entry in `implementation-plan.md` only.
It does not alter gameplay, homepage messaging, feedback infrastructure or releases.
Baseline: branch `mini/SHE-68`, source `b963dd353538294cb0fbf5d34d5283fad6e10e68`.
No PR has been created in this session.

The existing [Riverside Bakery journey](BAKERY_JOURNEY.md) already provides the
narrow loop: open a closure, inspect recorded deliveries and shifts, change the
road decision, compare futures, and reopen a share recipe. Reuse
`/world/journeys/bakery.html`; do not build a second onboarding or scenario.
`world/journeys/bakery-page.js` implements the worker, comparison and share flow;
its local best score is device state, not evidence of a unique player or completion.
The page contains no launch click/completion/feedback collector. Existing browser
tests in `test/e2e/bakery-mystery.e2e.js` cover successful and late interventions,
recipe reopen, unsupported recipes and the mobile Case File. Their presence is
not a fresh browser pass.

Prerequisites checked in Linear on November 12:

| Dependency | Observed status | Gate |
| --- | --- | --- |
| [SHE-12 / W1-007](https://linear.app/shel-bernstein/issue/SHE-12) | In Progress | Review actual first-time clarity responses and approve the scoped message below; do not claim a winning variant yet. |
| [SHE-52 / W1-039](https://linear.app/shel-bernstein/issue/SHE-52) | In Review | Verify integrated opt-in, submit, network failure and opt-out evidence before recruitment. Keep its collector under its existing owner. |

The repository design supports bounded synthetic stories, not predictions of real
cities. The older integration-gates section of BAKERY_JOURNEY describes broader
cross-app ambitions; this experiment uses only the implemented standalone story.
Historical release audits do not establish today's production route readiness.

## Audience, channel and invitation

Audience: adults who play city-building games and enjoy explaining supply-chain
failures, initially English-speaking desktop browser users. Exclude professional
team members and prior demo testers from the first-time denominator.
Channel: one moderator-approved playtest thread in one city-building community
chosen by the launch owner before posting. Record community, permission and date
privately. No unsolicited direct messages, scraped addresses, mass cross-posts,
paid targeting or referral rewards. No named community permission is assumed.

Proposed post, subject to SHE-12 clarity review:

> Why did Riverside Bakery close? Change one road decision, compare two futures,
> and inspect the delivery records. This is a small synthetic simulation with
> explicit rules, not a prediction about a real city. We are inviting adult
> city-building players to try the browser mystery and optionally tell us what
> was confusing. Reply “invite” if you want one playtest invitation. Feedback and
> measurement are optional; playing requires neither. No account or purchase is
> required for this journey.

Send the invite only to people who explicitly request it, once external sending
is authorized. Include the verified application origin plus the route above,
the consent notice below and a separately optional feedback link approved by
SHE-52. Never publish a localhost link or substitute an unverified public URL.
No reminder unless separately requested. No scarcity or guaranteed outcome claim.

Consent notice for the measured pilot:

> May we note whether you open the game, complete the comparison and reopen your
> recipe, using a random playtest code? This is optional. We will keep these notes
> private for 30 days and then keep aggregate counts only. We do not record your
> screen, name, IP address or account in the research notes. You may skip feedback,
> stop at any time, or ask the host to delete your notes using your code. Declining
> measurement does not prevent play. Please avoid personal information in feedback.

The host must explain any platform/server logging separately before consent;
this notice promises only what the research notes control. Never assume server
logs or community identities are anonymous.

## Measurement through completed play

Start with 10 individually consented, facilitated sessions. Use a private local
ledger; no new tracking endpoint is required for this pilot. The facilitator notes
the participant's explicit link activation and observes the game without recording
screens or audio. Do not offer solving instructions before the completion attempt;
mark assisted attempts separately. Off-session openings are unknown, not zero.
Do not infer a click from an invitation sent or a completed session from page load.

Use one random code per consenting participant, separate from any scheduling
contact, and one cohort label per wave (`pilot10`, `wave100`, `wave250`, `wave1000`).
Never put that code or contact information into a public recipe URL. Record:

```text
protocol,cohort,code,consent_date,build_sha,model,seed,invite_sent,
click_observed,start_observed,comparison_observed,replay_observed,
completion_verified,assisted,feedback_submitted,feedback_useful,
failure_category,withdrawn
```

Unknown observations remain blank. Booleans are yes/no only when observed.
The participant may separately submit feedback or explicitly permit the host to
note it. A declined response is not a gameplay failure. Keep no raw free text in
the public repository; private notes may contain a redacted confusing step or
favorite moment, expected behavior and observed behavior. Scheduling contacts are
deleted after the session; restrict research notes to the launch owner and
reviewer, delete row-level notes within 30 days, and honor deletion requests
before publishing aggregates. Suppress public subgroup counts below five.

| Stage | Required evidence |
| --- | --- |
| Invitation | Requested invite delivered, once per code. Report separately from community post reach, which may be unavailable. |
| Click C | Facilitator observes the consenting participant activate the invitation's Play link. A retry counts once. |
| Start S | Baseline journey loads with visible timeline and closure record; load failures remain in C. |
| Comparison | Participant inspects closure evidence and runs a supported road change; a failed/late hypothesis is valid gameplay. |
| Completed G | Participant explains the modeled road → delivery → closure/shift chain, compares baseline and changed outcomes, then opens the generated recipe and sees the same selected future. Host verifies all steps; a prefilled recipe or “Mystery solved” alone is insufficient. |
| Useful feedback U | Voluntary response names a specific confusing step with expected/actual behavior, or a specific favorite moment and why. Classify before seeing aggregate conversion; record unclear responses separately. |

Count each code once per stage per experiment, exclude staff, rehearsals and
withdrawn rows from all reported denominators. Repeated attempts and return visits
are not new players. Preserve errors, assisted completions and unknowns separately.
For the consented measured cohort report C/invites, S/C, G/C (primary), G/S,
feedback/G and U/G, plus U/all submitted feedback and assisted G/G. Feedback from
non-completers is valuable; report it separately. Zero denominator means N/A.
Report raw numerator/denominator and unknown count beside every percentage.
These observational, self-selected cohorts cannot establish causal message lift
or represent all visitors. Unmeasured players are excluded, never called dropouts.

Before waves beyond the facilitated pilot, SHE-52 and the measurement owner must
demonstrate a consented linkage from actual clicks to verified completions or
continue observing sessions manually. A click counter alone cannot clear this
gate. Do not project measured conversion onto anonymous traffic. Reconcile the
ledger after each batch: G ≤ S ≤ C ≤ invited, unique codes, exact build/model/seed,
no completion for an unobserved replay, and separate missing observations.

## Hypotheses, stages and budget

Hypotheses: the scoped promise leads at least 50% of consenting clickers to a
verified completion; at least 20% of completers volunteer useful feedback; at
least 8 of the initial 10 can explain the synthetic rules rather than treating
the result as a real-city prediction. These are operating thresholds, not powered
statistical claims. Keep audience, message, route and protocol fixed within a wave;
any change starts a new labeled cohort and requires a new clarity check.

| Stage | Limit and review | Advance only when |
| --- | --- | --- |
| Rehearsal | Two staff sessions, excluded from player counts | Consent, refusal, failure and replay procedures all work on the exact candidate. |
| Pilot | 10 consenting first-time clickers, up to 7 days | At least 8 explain synthetic limits, 5 complete, and no safety/privacy issue. |
| First 100 | Batches of at most 25 invitations; stop at 100 unique verified completers or 14 days | At least 50 measured clickers, G/C ≥ 50%, U/G ≥ 20%, at least 90% of clicked sessions have known completion status. Review after every batch. |
| Toward 1,000 | Checkpoints at 250, 500 and 1,000 cumulative verified completers; at most 100 invitations per batch | Same gates at each checkpoint, route/capacity and consent checks remain healthy, and launch owner explicitly approves the next stage. Stop after 28 additional days even below target. |

One thousand means completed gameplay, not invites, views, clicks or registrations.
No promised audience size or million-user claim. If observation capacity is
insufficient, reduce recruitment; do not silently weaken the definition.

Spend ceiling: **$0 incremental cash**, no ads, tooling purchases or billing-limit
changes. Human effort ceiling: 8 hours total for preparation, facilitation and
review. Review remaining hours after every batch; stop when exhausted even if
the 100-player milestone is unmet. Reaching 1,000 may need a separately approved
capacity/budget plan and verified instrumentation; this brief grants neither.

Immediately pause invitations on any privacy/consent failure, community objection,
misleading claim, incorrect recipe replay or disagreement with versioned results.
Pause a batch after two observed worker/load/replay failures in 10 consecutive
measured starts. Pause progression if G/C < 50%, U/G < 20% or unknown status > 10%
at a scheduled review; investigate, fix and repeat a small cohort. Do not discard
failed cohorts. Two such unsuccessful cohorts end this experiment. A withdrawal
stops that person's collection immediately. The launch owner owns pause/restart;
an unresolved incident blocks restart and escalation.

## Provenance, readiness and evidence

Pin `bakery-v1`, seed `2911`, baseline and supported intervention month 72–240,
and application SHA per cohort. No random draws occur in this fixture; the seed
identifies its recipe. Retain the exact shared recipe privately with verification
notes when consented. Logistics uses `flowmap-logistics/1`; synthetic geometry,
100-unit flour order, eight-hour scaled shift and permanent closure after three
short deliveries are declared scenario inputs/rules. These are not observed
Houston outcomes, real employment estimates or a 100-future ensemble. Preserve
both successful and too-late interventions without editing model outputs for copy.

Before sending anything, a named launch owner and reviewer must record: SHE-12
clarity evidence, SHE-52 integrated consent/error/opt-out evidence, moderator
permission, exact deployed candidate SHA/origin, public route and recipe smoke,
capacity review, ledger access/deletion check and two excluded rehearsals. All
are pending here. This preparation does not authorize deployment or posting.

Local verification on November 12, 2026:

```sh
bun test test/bakery-journey.test.js test/bakery-scenario.test.js
git diff --check
```

Model/recipe checks: **6 passed, 0 failed, 26 assertions**. They cover deterministic
replay, immutable inputs, delivery arithmetic, early/late changes and rejected
recipes. Whitespace check passed. This documentation-only change adds no UI;
Playwright and screenshots were skipped. No live funnel, participant response,
conversion result, production readiness, deployment, commit or PR is claimed.
Before recruitment, run the existing focused browser journey on the candidate:

```sh
bunx playwright test --config test/time-machine.browser.config.js test/e2e/bakery-mystery.e2e.js
```

After each wave append a private decision record with dates, protocol/build,
counts and unknowns, failures, consent withdrawals, hours/cash consumed,
go/hold/stop decision and owner. Publish only aggregate findings and redacted
themes after privacy review; link the implementation PR when one exists.
