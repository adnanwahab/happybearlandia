# HappyBearLandia implementation plan

## First-run World guidance and feedback (November 11)

Status: **implemented on review branch; automated verification pending**.

This slice improves the existing /world entry point without changing simulation contracts or adding a new simulation authority.

- [x] A first-run coach appears before the 3D world finishes initializing; provides a pinned quick-demo link and three guided experiments (matched weekly plan comparison, storm, 10-year packages), plus inspect-resident.
- [x] World publishes actual, bounded outcome notifications for configured plans, local storm effects, matched weekly well-being, and the existing 10-year package experiment. Playback reports observational mood/activity changes without representing them as policy effects.
- [x] A short narrated first-cycle comparison is available through ?demo=1&quick=1&autoplay=1; the original multi-cycle tour remains intact.
- [x] Advanced plan-year, overlay, seed, source and diagnostic controls are grouped under a native disclosure, preserving IDs and existing functionality.
- [x] Focused Bun and Playwright tests have been added to the core workflow.
- [ ] Confirm the branch CI and real /world browser smoke before merging.
- [ ] Verify performance on the target Mac browser and check that slower devices meet the intended quick-demo duration.

Important limits: the quick reel's model computation may take longer than its caption hold times. In the existing 10-year experience, three plan packages are compared; no unmodeled decade-long no-plan outcome is asserted. On the normal /world page, the classic local storm and weekly comparisons are separate from the default Living Population runtime, so guided actions explicitly switch modes first.

Acceptance path: open /world, inspect the coach before startup completes, select a weekly paired comparison, observe the actual delta in "What changed?", run a local storm, pause/play and inspect the observational mood changes, open the 10-year package report, verify advanced disclosure, reload a minimized guide, and open the short demo via its stable URL. Embed and saved-experiment pages should remain free of the coach.

Verification commands: `bun test test/first-run-guide.test.js` and `bunx playwright test --config test/first-run.browser.config.js`.


## Research Coordinator — November 11–12, 2026

Active 25-hour goal: November 11 09:24:50 through November 12 10:24:50 America/Chicago. Three evidence-backed audits completed. Coordinator implemented bounded scene reliability repairs under the existing feature freeze: missing-snapshot Canvas clearing/recovery, live reduced-motion handling, and graphics-loss camera-target/selection continuity. Focused Chromium 3 passed; actual flagship preservation suite 5 passed, including persisted share/reopen, zero-control, failure recovery, fallback and largest recipe/resource disposal. Scene/backend/Canvas/effects units 32 passed, 1 browser-gated skip. Acceptance, prerequisites, risks and current measured checks are in [the coordinator ledger](research-coordinator.md). Preserve pre-existing pipeline changes. No release or deployment is authorized.

Research follow-up accepted: [matched delay sensitivity](research-sensitivity.md), four seeds × three delays with independent zero controls and intervention repeats; all12cases/3840steps verified with exact inventory/ledger/event reconciliation and source hashes. Added full120-month boundary-seed trace invariance without model changes. Combined research/world-causal tests9passed/1023assertions. Actual City graphics-loss preservation is now included in4passing focused browser checks. Fresh named guided recording passed (54.20s playable); artifact audit2records/1video. Source and evidence references remain in the coordinator ledger; the25-hour goal is still active.

RC06 focused resize/resource preservation verified: two actual browser journeys, 32 scrub/focus updates and three stage lifecycles per WebGL/Canvas backend, stable per-month geometry counters and zero canvases after disposal. RC07 directory repair verified: all31current registry experiences plus the existing overview shortcut; static24-entry fallback, bounded catalog loading, preserved favorites/secondary routes, and a working flagship entry. Six browser checks,15adjacent unit checks and browser bundle pass. These counts are scoped evidence, not a claim of main-only atlas preservation. Ordinary World optional-package readiness is the next investigated slice.

RC08 accepted: ordinary World local presets and real cycle work are available while optional packages load. Late responses preserve selected local/cycle packages and busy controls; remote labels/amendments are source-scoped. Frozen loading order is retained. Saved remote policy options, configured note and year restore without policy reapplication or checkpoint mutation. Final6browserchecks pass;27readiness/controller/receipt units and12persistence units pass; existingquickdemo/recovery/touch2browserchecks pass. Browser bundle338modules passes. Next investigated slice is independent model-definition disclosure on renderer module-import failure.

[Product design](design.md) defines the target experience. [Engineering instructions](../AGENTS.md) describe how to plan, implement, and verify changes. Keep this plan current with task status, dependencies, acceptance evidence, and commit or PR references when available.

## Future Split Theater

Sprint 3 compares two histories from the same synthetic Riverside City checkpoint.
Both branches share the City model, scenario version, seed, starting month and horizon.
Future B receives one catalog policy. A no-policy run provides an identical control.
The City clock and model entity IDs drive every view.

| Status | Slice | Acceptance |
| --- | --- | --- |
| Verified | Paired run and normalized entity differences | Deterministically replay a versioned recipe. Verify identical starting states, actual route and project differences, stable identity, missing measurements, and no-policy equality. |
| Verified | Synchronized schematic and evidence | Render one matched month in side-by-side, wipe and A/B views. Highlight actual added, modified and removed entities and let a visitor inspect the compared state and history. Show first observed divergence and metric denominators. |
| Verified | Homepage entry and browser verification | Open the theater through the normal server, change comparison modes, inspect an entity, reload the selected month and verify the narrow viewport. |

The schematic maps district and City entity IDs to fixed screen positions. Geographic geometry,
World and House identities, and causal links require separate verified mappings. The first
divergence refers to the first difference observed in the compared fields and metrics.

The default seed 2911 compares 12 months from City month 2. Capital spending first
differs at month 4, the transit project enters the modeled inventory at month 5,
and Riverside-to-Center transit capacity rises from 1 to 9 in Future B at month 12.
A bundled recipe stores the model, scenario, settings and selected month in the URL.
The tested public-housing run shows its stalled project and does not create a building.

Local acceptance passed with 21 Bun tests across six suites and three Chrome journeys.
The browser checks covered the homepage entry, playback, month synchronization, pointer
wipe, A/B switch, exact route values and history, refresh, an invalid link, the
390-pixel no-policy view, and added/removed markers using an explicit schematic fixture.

## Playable Life vertical slice

Source is the “15 new features I'd add next” emerging civilization proposal. Start with “Live a Day as Anyone” on the shared Living World and House Simulator Population authority. Use the selected resident's existing identity and keep the current clock. The available work and travel activities are a household chore and the trip home. The follow-up uses 30 modeled days.

