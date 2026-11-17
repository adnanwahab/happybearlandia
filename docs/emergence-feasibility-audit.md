# Emergence feasibility audit — SHE-238

Audit date: 2026-11-12. Source baseline: `b963dd353538294cb0fbf5d34d5283fad6e10e68`.
Issue: [SHE-238](https://linear.app/shel-bernstein/issue/SHE-238/hbl-exp-6-codex-emergence-feasibility-audit-real-state-behind-possible).
Scope: source/test audit and proposed implementation slices; no simulation or UI implementation changes.

## Finding

The current Population/House authority can already produce small human stories through elapsed activities, spending, social encounters, schedules, payroll and business viability. Reuse these mechanisms. The strongest next investment is a bounded, persisted explanation of actual transitions, with exact resident and time links. A general story generator would currently outrun retained evidence and cross-model identity guarantees.

These are synthetic rule-based outcomes, not observations of real people or validated forecasts. A scenario can be deterministic without guaranteeing a dramatic outcome. Initial conditions and interventions may be authored; outcomes must be computed. Display “no qualifying change” when the rules produce none.

## Baseline and boundaries

Read [product design](design.md), [implementation plan](implementation-plan.md), [Population model card](../world/population/MODEL_CARD.md), [data formats](../world/population/DATA_FORMATS.md), source and tests listed below. No `docs/architecture.md` exists at this baseline. The issue names a “paired-experiments doc, experiment 6”; no matching repository document was found by filename. The full Linear issue supplies this audit's requirements.

| Area | Inspected implementation and actual behavior | Boundary for stories |
| --- | --- | --- |
| Agent state | `world/population/model.js`: `createPopulationModel`, `stepPopulation`, `inspectPerson`, `serializePopulation`, `restorePopulation`. Typed person/household arrays, location IDs, needs, schedules, economic and social records share one model. | Visible agents are a bounded sample, not the full population. A seeded profile is an initial assumption, not a recorded life event. |
| Activity/movement | `world/population/behavior.js`: `stepActivities`, `stepPersonNeeds`, destination/mode choices. `walk-command.js`: `applyWalkCommand`; runtime `walkPerson`. Travel consumes time, changes positions and needs, and records arrival. | District/straight-line approximation, not street routing. Renderer poses do not establish physical interaction. |
| Household relationships | `world/house/model.js`: action admission, `recordHouseInterval`; `relationships.js`: `completeHouseConversation`, `inspectHouseRelationships`, `romanceAvailability`. Actual completed attendance changes canonical ties, directed trust/resentment, memories and supported commitments. | Seeded labels such as rivals or crush are not evidence of prior encounters. Romance requires explicit eligible-pair consent. Completion-helper tests alone do not prove UI admission. |
| Employment | `world/population/employment.js` and `economy.js`: actual employer assignments, work/leave intervals, accrued wages, represented payroll, vacancy/budget-constrained recruitment and turnover. | Leave is an assumed spell, not a disease model. Wages and employer costs use different raw/represented units. No automatic transfer to another employer on closure. |
| Business activity | `stepLocalEconomy` calculates district demand, staffing-limited revenue, costs, cash and closure/reopening. | Demand is a district-budget proxy, not individual receipts at a particular café. Reopening uses synthetic new capital. Separate `world/models/business-v1/` is not this economy. |
| Events | `world/population/contracts.js`: `recordEvent`, `recordTrace`, seeded `draw`; household completion records include action IDs and outcomes. | Events are bounded by `maxLogEntries`; traces retain 12/entity and at most 1,024 entities. Not all events contain causal parent IDs; an event counter cannot reconstruct an evicted event. |
| Persistence | runtime `exportCheckpoint`/`restoreCheckpoint`; `world/population/checkpoint.js`; `world/experiments/persistence-api.js`. Typed graph, controls and command cursors retained. House autosessions use revisions; manual parent saves remain immutable. | `population-checkpoint.v1`, Population behavior `1.3.0`, 64 MiB limit. Reject incompatible/oversized states. Saved-state rewind requires an earlier checkpoint; discarded history is not restored by seed. |
| Cross-surface continuity | `world/house/bridge.js` uses actual household and building-location joins. `world/social/continuity.js` scopes characters to world/run/branch/tick. `world/house/economic-adapter.js` validates explicit business-to-household mappings. | Continuity text can be fictional with `simulationEffect:false`. A business budget projection does not itself mutate Population cash. Monthly City, Decision housing and Population clocks/IDs are not interchangeable. |

Normal entry points already include Living World selection and hotspots/traditions panels (`world/population/world-view.js`), employment inspector (`employment-inspector.js`), household risk lens, and House action/profile/Why panels (`world/house/house-ui.js`). Existing wiring is source-observed; this audit does not claim a fresh browser verification.

## Reproduction contract for all ten scenarios

The recipes below are specifications grounded in existing tests, not ten newly executed end-to-end scenario artifacts. Existing tests sometimes set fixture state directly; that is disclosed below and must not become a hidden player action.

For a runnable fixture, pin this source commit plus Population `1.3.0`, all optional subsystem versions in the checkpoint, seed **42**, normalized config, exact synthetic world context, immutable calendar origin, initial minute, fixed step and ordered commands at committed minutes. Use 20–80 raw residents unless noted; record represented population/weight independently. Store explicit resolved person, household, business and place IDs rather than names or current render indices. Persist initial, intervention and terminal checkpoints and selected source records before bounded buffers evict them. A source snapshot plus command history is required for continuation of edited states; a seed alone is insufficient.

Use two independent restores of one initial checkpoint for commands applied at runtime. For config alternatives that require reset, construct matched runs from the same seed/context and record the full config difference; these are not checkpoint forks with identical state if generation depends on that config. Validate actor correspondence before reporting person-level differences. Pause the polling clock; use `runtime.step()` with a fixed step or existing model `stepPopulation({minutes})` in tests. Do not compare 1-minute and 30-minute paths as equivalent: hotspot/social checks and boundary observations can depend on sampling.

For each scenario, repeat A from the same start, restore mid-transition and compare continued model state to uninterrupted A. Compare authoritative state/records, excluding runtime UUIDs and storage timestamps. Reject missing actors, incompatible versions and wrong run/branch links. Capture observational deltas separately from matched-control differences. Any proposed report schema, evidence archive or combined UI below is new work, not an existing API.

Complexity estimates are incremental engineer-days for a reviewable integrated slice, including tests: S = 1–3, M = 4–7. They assume reuse of the common evidence/report work in slice 1; standalone costs are higher.

## Ten deterministic scenarios

### 1. The walk that actually takes time — S

- **Recipe:** seed 42, 20 people, fresh minute 360, 1-minute steps. Resolve an adult at rest; request a destination 400 m along x through `runtime.walkPerson`. Observe 10 minutes; matched control makes no request. Use the same accepted actor ID in both branches.
- **Implementation:** `world/population/walk-command.js:applyWalkCommand`, `behavior.js:stepActivities`, runtime `walkPerson`; existing `world/population/walk-command.test.js` covers a 400 m/10-minute route, halfway position, needs, history and restore.
- **Measure:** committed x/z, elapsed transit minutes, energy, remaining travel, completed trips and `PLAYER_WALK_ARRIVED`. Admission must leave clock/coordinates unchanged. Separate background changes in the control from walking effects.
- **UI:** keep the existing World resident selection and movement control; add a before/arrival receipt linked to that exact resident and checkpoint. Show the straight-line approximation.
- **Missing:** a persisted start-to-arrival explanation; no street navigation upgrade is needed.
- **Regression:** existing route/atomic rejection/child-permission/paused-worker tests; add normal-entry report reopen and a midway save with exactly one arrival record. Never infer arrival from animation.

### 2. Dinner requires ingredients and attendance — S

- **Recipe:** seed 42, household size 4, minute 420, 1-minute steps, two eligible at-home participants and sufficient savings. Admit `cook`, advance its declared 30 minutes, then `sharedDinner` for those actual IDs and its declared duration. Control receives neither action. Inspect availability first; insufficient cash or missing participants is a valid rejection outcome.
- **Implementation:** `world/house/model.js:applyHouseholdAction`, `recordHouseInterval`, `houseNeedRates`; runtime `householdAction`. `test/house-integration.test.js` executes worker cooking and dinner with paid ingredients and elapsed fullness changes.
- **Measure:** ingredient debit (test fixture uses $6/member), prepared servings, cooking/dining person-minutes, participant fullness, meals consumed and canonical social encounter if produced. Do not promise every meal improves friendship.
- **UI:** use House cooking/dining actions and needs panel; add an ingredient → prepared meal → actual attendance receipt, with costs and participant IDs.
- **Missing:** joined receipt and evidence retention. Shared dinner invokes the existing social system; it is not necessarily a `completeHouseConversation` outcome.
- **Regression:** existing insufficient-savings and prepared-dinner tests; add mid-cook reload, no early servings, incomplete participant attendance and interruption without refund or duplicate food/charge.

### 3. Argument, then apology — S

- **Recipe:** seed 42, 24 people/household size 4, minute 360; resolve two available eligible conversation participants. Complete a 30-minute `conversation` with `conversationChoice:'argue'`, then one with `'apologize'`. Control repeats the same topic and durations with ordinary chat. Initial tie and profiles are identical.
- **Implementation:** `model.js:recordHouseInterval` calls `relationships.js:completeHouseConversation`; inspection through `inspectHouseRelationships`. `test/house-relationships.test.js` checks directed trust/resentment, symmetric memories and idempotence.
- **Measure:** per-person directed trust/resentment, pair tension/friendship, action IDs and completed minutes. In the direct completion fixture trust moves 50 → 45 → 50; that is fixture evidence, not a universal player outcome.
- **UI:** reuse House conversation selection and profile; expose the two directed perspectives with exact before/after values and completion records.
- **Missing:** a paired explanation view, not an apology mechanism. An apology reduces modeled tension; it does not guarantee reconciliation of all prior differences.
- **Regression:** existing repeated completion, bad choices, attendance and save/restore tests; add runtime admission through both completed actions and reopen the resulting report.

### 4. A witnessed flirt has a different consequence — M

- **Recipe:** use the explicit three-adult fixture in `test/house-relationships.test.js` (`jealousyFixture`): dating A/observer tie, consenting eligible A/B pair. Complete the same romantic conversation in two branches; only observer presence differs. Freeze both starting checkpoints after arranging locations as synthetic initial conditions. Do not teleport anyone through a player command.
- **Implementation:** `relationships.js:completeHouseConversation` and its witnessed-jealousy path check actual location, distance, travel, adulthood and dating; House model completes attendance.
- **Measure:** observer-directed trust/resentment, tie tension, `witnessed-jealousy` memory and observer ID. Existing fixture yields trust 70 → 62, resentment 10 → 22, tension 10 → 16 while the other directed perspective is unchanged.
- **UI:** profile memory shows who actually witnessed it and when; label the absent observer branch separately. No omniscient dialogue or assumed gossip transmission.
- **Missing:** normal-entry setup through visits/movement and end-to-end witnessing test; existing helper fixture does not prove that journey. No general rumor mechanism was established by this audit.
- **Regression:** retain present/away/traveling/other-location/minor/not-dating/declined tests; add runtime completed attendance, save before completion, consent rejection with no mutation, one witness effect after reload.

### 5. A quiet park attracts encounters — S

- **Recipe:** seed 42, 80 people, synthetic parks `a` at [0,0] and `b` at [30,0]. Start paired copies at minute 720, add benches/greenery/food stalls only to b in treatment through `runtime.improveHotspot`, then observe to 1320 at fixed 30-minute steps. Keep mandatory schedules/weather identical. A null attendance difference is valid.
- **Implementation:** `world/population/hotspots.js`: `hotspotDestination`, `hotspotAppeal`, `improveHotspot`, `advanceHotspotSocial`, `inspectHotspots`; ordinary simulation invokes proximity-checked `populationSocial(...).interact`.
- **Measure:** destination-choice counts separately from actual visits, present visitors, encounter IDs/pairs and tie deltas. Existing test proves improved seeded destination selection; another proves normal visits/encounters. It does not prove every improvement increases all-day attendance.
- **UI:** existing hotspots toolbar/map props and encounter list; add matched visit/encounter timeline with place and resident links.
- **Missing:** paired attendance receipt. Improvements are currently free design interventions; do not invent construction spending or individual café purchases.
- **Regression:** existing duplicate/unknown improvement, travelers excluded, no double conversation per bucket and checkpoint tests; add exact paired terminal replay and closed-hours/no-visitor report.

### 6. Friday music acquires regulars — M

- **Recipe:** seed 42, 80 people, park [0,0]/café [40,0], calendar origin pinned. Start at Friday 17:30, advance two weekly music occurrences with identical fixed 30-minute steps; add `stage` support only in treatment via `configureNeighborhoodTradition`. Use calendar-based Friday, not an assumed absolute day number. Retain both occurrence records promptly.
- **Implementation:** `neighborhood-traditions.js`: `configureNeighborhoodTradition`, `prepareNeighborhoodTraditions`, `recordNeighborhoodTraditions`, `inspectNeighborhoodTraditions`; `model.js` prepares/records actual interval attendance.
- **Measure:** unique attendees, person-minutes, returning regulars, invitation states and actual friend IDs. Do not equate an invitation with attendance or claim new friendships from recurrence alone.
- **UI:** reuse Neighborhood traditions panel and active event props; expose two dated occurrence records and regular IDs.
- **Missing:** retained cross-occurrence report. The three event templates are authored schedules, not spontaneously invented cultural institutions. Current retention: 12 gatherings/192 invitations.
- **Regression:** existing exact boundaries, calendar offsets, travel excluded from attendance, weather block and serialization; add two-occurrence runtime checkpoint continuation, missed invitation and unavailable venue paths. A two-week “more regulars” result remains to be measured, not assumed.

### 7. Paid leave preserves pay during the same absence — S

- **Recipe:** reuse `world/population/employment.test.js` quiet one-worker fixture, seed explicitly 42, calendar day 20759, work randomness/turnover/layoff/hiring disabled. Set the same initial two-day sick spell (`sickUntilDay[0]=2`) in both synthetic starting states; config differs only in paid sick days, 0 versus 10. Advance one 1,440-minute test interval; a player demonstration should use a pinned smaller fixed step and establish its own golden values.
- **Implementation:** `employment.js`: `recordEmploymentInterval`, `consumeEmploymentPay`, `consumeEmployerPayroll`; `behavior.js:householdDecisions` settles once. The test sets firm type to office and offset to zero before stepping.
- **Measure:** worked minutes, paid sick minutes, settled wages, represented payroll, savings/spending reconciliation and unchanged illness spell. Existing test expects zero work in both and 510 paid sick minutes in the entitled branch.
- **UI:** employment inspector plus household payments; show “same modeled absence, different pay entitlement,” not better health.
- **Missing:** a paired fixture/report launcher with disclosed assumptions. No clinical recovery or disease transmission is needed or supported here.
- **Regression:** existing leave/pay-queue/weight/calendar tests; add interval save/restore and normal inspector links, checking that neither employer nor household pays a second time.

### 8. A cash-exhausted employer removes real jobs — M

- **Recipe:** create seed-42 employed-worker fixture with hiring/turnover/layoff disabled. Author a low-cash initial firm state so the existing daily cost equation exhausts cash; retain a funded control with the same staff/demand. Step across settlement then the following work interval. Do not call `open=false` a player closure mechanism: the existing closure-removal test does that only as a fixture.
- **Implementation:** `economy.js:stepLocalEconomy` updates cash and records `BUSINESS_CLOSED`; `employment.js:syncEmploymentEmployers` removes assignments; `behavior.js:householdDecisions` consumes accrued pay. Daily order in `model.js`: finalize work, step economy, settle household.
- **Measure:** firm cash/revenue/cost/open, actual employer/headcount, worker employment, future worked minutes and next-period wages. Preserve already earned wages at closure; unemployment is not necessarily immediate zero household resources because nonwage assumptions remain.
- **UI:** employment inspector links worker to firm and settlement records; proposed explanation links closure to assignment removal and later lost work.
- **Missing:** cash-exhaustion-to-worker-to-payment integrated regression and a supported user-visible firm inspection link. No individual customer ledger or automatic job transfer is established.
- **Regression:** existing closed-employer/no-unbacked-pay test; add endogenous cash crossing, headcount reconciliation, no duplicate closure, accrued wages honored, rehire disabled and replay from before closure. This full cascade is proposed, not verified by the helper test.

### 9. A vacancy only becomes a job when recruitment is funded — S

- **Recipe:** seed 42, 20 initially unemployed people, `hiringRate:.5`, recruitment cost $1,000, matching the employment test fixture. Compare actual firm cash $100,000 versus $0, one daily interval, same district job slots and draw streams. Record firm cash as an authored initial assumption rather than a user API.
- **Implementation:** `economy.js:stepLocalEconomy` uses `employmentVacancy`, `assignEmploymentEmployer` with recruitment; hiring also calls `children.js:parentHiringAvailability`.
- **Measure:** hires, employer assignment, headcount, recruitment charges, remaining vacancy and worked/paid minutes. Existing test obtains funded hires, zero unfunded hires, recruitment cost = hires × $1,000 and no unworked hiring-day wages.
- **UI:** employment inspector explains accepted match or unavailable funded vacancy; show the actual next work interval rather than a celebratory invented salary payment.
- **Missing:** vacancy/recruitment reason exposure and retained first-work follow-up. Job interviews and skill-based hiring are not established by this path.
- **Regression:** existing budget/headcount/pay-queue tests; add worker-level saved first-shift continuation, full-capacity/no-match and caregiver-unavailability cases without promising a specific number of hires.

### 10. A household's shrinking buffer becomes visible — S

- **Recipe:** seed 42, 10 people, pinned daily steps, 14 full daily settlements from minute zero; compare normalized rent configurations with only `rentMultiplier` changed. Select the same household ID and retain each actual payment summary. A run beginning at 06:00 has a partial first day and must not count it as a full observation day.
- **Implementation:** `behavior.js:householdDecisions`, `world/population/money-history.js`, `household-risk.js:compactSettlement`, `analyzeHouseholdRisk`, `modelHouseholdRisk`. Snapshot and renderer join risk by actual household ID.
- **Measure:** opening/closing savings, income, rent/childcare/spending, net daily cashflow, expense coverage, depletion days and risk/trend state. Require seven consecutive reconciled full days for runway; fourteen for trend. Positive cashflow has no depletion estimate, not infinite days.
- **UI:** reuse Households at risk lens and household payments; proposed report names actual drivers and observation window. Display unknown for missing/stale evidence. Do not narrate eviction or a move from a risk flag.
- **Missing:** saved paired household trajectory and source-payment links; no new financial-pressure formula. Direct fixture payments in risk unit tests are synthetic inputs, distinct from model-generated settlement integration.
- **Regression:** existing full-week, gap, partial, duplicate, stale, finite-value and model-restore tests; add matched-rent runtime continuation and actual threshold crossing only if the selected fixture produces one. If housing moves occur, report them from `HOUSEHOLD_MOVED`, including moving cost, rather than assuming they did.

## Three small vertical slices, in dependency order

### Slice 1 — Save and reopen one dinner consequence (3–5 engineer-days)

**Journey:** select a resident through existing World → House bridge, prepare/share dinner through normal controls, open a receipt, reload it and return to the same saved household. Covers scenario 2; prepares reusable evidence handling for 1 and 3.

**Owned scope:** proposed bounded receipt representation and presentation beside existing House panels, using runtime checkpoints and existing world experiment persistence. Reuse action IDs, participant IDs, completed actions and actual payment records. Preserve start/terminal checkpoint references and copy only cited evidence before eviction; show missing records explicitly. No replacement simulation, new cash authority or automatic prose service.

**Prerequisites/decisions:** establish whether the receipt fits the existing versioned save envelope; extend its validator explicitly if necessary, never assume arbitrary fields are accepted. Preserve manual parent saves and autosession revision conflict handling. Define units, evidence cap and retention behavior before implementation.

**Acceptance:** paid ingredients once, no prepared food before completion, only actual attendees receive effects; in-progress reload continues exactly; receipt resolves same run/household/actors/time; no qualifying social change remains a valid result. Reject stale revision and wrong-city saves without altering the original. Unit/worker/SQLite integration plus focused browser smoke from World entry through report reopen. Risks: evidence eviction and payload growth.

### Slice 2 — Explain one employer closure to one resident (4–7 engineer-days)

**Journey:** from an existing resident employment inspector, open a synthetic cash-pressure fixture, observe computed closure, assignment loss and the next recorded household settlement, then inspect the source records. Covers scenario 8, optionally first-work follow-up from 9 after closure works.

**Dependency:** slice 1 receipt and exact checkpoint links. Reuse `stepLocalEconomy`/employment/pay ledgers; author starting cash only in a clearly labeled fixture. Add bounded causal references when the current closure/assignment records do not identify their dependency; do not infer a universal causal graph from coincident timestamps.

**Acceptance:** firm cash actually crosses zero; no jobs remain assigned to a closed firm; earned pay is retained; next-period work/pay reflect actual availability; headcounts and raw/represented payroll reconcile. Mid-boundary restore and matched funded control reproduce. UI explicitly allows nonwage resources and no qualifying closure. Test synthetic fixture, worker continuation, persisted evidence and inspector browser link. Risk: daily settlement ordering can make a plausible but false “instant loss of all income” story.

### Slice 3 — Follow a real encounter after a park improvement (3–5 engineer-days)

**Journey:** use existing hotspots panel to improve a place, observe ordinary destination/travel behavior, select a recorded co-present encounter, inspect both residents and reopen the saved record. Covers scenario 5; weekly regulars from 6 remain follow-on.

**Dependencies:** slice 1 evidence storage and entity links; independent of slice 2 mechanics. Preserve existing free-intervention semantics, mandatory schedules, opening hours, weather and bounded pair selection. UI compares destination choices, presence and encounters as separate measures.

**Acceptance:** admission changes neither time nor location; only actual stationary co-present people can encounter; replay reproduces participants and tie deltas; a no-encounter run has an honest empty state. Restore midway through travel, keep control unchanged, test missing venue/evicted evidence, and run focused browser smoke from hotspot to actual resident record. Risk: weak interventions may legitimately produce no change; never tune the displayed result independently of the engine.

## Verification and disposition

This audit changes documentation only. Existing regression results are recorded below after execution. No new scenario-run dataset, calibration, browser verification, deployment, API, or gameplay mechanism is claimed. Proposed scenario goldens and slice acceptance tests remain future work. Existing mechanisms should not be reimplemented.

Executed on this checkout with Bun: **81 passed, 0 failed, 527 assertions, 14.38 seconds** across these ten files:

```sh
bun test world/population/employment.test.js world/population/walk-command.test.js test/population-hotspots.test.js test/neighborhood-traditions.test.js test/house-relationships.test.js test/household-risk.test.js test/house-integration.test.js test/house-session-persistence.test.js test/household-economic-adapter.test.js test/social-continuity.test.js
```

This includes actual worker commands, midway checkpoint continuation and temporary SQLite close/reopen; it is not a full repository test result. `git diff --check` passed. No lint/type script is defined in the root package; no runtime code changed. Playwright was skipped because this is a documentation audit with no browser behavior changes. Complexity numbers are planning estimates, not measured delivery durations. The next action is slice 1 contract/fixture implementation, with its browser acceptance gate, before expanding story coverage.
