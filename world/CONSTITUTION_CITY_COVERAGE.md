# Constitution → World Diff coverage audit

This audit covers all **100 distinct requested feature lines** in the attached list (99 newline characters). Implemented means a bounded mechanism exists; Partial states the exact narrower behavior. This is not an all-features completion claim.

## Source and model boundaries

- BalancedA is the actual captured Dear Congress policy package:10public proposals, not enacted constitutional text. Onlyh_lots/f_drainage/t_brt have reviewed adapters;7remain unavailable.
- The workspace uses city-systems.1.0.0, a synthetic monthly planning engine. Daily residents, coarse OD transport and rendered geography are distinct systems. No lane-level physics, real-resident prediction, empirical health/safety/happiness forecast or calibrated causal truth is claimed.
- National USD-billions costs and the explicit synthetic local allocation factor are distinct. Delay/compliance/sunset effects apply only to supported mechanisms.
- Exact on-demand states use the frozen manifest/seed/month; no city×month state cache or silent horizon/population reduction. Budget rejection is intentional.

## Every requested feature

| # | Requested feature | Status | Evidence / actual limit |
|---:|---|---|---|
| 1 | Constitution → World Diff | Partial | Three reviewed adapters preserve actual public proposal wording and show potential/recorded scope. Seven Balanced A clauses stay unavailable; no enacted constitutional text is supplied. `constitution-city/{plan,mappings,host,views}.js`. |
| 2 | Before / After Cities | Partial | Synchronized synthetic before/after views use paired regenerated states, not a geographically calibrated current-law twin. `studio.js`, `views.js`. |
| 3 | Policy Time Machine | Implemented (bounded) | Exact selected seed/month regeneration0–360; workload or unevaluated horizons are rejected, never silently reduced. `runtime-core.js`, `runtime.js`. |
| 4 | “What changed?” overlay | Partial | Recorded entity/field deltas and potential scope; no lane geometry or real-resident relocation inference. `analysis.js`, `views.js`. |
| 5 | Law → mechanism → outcome graph | Partial | Recorded events/decisions/resource links plus declared mappings; no invented or empirically identified causal chain. `buildConstitutionExplanationGraph`. |
| 6 | Click any outcome and ask “WHY?” | Partial | Recorded why evidence and unavailable links are inspectable; this is model explanation, not causal proof. `analysis.js`, Studio analysis/Ask panel. |
| 7 | 100/1,000 Possible Cities view | Implemented (bounded) | Explicit100/1000 requested seeds supported subject to visible budgets; dots replay actual frozen manifests on demand. Not1000 simultaneous 3D worlds. `runtime*.js`. |
| 8 | Policy comparison mode | Partial | Current/A/B comparisons implemented. Candidate ranking helper only ranks evaluated results; no untested best discovered alternative. `studio.js`, `rankConstitutionCandidates`. |
| 9 | Automatic policy scorecard | Partial | Recorded housing/jobs/mobility/finance and service proxies. Health, safety, environment/happiness/inequality claims require supported metrics; missing metrics remain unavailable. `analysis.js`. |
| 10 | Neighborhood impact map | Partial | Synthetic district impacts, not precise real block winners/losers. `analysis.js`, `views.js`. |
| 11 | Household impact explorer | Partial | Stable synthetic household diffs and income/rent/savings/burden; no complete household accounts or real-person prediction. `constitutionHouseholdFinances`. |
| 12 | Business impact explorer | Partial | Actual synthetic business rows/demand/cost/viability; missing cash/balance fields are unavailable. `analysis.js`, city businesses pack. |
| 13 | Government budget impact | Implemented (bounded) | Recorded government revenues/operations/capital/interest/debt/maintenance proxies; national source costs separately scaled. City finance pack, `analysis.js`. |
| 14 | Distributional analysis | Partial | Supplied income/geography/tenure dimensions only; unsupported age/occupation distributions are not inferred. `analysis.js`. |
| 15 | Constitution clause dependencies | Partial | Declared mechanism dependencies and shared effects, not constitutional doctrine. `analyzeClauseDependencies`. |
| 16 | Rights constraint engine | Partial | Only explicitly supplied encoded numeric rules; absent rules do not establish rights compliance. `checkConstitutionRights`. |
| 17 | Policy conflict detector | Partial | Declared duplicate/conflicting mappings and recorded constraints; no universal legal contradiction detector. `analyzeClauseDependencies`. |
| 18 | Law expiration / sunset simulation | Partial | Permanent/2/5/10-year legal expiry can be compared. Only attributable entitlements reverse; built assets and sunk cost remain. `runtime-core.js`. |
| 19 | Implementation-delay slider | Implemented (bounded) | Delay0–120months affects supported actual intervention timing. `studio.js`, `applyClausePlan`. |
| 20 | Compliance slider | Partial | Compliance scales only reviewed intervention assumptions; not universal person-level law adoption. `plan.js`, `mappings.js`. |
| 21 | Real pedestrian navigation | Partial | Existing legacy road graph/pathfinding lacks full sidewalk/crossing/entrance/stair topology. Monthly city transport is separate. `sim.js`, city transport pack. |
| 22 | Real vehicle navigation | Deferred | Coarse district road/transit routing is not lane-level intersections/signals/turn rules. |
| 23 | Traffic lights with adaptive timing. | Deferred | No adaptive traffic-signal timing implementation in this workspace. |
| 24 | Pedestrian crossings that respond to signals. | Deferred | No signal-responsive crossing controller. |
| 25 | Traffic congestion emerging from actual trip demand. | Partial | Actual coarse district work-trip demand and bounded link congestion; not microscopic lane traffic. City transport pack. |
| 26 | Rush hour. | Partial | Daily population schedules exist in the separate Living City engine; monthly policy views do not simulate a rush-hour clock. |
| 27 | School commute. | Partial | Separate daily school activity schedules; not coupled to monthly policy-city lane routing. |
| 28 | Lunch-hour movement. | Partial | Separate daily scheduled/need-driven meal activity; not monthly city street animation. |
| 29 | Nightlife activity. | Partial | Daily dining/recreation windows; no modeled nightlife industry/venues in this workspace. |
| 30 | Weekday/weekend behavioral differences. | Partial | Separate population weekday/weekend schedules; monthly model has no hourly behavior clock. |
| 31 | Weather affecting transportation and activity. | Partial | Recorded flood/rate shocks affect construction/utilities/transport access; not comprehensive weather behavior. City environment/construction/transport packs. |
| 32 | Seasonal simulation. | Deferred | No explicit seasonal model/calibration in Constitution City. |
| 33 | Parking supply and parking search behavior. | Partial | Parking price affects coarse road/transit choice; parking supply/search is not implemented. City transport pack. |
| 34 | Public-transit routes with buses/trains physically moving. | Partial | District transit capacity/routes and separate visual traffic exist; no policy-driven physical bus/train timetable here. |
| 35 | Transit crowding. | Partial | Coarse link capacity/denied boarding, not vehicle-level passenger simulation. City transport pack. |
| 36 | Bike lanes and cycling behavior. | Partial | Daily model has bike choice; no lane-level bike infrastructure mechanism in this monthly workspace. |
| 37 | Walkability scoring. | Deferred | No validated walkability score. |
| 38 | Travel-time heatmaps. | Partial | District accessibility/travel metrics and views; no continuous calibrated travel-time surface. |
| 39 | Accessibility maps: “everything reachable in 15 minutes.” | Partial | Coarse accessibility matrix exists; exact15-minute reachable geography is unavailable. |
| 40 | Delivery trucks and logistics traffic. | Deferred | No causal delivery-truck logistics model. |
| 41 | Emergency vehicles. | Partial | Emergency service capacity proxy, not modeled emergency vehicle routes. |
| 42 | Garbage collection. | Deferred | No garbage collection operations model. |
| 43 | Road maintenance / pothole deterioration. | Deferred | No pothole deterioration/repair queue. |
| 44 | Construction closures that reroute traffic. | Partial | Explicit road access/shocks and coarse rerouting; no physical work-zone/lane closure geometry. |
| 45 | Utility networks under streets: water, sewer, power, fiber and storm drainage. | Partial | District power/water/sewer/stormwater capacity/outage projects; no underground fiber/water flow networks. City utilities pack. |
| 46 | Real businesses with balance sheets. | Partial | Synthetic demand/cost/viability rows, not complete audited business balance sheets. Missing accounting remains unavailable. |
| 47 | Business creation and failure. | Implemented (bounded) | Quarterly synthetic business opening/closure with capacity/viability feedback. City businesses pack. |
| 48 | Business revenue based on actual foot traffic. | Partial | District modeled spending/workers/accessibility proxy, not observed pedestrian footfalls. |
| 49 | Rent expenses. | Implemented (bounded) | Commercial rent is a recorded business cost; housing rent is a household expense. City systems. |
| 50 | Employee wages. | Implemented (bounded) | Filled-job wages enter business costs/household income. City jobs/businesses packs. |
| 51 | Inventory. | Deferred | No business inventory ledger in this coupled monthly workspace; separate business model is not silently reused. |
| 52 | Suppliers. | Deferred | No supplier graph in Constitution City. |
| 53 | Customer demand. | Partial | Explicit district spending/demand proxy; not a full consumer-choice market. |
| 54 | Price setting. | Deferred | No endogenous product price-setting system in this workspace. |
| 55 | Competition between nearby businesses. | Partial | District demand sharing/viability, not detailed product/brand competition. |
| 56 | Business reputation. | Deferred | No business reputation dynamics in this engine. |
| 57 | Advertising. | Deferred | No advertising acquisition mechanism here. |
| 58 | Business expansion into additional locations. | Deferred | Openings are not modeled multi-location firm expansion. |
| 59 | Bankruptcy. | Partial | Closure/viability exists; no formal bankruptcy balance-sheet resolution. |
| 60 | Startup creation. | Partial | Quarterly new synthetic businesses; no founder/startup finance lifecycle. |
| 61 | Loans and interest rates. | Partial | Interest affects development/fiscal debt; no individual business loan market. |
| 62 | Commercial real-estate market. | Partial | Commercial rent/open/closed space proxies; no complete commercial property market. |
| 63 | Office occupancy. | Partial | Jobs/building records exist; no calibrated office occupancy/remote-work dynamics. |
| 64 | Remote-work percentage. | Deferred | No remote-work parameter mechanism in this workspace. |
| 65 | Supply-chain disruptions. | Partial | Construction material constraints/shocks exist; no supply-chain firm network. |
| 66 | Household finances | Partial | Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 67 | Job market | Implemented (bounded) | Explicit vacancies, job eligibility, deterministic matching and household wage income. City jobs pack. |
| 68 | Worker skills. | Partial | Occupation eligibility, not a continuous worker skill model. |
| 69 | Education improving skills over time. | Deferred | No education-to-skill accumulation pathway. |
| 70 | Job switching. | Partial | Reassignment/job loss and hiring; no calibrated worker career search. |
| 71 | Unemployment. | Implemented (bounded) | Actual filled/unfilled worker/job allocations drive employment metrics. |
| 72 | Wage negotiation. | Partial | Bounded vacancy/unemployment wage adjustment, not bilateral negotiation. |
| 73 | Commute-vs-wage tradeoffs. | Partial | Commute eligibility/accessibility and wages enter coarse allocation; no full personalized wage–commute utility. |
| 74 | Migration into/out of the city. | Partial | Annual synthetic demographics/migration; no geographic real-resident forecast. |
| 75 | Household formation. | Partial | Coarse annual household changes; no realistic family life-course model. |
| 76 | People moving apartments based on rent/jobs/preferences. | Partial | Explicit unit eligibility/ranked housing search/moves; preferences are bounded illustrative rules. |
| 77 | Housing search. | Implemented (bounded) | Actual listings, budget/bedroom constraints, deterministic simultaneous allocation and rejection reasons. City housing pack. |
| 78 | Landlord behavior. | Partial | Vacancy/lease rent adjustment; no rich strategic landlord model. |
| 79 | Developer behavior. | Partial | Residual feasibility and parcel competition, bounded developer decisions. City development pack. |
| 80 | Property valuation. | Partial | Illustrative residual/parcel valuation; no empirical property appraisal. |
| 81 | Vacancy. | Implemented (bounded) | Recorded housing vacancy and commercial closure proxies; definitions stay separate. |
| 82 | Gentrification/displacement visualization. | Partial | Synthetic moves/unhoused transitions and district deltas; not real gentrification identification. |
| 83 | Construction profitability. | Partial | Explicit financing/cost/value feasibility, not guaranteed realized developer profits. |
| 84 | Zoning effects. | Implemented (bounded) | Reviewedh_lots entitlement adapter changes modeled parcel capacity, not guaranteed completed homes. |
| 85 | Land-value heatmap. | Partial | Parcel/district values exist; no calibrated continuous land-value heatmap. |
| 86 | City health dashboard | Partial | Recorded multi-system scorecard, not a comprehensive health/safety/happiness index. |
| 87 | Automatic anomaly detection | Partial | Recorded model metric changes flagged without invented traffic-death outcomes. `constitutionAnomalies`. |
| 88 | Automatic interesting-event feed | Partial | Filtered recorded events/anomalies; no fabricated interesting-event narratives. |
| 89 | Causal event replay | Partial | Exact selected-month replay and retained event/decision links; not empirically proven causal replay. |
| 90 | Sensitivity map | Partial | Paired contrasts of actually evaluated scenarios; no exhaustive spatial sensitivity search. `evaluateConstitutionSensitivity`. |
| 91 | Uncertainty fog | Partial | Limitations/unsupported effects disclosed; no calibrated spatial uncertainty fog. |
| 92 | Evidence attached directly to parameters | Partial | Actual source URL/time/proposal evidence metadata and explicit mapping assumptions; most coefficients remain synthetic. |
| 93 | Calibration dashboard | Deferred | No historical calibration dataset/fitted policy-city model supplied. |
| 94 | Model accuracy history | Deferred | No independent historical forecast accuracy ledger. |
| 95 | Assumption inspector | Partial | Frozen manifest, mapping details, source metadata and raw recorded analysis are inspectable; not every numeric glyph has a dedicated inspector. |
| 96 | Contradiction detector | Deferred | No independent observed-mobility contradiction detector in this workspace. |
| 97 | Independent model comparison | Deferred | One city-systems model; no independent-model ensemble comparison. |
| 98 | Monte Carlo failure explorer | Partial | Bounded returned seed distributions/failures; no adversarial automatic failure-condition search. |
| 99 | Policy optimizer | Partial | Helper ranks evaluated candidates against explicit constraints; no general policy optimizer or untested cheaper result. |
| 100 | Ask the City | Partial | Grounded deterministic recorded-data question templates; no free-form predictive AI or paid model calls. `askConstitutionCity`. |

