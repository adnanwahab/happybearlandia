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


[Product design](design.md) defines the target experience. [Engineering instructions](../AGENTS.md) describe how to plan, implement, and verify changes. Keep this plan current with task status, dependencies, acceptance evidence, and commit or PR references when available.

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

In progress: monthly City authority, one persisted baseline/plan experiment with matching seed, model and original state; 120 steps and Month 0/120. Frozen interfaces: `world/future-machine/INTERFACES.md`. Six isolated feature chats own data, diff, scene, UI, story, share; integration owns composition, route, durability configuration and acceptance.

Acceptance gates: fork/run/scrub/blink/inspect/share through `/world/future-machine.html`; deterministic zero and nonzero comparisons, missing snapshots, refresh and invalid recipe handling; attributed synthetic layout without inferred real geometry; disposable bounded scene/history resources; measured browser journey and local export/restart durability. Production volume attachment, backup operations and deployment remain explicit release gates. Do not deploy.

Risks: replay recomputes detailed states (must label); full 121-state histories can grow; model construction can correctly record no completed physical change. Observe actual results before selecting demo narration. Cross-model resident identity and causal attribution are unsupported.
