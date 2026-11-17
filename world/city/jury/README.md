# Zoning Jury v1

Open `/world/city-lab.html` and choose **Run pinned jury demo**. This local guide
is independent of saved experiments, imported inventory and the custom form.
No API writes, human votes, testimony, generated text or live observations occur.

`model.js` fixes City seed 42, 120 initial households and 36 monthly steps.
Both arms clone `createCity` and use the unchanged City engine. Housing requests
six homes for illustrative USD 840,000; zoning requests six units of capacity
for USD 20,000 in district d1. No shocks are scheduled. Normal financing,
construction and utility gates still apply. Capacity permission is not delivery.
`demo.json` pins the resulting terminal **metric projections**, not complete world
snapshots, for both choices and their matched baseline. Replay requires exact
record equality and the current City model version. It verifies only these
retained metrics, not complete event histories or full-state equivalence.
The source checkout pins the initializer and rules; a new generator/rule version
requires explicitly reviewing and regenerating the fixture, never fallback data.

Scoring calls the existing `evaluateLivingCouncil` with `cityMetrics` outputs and
selects its existing renters, public service operators and treasurer records.
Lower mean rent supports; higher opposes; unchanged holds. Fewer overloaded
facilities supports; more opposes; unchanged holds. Treasury supports if proposed
cost fits baseline terminal cash and plan terminal cash is nonnegative; otherwise
opposes. This baseline terminal-cash convention is an authored scoring assumption,
not a financing forecast. Final success requires all three supports. Displayed
numbers use the same records as scoring. No rounding enters scoring.

The housing demo earns two supports and one hold. The zoning demo earns one
support and two holds. Neither achieves unanimous success. This intentionally
shows that delivering/authorizing housing and satisfying all preferences differ;
no alternative outcome is invented to make a player win. The all-support test
is explicitly an isolated synthetic scoring fixture, not an executed City run.
A later slice could offer further supported packages; this slice makes no claim
of a reachable unanimous outcome using the two authored choices.

Metrics and preferences are synthetic. Mean rent is not household welfare;
overload counts omit service quality and unequal access; treasury cash omits
broader welfare and long-term risk. One seed supplies no uncertainty interval.
There are no cross-model resident identities or clock conversions. Checkpoint IDs
are scoped to this recipe, arm, seed and month. Frozen input/output records and
independent replay states prevent editing parents. Cancel/revise/clear advances
a generation token and retires evidence; late async work cannot publish a vote.
Missing source, missing metric, wrong seed/month/version and replay mismatch
withhold all votes. No persistent state is changed.

Verification: `bun test test/zoning-jury.test.js test/living-city-council.test.js
 test/city-lab-lifecycle.test.js`; browser navigation/failure/cancel checks:
`bunx playwright test --config test/zoning-jury.browser.config.js`.