| Status | Task | Dependencies and acceptance |
| --- | --- | --- |
| Implemented | Open the selected resident from Living World | Save or resolve the starting Population checkpoint. Open House with the same experiment, household, and resident IDs. Reject a missing or mismatched resident and preserve ordinary House entry points. |
| Implemented | Run a 24-hour playable window | Record starting and ending ticks and show the resident's current state. Route chore, travel home, talk, plant purchase, and rest through existing runtime commands. Verify an unavailable action can be declined and the user can continue the day. |
| Implemented | Hand off to the simulation for 30 modeled days | Close the direct-command window at the exact day boundary. Advance with existing scheduler and household observation behavior. Keep the interface responsive and resume an interrupted advance from the latest committed minute. |
| Implemented | Save and reopen the follow-up | Persist a child checkpoint with resident identity, accepted actions, available events and decision traces, and the start/follow-up observations. Reload the report and open both World checkpoints. Verify the starting checkpoint still represents the original state. |
| Verified | Exercise the integrated journey | Chromium verified the resident inspector entry control, rest and purchase receipts, pause and resume, exact 31-day elapsed time, immutable parent checksum, and read-only report reload using the real population worker and an isolated SQLite store. |

Verification passed with 32 House, checkpoint integration, and movement tests plus the Playable Life browser journey. The browser fixture supplies a selected resident to the World entry control.

The follow-up report is observational. An action-level effect estimate needs a matched autonomous control with a defined outcome and equivalent start state. Keep that comparison, broader work and venue actions, and the universal causal inspector handoff as follow-on scope. Bound evidence and checkpoint size, and measure follow-up responsiveness against representative Population runs before expanding the time horizon. Verify identity and clock mapping before linking a resident to monthly CityState, Decision Studio, or a different model version.

The emerging civilization roadmap depends on inspectable events and stable entity identity. Start idea diffusion with a recorded social interaction and a seeded adoption rule, then add durable kinship and historical residence records for generational families. Perspective comparisons need a shared event and resident-level exposure evidence. Resident-led experiments need versioned experiment recipes, transparent assumptions, and a way to compare forecasts with recorded outcomes.

## Housing policy vertical slice

### Policy Impact Explorer (2026-11-18)

Implemented on `codex/policy-impact-explorer`. Delivers a public-only, token-authenticated
`policy-impact-preview.v1` submission through immutable storage, bounded existing
RunJobManager execution and the existing Constitution City monthly model to
`/world/impact?preview=ID`. The first accepted increment is an exact synthetic
housing-clause diff with the reviewed `h_lots` adapter, 100 matched seeds,
recorded checkpoint scrubbing, synchronized cities and inspectable evidence.
Drainage/transit may use their existing reviewed mappings; arbitrary wording
changes must never execute heuristic numeric effects.

Prerequisites: frozen City initial state/model/runtime/mapping versions; exact
proposal version identity; configured integration token and embedding origins.
Acceptance: schema/auth/privacy/idempotency/failure/retry/persistence checks,
recorded pair and checkpoint checks, focused browser flow and a captured demo;
existing Constitution City and Experiment Lab regression checks. Material risks:
synthetic mappings lack empirical calibration, storage/work needs explicit bounds,
and current-law assertions need publisher evidence. No new simulation engine,
deployment, production data mutation or automatic merge is authorized.

Acceptance evidence: 13 preview/security/normal-server tests and 44 existing
runtime/mapping/analysis/civic/Experiment Lab contract tests pass; three new
Playwright cases pass with 100 recorded pairs and exact month 0/12/24 selection.
The two focused Constitution City and Experiment Lab browser regressions pass.
[Contract and request/response](policy-impact-preview.md),
[review record](reviews/POLICY-IMPACT.md) and
[browser capture](images/policy-impact-100-futures.png) retain the actual evidence.
Model-upgrade resubmissions return the original frozen preview; only an explicit
new `modelRunId` creates a new model run. The first slice intentionally caps
horizons at 24 months with three synthetic households; calibrated forecasts,
larger initial cities, complete event retention, finer recorded city checkpoints
and lighter results pagination remain follow-on work. This is separate from the
unresolved cross-model World/Worldline ten-year roadmap below.

