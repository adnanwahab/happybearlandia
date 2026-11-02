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
| 18 | Law expiration / sunset simulation | Partial | Permanent/5/10-year legal expiry can be compared. Only attributable entitlements reverse; built assets and sunk cost remain. `runtime-core.js`. |
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

Connected HBL browser checks and final screenshot evidence are pending module integration. Status rows describe reviewed source mechanisms; they do not assert browser QA has passed before execution. Product owns test/e2e/constitution-city.e2e.js.
