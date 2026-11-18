# One Salary, Seven Days — house-budget.v1

## Purpose and patterns
An independent authored household resource puzzle at `/world/house?budgetPuzzle=1`.
It illustrates constrained spending across seven days, not real affordability or
welfare. No measured observations or empirical validation. Scripted flavor is
labeled separately from computed resource balances.

## Entities, state and scales
One synthetic household; identity `one-salary-seven-days.v1`, rules/model
`house-budget.v1`, matched seed 695 (no random draws). Integer toy credits and
food units, days 1–7. Initial cash 100 (one salary), food 2. State includes ordered
actions, status, reason and frozen daily checkpoints with parent IDs. No mapping
to Population residents, City IDs, clock, savings or experiment storage.

## Process and scheduling
Human commands apply synchronously in order. Purchases check affordability before
subtracting cash or adding food. End day consumes one food; insufficient food
fails without creating food or spending. Day 7 then attempts rent of 40; insufficient
cash fails without charging partial rent. Otherwise success. Earlier completed
days advance by one. Terminal runs reject actions. Cancellation preserves existing
records and declares cancelled, never success/failure. Restart uses identical inputs.

## Design concepts
Fixed constraints and human choices; no autonomous agents, adaptation, learning,
foresight, interaction, stochasticity or inferred causal effects. Observations are
computed balances and a decision calendar. The seven ODD elements are supplied to
make this independent toy mechanism reviewable despite its lack of social agents.

## Initialization
`BUDGET_SCENARIO` in `world/house/budget-puzzle.js` pins all inputs; unsupported or
absent sources reject initialization. No fallback to invented household records.
Page-local only: leaving/reloading loses progress; no durable save/share claim.

## Input data
Authored synthetic prices: groceries cost 12 for 3 food, takeaway 9 for 1 food,
treat 15 for zero food. Treat is deliberately optional. One food/day and day-7
rent 40 are game assumptions, not measured nutrition or market prices.

## Submodels, invariants and replay
Only spending, food consumption and rent rules above. Cash and food never go
negative; no credit, resale, income accrual or hidden needs. Immutable transitions
preserve parents; daily records retain action counts linking exact decisions.
`replayBudget` recomputes from the pinned scenario and ordered actions, then compares
the entire record, including all daily checkpoints. Any missing/altered/version or
seed mismatch yields no verified result. This is local consistency verification,
not authenticated provenance: editing both commands and evidence can create a
new consistent run. No external scientific inference or permanent checkpoint store.

Acceptance paths: `test/budget-puzzle.test.js` and
`test/e2e/budget-puzzle.e2e.js`. Human code-to-description review remains required.
