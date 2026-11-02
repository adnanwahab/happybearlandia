# Feature backlog coverage

This audit maps the 198 numbered acceptance tickets in the supplied backlog to the current local implementation. It does not claim 198 polished new features. Existing means retained functionality, New means implementation added in this release, Partial names its practical boundary, and Deferred means unavailable. Scope is the existing HappyBearLandia project, with the existing Dear Congress handoff preserved. No deployment is included.

The connected signature workflow is implemented: failure rule → reviewed fix → matched rerun/previous cloud → selected future → numerical explanation → reviewed timeline fork → bounded plan search → reviewed alternative → stress matrix → decision brief.

## Verification and entry point

Open `/world/decision.html#advanced-studio` (or its Advanced decision tools navigation) and `/world`. Final coordinator regression: 164 selected unit/API checks passed; a subsequently added optimization-audit check also passed. Chromium connected-loop, robustness/mobile and exact future-world handoff tests passed. Firefox and WebKit/Safari were not installed and are untested.

Relevant implementation: `decision/{advanced-studio,intelligence,intelligence-view,exploration,optimization,optimization-api,robustness,guided-tour,demo-fallback}.js`, `models/housing/{fork,counterfactual,causal-registry}.js`, and the existing approval, visualization and trust modules.

Relevant tests: `test/decision-exploration.test.js`, `test/housing-fork.test.js`, `test/decision-intelligence.test.js`, `test/advanced-studio.test.js`, `test/robustness.test.js`, `test/demo-fallback.test.js`, and `test/e2e/{advanced-loop,advanced-reliability,visualization-exploration}.e2e.js`.

Robustness reports restore locally for the exact source fingerprint; they are not attached to a server read-only share across browsers.

Housing 1.2.0 adds monthly records and forks. Frozen 1.0.0 and 1.1.0 implementations remain available. Counterfactuals, uncertainty and scores describe this exploratory model; they are not empirical causal or predictive guarantees.

## Numbered coverage

Acceptance-ticket status counts (not major-feature counts): Existing: 99, New: 68, Partial: 27, Deferred: 4.