Review: [PR #558](https://github.com/adnanwahab/happybearlandia/pull/558).
No merge or deployment performed.

The next proposed cross-application milestone is the ten-year housing journey in the product design. The existing Decision Studio housing model and monthly City history are starting points. The checklist records the integration work and its acceptance gates.

| Status | Task | Dependencies and acceptance |
| --- | --- | --- |
| Pending | Audit housing runs and World render inputs | Identify supported proposals, costs, metrics, run versions, snapshots, and any existing geographic mappings. Document gaps and choose the authoritative housing state for the slice. |
| Pending | Define the run and geography adapters | After the audit, specify stable scenario, checkpoint, time, unit, and entity mappings. Attribute real geometry and label synthetic properties. Expose missing or unsupported mappings explicitly. |
| Pending | Run a housing proposal and matched baseline over ten years | Use the supported housing engine and the agreed run contract. Verify identical inputs and seeds reproduce the same outcomes, and preserve the baseline when an input changes. |
| Pending | Connect the selected future to World and Worldline | Use the same run, date, metrics, and supported entities in both views. Verify deep links and missing checkpoint handling. |
| Pending | Connect a housing outcome to its causal evidence | Link a real modeled outcome to recorded inputs or dependencies, including model and run provenance. |
| Pending | Verify the entire journey | In the app, change an input, compare futures, enter a selected year, inspect evidence, and rerun. Record test commands, results, and the integration commit or PR. |

### Dependencies and open decisions

- The cross-model property and resident mappings need to be established before the views can claim a shared entity. Confirm which World rendering inputs can come from the housing model.
- Durable hosted storage and legacy migration still need deployment verification. The existing focused browser suites use an isolated test store.
- The earlier repository-wide browser run reached its time budget after reproducing existing party-test failures. The historical verification notes below preserve that result.

## Completed work and follow-on features


Source is the user-provided “The next 12 features I'd build for HappyBearLandia” design. The active checkout includes existing in-progress causality, replay, comparison and navigation work. Preserve those changes and reuse their contracts.

## November 10 product review

- [x] Define the bakery mystery before building its UI. The recipe model runs 241 monthly states from 2026 to 2046. It reuses the synthetic logistics solver and adds explicit operating and scheduling rules for Riverside Bakery and Luis.
- [x] Add exact City checkpoint selection by saved run and month. Keep the city model's existing time scale and link newspaper and discovery evidence back to that month. Derive the district heatmap from the selected state.
- [x] Integrate the worker-backed bakery journey, recorded headlines, shareable recipe, and comparison. Verify that a shared URL reproduces the same timeline and that an intervention after closure leaves the bakery closed.
- [x] Configure durable Decision Studio paths and verify local backup and restore. Hosted volume attachment and legacy migration require a deployment check.
- [x] Run the focused integration suites after integrating the City, bakery, and storage changes. The 64 focused Bun tests, 58 Decision Studio tests, and six distinct Time Machine and adjacent browser journeys passed.
- [x] Run the repository-wide Bun suite. It recorded 2,331 passes, nine failures, and one error on the Time Machine integration checkout.
- [ ] Complete the repository-wide browser run. The run hit its 150-second budget after reproducing three party-test failures from the pre-integration run.

The revised journey uses its own versioned recipe, synthetic household and business, and schematic comparison. The original milestones below remain the broader roadmap for the separate City model. A 3D swipe, public leaderboard, cross-app character continuity, and five-person playtest remain follow-on work.

## Living City implementation

- [x] Generate five evidence-backed requests from the synthetic City model. The Riverside commute is the first playable quest.
- [x] Compare 100 paired seeds through the existing monthly City engine. Both arms begin at the same checkpoint and use the same flood schedule. The intervention changes capacity on existing transit links once the modeled project completes.
- [x] Integrate the Living Network and council after the quest model. The network reads measured City links and resource flows and opens on the current checkpoint. Council positions come from explicit rules and the selected pair’s outcomes.
- [x] Revisit the same household in either arm, show an interview based on the recorded commute, and share a versioned recipe that reproduces the selected pair. The combined City and Time Machine checks passed with 87 Bun tests and five browser journeys.

The guided release covers the first commute challenge. The 3D Policy Paintbrush, public Experiment Arena, autonomous council negotiations, and cross-app household travel remain roadmap items. Goods and information are marked unavailable in the monthly City data. The four other requests provide starting evidence for future playable scenarios.

## First release

- [x] Inventory the existing monthly CityState, causal event store, historical API, paired comparison, temporal snapshots and Universe navigation. Keep the existing CityState and run context as the historical authority.
- [x] Add a historical view to the existing World causal demo. Given a completed synthetic run, load the exact checkpoint at the selected month and its previous month. Display additions, removals and changes for modeled buildings, households, people, businesses and district links. A missing checkpoint must surface an error.
- [x] Link recorded events to their month and entity and hand off to the existing causal inspector. Verify that a saved link reopens the same month and record without recording a new run.
- [x] Test empty storage, initial recording, event jumps, slider navigation, reload and error recovery using the application server with an isolated in-memory SQLite database.
- [x] Review delegated newspaper and discovery views and link them from the historical page once their routes and storage behavior are verified.

The first slice uses the current 20-month synthetic World run and a district-based view. The existing OSM building timeline, live population runtime and monthly CityState use different models. Extend the historical model only after mapping identity and time explicitly. Preserve URL context keys owned by the Universe shell.

## Follow-on acceptance criteria and dependencies

| Feature | Checkout evidence | Next work and acceptance |
| --- | --- | --- |
| 1. Universal Time Machine | Monthly replay service and 21 demo checkpoints. Separate building-date timeline. | Verify this release's checkpoint journey, then add a stored-run selector, measured long-history pagination, calendar metadata, and a 2026–2050 World render adapter. |
| 2. Why Did This Happen? | Versioned model traces and shared inspector. | Verify a construction event jump and its recorded input edge. Expand event coverage per model and show an explicit empty state when history is unavailable. |
| 3. Branch Reality | Economic fork engine and Decision Studio forks. The private causal route is disabled by default. | Add versioned intervention replay for the monthly city, an authenticated parent loader and durable child runs. From the selected month create a seeded child and confirm the parent hash and same-seed control remain stable. |
| 4. Future Diff Viewer | Paired comparison API and Worldline UI exist. | Map exact shared entities between supported runs. Select two completed runs and verify highlighted building and road deltas against stored metrics, including missing samples. |
| 5. Follow a Life | Population and social continuity provide separate identity foundations. | Authoritatively map a resident to World and House IDs and verify the same resident and time after navigation and reload. |
| 6. Universal Entity Inspector | Causal events and modeled entity IDs in the demo. | Add supported relationship projections and cross-view adapters, with evidence and explicit empty states. |
| 7. Living Newspaper | Persisted monthly city events. | Delivered for the fixed demo. Illustrated yearly editions link to exact recorded events and show an empty state before recording. |
| 8. Butterfly Effect Explorer | Economic fork domain adapters and recorded causal graph. | After branching and paired comparison, test a supported link intervention over time with matching streams, recorded differences and provenance. Add bridge creation only when the model supports that operation. |
| 9. City Heatmaps | Monthly CityState inventories and metrics. | Add supported entity-level metrics with units and missing-value legend, and verify color bins for a selected month. Avoid treating aggregate observations as building values. |
| 10. Saved Futures Gallery | Immutable experiments and causal run listing. | Add ownership-aware browsing, bookmarks and share links after access contracts exist. Verify open, replay, share permissions and fork behavior independently. |
| 11. Surprising Discovery Engine | Recorded monthly metrics and paired comparison data. | Delivered for completed monthly World recordings. Deterministic rules identify large changes, reversals and outliers with source observation links. |
| 12. Multiplayer Scenario Lab | No shared governance contract established for this design. | After authenticated forks and ownership, define roles and write conflicts. Verify concurrent proposals, voting and revocation with separate accounts. |

The broader guided journey depends on exact replay first, then authorized forks, then cross-run comparison and cross-app identity mapping. Verify reproducibility against independently stored digests before describing any recomputation as verified.

## Verified in this release

- The application server serves the Time Machine and both companion views. The browser journey records a run, scrubs the keyboard-accessible slider, jumps to a construction event, selects the added building, follows its recorded inputs, and restores the selection on reload without writing again. It exercises missing-checkpoint recovery and evidence links from the newspaper and discovery views.
- The focused Bun suite covers the city model, checkpoint replay, causal reads and persistence, fork infrastructure, paired comparison, and both companion views. Reproduce the browser journey with `bunx playwright test --config test/time-machine.browser.config.js`.
- Browser builds for all three entry points pass. The repository package defines no lint or typecheck script.

## Emergent civilizations implementation

The first release connects to the existing Playable Life entry from a selected Population resident. The next experiments use the saved Population contact and family records, the recorded monthly City demo, and the Riverside commute ensemble. These sources have separate clocks and identities.

| Slice | Acceptance |
| --- | --- |
| Playable Life | Restore a saved resident, submit validated commands for one modeled day, and open the saved 30-day follow-up and its checkpoint links. |
| Idea diffusion | Replay retained contacts from a saved Population run with a reproducible seed and expose the evidence behind modeled adoption. |
| Generational families | Read saved Population checkpoints, show recorded kinship, and reopen the exact checkpoint for a selected family member. |
| Rashomon | Compare four perspectives of one recorded City event, with modeled outcomes and interpretations labeled separately. |
| Archaeology | Trace selected City entities across exact stored months and link construction clues to recorded causal evidence. |
| Planner experiment | Compare a declared simplified forecast with 100 matched Riverside City pairs and reopen a comparable pair. |
| Reality Debugger | Audit exact City checkpoints and distinguish integrity failures from modeled scarcity. |
| Future Search | Search completed City runs for exact rent and district-link travel changes, with unavailable measurements excluded. |

The new views read existing sources or run local synthetic experiments. They do not alter saved simulation runs or equate residents across the Population and monthly City models. The remaining emerging-civilization roadmap items require further slices.

## Civilization laboratory implementation

Start with the monthly City engine as the shared authority for the Atlas and World Genome. Scale documented City inputs, hold seeds and horizons fixed when comparing recipes, and identify the outputs as synthetic City model results. Open sampled futures with a versioned recipe and expose the run parameters and model version.

| Slice | Acceptance |
| --- | --- |
| Tipping Point Atlas | Run a bounded grid over construction capacity and population growth, compare the same seeds at each cell, and reopen one selected future. |
| World Genome and Scenario Cookbook | Generate matched City futures from explicit land, energy, transport, construction and population assumptions. Combine supported City shocks in a reproducible recipe. |
| Assumption Jenga | Remove one selected change at a time, hold the other assumptions fixed, and show which measured City outputs move. |
| Feedback Loop Laboratory | Scrub monthly matched outcomes and inspect the housing, development and household growth rules. |
| Constraint Detective | Classify explicit recorded constraints and link each row to its event and checkpoint. |
| Policy Impact Receipt | Show proposal cost, implementation stages, commute outcome coverage and an exact replay link for the selected pair. |

Additional transfer, economic, environmental and uncertainty work depends on shared cross-model identities, resource contracts, and compatible evidence.

## City invention release

Use one versioned City plan contract across search, merge, replay and breakpoints. A plan records the seed, horizon, model version and explicit catalog policies. The Riverside fixture starts in month 2. Compare plans from that same checkpoint and compute commute from recorded simulated trips, with the trip count shown alongside the mean.

| Slice | Acceptance |
| --- | --- |
| Reverse Simulator | Generate compatible affordable proposals, rerun each with the same seed, report the measured frontier and disclose the tested search bounds. |
| Worldline Merge Studio | Reject mismatched starts or competing policy choices, merge compatible inputs, and rerun the baseline, both sources and the combined plan. |
| Reality Breakpoints | Stop advancing at the first supported metric match, show that month’s inputs and system events, and open its exact replay. |
| City Plan Replay | Recompute a supported recipe, inspect monthly policy stages and district outcomes, and hand the same recipe to the other tools. |

The first release runs synthetic local scenarios. The catalog covers transit, public housing and upzoning. The existing City model has no road expansion policy, and the receipt covers proposed cost and the measured commute sample.

### Local verification

- The homepage serves the deck.gl Houston map through its existing preview carousel. The standalone map reads the cached OpenStreetMap geometry, labels illustrative elevations, and handles an unavailable library.
- The focused browser configuration runs with in-memory World persistence. Nine journeys passed, including the search-to-merge-to-breakpoint round trip, the Atlas and Genome recipe replays, both map states, and the saved Playable Life follow-up. Run `bunx playwright test --config test/civilization.browser.config.js`.
- The extended Atlas benchmark completed 2,023 simulations across 289 cells with a 12-month horizon and 30 starting households. The full Reverse Simulator benchmark evaluated all 2,556 compatible bundles for seed 2911, a 12-month horizon, a 25% commute reduction target, and a proposed budget of 200 million modeled USD.
- The focused Bun suite passed 49 tests across 18 files. The separate Population worker checkpoint continuation test timed out at its 30-second limit. The browser Playable Life checkpoint and follow-up journey passed.

## Hidden Systems release

Run the existing monthly City engine from a shared synthetic housing shortage. Compare baseline staffing and materials with an edited capacity plan over up to 60 months. Project identity and the selected household stay in this model across views.

- Queue City measures permit submissions, grants, and outstanding projects from the engine. Construction uses the same project transitions and capacity ledger. Verify that arrivals, departures, and queue stocks reconcile for every simulated month.
- Construction Theater renders the model's recorded progress and completion of the selected project in schematic 3D. Its timeline, stage events, and occupancy all refer to the same monthly snapshot.
- The household panel follows housing, rent, commute observations, and savings in the two same-seed futures. The demo should show the effect of relieving the initial materials constraint.
- Keep seed, capacity assumptions, model version, and month in the replay link. The demo uses local synthetic scenarios and makes no changes to saved World runs.

## Learning Civilization release

Use the versioned Riverside City model for a local observatory, vote, and prediction round. Players collect incomplete district evidence under a sensor budget, select a proposal under a separate capital budget, and submit a scored prediction before revealing the adjusted future.

- Observatory readings carry the measurement month, district identity, type, unit, and declared measurement resolution. Unmeasured quantities remain unavailable.
- The assembly uses published fictional rules and evidence available to the selected sensors. A player vote and modeled resident votes decide whether an affordable proposal proceeds.
- Store observations, locked predictions, and outcomes separately in browser storage. Resolve a prediction only against the approved seed, horizon, and policy set. Keep a bounded score history across rounds and link the result to exact City plan replay.
- Verify the round from sensor placement through the vote and score, including reload before and after the reveal. Shared accounts, multiplayer voting, and unsupported City measurements remain follow-on work.

## Sculpt a Storm release

The first crisis scenario uses a versioned synthetic neighborhood and closed-boundary heightfield. Match rainfall and starting terrain across branches. Keep simulated depth, infrastructure exposure, and access consequences as separately declared model steps.

- Use a CPU reference and WebGPU compute for rainfall, drainage, and local transfer. Verify conservation, finite depths, and bounded CPU/GPU parity.
- Let visitors place drainage, add detention, and raise a modeled road cell. Show depth on a 3D terrain timeline and keep a keyboard-accessible view when graphics are unavailable.
- Derive road closures, building inundation, and depot access from declared rules. Compare matching storms across 100 seeded rainfall intensities and record the assumptions with each result.
- Save local scenario branches and encode a versioned replay link. This release uses synthetic geometry and illustrative costs. Regional treaties, emergency staffing, and validated site hydrology require further slices.

### Local verification of the three releases

- Hidden Systems queue flows reconciled in both 60-month futures. The demo family entered a completed building at month 28 with baseline capacity and month 16 with the adjusted capacity. The browser test reopened the exact edited project and month.
- Learning Civilization passed its browser round from incomplete evidence through approval, a locked prediction, scoring, and exact replay. Reloads preserved the lock and result. Five district metrics are supported, and observations, votes, predictions, and scores are local to this browser.
- The Low Crossing demo went from one closed road link to zero and from five flood-exposed buildings to four. The matched 100-storm ensemble, saved branch, and downloadable versioned event record passed browser checks. CPU and Chrome WebGPU depth frames matched in three solver parity cases.
- The combined focused Bun suite passed 36 tests. Chrome passed the 11 existing and new City journeys plus two storm-specific journeys, including the active WebGPU path and forced CPU fallback. Run the browser checks with `bunx playwright test --config test/civilization.browser.config.js`.

## Storm recovery and mutual aid

Continue the same storm branch at its final exposure snapshot. Compare a passive control with an ordered repair and shelter plan. Route access controls where crews can work and which households can reach shelter. Model mutual aid as a budgeted agreement with a neighboring municipality, and keep the borrowed crews and payment in the same response ledger. Record simulated shifts and replay the exact scenario and dispatch order.

The recovery demo can reopen the Depot Spur, restore the Riverside Clinic, and shelter 12 households. One borrowed crew allows shelter dispatch to start in parallel with road clearance. All 14 storm model tests and the three Chrome storm journeys passed, including exact response-shift replay.

## Interconnected lives release

Timeline Braids reads saved Living World descendants and verifies population continuity before comparing one resident. The first view supports up to ten saved branches. Draw actual checkpoint edges and report the first difference only across samples from the same modeled minute. Link each visible point to its exact saved World checkpoint and supported House entry.

Civilization Zoom uses a single saved model and clock for drill-down and supported replay links. Collective Mind is a separate seeded lightweight agent model. Verify its deterministic updates and label the rules and visualization backend.

The Connected Lives hub is linked from the homepage. Timeline Braids preserves the selected saved checkpoint in its URL and opens that resident in Civilization Zoom or Playable Life. Zoom keeps one checkpoint through six in-page levels, including residents with unrecorded building anchors. Collective Mind runs 1,000 deterministic agents for 60 rounds and replays a selected round from a versioned URL. JavaScript advances the agents and WebGPU or Canvas renders their network.

Seven focused Bun tests and three Chrome journeys passed. The browser checks used real sibling saves in isolated World storage, verified the Braids-to-Zoom handoff, and exercised both Collective Mind renderers.

### November 10 release integration and UI sprint

- The guided saved Population future connects Worldline, 3D World, and House Simulator through an immutable World experiment and an explicit resident-to-household lookup inside its checkpoint. Scrubbing uses saved lineage points. The rain comparison restores two copies and advances each by one fixed step. The edited checkpoint records the parent and comparison evidence.
- The Decision Studio handoff depends on a model-owned mapping for versioned entities and time. Keep monthly City causal records and Population checkpoints separate until that mapping exists and is tested.
- The sprint report records the six UI entry points and their exercised interactions. The release audit and checklist record broader failures, storage compatibility, backup rehearsal, and deployment gates.

## Release integration and verification

- [x] Surface the guided saved future from the homepage and Universe shortcuts. Worldline, 3D World and House use the same saved Population checkpoint and resident. The saved synthetic footprint renders through WebGL2 when WebGPU is unavailable.
- [x] Verify a repeatable one-step rain fork, its saved parent lineage, the unchanged parent checksum, the saved timeline after refresh, and missing or invalid checkpoint errors.
- [x] Add release health, readiness and database preflight checks. Rehearse the read-only deployment smoke on file-backed local storage.
- [ ] Establish a versioned mapping from Decision Studio housing runs into Population before enabling an authoritative handoff.
- [ ] Reconcile the broad suite failures and unrun browser tests. Confirm the exact candidate image, restore a verified production backup on staging, and rehearse rollback before an authorized deployment.

See [the release audit](release-audit.md) for verification results and [the release checklist](release-checklist.md) for local URLs and Fly operations.

## Future Machine — November 11 integrated slice

Implemented and locally verified: monthly City authority, one persisted baseline/plan experiment with matching seed, model and original state; 120 steps and Month 0/120. Frozen interfaces: `world/future-machine/INTERFACES.md`. Six isolated feature chats own data, diff, scene, UI, story, share; integration owns composition, route, durability configuration and acceptance.

Acceptance gates: fork/run/scrub/blink/inspect/share through `/world/future-machine.html`; deterministic zero and nonzero comparisons, missing snapshots, refresh and invalid recipe handling; attributed synthetic layout without inferred real geometry; disposable bounded scene/history resources; measured browser journey and local export/restart durability. Production volume attachment, backup operations and deployment remain explicit release gates. Do not deploy.

Risks: replay recomputes detailed states (must label); full 121-state histories can grow; model construction can correctly record no completed physical change. Observe actual results before selecting demo narration. Cross-model resident identity and causal attribution are unsupported.


Completed acceptance: all six feature commits integrated on `codex/future-machine-integration` in `/Users/wahabma/happybearlandia`. `HBL_FM_BROWSER=1 bun test test/future-machine-*.test.js test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js test/reality-share.test.js` passed 74 tests / 442 assertions, no skips. Final Chromium run passed all six checks in 57.4 seconds, including the 40-second tour; final camera-unlocated disclosure also passed a focused journey rerun. No lint/typecheck scripts exist. Diff checks passed.

Verified behavior: common immutable Month 0, both Month 120 endpoints, deterministic zero/nonzero differences, 24 completed additional homes, 1,000,000 modeled USD cumulative capital spending, synchronized split/blink/ghost view, director and exact-ID household/event inspection, share/refresh, explicit absent saved-record recomputation, mismatch/missing-replay errors, 390px layout, no-WebGL fallback, upper-limit recipe, navigation and disposal. Director deduplicates repeated policy differences and prioritizes recorded physical additions. The base fixture required a declared versioned demo assumption: utilities 200 per district/network, no private parcel capacity and zero annual growth.

Default saved-pair replay reached ready in approximately 0.65 seconds locally; upper limit 120 households approximately 2.0–2.1 seconds. Serialized histories measured 17.1 MB / 50.9 MB respectively; default replay transfer is about 18.3 MB. Eight scene objects at Month 120; repeated scrub stays within ten and disposal clears them. These are Chromium/local measurements, not public-network or device guarantees. Final artifacts: `/private/tmp/future-machine-final-20261111` (2036 screenshot, thumbnail, evidence JSON and silent 43.96-second WebM). Normal entry remains `/world/future-machine.html`; isolated server is running on port 39885.

Durability evidence: local server restart preserved the completed pair and replayed 120 steps ending Month 120; isolated SQLite tests passed export integrity and restored City/share backups. `fly.toml` now declares durable City/share paths, with no deployment performed. Hosted volume/free-space/migration, off-host backup/restore rehearsal, public capacity/access controls and hardware/network validation remain release blockers. Replay remains labeled manifest recomputation; no independent checkpoint or unsupported causal/cross-model identity claim is made.

Commit lineage: data `039a657`, diff `6d3c37f`, scene `c5dd746`, UI `6520c0e`, story `e2751b1`, share `77b7993`; composition/tests `a3191f9`. Full worker SHAs, files, artifacts and limits: [Future Machine handoff](future-machine.md). No PR published; no additional chats/agents or outbound chat communications.

## World visual pass (2026-11-11)

Implemented and verified from 6c3330f with seven explicitly requested Codex chats and strict file ownership. The proposed PR10 commit is absent locally; first-run guide files are absent. Build an equivalent integrated slice on current entry points, retaining finished Future Machine. The shared response is available as pasted text; its linked 316-line download is unavailable and has not been read.

Next slice: Open World → quick demo → focus a real resident and label current observation → fresh matched legacy week → measured results → inspect → replay. Dependencies and exports are frozen in world/onboarding/VISUAL-PASS-INTERFACES.md. Independent UI/controller/feedback/camera/browser/accessibility work integrates through render.js only. Acceptance: real worker computation, stale cancellation isolation, error recovery, one responsive sheet, keyboard/touch/reduced-motion/WebGL fallback, preserved civic tour/ten-year/Future Machine, viewport screenshots and honest startup/computation/reveal/total timing. Risks: real computation may exceed 10–15 seconds; model clocks/identities remain distinct; unavailable prerequisite must not lead to fabricated mappings or results.

Visual pass integration status: delivered the end-to-end slice with a dedicated cancellable legacy paired worker, frozen local Balanced recipe, current resident observations, actual result overlays, inspect/replay and error retry. WebGPU-only startup was found in the checkout and now falls back to WebGL2. Guide, inspector/results/activity/Population sheets use one manager; legacy docks are suppressed during managed sheets; secondary actions fold into More city actions. No Population/monthly City identity mapping or construction effects were added.

Acceptance evidence so far: 88 Bun tests pass, one browser-gated test skipped; 20 ten-year/longitudinal tests pass plus the external temporary-database three-package regression passed on targeted rerun. Future Machine full journey and WebGL fallback pass (2 browser tests). Touch dismissal/reopening and full civic tour with unavailable remote synthesis pass (2 browser tests). Real worker error/retry and score-identical replay pass. Five viewport screenshots and measured timings are in /tmp/hbl-world-visual-pass. Desktop 80 residents: 2.178 s scene readiness, 81 ms observation after Play, 1.268 s to first worker progress, 5.494 s remaining compute, 5 ms reveal, 6.769 s total after Play. Larger population pacing remains under verification; no default-2,000 speed claim. Final evidence and limitations are recorded in docs/world-visual-pass-report.md. No commit was created by integration; shared HEAD advanced externally to 7537cc1 during work.

Final acceptance: combined viewport/failure suite 10 browser tests passed; post-review quick-result ownership/error/replay, full civic tour, and 500-resident pacing suite 3 passed; Future Machine integration/fallback 2 passed; separate touch/full-tour suite 2 passed. Final focused modules 30 passed. At 500 residents actual after-Play time was 26.705 s (78 ms initial resident feedback), exceeding the 10–15 s target while reporting real progress. Default 2,000 timing, physical phones, Safari and actual WebGPU hardware remain unverified. Keep future optimization focused on worker computation rather than captions. The completed slice and evidence live in docs/world-visual-pass-report.md; no deployment or PR was performed.

Final 320px post-layout smoke passed: actual completed comparison, visible measured result, resident inspection, Escape focus return to Start here, reopening and actual replay. Screenshot visually inspected; final diff whitespace check passed. Review locally on port 39910. Next recommended slice is one authority-scoped resident commute mission with matched travel/budget consequences; it is not implemented in this pass.

## One City, Two Futures flagship sprint

The next integrated slice is delivered on `sprint/one-city-two-futures-20261111`: homepage Play Demo → immutable matched Month 0 → recorded monthly divergence → first physical building at Month 16 → measured KPIs → exact project/policy completion receipt → pause/resume/manual exploration/share/replay. Six isolated Codex worker worktrees plus the coordinator supplied the slice; current ownership and commits are in `docs/one-city-two-futures-workers.json`.

Acceptance: seed 42, model `city-systems.1.0.0`, 30 starting households, exactly 120 steps per arm. At Month 16 and 120, homes are 36 without versus 60 with the housing plan; cumulative capital spending differs by 1,000,000 illustrative USD. One three-floor structure contains the 24 units. Both scene halves use one camera and time; no geographic parcel or cross-model resident mapping is invented. Mean unit rent is labeled as including new inventory, not incumbent savings. Physical structure selection and KPI WHY show event `16-0`, recorded project and policy, selected month, model, seed and run; missing causal edges remain explicit.

Status: homepage/default cinematic demo, split/difference/blink, camera fit over the full history, real unit-count labels, three measured cards, historical WHY receipts, recipe refresh and zero-control paths implemented. Graphical Canvas2D now works in the comparison and ordinary World; metadata definitions load before GPU startup, and renderer initialization is bounded. Activity, numeric mood/authority seed, disabled explanations, Reality nonpassing-vs-error wording, mobile panel handling, and registry-derived gallery/connected counts are repaired. Original 29 catalog entries plus existing Houston Map and flagship are explicitly retained as 31 unique registered experiences; no bar-scene stretch feature was added.

Verification: 140 focused tests plus 35 adjacent tests passed, one browser-gated skip; existing comparison browser suite 5 passed; expanded integrated suite 9 passed, with before/after images, actual API metrics and a 55.760-second playable recording. Additional bounded-GPU-failure and exact recording-command checks are recorded in the live sprint status. Two native browser-entry bundles and whitespace checks passed. Scope is frozen for final verification/reporting; no release merge, PR creation, push, deployment or production mutation performed. A later GitHub audit found PR11/12 externally merged; stale handoff statuses are not treated as current facts.

Full acceptance mapping, scenario measurements, commands, artifacts, limits and follow-on release gates: [sprint evidence report](one-city-two-futures-sprint.md). Current review route: `http://localhost:39960/world/future-machine.html`. Safari, Firefox, physical phones and actual WebGPU hardware remain unverified. The separate World–Worldline cross-model housing roadmap remains pending; this slice intentionally retains monthly City authority.

### Approved D01–D05 follow-up (2026-11-11)

Continue the functioning flagship. Coordinator owns director/shared camera integration; existing isolated workers own recorded charts, construction progress and evidence-chain modules under the contracts in demo-backlog.md. R04/R10 prerequisites verified before polish. D01 six-second actual first-divergence hold is implemented: clock2tests/13assertions and actual native timed browser normal/reducedmotion2passed32s. Screenshot/evidence `/tmp/hbl-cinematic-hold-proof/`. Mobile native framing and Activity authority-seed export are active observed regressions; new modules pending integration. Main divergence50/26 requires overlap review before any release proposal. No release merge/deployment.

D01–D05 accepted follow-up: integrated code `1b19358`, compact delta `52f565d`, exactconstruction proof `53ae405`, WHY jump/reverse0 regression `a2db60a`, mobileFPS `13a554d`. Actual recordeddelta1browserpass, construction2pass, trail1pass; responsive/native and test caveats in status/manifest. Named native recording59.5s test passed,56.84s playable video. Stale inspector corrected; Activity exportedseedverified. Main branch preservation risks audited without merge. Next verification is U09 visible recomputationdisclosure; no new feature scope.

## Bounded local Codex pipeline

In progress: build a dependency-aware, persisted dispatcher for approved `demo-backlog.md` tasks. Acceptance: atomic repository-wide claims, three-worker default with exclusive file/interface reservations, sandboxed workers/checks, commit/evidence gates, serialized local integration, deadline/freeze, interruption recovery, dry-run and focused scheduler/lifecycle tests. Backlog remains authoritative; explicit execution metadata supplies ownership and commands without adding product scope. Existing external assignments are not adopted automatically. No push, deployment, main merge or production writes. Risk: nested OS sandbox or unavailable CLI authentication can block the live demonstration; report actual execution only.

Delivered: `scripts/demo-pipeline.mjs`, reviewed U10 execution metadata, operational README, Markdown/JSON status and lifecycle tests. Actual checks: dispatcher 11 passed / 53 assertions; existing story/data regression 14 passed / 82 assertions; dry-run selected only U10; conflict fixture selected one of two overlapping tasks without launching workers. Real temporary Git tests verified isolated commits, ordered integration, one repair retry, preserved branches and interrupted-lease recovery. No browser behavior changed; Playwright skipped. Local live sandbox probe exited 71 (`sandbox-exec: sandbox_apply: Operation not permitted`); shared Git directory writes are also outside this chat's sandbox. Consequently no live coding worker or full sprint was launched, and no two-hour execution is claimed. Next: run from a host with working Codex OS sandbox and Git worktree write permission using the README's exact 120-minute command. Other approved objectives require explicit file/interface ownership and reviewed check argv before dispatch; narrative-only assignments remain blocked rather than silently approved.

## Engineering pipeline working slice

Audit found manual chat assignments, historicalstatus contradictions and a separately implemented CLIrunner whose native sandboxpreflight is unavailable on thishost. Reused dispatcher95b63be; added interactiveCodexbridge d99e112 with repository-wideatomicclaims, exactfile/interfacemutexes, capacitythree, >2verificationbackpressure, immutablehandoff, independentcandidate/integratedtests and retainedREPAIRstate. Pipeline tests17pass/76assertions. ActualapprovedU10 dispatched tooneisolatedinternalworker, reviewed and integrated779c360; both phases12pass/89assertions usingrealCityseed42. No browserbehaviorchanged, so no new visualclaim or unnecessaryPlaywright. Existingflagshipproof remains in demo-evidence-manifest.json. Current pipeline report: engineering-pipeline-status.md. Eight further approvedreliabilityscopes plus boundedrepairautomation are planned; NBcandidate remains separately queued, notclaimedintegrated. No mainmerge/deployment.

Pipeline acceptance follow-up: existingexternalNBcandidates are now in verificationqueue and count towardbackpressure; real thirdpendingcontribution blockednewdispatch. U16 nexttask independentlyintegratedbb277fd, candidate15pass/200assertions thenintegrated15pass/200assertions. Actual12artifacthashes and modelmetrics reproduced. EightREADYtaskpool maintained; twoNBcandidates remainunverified. No browser-facing sourcechanges in pipelineincrement. Runtime is on-demand internalCodex, not a falselyclaimed daemon or workingexternalCLI sandbox. Final evidence engineering-pipeline-evidence.json.

## Historical backlog expansion candidate

Isolated integration branch `codex/backlog-integration` retains finalized demo commits through 9691d0e. Next slice: integrate committed track adapters into existing Studio, preserving model authority and regression coverage. Acceptance requires normal entrypoint operation, explicit missing-data states and integrated tests; adapter tests alone do not close UI tickets. Risks: checkpoint engine hooks, compact trace hydration, empirical evidence absent, provider/browser availability. Current increment: provider boundary regressions integrated; methodology evidence mounted in historical evaluation; bounded reproduction appendix mounted in printable briefs. Focused tests pass; browser verification pending. Track evidence and unresolved implementation are recorded under docs/backlog-expansion/.

Backlog follow-up: ticket 96 declared factorial execution/report is mounted in Intelligence dependence inspection. Explicit equal-weight levels and selected stored seed, ≤128 evaluations, provenance and unavailable decomposition states. Real production-route browser check passed (1 test, 9.6s); 19 statistics/intelligence tests pass. This closes the bounded design UI increment, not continuous-distribution Sobol or empirical uncertainty calibration. See backlog-expansion/integration.md for outstanding shared wiring.

### Integrated backlog candidate — current final evidence

All eleven workgroups have delivered their assigned bounded increments into the isolated integration branch. Normal Studio mounts now cover typed stored search, paired schematic housing, deterministic clustering/queries/event playback, real PDP and declared factorial controls, viewport transitions, recorded construction/fork/stress/optional audio, dedicated methodology navigation, exact appendix/QR, persistent local checkpoint approval UI and durable reviewed workflows. Current31-ticket ledger and consolidated actual screenshots/provenance/checksums are in `docs/backlog-expansion/integration.md` and `docs/backlog-expansion/evidence/manifest.json`. Historical167Existing/New records and finalized33distinct demo queue evidence are retained; no blanket198-ticket completion claim.

Frozen combined backlog/shared checks112pass/746assertions; existing Decision58pass/2972assertions, Advanced42pass/565assertions; retained flagship/model/renderer137pass/3browser-gatedskips/3605assertions. Feature-specific real browser gates complete for all assigned bounded tracks; native/fallback flagship2pass21.6s. Model calibration/live providers/absent browser engines retain documented external evidence limits. No release merge/deployment authorized. Final candidate and preview references follow in the integration evidence record.

Final frozen connected browser loop1pass45.8s; Studio bundle76modules and diffcheck pass. Local isolated preview http://localhost:42983/world/decision.html; delivery artifacts include actual screenshots, provenance, checksums and retained33-item demo queue references. No new release or deployment.


## NB district comparison increment (2026-11-11)

Next end-to-end slice after the verified flagship: reuse its immutable monthly City pair to compare the provisional twelve district metrics on the same selected month. Prerequisites are the existing validated seed/model/original/horizon adapter, fixed pair identity and recorded timeline; no new engine, clock, storage or geographic mapping is needed. Coordinator owns main.js composition; pure projection modules and dedicated tests are separate from existing worker directories.

Acceptance: open the ordinary Future Machine route, fork, compare district values at Months 0/16/120, switch metric with keyboard, reverse scrub and refresh; exact source values, units, sample counts, missing/null semantics and 320px no-GPU layout must agree. Registry, partition conservation, rental-only means, unknown district coverage, incompatible pairs and deterministic 121-frame projection have focused checks. Delivered candidate and actual evidence: [NB intake review](reviews/nb-intake-20261111.md).

Material scope decision: district context ships before any grid. Synthetic flagship positions have no supported geographic footprint, so there is no cell attribution. Original image labels remain missing; crew assignments/model changes are deferred. Grid tasks retain their ID/dependencies and are not declared complete by this district summary. Existing release/main-preservation blockers and worker ownership remain in force.

District increment implementation: `c4cbfa22dfb1d034d3eee072d42058552e89a8cc`; final7unit/57assertions,18adjacentpass/1skip/129assertions,1actualChromiumjourney5.5s, browser build and diffcheck pass. Full grid remains dependent work.

NB-U01 prototype follow-up: integrated `c789517` from worker `4660ca3`. Independent7tests/48assertions pass including actual Chromium320/1440 with GPU disabled. This is an explicitly labeled fixture component; it accepts no City authority and is not mounted in a production page. NB-U02/G02/G03 still gate real grid integration. Existing district summary remains the shipped normal-entry-point slice.


### Continuous coordinator audit — November 11, baseline 1de9fd8

Current worktree is clean detached source matching the requested sprint tip; do not change the branch checked out in another worktree. R01/R04/R06/R11/R12 already delivered: resume reliability queue rather than duplicate implementation. Next isolated dispatch contracts: [coordinator-next-dispatch.json](coordinator-next-dispatch.json). R13 catalog preservation precedes release reconciliation; R14 verifies optional-loading failures; R15 adds bounded repair. Eight READY scopes, zero confirmed running original sprint workers, two external NB candidates in REVIEW. Keep NB source changes outside the frozen flagship reliability increment.

Acceptance for this audit: rerun deterministic/boundary and pipeline tests, canonical actual-browser journeys, responsive 390/320 checks, native Metal pixel proof, named recording and artifact validation. Record exact results and current source hashes in coordinator-audit-20261111.md and coordinator-audit-evidence.json. No release merge or deployment. Existing historical evidence remains separately identified.


### Reliability queue resumed — R13/R14/R15

All three tasks acquired actual repository-wide claims at baseline1de9fd8 in separate managed worktrees. Existing catalog/first-run chat owns R13, existing browser-proof chat owns R14, coordinator isolated agent owns R15. Dependencies R11, R04/R09 and U10 already verified. Exclusive paths remain scripts/pipeline/tasks.json scopes; shared runtime source remains coordinator-owned. Acceptance: R13 names concrete main preservation failures without runtime edits; R14 injects actual optional-loading failures and records browser outcome; R15 permits one explicit owned repair after failed verification, preserves failed evidence, rejects third total attempt/racing resume. Failed integrated checks must require explicit reconciliation. Candidate and integrated checks required before VERIFIED. No browser rerun for pipeline-only changes; R14 requires actual normal-route browser proof. No main/release merge or deployment.


R15 accepted atd548153: candidate/integrated12pass each, combined37pass. R13/R14 independently failed and remain retained repair candidates; no production changes from them entered the sprint. R13 needs bounded catalog/directory/atlas preservation. R14 acceptance must distinguish optional metadata failure from missing required simulation module; preserve useful independent disclosure during renderer import failure without pretending an unavailable simulation can run. Exact evidence and timing: coordinator-resume-evidence.json. Next compatible U01 continuation requested after verification drain, subject to normal durable ownership/capacity.


Observed follow-up U18: actual U01 screenshots expose stale native label spans above the Canvas fallback, despite the old canvas being removed. Next bounded slice clears the native overlay at fallback transition and adds a live-loss regression assertion. Acceptance requires real native/WebGL loss with one Canvas, no retained native labels, identical recorded month/seed/KPIs, working WHY/scrub and screenshot inspection. Own scene/index.js and existing device-loss browser test only. Shared City data is unchanged.


## Local branch consolidation — November 11, 2026

User-authorized scope: consolidate work from November 8–11 locally and remove redundant GitHub branches. The integration starts at GitHub main `78c3c51`, incorporates the recent sprint, backlog candidate, neighborhood triage, research, Sprint 2, Future Split, causal inspector, Time Machine, and opt-in pipeline branches. Original worker commits whose patches were already cherry-picked are retained through history-only merges after `git cherry` confirmed patch equivalence. Detached worktree snapshots and pre-November-8 branches are outside this cleanup. Active worktrees remain intact. The exact captured heads and deleted remote heads are in [the audit ledger](branch-consolidation-20261111.json).

Acceptance: all captured recent branch heads reachable from local main; resolve shared entry points without dropping main's Houston directory/Canvas fallback or sprint's flagship; focused model/HTTP tests and browser journeys; delete only unchanged GitHub branches already reachable from GitHub main. Keep unique remote work and open PRs until a later reviewed remote integration. No push to main or deployment is authorized by this local cleanup.

Material resolutions: keep the integrated first-run guide, retain existing feedback helper exports, combine Activity toggle and panel ownership, preserve canonical registry counts and directory navigation, keep both explicit Reality outcome summaries and detailed interpretation, preserve local plan selections when remote packages arrive. Full-renderer local-play tests use the existing `renderer=canvas` adapter because main introduced a separate lightweight `renderer=canvas2d` entry point. Symphony tests distinguish current VERIFIED tasks from synthetic READY fixtures; no dispatcher is launched.

Verification: 261 feature/model/pipeline/backlog/HTTP tests passed (three opt-in browser cases skipped); 44 World onboarding tests passed; 26 causal/checkpoint/retention tests passed (one opt-in Canvas fixture skipped); eight offline Python orchestration tests passed. Browser final results will be recorded below before local main is advanced. Initial HTTP checks required local-listening permission. The first browser run exposed the fixed Reality summary regression; overlapping artifact directories caused a trace-cleanup failure, so the final suite uses an isolated directory. Imported third-party QR sources retain existing whitespace warnings; merge resolution changes pass whitespace checks. No repository-wide test or production validation is claimed.

Browser evidence: the isolated canonical suite passed 12 checks and skipped the opt-in recording; its reduced-motion hold assertion ran after slow screenshot encoding had consumed the live hold. Pause now precedes artifact capture, and both normal/reduced-motion hold cases passed together on rerun (2/2). Thus all 13 distinct canonical checks passed across these runs. The corrected Reality/World/count subset also passed 3/3. Full-renderer startup independently reached ready without page errors; local-play acceptance is recorded next.

Final local-play evidence: five checks passed through the normal full-scene `renderer=canvas` adapter: local cycle during optional loading, late response control ownership, optional-service failure, remote-only amendments/literal labels, and frozen snapshot ordering. The sixth initially timed out because `#planYear` was hidden inside main's collapsed Advanced settings, before save/reload began. The test now opens that disclosure through the normal UI; the saved remote-policy capture/reload journey passed on rerun (1/1, 4.8s). All six distinct local-play checks passed across these runs. All captured heads are preserved; promote the verified consolidation to local main by fast-forward. Active chats continued committing after the captured snapshot, so their later work remains separately owned and was not silently adopted.

Cleanup completed: 12 recent GitHub branches deleted atomically with expected-head leases, each already included in GitHub main; 16 inactive local merged branches deleted using safe `git branch -d`; remove the temporary consolidation branch after fast-forwarding local main. Active worktree branches, older branches, and open PR heads retained. No remote main push, PR merge, deployment, or worktree deletion occurred. All captured heads remain reachable from the consolidation branch. Working-tree changes for the consolidation are committed; the machine-readable ledger preserves original SHAs for recovery.
