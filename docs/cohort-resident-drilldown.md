# SHE-129: representative resident drill-down readiness

## Observed audit — 2026-11-12

Implementation is blocked by the unavailable SHE-144 cohort authority and
sampling contract. This is a readiness record, not delivery of the interaction.
The isolated checkout is `workspaces/SHE-129`, branch `mini/SHE-129`, starting
commit `b963dd353538294cb0fbf5d34d5283fad6e10e68`; its initial worktree was clean.
This slice owns only this document and its implementation-plan entry.

Read-only Linear inspection of SHE-129 confirms the structured `blockedBy`
relation to [SHE-144](https://linear.app/shel-bernstein/issue/SHE-144).
SHE-144 remains Todo. Its linked [PR #169](https://github.com/adnanwahab/happybearlandia/pull/169)
at head `588f58fdf3a366343bc9daa023cee98dca01a032` is open, draft and unmerged.
The GitHub API reports `mergeable_state: dirty`. Inspection of both changed files
shows only `docs/hierarchical-cohort-spike.md` and `docs/implementation-plan.md`:
there is no cohort engine or sampling API to consume. That readiness document
also records missing prerequisite oracle source and runner work. These are
observations of the inspected revisions, not permanent tracker guarantees.

Overlap audit: GitHub cohort PR search returned #169 and the existing SHE-141
count-contract PR #34. Linear dependency search also identifies SHE-162's stable
zoom interaction and SHE-151's architecture comparison. Do not take ownership of
their camera behavior, benchmark interfaces or the SHE-144 engine. Search results
alone do not establish exclusive ownership of all remote work.

The local `world/population/model.js` already computes income-bin aggregates
from individually stored synthetic residents. `world/population/intelligence-view.js`
displays these aggregates as JSON and separately inspects existing person IDs.
`world/population/visible-sample.js` selects render records. Neither is the
hierarchical census cohort authority described by SHE-144. The Population model
card explicitly distinguishes full-state aggregates from visible render samples.
Reusing a persistent Population person ID as an identity for an unsimulated
cohort member would conflate these state authorities.

## Next integrated slice

Prerequisite: make the reviewed SHE-144 source and its versioned inspection
contract available in this checkout, then audit its actual tests and entry point.
Do not reconstruct that contract from the issue description or copy the
dependency's implementation into this feature.

1. Connect a selectable cohort row in the supported census/cohort view to a
   bounded representative panel using the existing adapter. Keep the source
   cohort, run, model/rules versions, tick, seed and sampling version together.
2. Show sample count, represented cohort population, weight definition/units,
   and each sample's weight. State explicitly that generated lives are synthetic
   representatives without persistent identity or recorded personal history.
   Separate generated attributes from observed inputs and retained model events.
3. Use the adapter's deterministic sample key. Selection, ordering, closing and
   reopening must not mutate authoritative state or consume simulation RNG.
   Define tick changes and sample-count changes using the actual adapter contract;
   never promise the same life across changed model/time inputs without support.
4. Handle empty cohorts, missing snapshots, invalid requests and incompatible
   versions explicitly. Do not silently substitute a nearby cohort or person.

Acceptance evidence required: identical versioned inputs reproduce identical
samples after reopening and checkpoint reload; inspection order and repeated
inspection leave authoritative state unchanged; matched inspected/uninspected
runs agree; counts and weights satisfy the adapter's mass semantics. Add focused
integration tests through the real view and a browser smoke check for select,
close, reopen, weighting labels and unavailable data. Test changed seeds/ticks,
empty cohorts and bounds without claiming empirical representativeness.

No application code changed and no functional acceptance criteria were verified.
Documentation verification is `git diff --check`; browser tests are inapplicable
to this slice. Root package scripts provide no lint or type-check command.
The shell GitHub CLI could not connect; connected GitHub reads succeeded.
No remote messages, issue updates, dispatch, merge or deployment were performed.
