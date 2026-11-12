# Homepage value proposition clarity test

SHE-12 / HBL-W1-007 · November 12, 2026 · Research preparation only.
Three candidates are ready for first-time readers. No participants have been
tested and no winner is established. Evaluate clarity before changing homepage
code. The prerequisite live baseline, SHE-6 / HBL-W1-001, remains Backlog in
Linear as inspected on this date.

## Current implementation and overlap

Audit baseline: `b963dd353538294cb0fbf5d34d5283fad6e10e68`, branch `mini/SHE-12`.
The working tree was clean before this documentation slice.

- `index.html` introduces “Explore living cities, animated worlds, unusual games,
  and experiments in possible futures.” Its prominent **Play Demo** link already
  opens `/world/future-machine.html?demo=1`, alongside “One City, Two Futures · a
  reproducible housing comparison.” Preserve this existing entry.
- `docs/future-machine.md` describes the synthetic Riverside housing proposal,
  matched baseline and plan, Month 0–120 comparison, and evidence limits.
  `docs/implementation-plan.md` records implemented demo and WHY work. These
  capabilities do not need rebuilding for this issue.
- `test/e2e/two-futures-compatibility.e2e.js` contains the homepage Play Demo
  journey, common initial state and seed 42 assertions, and WHY interaction
  coverage. These are inspected existing tests, not fresh execution evidence.
- `docs/design.md` requires visible model assumptions and bounded causal claims.
  WHY receipts explain recorded model activity; they do not prove real-world
  causality. No `docs/architecture.md` or more specific `AGENTS.md` was found.
- SHE-14 owns the later homepage CTA clarification. This slice proposes copy
  only; it does not implement that issue or change simulation records or seeds.

This is a source audit, not the deployed first-play baseline required by SHE-6.
Coordinator agreement on exclusive implementation ownership and the issue's
dispatch gate remain prerequisites to a later code change. No labels or issue
status were changed here. Proposed research file: this note; the implementation
plan receives only its status entry.

## Three candidates

Present each heading and paragraph with the same **Play Demo** button and the
same adjacent disclaimer: **Synthetic city. Results show what this model does
under its assumptions, not predictions of a real city.**

### A

**Choose a housing policy. See two possible futures. Find out why they differ.**

Compare a simulated city with and without your policy over ten years. Open WHY
to inspect the recorded changes and model assumptions behind the results.

### B

**What could your housing policy change in a city?**

Choose a policy, then compare two simulated futures: one with your change and
one without it. Open WHY to inspect recorded events and the model assumptions
behind each difference.

### C

**Try a housing policy before you debate it.**

Choose a policy and see two futures for a simulated city, with and without your
change. Open WHY to explore the recorded changes and assumptions behind the
model's results.

## First time reader protocol

Proposed small qualitative study: six adults who have never used the product.
Obtain agreement to record anonymous written responses; collect no names,
contact details or recordings. Participants may stop or skip a question.
Do not contact anyone or publish responses without authorization.

Complete and link the SHE-6 live baseline before conducting the sessions. Keep
the tested copy, disclaimer, CTA, text styling and exposure time fixed. Show
plain text cards rather than changing the app or building an experiment system.
Assign one participant each to ABC, BCA, CAB, ACB, CBA and BAC; retain the assigned
order. First exposure is the cleanest comprehension observation; subsequent
cards can benefit from learning. Report those separately.

For each card, allow 15 seconds of reading, hide it, then ask without coaching:

1. What do you think you can do here?
2. What would the two futures represent?
3. What would you expect to find after opening WHY?
4. What would these results tell you about a real city?
5. Which words were unclear, and what would you expect Play Demo to do?

After all cards, ask which was clearest and why. Preserve verbatim responses
before scoring. Do not show scoring criteria or suggest the expected answers.
If a participant needs help, record it and score the unassisted response first.

## Scoring and decision rule

Proposed rubric, fixed before collection: score each dimension 0 or 1, with an
exact supporting quote. Missing or ambiguous answers score 0, with a note.

| Dimension | One point requires |
| --- | --- |
| Action | Understands they choose or change a housing policy |
| Comparison | Identifies the same starting city with and without that change |
| WHY | Expects recorded model events or assumptions explaining the results |
| Limits | Recognizes simulated outcomes are not reliable real-city predictions |

For each candidate, report each dimension as count/actual respondents and total
score out of 4 per respondent. Keep first exposures and later exposures separate;
list skipped responses and assistance. Preference is secondary to comprehension.
Recommend a candidate only after all six sessions, using highest aggregate
comprehension score, then fewest prediction misconceptions, then preference
count. Report order effects and dissenting quotes. If tied or first-exposure
responses contradict the aggregate choice, report inconclusive and test again.
This sample supports a qualitative copy decision, not a conversion lift claim.

## Response record and recommendation

Actual sessions: **0**. Actual responses: **0**. No scores or lift estimates.
Use one row per participant per candidate when real responses arrive:

| Anonymous ID | Order and position | Candidate | Verbatim Q1–Q5 answers | Assistance or skip | Action / comparison / WHY / limits | Preference and reason |
| --- | --- | --- | --- | --- | --- | --- |

Recommendation pending participant evidence. A is a provisional starting
hypothesis because its heading names all three steps directly; this is editorial
judgment, not a tested winner. Do not ship it on that basis.

## Verification and remaining work

Read-only audit commands: `git status --short`, `git branch --show-current`,
`git rev-parse HEAD`, `rg --files -g 'AGENTS.md' -g '*architecture*'`, and
`rg -n -i 'homepage|value proposition|HBL-W1-007|HBL-W1-001|first.time tester' docs test`.
Read `index.html`, `docs/design.md`, the relevant implementation-plan sections,
`docs/future-machine.md`, and the existing compatibility browser tests.
Linear reads: `get_issue(SHE-12)` and `list_issues(query=HBL-W1-001)`.

No runtime code or browser behavior changed. Playwright, screenshots, lint and
runtime tests are not applicable to this research-only slice; package.json has
no lint/typecheck script. No commit or PR was created. No merge or deployment.
Next: finish the live baseline, obtain real tester responses, apply the rubric,
and record an evidence-backed recommendation before the homepage owner codes it.
