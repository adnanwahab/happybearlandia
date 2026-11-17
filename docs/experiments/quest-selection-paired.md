# SHE-253 quest-selection paired experiment — draft

Status: **not preregistered; no experiment runs authorized or performed**.
This document proposes definitions for human review. It is not a record of a
human metric choice. The issue explicitly says: “Do not dispatch. A human picks
the metrics before any run.” No agents were dispatched.

## Question and existing evidence

Does one contextual quest-selection policy improve recorded quest outcomes
relative to uniform random selection on matched seeds in HBL?
The issue cites Yu, Guzdial and Sturtevant (2024), DOI
10.1609/aiide.v20i1.31885, as motivation from FarmQuest. That supplied reference
is not HBL evidence; no replication or player-experience claim is made here.

Inspected baseline: `b963dd35`. `world/living-city/quests.js` exposes five
evidence-backed requests, but only the commute has a playable intervention
ensemble. Its 100 pairs compare transit with no transit, not quest selectors.
`docs/city-seed-replay.md` concerns monthly City replay, not House quest replay.
Neither result satisfies this experiment's replay prerequisite.

`world/house/date-quests.js` has existing quest content, contextual offer scores,
and actual completion/abandonment transitions. Its contract is
`world/house/date-quests-contract.md`. This is a possible test bed, pending human
scope approval; it must not silently substitute date quests for Living City
quests. House and monthly City identities and clocks are distinct.
The House lab controller compares house designs, not quest policies.

## Proposed protocol for review

Before running, a human must select the test bed, approve the following metric
definitions and stop rule, and record their name, date and approval reference
below. Pin a runnable scenario, scripted player version, time horizon, initial
checkpoint generator, eligible candidate rules and director rule. These remain
unresolved prerequisites, not discretionary changes after observing results.

Proposed experimental unit: one seed's complete episode. Use exactly 100 unique
seeds, integers 0 through 99, with every seed run under director, random-A and
random-B on the same pinned source and runtime. Use existing quest content only.
Both random labels execute identical code and identical seed-indexed random
draws; labels must never enter random keys, IDs, decisions or model state. This
strict label-invariance null is distinct from an independent-random-stream
statistical calibration experiment.

Proposed metrics, computed per seed before averaging paired differences:

| Metric | Proposed definition | Missing/boundary handling |
| --- | --- | --- |
| Quest completion rate | Distinct completed accepted quests / distinct accepted quests within the fixed episode | No acceptances: undefined, report count and exclude only this metric's pair; never convert to zero |
| Time to first quest | Simulated minutes from episode start to first accepted quest | No acceptance: right-censored at the fixed horizon; report censor count and compare restricted waiting time `min(wait, horizon)` across all pairs |
| Quests abandoned | Count of distinct accepted quests transitioning to abandoned within the episode | Include explicit and automatic abandonment; active quests at horizon remain unresolved and are separately counted |

“First quest” is ambiguous between offered and accepted; the proposed definition
uses accepted. Human approval must resolve this before execution. Record offered,
accepted, completed, abandoned and unresolved counts as denominator diagnostics.
Deduplicate by persistent episode/quest identity, retain causal evidence IDs, and
collect events during execution: bounded inspector histories are not full logs.

Director proposal for the date test bed: choose the highest existing contextual
offer score, with stable quest-ID tie breaking. Random chooses uniformly from
the exact same eligible candidate set. Do not compare a scored/truncated pool
against a different random pool. Pin candidate construction and selection
separately. Both arms use the same scripted player, acceptance cadence, action
budget and clock; only quest selection changes. No completion or abandonment
may be manufactured by the harness.

## Proposed stop rule and analysis

Stop after all 100 scheduled seeds have been attempted, without interim benefit
checks, optional extensions or replacing inconvenient seeds. Infrastructure,
invariant or replay failures stop acceptance of results; retain failures and
invalidate the batch rather than silently reporting a smaller completed cohort.
After a repair, version the protocol/build and rerun the complete batch. Do not
pool builds. Approval and protocol must exist in a repository commit before the
first batch invocation; retain that commit ID in the run manifest.

For each seed and arm, independently regenerate and replay the complete episode.
Require equality of initial checkpoints, ordered command/event traces and final
checkpoints under pinned versions. Comparing only final metrics is insufficient.
Retain hashes and diagnostic failures. Require random-A and random-B traces and
outcomes to match after removing presentation labels; any difference invalidates
the batch. A zero null difference is a plumbing guard, not proof of model validity.

Report director minus random-A paired mean differences in percentage points for
completion and in minutes/counts for the other metrics. Report baseline and
director means, valid pair counts, exclusions and censor counts. Proposed 95%
interval: percentile paired bootstrap, 10,000 resamples of whole seed pairs with
a separate fixed analysis seed 253; use sorted order-statistic indices
`floor(0.025 * (B - 1))` and `ceil(0.975 * (B - 1))`. Resample the eligible seed
pairs for each metric. With fewer than two valid pairs report no interval and
an insufficient-data status. Report all metrics regardless of direction;
intervals are descriptive and marginal, with no multiplicity-adjusted claim.
Report the same effects/intervals for random-A minus random-B (expected exactly
zero for this label-invariance null).

Archive source and protocol commit IDs, dirty-source rejection, source hashes,
runtime, model/rules/player/policy versions, all seeds and scenario inputs,
initial state hashes, event provenance, replay evidence, per-seed metrics,
analysis version and report together. Keep synthetic assumptions separate from
modeled outcomes and narrative interpretation.

## Human approval record — required before execution

- Approver, date and approval reference: **pending**.
- Approved test bed, scenario, player and horizon: **pending**.
- Approved metrics, denominators and censor handling: **pending**.
- Approved policies, seeds, stop rule and analysis: **pending**.
- Preregistration commit: **pending**.

## Not measured and current result

No paired results, effect estimates, intervals or null results exist for SHE-253.
This draft measures neither fun, player experience, satisfaction, consented human
behavior, long-term retention, new-content quality nor transfer from FarmQuest.
An eventual scripted-player result describes that player and scenario only.
No survey, production-data change, deployment or new quest content is included.

Next: obtain the human choices above, commit the approved protocol, implement
the selected runtime adapter and focused replay/measurement tests, then execute
and publish the paired batch and null evidence. Until then acceptance criteria
for preregistration and experimental results remain open.