## Verification and delivery status

Dear Congress: public-plan/link focused checks passed; public HTTP GET leaves stored DB unchanged; typecheck passed. Read-only GET/api/plan and UI links are local changes only; not deployed. Public response explicitly excludes journals, individual votes and emergent raw sourceText. HBL currently has the captured production source for old deployments without the new GET.

Actual-worker browser checks verified100/1000 completed requested catalogs on a clearly disclosed3-household/1-month synthetic fixture, exact selected-state metrics, budget rejection and cooperative cancellation. Original business-mode /world entry passed with10source clauses, unavailable childcare mapping and exact location handoff. Product paired3D/camera browser case also passed; Coordinating root reports all three integrated browser cases passed, including the actual 360-month replay assertion, plus 38 component tests. Product stopped its duplicate catalog run. Product owns test/e2e/constitution-city.e2e.js; root may refine assertions during coordinated verification. No paid model calls or deployment occurred.

## Secondary 100-feature specification

Each numbered item in the later specification is audited separately. References to the primary table preserve the same limits; no daily-population feature is silently claimed as part of the monthly policy engine.

| # | Requested feature | Status | Evidence / actual limit |
|---:|---|---|---|
| 1 | Constitution → World Diff | Partial | Primary item1: Three reviewed adapters preserve actual public proposal wording and show potential/recorded scope. Seven Balanced A clauses stay unavailable; no enacted constitutional text is supplied. `constitution-city/{plan,mappings,host,views}.js`. |
| 2 | True synchronized Before/After cities | Partial | Primary item2: Synchronized synthetic before/after views use paired regenerated states, not a geographically calibrated current-law twin. `studio.js`, `views.js`. |
| 3 | Law Ripple Animation | Partial | Primary item5: Recorded events/decisions/resource links plus declared mappings; no invented or empirically identified causal chain. `buildConstitutionExplanationGraph`. |
| 4 | Policy Time Machine | Implemented (bounded) | Primary item3: Exact selected seed/month regeneration0–360; workload or unevaluated horizons are rejected, never silently reduced. `runtime-core.js`, `runtime.js`. |
| 5 | Clause Dependency Graph | Partial | Primary item15: Declared mechanism dependencies and shared effects, not constitutional doctrine. `analyzeClauseDependencies`. |
| 6 | Law Geographic Footprint | Partial | Primary item10: Synthetic district impacts, not precise real block winners/losers. `analysis.js`, `views.js`. |
| 7 | Policy Beneficiary Map | Partial | Primary item10: Synthetic district impacts, not precise real block winners/losers. `analysis.js`, `views.js`. |
| 8 | Policy Burden Map | Partial | Primary item14: Supplied income/geography/tenure dimensions only; unsupported age/occupation distributions are not inferred. `analysis.js`. |
| 9 | Rights Constraint Checker | Partial | Primary item16: Only explicitly supplied encoded numeric rules; absent rules do not establish rights compliance. `checkConstitutionRights`. |
| 10 | Conflicting Law Detector | Partial | Primary item17: Declared duplicate/conflicting mappings and recorded constraints; no universal legal contradiction detector. `analyzeClauseDependencies`. |
| 11 | Repeal Simulation | Deferred | No general repeal of an already-enacted policy in the initial city. Current-vs-new-proposal and expiry are not relabeled repeal. |
| 12 | Sunset Clause Simulation | Partial | Primary item18: Permanent/2/5/10-year legal expiry can be compared. Only attributable entitlements reverse; built assets and sunk cost remain. `runtime-core.js`. |
| 13 | Implementation Lag | Implemented (bounded) | Primary item19: Delay0–120months affects supported actual intervention timing. `studio.js`, `applyClausePlan`. |
| 14 | Compliance Model | Partial | Primary item20: Compliance scales only reviewed intervention assumptions; not universal person-level law adoption. `plan.js`, `mappings.js`. |
| 15 | Enforcement Budget Model | Deferred | Compliance is an explicit assumption; no enforcement-budget→adoption mechanism. |
| 16 | Agency Capacity Model | Partial | Permit/construction/fiscal resource constraints can delay supported projects; no general implementing-agency staffing model. |
| 17 | Political Continuity Model | Deferred | No endogenous administrations/elections/political continuity model. |
| 18 | Policy Interaction Matrix | Partial | Primary item17: Declared duplicate/conflicting mappings and recorded constraints; no universal legal contradiction detector. `analyzeClauseDependencies`. |
| 19 | Automatic Amendment Suggestions | Deferred | No automatic legal-amendment text generator. Evaluated-candidate ranking is not amendment discovery. |
| 20 | Policy Version History | Partial | Frozen source/manifest/result exports support separate comparisons, not durable constitutional draft version-control UI. |
| 21 | Sidewalk navigation graph | Partial | Primary item21: Existing legacy road graph/pathfinding lacks full sidewalk/crossing/entrance/stair topology. Monthly city transport is separate. `sim.js`, city transport pack. |
| 22 | Door/entrance routing | Deferred | No mapped building-door/entrance navigation graph. |
| 23 | Crosswalk routing | Partial | Primary item21: Existing legacy road graph/pathfinding lacks full sidewalk/crossing/entrance/stair topology. Monthly city transport is separate. `sim.js`, city transport pack. |
| 24 | Pedestrian traffic lights. | Deferred | Primary item24: No signal-responsive crossing controller. |
| 25 | Car lane graph. | Deferred | Primary item22: Coarse district road/transit routing is not lane-level intersections/signals/turn rules. |
| 26 | Turn lanes and intersection logic. | Deferred | Primary item22: Coarse district road/transit routing is not lane-level intersections/signals/turn rules. |
| 27 | Dynamic traffic lights based on congestion. | Deferred | Primary item23: No adaptive traffic-signal timing implementation in this workspace. |
| 28 | Pedestrian congestion | Partial | Primary item25: Actual coarse district work-trip demand and bounded link congestion; not microscopic lane traffic. City transport pack. |
| 29 | Rush-hour simulation. | Partial | Primary item26: Daily population schedules exist in the separate Living City engine; monthly policy views do not simulate a rush-hour clock. |
| 30 | Traffic jams emerging from actual trips rather than random cars. | Partial | Primary item25: Actual coarse district work-trip demand and bounded link congestion; not microscopic lane traffic. City transport pack. |
| 31 | Parking simulation | Partial | Primary item33: Parking price affects coarse road/transit choice; parking supply/search is not implemented. City transport pack. |
| 32 | Bicycle routing. | Partial | Primary item36: Daily model has bike choice; no lane-level bike infrastructure mechanism in this monthly workspace. |
| 33 | Bike-share stations. | Deferred | No bike-share station inventory/availability model. |
| 34 | Bus routes with actual moving buses. | Partial | Primary item34: District transit capacity/routes and separate visual traffic exist; no policy-driven physical bus/train timetable here. |
| 35 | Subway/train simulation. | Partial | Primary item34: District transit capacity/routes and separate visual traffic exist; no policy-driven physical bus/train timetable here. |
| 36 | Transit transfers. | Deferred | No passenger-level transit transfer network. |
| 37 | Transit crowding. | Partial | Primary item35: Coarse link capacity/denied boarding, not vehicle-level passenger simulation. City transport pack. |
| 38 | Delivery vehicles. | Deferred | Primary item40: No causal delivery-truck logistics model. |
| 39 | Garbage trucks and scheduled collection. | Deferred | Primary item42: No garbage collection operations model. |
| 40 | Emergency vehicles that reroute around traffic. | Partial | Primary item41: Emergency service capacity proxy, not modeled emergency vehicle routes. |
| 41 | Persistent individual lives | Partial | Stable synthetic IDs and deterministic on-demand month replay; bounded detail, not a durable all-resident life database. |
| 42 | Households | Partial | Primary item66: Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 43 | Friend networks. | Deferred | No explicit friendship graph. |
| 44 | Coworker networks. | Deferred | Shared employment exists, not coworker social-network dynamics. |
| 45 | Neighborhood social networks. | Deferred | No explicit neighborhood social graph. |
| 46 | Daily schedules generated from occupation and household constraints. | Partial | Primary item27: Separate daily school activity schedules; not coupled to monthly policy-city lane routing. |
| 47 | Long-term goals | Deferred | Needs/schedules and utility decisions are not a persistent long-term personal-goal planner. |
| 48 | Personal budgets. | Partial | Primary item66: Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 49 | Savings and debt. | Partial | Primary item66: Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 50 | Food spending. | Partial | Primary item66: Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 51 | Transportation spending. | Partial | Primary item66: Income/rent/savings/burden recorded monthly; food/transport/discretionary expense ledger remains incomplete. |
| 52 | Childcare decisions. | Deferred | No childcare decision/price/capacity mechanism; both childcare clauses explicitly unsupported. |
| 53 | Housing search. | Implemented (bounded) | Primary item77: Actual listings, budget/bedroom constraints, deterministic simultaneous allocation and rejection reasons. City housing pack. |
| 54 | Job search. | Implemented (bounded) | Primary item67: Explicit vacancies, job eligibility, deterministic matching and household wage income. City jobs pack. |
| 55 | People relocate between neighborhoods when their circumstances change. | Partial | Primary item76: Explicit unit eligibility/ranked housing search/moves; preferences are bounded illustrative rules. |
| 56 | Real parcel economics | Partial | Primary item80: Illustrative residual/parcel valuation; no empirical property appraisal. |
| 57 | Developers as agents | Partial | Primary item79: Residual feasibility and parcel competition, bounded developer decisions. City development pack. |
| 58 | Landlords as agents. | Partial | Primary item78: Vacancy/lease rent adjustment; no rich strategic landlord model. |
| 59 | Tenant lease expiration. | Implemented (bounded) | Primary item49: Commercial rent is a recorded business cost; housing rent is a household expense. City systems. |
| 60 | Eviction/move-out mechanics. | Partial | Lease turnover, vacancy/unhoused search and recorded moves exist. Legal eviction proceedings and enforcement are not modeled. |
| 61 | Renovation decisions. | Partial | Primary item79: Residual feasibility and parcel competition, bounded developer decisions. City development pack. |
| 62 | Building deterioration. | Partial | Primary item31: Recorded flood/rate shocks affect construction/utilities/transport access; not comprehensive weather behavior. City environment/construction/transport packs. |
| 63 | Maintenance spending. | Implemented (bounded) | Primary item13: Recorded government revenues/operations/capital/interest/debt/maintenance proxies; national source costs separately scaled. City finance pack, `analysis.js`. |
| 64 | Vacancy by actual building. | Implemented (bounded) | Primary item81: Recorded housing vacancy and commercial closure proxies; definitions stay separate. |
| 65 | Property sale transactions. | Deferred | No property sale transaction market in this workspace. |
| 66 | Mortgage simulation. | Deferred | No household mortgage origination/amortization model. |
| 67 | Zoning map overlay. | Partial | Parcel entitlement data and clause-scope highlights exist. A full zoning-use/FAR map overlay is unavailable. |
| 68 | Rezoning simulation | Implemented (bounded) | Primary item84: Reviewedh_lots entitlement adapter changes modeled parcel capacity, not guaranteed completed homes. |
| 69 | Development feasibility overlay | Partial | Developer feasibility calculations exist in the monthly engine. The requested green/red parcel profitability overlay is unavailable. |
| 70 | Displacement visualization | Partial | Primary item82: Synthetic moves/unhoused transitions and district deltas; not real gentrification identification. |
| 71 | Businesses inside the same economy as residents | Partial | Primary item48: District modeled spending/workers/accessibility proxy, not observed pedestrian footfalls. |
| 72 | Multi-location companies | Deferred | No multi-location company ownership/expansion graph. |
| 73 | Real employee hiring. | Implemented (bounded) | Primary item67: Explicit vacancies, job eligibility, deterministic matching and household wage income. City jobs pack. |
| 74 | Employee resignations and turnover. | Partial | Primary item70: Reassignment/job loss and hiring; no calibrated worker career search. |
| 75 | Worker skill matching. | Partial | Primary item68: Occupation eligibility, not a continuous worker skill model. |
| 76 | Wage competition between nearby employers. | Partial | Primary item72: Bounded vacancy/unemployment wage adjustment, not bilateral negotiation. |
| 77 | Supplier network graph. | Deferred | Primary item52: No supplier graph in Constitution City. |
| 78 | Actual supplier businesses existing elsewhere in the city. | Deferred | Primary item52: No supplier graph in Constitution City. |
| 79 | Truck deliveries generated by supply orders. | Deferred | Primary item40: No causal delivery-truck logistics model. |
| 80 | Commercial leases. | Partial | Primary item62: Commercial rent/open/closed space proxies; no complete commercial property market. |
| 81 | Business relocation. | Deferred | Businesses open/close but no explicit relocation choice model. |
| 82 | Business bankruptcy. | Partial | Primary item59: Closure/viability exists; no formal bankruptcy balance-sheet resolution. |
| 83 | Startup formation. | Partial | Primary item60: Quarterly new synthetic businesses; no founder/startup finance lifecycle. |
| 84 | Bank loans to businesses. | Partial | Primary item61: Interest affects development/fiscal debt; no individual business loan market. |
| 85 | Credit risk. | Partial | Primary item61: Interest affects development/fiscal debt; no individual business loan market. |
| 86 | Inventory physically arriving and being consumed. | Deferred | Primary item51: No business inventory ledger in this coupled monthly workspace; separate business model is not silently reused. |
| 87 | Customer foot traffic based on actual pedestrian movement. | Partial | Primary item48: District modeled spending/workers/accessibility proxy, not observed pedestrian footfalls. |
| 88 | Competitors reacting to prices. | Partial | Primary item55: District demand sharing/viability, not detailed product/brand competition. |
| 89 | Advertising changing customer awareness. | Deferred | Primary item57: No advertising acquisition mechanism here. |
| 90 | Regional input-output economy | Partial | Primary item53: Explicit district spending/demand proxy; not a full consumer-choice market. |
| 91 | Infrastructure X-Ray mode | Deferred | No Infrastructure X-Ray UI or underground topology. District utility capacity records are related backend data only, not this feature. |
| 92 | Electricity network simulation | Partial | Primary item45: District power/water/sewer/stormwater capacity/outage projects; no underground fiber/water flow networks. City utilities pack. |
| 93 | Water network simulation. | Partial | Primary item45: District power/water/sewer/stormwater capacity/outage projects; no underground fiber/water flow networks. City utilities pack. |
| 94 | Sewer capacity. | Partial | Primary item45: District power/water/sewer/stormwater capacity/outage projects; no underground fiber/water flow networks. City utilities pack. |
| 95 | Stormwater/drainage network | Partial | Primary item45: District power/water/sewer/stormwater capacity/outage projects; no underground fiber/water flow networks. City utilities pack. |
| 96 | Flood simulation with visible water propagation. | Deferred | No visible water propagation or hydraulic flood simulation. Recorded hazard damage/resilience proxies do not implement water physics. |
| 97 | Road deterioration and potholes. | Deferred | Primary item43: No pothole deterioration/repair queue. |
| 98 | Maintenance backlog | Deferred | No maintenance backlog stock, deterioration-driven escalating repair costs or deferred repair queue. Generic maintenance expense is not a backlog mechanism. |
| 99 | City Nervous System dashboard | Partial | Primary item86: Recorded multi-system scorecard, not a comprehensive health/safety/happiness index. |
| 100 | Ask the World | Partial | Primary item100: Grounded deterministic recorded-data question templates; no free-form predictive AI or paid model calls. `askConstitutionCity`. |