| Ticket | Capability | Status | Boundary / implementation note |
| --- | --- | --- | --- |
| 1 | Scenario contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 2 | Experiment contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 3 | Run contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 4 | ExperimentResults contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 5 | Deterministic seed system | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 6 | One experiment runner | Existing | Existing flagship execution path retained; legacy resident/civic models remain separate products. |
| 7 | Web Worker execution pool | Existing | Bounded workers per experiment/job; no claim of an unbounded distributed pool. |
| 8 | Progressive result streaming | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 9 | Experiment cancellation | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 10 | Failed-run isolation | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 11 | Streaming aggregation | Existing | Provisional aggregates over actual available rows; not a dedicated incremental-quantile data structure. |
| 12 | Experiment persistence | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 13 | Run manifest | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 14 | Reproduce Experiment button | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 15 | Housing-v1 model pack | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 16 | Housing parameter registry | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 17 | Housing metric registry | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 18 | Housing event system | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 19 | Construction pipeline model | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 20 | Permitting-delay mechanics | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 21 | Construction-capacity constraint | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 22 | Interest-rate response | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 23 | Migration/population demand | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 24 | Policy-adoption ramp | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 25 | Stress/shock engine | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 26 | Success criteria | New | Implemented in this release; see component/tests below. |
| 27 | Intervention.v1 contract | New | Intervention.v1 wraps the existing allowlisted approval/revision vocabulary. |
| 28 | WorldRevision contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 29 | Revision history | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 30 | Undo / restore revision | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 31 | Simulation-stale detection | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 32 | Visual-only vs simulation-impacting edits | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 33 | Propose Building mode | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 34 | Ghost building placement | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 35 | Building editor | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 36 | Building approval screen | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 37 | BuildingProposal contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 38 | Construction lifecycle | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 39 | Floor-by-floor construction animation | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 40 | Construction cranes / site visuals | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 41 | Construction progress panel | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 42 | Building uses construction capacity | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 43 | Completed building adds housing stock | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 44 | Building public-cost effects | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 45 | Building delay uncertainty | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 46 | Building cost-overrun uncertainty | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 47 | Building construction events | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 48 | Building replay | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 49 | Baseline / Plan A / Plan B / Stress tabs | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 50 | Automatically generated parameter sliders | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 51 | Policy levers vs world assumptions grouping | New | Implemented in this release; see component/tests below. |
| 52 | Scenario duplication | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 53 | Scenario rename/delete/reset | New | Implemented in this release; see component/tests below. |
| 54 | Stress preset chips | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 55 | 100 / 500 / 1,000 run selector | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 56 | Success-criteria editor | New | Simple editor handles one success and one failure rule; imported multi-rule definitions remain supported. |
| 57 | Changed-from-baseline indicators | New | Implemented in this release; see component/tests below. |
| 58 | Uncertainty visualization underneath sliders | New | Implemented in this release; see component/tests below. |
| 59 | ✨ Edit World button | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 60 | Natural-language edit composer | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 61 | WorldEditProposal contract | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 62 | AI provider abstraction | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 63 | OpenAI adapter | Partial | Adapter implemented; real paid-provider call not tested. |
| 64 | Claude/Gemini adapters | Partial | Adapters implemented; real paid-provider calls not tested. |
| 65 | Selection-aware editing | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 66 | Structured AI operations | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 67 | AI assumptions/warnings panel | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 68 | Visual ghost preview before approval | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 69 | Structured diff before approval | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 70 | Approve / Edit / Reject flow | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 71 | AI edit audit history | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 72 | Prompt → BuildingProposal flow | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 73 | Prompt → parameter-change flow | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 74 | Prompt → stress-scenario flow | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 75 | 500-future outcome landscape | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 76 | Progressively appearing future points | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 77 | Named metric axes | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 78 | Outcome coloring | New | Implemented in this release; see component/tests below. |
| 79 | Future hover cards | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 80 | Click-to-select future | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 81 | Success/failure filters | New | Implemented in this release; see component/tests below. |
| 82 | Natural-language future search | Partial | Bounded local numeric comparisons joined by AND plus event phrases; no general language model search. |
| 83 | 500-future grid view | New | Implemented in this release; see component/tests below. |
| 84 | Density contours | New | Calculated binned Gaussian density contours. |
| 85 | Previous-experiment ghost cloud | New | Implemented in this release; see component/tests below. |
| 86 | Before/after metric delta strip | New | Implemented in this release; see component/tests below. |
| 87 | Scenario overlays | Partial | Scenario cloud overlays; no full simultaneous side-by-side city scenes. |
| 88 | Lasso selection | New | Implemented in this release; see component/tests below. |
| 89 | Failure clustering | Partial | Overlapping supported condition groups; no independent unsupervised cluster model. |
| 90 | Failure-rule mining | New | Implemented in this release; see component/tests below. |
| 91 | Lift calculation | New | Implemented in this release; see component/tests below. |
| 92 | Failure-support counts | New | Implemented in this release; see component/tests below. |
| 93 | Success-pattern analysis | New | Implemented in this release; see component/tests below. |
| 94 | Sensitivity tornado chart | New | Implemented in this release; see component/tests below. |
| 95 | Partial-dependence chart | Partial | Real bounded numerical PDP reruns and grid/table; dedicated plotted PDP chart deferred. |
| 96 | Variance decomposition | Deferred | No valid balanced factorial/Sobol design implemented; arbitrary ensemble variance is not labeled decomposition. |
| 97 | TEST THIS FIX button | New | Implemented in this release; see component/tests below. |
| 98 | Convert a failure rule into a proposed intervention | New | Implemented in this release; see component/tests below. |
| 99 | Approve fix before rerun | New | Implemented in this release; see component/tests below. |
| 100 | Before/after experiment comparison | New | Implemented in this release; see component/tests below. |
| 101 | Low-confidence × high-impact warnings | New | Implemented in this release; see component/tests below. |
| 102 | Causal X-Ray mode | New | Implemented in this release; see component/tests below. |
| 103 | Interactive causal graph | New | Implemented in this release; see component/tests below. |
| 104 | Event → equation linkage | New | Implemented in this release; see component/tests below. |
| 105 | One-at-a-time counterfactual attribution | New | Matched one-at-a-time model interventions; effects need not add and are not empirical causal proof. |
| 106 | Top-five reasons for a selected future | New | Implemented in this release; see component/tests below. |
| 107 | Ripple-effect visualization | Partial | Equation graph and linked mechanisms; no animated causal ripple simulation. |
| 108 | “Why did this happen?” natural-language query | Partial | Deterministic supported why query, backed by events and executed numerical diagnostics. |
| 109 | “What changed between these futures?” query | Partial | Deterministic comparison of selected stored futures; no general freeform explanation. |
| 110 | ENTER FUTURE button | New | Implemented in this release; see component/tests below. |
| 111 | Multiverse → city camera transition | Partial | Physical view navigation and smooth scrolling; no cinematic blended camera flight. |
| 112 | City → multiverse return transition | Partial | Return navigation; no cinematic camera flight. |
| 113 | On-demand deterministic future replay | Partial | Stored exact-run replay plus explicit numerical reproduction; no serialized checkpoint service. |
| 114 | 10-year timeline scrubber | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 115 | Timeline event markers | New | Implemented in this release; see component/tests below. |
| 116 | Metric charts synchronized with timeline | New | Implemented in this release; see component/tests below. |
| 117 | Housing supply reflected in buildings | Partial | Illustrative surrounding stock-to-height mapping; project units come from stored model states. |
| 118 | Construction sites reflected with cranes | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 119 | Vacancy represented visually | Partial | Illustrative vacancy-to-shade mapping; no measured parcel-level vacancy model. |
| 120 | Selected-building inspector | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 121 | Best / Median / Worst future shortcuts | New | Implemented in this release; see component/tests below. |
| 122 | Compare selected future with scenario median | New | Implemented in this release; see component/tests below. |
| 123 | FORK FROM HERE button | New | Fork review is pure; separate approval required before saving/simulating. |
| 124 | TimelineFork contract | New | Implemented in this release; see component/tests below. |
| 125 | Branch at a selected year | New | Completed-month branch; operations start the following month. |
| 126 | Apply parameter intervention after branch | New | Initial stock/income/rent rewrites rejected. |
| 127 | Apply building intervention after branch | New | Approved new buildings and forward cancellation; existing redesign/moves and completed-stock deletion rejected. |
| 128 | Original vs fork side-by-side timeline | New | Implemented in this release; see component/tests below. |
| 129 | Original vs fork metric deltas | New | Implemented in this release; see component/tests below. |
| 130 | Shared pre-fork history | New | Implemented in this release; see component/tests below. |
| 131 | Deterministic post-fork replay | Partial | Deterministic replay from original initial state through shared prefix; serialized checkpoints/nested forks unavailable. |
| 132 | Promote successful fork into a scenario | New | Promotion creates a proposed new scenario requiring approval. |
| 133 | Recession preset | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 134 | Inflation shock | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 135 | Interest-rate shock | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 136 | Population boom | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 137 | Construction shortage | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 138 | Implementation delay | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 139 | Stress-test sequence / boss battle UI | New | Implemented in this release; see component/tests below. |
| 140 | Plan × stress-test matrix | New | Implemented in this release; see component/tests below. |
| 141 | Robustness score | New | Explicit chosen criterion and eligible-row denominator; not predictive reliability. |
| 142 | Remaining vulnerability summary | New | Implemented in this release; see component/tests below. |
| 143 | OptimizationJob contract | New | Implemented in this release; see component/tests below. |
| 144 | Select searchable policy levers | New | Implemented in this release; see component/tests below. |
| 145 | Objective/constraint editor | New | Implemented in this release; see component/tests below. |
| 146 | Generate candidate plans | New | Bounded deterministic candidate generation, at most six variants. |
| 147 | Fast 100-run candidate screen | New | 100 paired runs per candidate screen. |
| 148 | Promote promising candidates | New | Implemented in this release; see component/tests below. |
| 149 | 500-run finalist evaluation | New | Up to two finalists evaluated with 500 paired runs. |
| 150 | Pareto filtering | New | Pareto filtering uses feasible evaluated candidates, not a global-optimum claim. |
| 151 | Pareto-front visualization | New | Implemented in this release; see component/tests below. |
| 152 | Candidate-vs-current comparison | New | Implemented in this release; see component/tests below. |
| 153 | Apply candidate as new scenario | New | Implemented in this release; see component/tests below. |
| 154 | Stress-test candidate | New | Reviewed alternative can be selected in the real stress matrix. |
| 155 | Assumption ledger | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 156 | Evidence/source registry | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 157 | Confidence level per assumption | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 158 | Sensitivity rank per assumption | New | Implemented in this release; see component/tests below. |
| 159 | “What should we verify?” view | New | Implemented in this release; see component/tests below. |
| 160 | Model methodology page | Partial | Registry equations, model README and in-app methodology; no separate methodology site. |
| 161 | Known-limitations page | Partial | Model README and in-app limitation sections; no separate limitations site. |
| 162 | Historical backtest | Partial | Uploaded-data cutoff-safe backtest and published retrospective ACS diagnostic; no verified empirical blind default. |
| 163 | Observed vs simulated bands | Partial | Published observed-versus-simulated diagnostic and ranges; not validated forecast bands. |
| 164 | Model calibration report | Partial | Pre-cutoff rent-response grid fitting with candidate RMSE audit for supplied data; no empirical policy-validity claim. |
| 165 | Exploratory / predictive model badge | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 166 | Decision Brief page | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 167 | Bottom-line scenario comparison | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 168 | Median + p10–p90 ranges | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 169 | Main tradeoff statement | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 170 | Top failure modes | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 171 | Top drivers | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 172 | Assumptions-to-verify section | New | Confidence/impact-ranked verification priorities included in the brief. |
| 173 | Limitations section | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 174 | Reproduction manifest in appendix | Partial | Full manifest is downloadable; the print appendix summarizes reproduction rather than embedding every raw record. |
| 175 | Print/PDF stylesheet | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 176 | Share experiment link | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 177 | QR-code share from presentation mode | Deferred | QR share not implemented; read-only experiment links are implemented. |
| 178 | Executive Mode | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 179 | Analyst Mode | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 180 | 90-second guided tour | New | Implemented in this release; see component/tests below. |
| 181 | Pinned demo experiment | New | Versioned pinned saved-results fixture. |
| 182 | Precomputed fallback results | New | Explicit read-only saved fallback; no silent replacement of failed fresh runs. |
| 183 | Smooth construction animation | Partial | Stored monthly/floor state transitions; no continuously interpolated construction physics. |
| 184 | Smooth multiverse camera transitions | Partial | View transitions/smooth scrolling; no cinematic multiverse fly-through. |
| 185 | Fork-timeline animation | Deferred | Original/fork chart and monthly replay implemented; dedicated fork animation deferred. |
| 186 | Stress-event presentation effects | Partial | Stress sequence/status presentation; no cinematic event effects. |
| 187 | Subtle sound design | Deferred | Sound design deferred. |
| 188 | Loading/partial/cancelled/error states | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 189 | Performance dashboard | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 190 | Playwright full-demo E2E test | New | Connected loop verified in Chromium. |
| 191 | Chrome/Safari/Firefox testing | Partial | Chromium tested. Firefox and WebKit/Safari engines not installed here. |
| 192 | Mobile fallback futures grid | New | Implemented in this release; see component/tests below. |
| 193 | Landing page | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 194 | RUN DEMO CTA | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 195 | REQUEST PILOT CTA | Existing | Existing implementation retained; this row is not a claim of newly written functionality. |
| 196 | 2-minute demo recording | New | Paced actual two-minute Playwright workflow recording; assertions/computation retained. |
| 197 | Product analytics events | Partial | Bounded browser-local activity only; no external product analytics. |
| 198 | Pilot-request tracking | Partial | Browser-local pilot brief/activity only; no external CRM or submission. |
