# Council Coalition Cards v1

From `/world`, expand World controls → Council Coalition Cards. Direct entry:
`/world/coalition/`. Open the pinned transit demo, drag roles into the bloc or
use Join/Remove buttons. Cancel discards local selection; reopen resets it.
No storage, server writes, policy enactment, persuasion or analytics.

`scenario.js` pins an authored synthetic pair of metric inputs, not a monthly
City run, observed people, empirical measurements or engine checkpoint. Seed
2911 and month12 identify both authored arms; no RNG or engine is invoked.
The two metric records are cloned/frozen with the proposal and role positions.
No mapping to the currently rendered World residents or its clock is claimed.

`model.js` reuses `living-city/council.js` goals, units and support/oppose/hold
rules. Hold is displayed as abstain/hold. Three supporting seats **inside the
selected bloc**, out of the fixed five-seat council, win the assembly exercise.
Opponents and abstainers can join but do not count toward three. The threshold
is a synthetic game assumption, not an existing municipal or repository vote
policy. Card movement changes membership only; it cannot persuade anyone.

The demo has three supporters, one opponent (higher rent), one abstainer
(unchanged service overload). The treasurer checks cost and nonnegative balance.
No-source, cancelled and source/rule replay mismatch have no winning result.
v1 accepts only its exact pinned input record and compares recomputed positions
with independently authored expected votes. This catches incompatible source or
vote-rule drift; it does not certify City replay or provide cryptographic proof.
Other source adapters, arbitrary saved-run imports and real council actors are
unsupported. Rendered scripted explanations are separate from input values.

Checks: `bun test test/council-coalition.test.js test/living-city-council.test.js
 test/city-council.test.js`; browser: `bunx playwright test --config
 test/council-coalition.browser.config.js`.