## Public Dear Congress handoff

Local Dear Congress changes are in `src/server/public-plan.ts`/`.test.ts`, `src/client/constitution-city-link.ts`/`.test.ts`, with narrow additions to existing `server.ts` and `App.tsx`. The public GET returns `{schemaVersion,packages,balanced,alternatives,provenance}`. Packages contain only allowlisted public proposal fields; no journal bodies/authors, individual votes, raw emergent sourceText, cost estimates by voter or idea reports. Synthesis uses a detached DB and the same real-only input/options/default budget/current-plan hysteresis as the existing normal synthesis. Existing illustrative scoring and synthetic prior fallbacks are disclosed. No `lastPlan`, `challengerStreak` or snapshot-store write occurs.

The link transports source marker, package ID, valid location, source origin and existing opaque sourceSnapshot when known. It never puts journals, entry IDs or proposal narrative in a URL. It uses the existing configured HBL base URL; changes are not deployed. HBL distinguishes a current captured public package from an exact stored simulation-snapshot handoff and explicitly fails if a requested frozen source is missing/mismatched.

Focused DC checks: public helper/link tests4passed/29assertions including a real isolated GET endpoint and unchanged DB file. Existing Living City link tests also passed in the earlier focused run; final `bun run typecheck` passed. The HTTP test uses an OS-assigned isolated port and deletes its temporary DB.

