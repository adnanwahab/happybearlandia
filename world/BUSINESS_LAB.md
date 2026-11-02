# Business Lab

Open `/world/business.html` or `/business-simulator`. The existing
`/world?business_mode=true` remains the live neighborhood placement view.

## Playable flow

1. Describe a company or choose an example. The local compiler is clearly labeled
   as a deterministic parser, not AI. Configured OpenAI, Claude or Gemini providers
   can propose a full definition using the existing server-side provider adapters.
2. Review/edit assumptions and approve the version. Nothing runs before approval.
3. Plan a day or month: price, quality, inventory purchases, staffing, supplier,
   channel budgets and optional recipe values. The next forecast is visible first.
4. Run the period. The animation plays the pure engine's trace; each customer has
   exactly one logged outcome. Pause/speed/skip affect playback only.
5. Review accrual P&L separately from cash flow, all lost-sale reasons, funnels,
   capacity, reputation, stock and subscription metrics.
6. Run 500 futures in a module Worker. Test a suggestion or three alternatives
   with shared seeds; inspect the Pareto frontier. Inspect/replay any dot, explicitly
   adopt a plan, or enter a future. No alternative is applied automatically.
7. Use the Hub for equipment/location plans and simulated debt/equity financing.
   Edit Business uses propose/review/approve and increments the definition version.
8. Product Editor validates/imports/exports JSON and previews price versus intent.

The active company/plan persist in browser localStorage (`hbl-business-lab.v1`).
Starting/replacing a company or entering a future preserves one previous recovery
snapshot. Replay exports include the state, approved definition, model version,
plan and seed. Futures can be exported with all input snapshots and run seeds.
Browser saves are conveniences, not a multi-user database; clearing browser data
removes them. Never put credentials in content packs.

## Model and experiment runner

`models/business-v1/index.js` is a pure deterministic `simulatePeriod` engine;
`content.js` provides shared archetype/segment/channel/event data. `schema.js`
validates the definition and deep-freezes approved versions. The engine clones
inputs and tracks inventory value, pipeline orders and cash separately. Inventory
is paid on purchase and expensed when sold/spoiled; it is not charged twice.
Services use labor capacity, subscriptions renew/churn under support capacity,
marketplaces use seller capacity and take rate, and stocked products use inventory.

Customers use independent market, event, supplier, arrival and customer streams.
Stand arrivals use per-minute Poisson draws and an afternoon traffic curve; large
monthly counts use a normal approximation to Poisson. Rivals and walking away
compete using utility, with explicit budget and purchase-intent filters. Supplier
failures refund undelivered stock; lead-time orders cannot sell before delivery.
Known next-period forecasts are pinned across future branches; later periods vary.

`futures.js` calls the **same `executeDecisionExperiment` kernel used by housing**
with the `business-v1` model descriptor and a business simulation closure. The
housing HTTP experiment API and its calendar-specific manifest format are unchanged.
Business horizons are explicitly 1–60 days/months, never interpreted as housing
calendar years. Up to 500 futures per plan and four paired plans are supported.
Cancellation terminates the browser Worker without modifying the active company.
Attribution shows conditional frequencies versus other buckets, not causal claims.

`compiler-api.js` is server-only and blocked from static serving. Routes:
`GET /api/business/providers`, `POST /api/business/compile` with
`{text,provider,definition?}`. Uses the existing `OPENAI_API_KEY`/`OPENAI_MODEL`,
`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, or `GEMINI_API_KEY`/`GEMINI_MODEL` settings.
Default is always local. AI returns JSON data, independently validated; one repair
attempt is allowed. Size limits, same-origin POSTs, rate limits and timeouts apply.
No credentials, world records or repository context reach the client/provider.

## Deliberate simplifications

This implements the core v1 loop and simplified adapters, not every roadmap item:

- One active product/site, one archetype; no hybrid weights, SKU cannibalization,
  multi-site chain operations, research tree, scenario/career scoring or specialist
  staff assignments. Location tiers are abstract traffic/rent multipliers.
- Per-period stock decay rather than per-input hourly batch aging. Recipe ideals
  use a shared default; weather is synthetic and no real economic benchmarks exist.
- Marketplace, manufacturing, media and project businesses use generic capacity
  adapters. No detailed sales-cycle pipeline, audience cohorts, or two-sided seller
  churn. Rival AI currently models a discounter and premium competitor, not a follower.
- Channel customer attribution is proportional to modeled visitors. Futures vary
  random draws, not uncertainty ranges on inferred assumptions. Strategy search is
  a four-plan grid, not an optimizer over the entire decision space.
- HQ floors in the Hub are symbolic. The neighborhood consumes the saved approved
  name/price/quality/COGS and simulates resident visits separately; its live sales
  do not alter the Lab ledger/futures. This boundary is stated in the world panel.
- Financing is illustrative; no real money, accounts or payments exist. Cash failure
  respects available modeled credit; credit is not borrowed automatically.
- No production credentials were configured or paid provider requests made in QA.
  Provider validation/repair is tested with injected responses.

## Verification

`bun test test/business-lab.test.js test/business-mode.test.js world/sim-seed.test.js`

Covers approval, validation, deterministic replay, complete customer outcome counts,
stock and cash reconciliation, lead times, finite archetype results, subscription
renewals, credit/financing, cash failure, 500 completed futures, paired seeds, replay,
and server-side compiler validation/repair. Browser QA exercises describe → approve
→ plan → run → review → futures, strategy comparison, versioned edits and save/reload.
