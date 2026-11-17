# Council coalition assembly — ODD

## 1. Purpose and patterns
Teach a single civic trade-off through an explicitly synthetic assembly game.
A winning bloc is an arithmetic game outcome, not a prediction of persuasion,
a public vote or policy effectiveness. [Contract](../../world/coalition/README.md).

## 2. Entities, state and scales
Five fixed synthetic roles: commuters, renters, employers, services, treasury.
Role IDs are scoped to this exercise, not residents. State is an immutable
paired input record, fixed derived positions and a selected ID set. Time is
one authored month12; monetary units follow the existing modeled-currency
council labels. No entity/time mapping to World or a City run is supplied.

## 3. Process and scheduling
Open validates exact pinned source/version, clones and freezes it, evaluates
existing council rules, checks authored expected positions, then clears selection.
Join/remove synchronously replaces the selected set and recomputes the count.
Cancel clears the decision. Reload/reopen has no persisted progress.

## 4. Design concepts
Goals and votes reuse Living City council. No learning, negotiation, stochastic
behavior, social contagion or empirical opinion sensing. Membership is a user
choice; opponents retain disagreement. Synthetic majority assumption: at least
three supporting roles inside the bloc out of five seats wins. Abstention never
reduces the denominator. This threshold affects only this game.

## 5. Initialization
`world/coalition/scenario.js` pins transit-tradeoff.v1 and council-coalition.v1,
seed2911, month12, proposal cost200 and both authored metric records. Seed is
an identifier only, with no draws. Both arms use the same identifiers. The
checkpoint is an immutable toy input record, not a recorded engine checkpoint.

## 6. Input data
All numbers and expected positions are authored synthetic assumptions in the
fixture. No measured observations or external data. Labels and explanatory text
are scripted flavor. Missing source, changed input/version/expected positions or
vote-rule drift yields no result; never fall back to invented outcomes.

## 7. Submodels and invariants
`world/living-city/council.js:evaluateLivingCouncil` supplies metric directions
(shorter commute, lower rent, higher employment, lower overload) and treasury
cost/balance checks. Unchanged/missing metrics hold. `world/coalition/model.js`
checks compatibility, preserves role identity and counts unique selected support.
Invariants: five immutable positions; support+oppose+hold=5; no duplicate seats;
selection cannot alter votes/inputs; threshold3 and denominator5 remain fixed;
invalid/cancelled source has winning=null. Integration and browser tests are
`test/council-coalition.test.js` and `test/e2e/council-coalition.e2e.js`.
