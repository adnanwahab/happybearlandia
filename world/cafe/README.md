# Pop-up Café weekend v1

Normal entry: expand **Pop-up Café Challenge** on `/world/business.html`.
This page-local sandbox never reads or writes Business Lab company storage.
Starting again resets only the café. Cancel retains completed days and prevents
further trading; no success is awarded. Reload discards this session.

`session.js` orchestrates the unchanged aggregate `business-v1` 1.0.0 engine.
It adds no resident agents, economic rules, RNG draws or cross-model mapping.
The pinned authored synthetic source is `weekend-cafe.v1`, seed 42, two daily
periods. Definition defaults come from `createDefinition('local-retail')`;
`test/fixtures/cafe/weekend-v1.json` pins the complete initial state, decisions,
reports and checkpoints against later default drift. These are toy assumptions,
not measured observations. Café/weekend names are scripted flavor.

Supported decisions: stock 0–180 integer cups/day maps to production; price
$0.50–$4/cup maps to price; staff 1–3 integer workers maps to staff. All other
plan fields use model defaults. Hours are disabled because the existing daily
customer schedule is fixed at 480 minute ticks starting 09:00. Staffing changes
capacity and wages, not opening times. No calendar dates/timezone are inferred.

Each click executes exactly one period. The engine calculates arrivals, purchase
reasons, finite inventory, spoilage, capacity, employment, cash and P&L; see
`world/models/business-v1/index.js`. Unmet willing demand is sold-out plus queue
losses, distinct from non-purchases due to budget/preferences/rivals. Stock cash
purchases differ from expensed sold/spoiled inventory. Workforce is aggregate
workers/hours, not individual real employees. Expenses include cogs, spoilage,
rent, wages, marketing and interest; capital purchases remain fixed at zero.

Success at period 2 requires cumulative profit > 0, cash > 0 and no bankruptcy;
otherwise failure. Inputs/checkpoints/reports are recursively frozen. Both
alternatives start from identical source and seed. Full replay rebuilds from the
pinned source and compares all checkpoints/receipts/decisions; missing evidence
or version/state mismatch returns unavailable without a substitute result.
Verification detects inconsistency, not maliciously rewritten self-consistent
records; no public score or imported receipt is trusted.

Checks: `bun test test/cafe-weekend.test.js`; browser navigation:
`bunx playwright test --config test/cafe.browser.config.js`.