Additional Product browser evidence: actual paired3D test passed in24.7seconds with6completed worker futures, month12 regenerated metrics exactly matching recorded proposal and paired baseline, two actual canvases, synchronized drag cameras, unsupported clause disclosure, exact seed selection, unevaluated-month rejection and JSON export. Coordinating root subsequently confirmed all three integrated browser cases passed, including the 360-month actual-worker replay, and 38 component tests passed. Product intentionally interrupted its duplicate catalog run after root took final verification. Earlier100/1000 completed catalogs and original-world entry/location checks passed. Product port3144 is closed; user3000/3217 were untouched by Product.

## Editable text route acceptance

`test/e2e/constitution-text.e2e.js` verifies `/visualize-constitution` returns200, exact textarea source survives compilation, rights/powers/institutions/procedures/constraints are explicit candidate groups, and mechanism/parameter/outcome trace fields are supplied. Actual paired workers render OpenStreetMap-derived baseline/amended footprints with synchronized cameras. A second unknown binding remains unmodeled and produces identical terminal metrics to each same-seed current-rule branch. The strengthened browser case passed in10.7seconds, including actual highlighted-building IDs and parcel-to-building stable-ID joins. This does not adjudicate rights or legal authority and does not infer numeric effects from edited prose.

The new constitution-page law library browser case confirms90 supplied records and exact law21 text copied into the editor. Its first supported comparison exposed conflicting frozen-state/context arguments. Root subsequently fixed the city callback to omit the second worldContext and confirmed the prior nine-browser-case suite passed after that fix and the updated law-panel labels. The acceptance assertion remains in `test/e2e/constitution-text.e2e.js`; this earlier failure is resolved. The separate `/world` law panel and editable compiler/paired-world cases also passed.
