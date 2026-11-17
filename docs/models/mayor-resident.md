# Mayor and Resident — mayor-resident.1.0.0

## 1. Purpose and patterns

An authored, synthetic two-player budget exercise at `/world/challenges.html`.
It demonstrates asymmetric permissions and a matched policy comparison. It has
no empirical target or calibration, and does not establish real policy effects.

## 2. Entities, state and scales

One independent household, `exercise-household-1`; illustrative monthly USD.
Checkpoint month 0: income 4000, rent 1800, expenses 1800, savings 2400, seed 42.
These are pinned authored assumptions in `world/mayor-resident/model.js`, not
observations or an imported Rivera/Population identity. Horizon is one month.
Session roles and revisions are collaboration state, not simulation time.

## 3. Process and scheduling

Mayor selects unchanged policy or voucher. Resident selects usual or conserve.
Resident runs only after both choices exist. Server computes control then selected
arm from the same initial checkpoint, seed and strategy, sealing a receipt.
Role switching requires both capabilities and changes no modeled state. No
simulation tick depends on browser rendering, a timer, or network polling.

## 4. Design concepts

No adaptation, learning, interaction, migration or emergence. Human choices are
external inputs. The common expense draw is a deterministic authored disturbance,
not a sampled empirical risk. Target success (monthly balance >=500) is a game
criterion; failure is allowed and does not imply hardship in real households.

## 5. Initialization

Both arms independently start from the complete frozen INPUTS above. Policy and
strategy must be enumerated choices. No client-supplied state, seed or result is
accepted. Missing choices produce unknown outcomes, never zero-filled results.

## 6. Input data

All inputs originate in the versioned source file. No external data or personal
information. Authored voucher is 300 per month, conservancy reduces expenses by
150 without modeled welfare effects. Neither is an existing City intervention.
Changing any formula or coefficient requires a model version bump. A receipt
records inputs, seed, model/rules versions, checkpoint, choices and run revision.
The API retains it in private memory until deletion, expiry or restart.

## 7. Submodels

Common shock = unsigned32(imul(seed,1664525)+1013904223) modulo 101.
Control subsidy =0; selected subsidy =0 or 300. Both use strategy saving =0 or
150. In each arm: rent=1800-subsidy; expenses=1800-strategySaving+shock;
balance=4000-rent-expenses; ending savings=2400+balance; public cost=subsidy.
Delta savings = selected minus control; no rounding or time accumulation.
Narrative UI labels describe these arithmetic results only. Housing supply,
allocation, eligibility, wellbeing, taxes and budget funding are unmodeled.

Code/contract: [model](../../world/mayor-resident/model.js),
[API](../../world/mayor-resident/api.js),
[session rights](../../world/mayor-resident/README.md).
Replay/denial/expiry tests: `test/mayor-resident.test.js`.
