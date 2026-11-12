# HappyBearLandia implementation plan

## Symphony pilot — SHE-179

Documentation slice: [verification report](symphony-pilot-verification.md).
Target absence, clean isolated issue branch, local sprint base and no Linear
blocking relations were confirmed before editing. This worker owns only that
report and this status entry; the trusted host owns publication interfaces.
Acceptance: distinguish observed execution from offline tests and pending live
publication, pass whitespace checks, and commit locally on `symphony/SHE-179`.
Offline Symphony tests passed 8/8 and the one-worker Linear dry-run exited 0.
No browser behavior changed, so app launch, Playwright and media are inapplicable.
Final commit/check evidence is handed off through `.git/hbl-workpad.json`;
GitHub draft publication and remote-base freshness remain host gates after the
session. On resume, read-only Linear and GitHub checks confirmed the host
published commit `cc9d10afc7c0d543eae6d4f37e8b461d4eba3b57` as open
[draft PR #24](https://github.com/adnanwahab/happybearlandia/pull/24), with
the correct sprint base and issue branch; no comments or review threads
were returned. The report now records that live receipt separately from
the original offline tests, which passed 8/8 again. CI and dispatcher
internals remain unverified; publication of this follow-up is a host gate.

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


### Continuous coordinator audit — November 11, baseline 1de9fd8

Current worktree is clean detached source matching the requested sprint tip; do not change the branch checked out in another worktree. R01/R04/R06/R11/R12 already delivered: resume reliability queue rather than duplicate implementation. Next isolated dispatch contracts: [coordinator-next-dispatch.json](coordinator-next-dispatch.json). R13 catalog preservation precedes release reconciliation; R14 verifies optional-loading failures; R15 adds bounded repair. Eight READY scopes, zero confirmed running original sprint workers, two external NB candidates in REVIEW. Keep NB source changes outside the frozen flagship reliability increment.

Acceptance for this audit: rerun deterministic/boundary and pipeline tests, canonical actual-browser journeys, responsive 390/320 checks, native Metal pixel proof, named recording and artifact validation. Record exact results and current source hashes in coordinator-audit-20261111.md and coordinator-audit-evidence.json. No release merge or deployment. Existing historical evidence remains separately identified.


### Reliability queue resumed — R13/R14/R15

All three tasks acquired actual repository-wide claims at baseline1de9fd8 in separate managed worktrees. Existing catalog/first-run chat owns R13, existing browser-proof chat owns R14, coordinator isolated agent owns R15. Dependencies R11, R04/R09 and U10 already verified. Exclusive paths remain scripts/pipeline/tasks.json scopes; shared runtime source remains coordinator-owned. Acceptance: R13 names concrete main preservation failures without runtime edits; R14 injects actual optional-loading failures and records browser outcome; R15 permits one explicit owned repair after failed verification, preserves failed evidence, rejects third total attempt/racing resume. Failed integrated checks must require explicit reconciliation. Candidate and integrated checks required before VERIFIED. No browser rerun for pipeline-only changes; R14 requires actual normal-route browser proof. No main/release merge or deployment.


R15 accepted atd548153: candidate/integrated12pass each, combined37pass. R13/R14 independently failed and remain retained repair candidates; no production changes from them entered the sprint. R13 needs bounded catalog/directory/atlas preservation. R14 acceptance must distinguish optional metadata failure from missing required simulation module; preserve useful independent disclosure during renderer import failure without pretending an unavailable simulation can run. Exact evidence and timing: coordinator-resume-evidence.json. Next compatible U01 continuation requested after verification drain, subject to normal durable ownership/capacity.


Observed follow-up U18: actual U01 screenshots expose stale native label spans above the Canvas fallback, despite the old canvas being removed. Next bounded slice clears the native overlay at fallback transition and adds a live-loss regression assertion. Acceptance requires real native/WebGL loss with one Canvas, no retained native labels, identical recorded month/seed/KPIs, working WHY/scrub and screenshot inspection. Own scene/index.js and existing device-loss browser test only. Shared City data is unchanged.


U02 actual resize proof exposed Canvas ID-label right overflow and44px footer overlap at390/320 after focus. Native resize passes and both preserve actual frame/seed/metrics. Authorize one bounded repair by the current U02 owner in canvas-stage.js only, plus existing assigned test/config. Preserve first candidatee30a1c0 and independent failing gate under the same claim; record scope reconciliation under shared lock before owner repair resume. Require text bounds within arm/abovefooter and unchanged recorded state across desktop→390→320→desktop.


Final verification at1d0a488: clean combined139unitpass/3browser-gatedskips/1199assertions after correcting stale hardcoded dispatcher batch expectation. Native2pass, responsive3pass, share/missing/corrupt/boundary5pass, namednative recordingpass (actualPlay→complete54.289s), artifactverifier2records/1video. Concurrent canonical sweep12pass/1recordingskip/1hold-testfailure: full-history/screenshot capture consumed the unpaused hold, then Pause observedmonth77. Retain trace; move Pause before heavy artifact IO after observing the actual hold, then rerun focused and canonical checks. This test correction preserves clock assertions and does not change demo timing. U02 mobilelabelrepair still pending; earlier recordings are pre-U02-repair source evidence.


Accepted working increment complete at application2c9d973: U18 and bounded U02 visible repairs verified in candidate/integrated browser paths, R15 repair infrastructure exercised on actual failed U02. Final combined139units/3skips, canonical13browsers/1recordingskip, responsive3, actualdevice-loss2 and namedrecordingpass52.868sPlay→completion; exact evidence in coordinator-final-status.md/coordinator-final-evidence.json. R13/R14 diagnostic failures remain unintegrated and block release readiness. U03 claimed and released for uncontented resource measurements; U05/U08 READY. No release/main merge/deployment. Scope reconciliation for U02 was committed before owner resume and applied under shared lock before worker edits; original failed SHA/base/attempt1 retained.


## Symphony receipt-example subset recovery — November 11, 2026

Recovered SHE-89's six untracked receipt-example files on isolated local branch
`codex/merge-complete-symphony-20261111`, based on remote sprint `f1174eb9`.
The existing monthly City engine regenerates both pinned synthetic receipts.
Integrated receipt/data/diff/share checks: 25 tests passed, 218 assertions;
explicit fixture regeneration check passed. Browser behavior is unchanged.
SHE-179 documentation was already merged remotely as PR #24; incomplete and
untested workspace work was deferred. No source workspaces retired, remote
push, release/main merge or deployment. Details, source hashes and limitations:
[workspace recovery audit](symphony-workspace-integration-2026-11-11.md).

Linear-first follow-up: all 59 In Review issues were matched to workspace and
workpad evidence; none supplies an additional complete contribution to merge.
SHE-89 remains In Progress: the recovered existing Future Machine examples are
a useful tested subset, not completion of its canonical receipt/validator scope.
SHE-179 is already Done and merged. No tracker status or original workspace
was changed. Detailed issue-by-issue findings are in the workspace recovery audit.

## Unblock audited Symphony tasks — November 11, 2026

User authorized parallel unblocking after the Linear-first audit. Complete the
following small integrated slice before widening the 59-task review queue:

| Owner / slice | Prerequisites and acceptance | Status |
| --- | --- | --- |
| SHE-79 manifest load boundary | Preserve existing paired recipe/manifests; reject unsupported IDs, versions, missing seeds and invalid optional display names with actionable diagnostics before replay; valid saved fixtures load unchanged. Own data module and focused tests. | Locally integrated and independently verified |
| SHE-115 bounded worker lifecycle | Recover old WIP without changing its workspace; verify timeout, abort before/during work, cleanup/termination, single settlement and isolated successful work through current API. Own City worker helper/API and focused tests. | Locally integrated and independently verified |
| Shared operational blockers | Check actual current isolated-clone policy and manual procedures, run disposable real Git sandbox proof and offline host tests; preserve current dispatcher, workspaces and credentials. | Existing repair verified; no host changes required |
| Coordinator integration | Independently review commits, combine nonoverlapping slices on this local branch, run relevant regressions, retain source provenance and report exact remaining external gates. | 68 combined tests / 629 assertions and two browser checks passed |

Risks: the older receipt/validator chain remains a distinct contract decision;
SHE-79 is not a general receipt import implementation. Active host repair sources
are uncommitted in the primary checkout and will not be swept into this branch.
No task is marked Done or bulk relabeled based on stale workpad claims. No main
merge, deployment, production data change or unrestricted sandbox is authorized.

Delivered increment on local `codex/merge-complete-symphony-20261111`:
SHE-115 worker commit `060c26e` integrated as `8c40ed6`; SHE-79 worker commit
`01bf424` integrated as `81690ca`. The latter validates the existing completed
Future Machine manifest boundary, not a new server-wide scenario catalog.
Coordinator reviewed both diffs, ran the combined 68-test backend/data/receipt
suite (629 assertions) and two real normal-entry browser checks (7.7 seconds).
Valid seed-42 month-16 replay/WHY still shows +24 homes; deliberately malformed
display metadata produces a visible safe error before any replay request.

Operational verification: 49 offline host tests, 55 cached workspace/config
ExUnit tests, and one real OS-sandbox Git fixture passed. Fresh independent
clones contain their Git metadata and use the existing stable manual procedures.
Old linked workspaces remain preserved and are not automatically reusable.
SHE-79 and SHE-115 were moved from blocked-review handoffs to In Progress during
implementation; no ready/pilot dispatch labels or Done states were applied.
They await publication/review of this local branch. SHE-83/SHE-84 canonical
receipt work, other task-specific prerequisites, participant evidence and media
access remain separate scope. No bulk requeue, dispatcher restart, push, main
merge or deployment was performed.

## Publication gate for the unblock slice — November 11, 2026

User authorized publication/review for Symphony consumption. Published branch
`codex/merge-complete-symphony-20261111` as PR #26 against the sprint branch;
independent review found no actionable runtime issues (19 focused tests / 264
assertions). CI now runs the 68-test unblock regression and two normal-entry
browser checks and retains browser artifacts.

First hosted run `43146419857` passed existing unit contracts, all new unblock
regressions and Chromium installation, then failed three older release-browser
expectations: catalog count 29 versus registered 31, saved navigation inside
collapsed World controls, and an error expectation superseded by working Canvas
fallback. Required gates remain enabled. Targeted harness repairs preserve all
registered IDs and exact saved checkpoint/House/fork/replay assertions while
exercising the actual controls and renderer fallback. Full hosted verification
must pass before merge; current publication/merge status is authoritative at
https://github.com/adnanwahab/happybearlandia/pull/26.

## Symphony recovery prerequisite slice — November 11, 2026

Recovery mission: prove operational prerequisites before the first new dispatch.
Own new `ops/symphony/workspace_preflight.py` and its focused tests plus the
recovery note; preserve active peer ownership of installed hooks/coordinator and
throughput work. Acceptance: contained disposable clone, real sandbox local
commit, approved sprint fetch, locked dependencies/imports, sanitized auth/error
checks and cleanup. No label, merge, deployment or scheduler side effects.

Eleven focused regression tests and19 total ops tests pass, including shared metadata, alternates,
symlinks, disk, permission denial, secret sanitization, credential-file refusal
and timeout descendant cleanup. Initial real host probe passed all checks at
sprint870c0ca. Two further full clones hit180second timeouts; the copied-object
cache path passed all9 real checks against0d115ec in5.9seconds, including the
corrected credential guard, remote fetch and actual sandbox commit/imports.
Browser behavior is unchanged. Hook installation and continuous queue proof are
separate operational gates, not implied by preflight success. See
[recovery evidence and candidate ownership](symphony-recovery-preflight.md).


## SHE-180 safe backlog coordinator package and activation

Package the standalone coordinator and minimal extracted host adapter without
changing the existing Symphony workflow, sandbox, publisher or unrelated source.
Original installed-host80-test evidence is retained separately from the clean
package test run. Requirements/gaps for SHE-126/127 are explicitly mapped in
docs/symphony-coordinator-reconciliation.md; neither issue is marked Done.

Actual live read-only audit succeeded on175issues/17PRs. It found30reserved active
issues and incomplete ownership; no safe three-issue batch is approved by this
snapshot. Do not weaken these gates, bulk-reset statuses or infer stopped claims
from an idle dispatcher. User-authorized live pilot remains conditional on real
candidate readiness. Publish this working package as draft only; no merge/deploy.
Acceptance and exact test/audit evidence: docs/she-180-coordinator-evidence.json.

## Symphony throughput increment — 2026-11-11

Measured next slice: reduce PR30 coordinator's per-issue API fanout, run bounded
recurring reconciliation of explicitly reviewed tasks, persist redacted throughput
events/resource samples, and extend the installed Symphony dashboard with those
metrics. User authorized profiling, implementation, safe empirical experiments
and draft sprint PRs; no main merge/deploy/production-data changes. Preserve all
approval/ownership gates and original workspaces. No automatic backlog approval.

Baseline: live concurrency1, zero running/retrying, 10s poll; about28GiB swap and
35GiB free disk in two five-second resource samples. PR30 scan evidence recorded
877Linear reads for175issues. PRs27–29 were coordinator-delegated tasks, not
Symphony dispatches, so they cannot prove eligible-to-claim/reasoning latency.

Ownership: scan worker owns backlog_coordinator.py and its tests; scheduler worker
owns throughput_policy.py, throughput_scheduler.py and tests; metrics worker owns
throughput_metrics.py and tests. Coordinator owns shared interfaces, integration,
native dashboard overlay/install, live verification and report. All workers use
independent clones; no remote credentials or autonomous production actions.

Acceptance: unchanged fail-closed schema/pagination/ownership semantics; measured
complete scan reduction; restart-safe single-host leases and no duplicate grant;
resource pressure holds new grants without killing work; ranked fast/feature/
research lanes preserve trusted approvals; real loop records events and serves
real utilization in existing dashboard. Focused tests, full package integration
checks, native dashboard compile/tests and browser smoke before reviewable PR.

Risks: live unknown ownership and28GiB swap may block actual useful-ticket scaling.
Report that honestly; no claims of4/6/8/12 live capacity from synthetic tests. Keep
one active Symphony worker until accepted changes/worker-hour and resource health
justify gradual scaling. Rollback backs up installed files/config and retains
leases/events; do not destroy state or reset active workers.

Implemented increment: complete batched scan, durable weighted lanes, guarded
recurring scheduler, private SQLite events/resources and native dashboard overlay.
Live175-issue scan:18logicalLinearreads/24GitHubcommands/0GitHubretries/21.196s;
prior logical count877. No end-to-end throughput improvement claimed. Quality
rates without event history remain unavailable. Host cap restored1; additive
pressure-release filter holds dispatch. Read-only observer installed; no approvals
or workers launched. Test evidence and operational limits are in
`docs/symphony-throughput.md`; pressure config/test patch is reviewable alongside
the installer. Native formatter/lint/build/305tests(0failures,6skips)/100%coverage/
Dialyzer passed; installed-host164tests passed; package102tests passed; actual
Playwright dashboard smoke passed without page errors. Retain current approval
hold, review ownership individually, then measure nonduplicate useful tickets at
concurrency1 before considering4/6/8/12. Human review required before merging.
## Independent agent-count review repair — November 11, 2026

PR34's bounded synthetic metric interface can accept a positive finite duration
whose derived throughput overflows. JSON then changes Infinity into null,
contradicting the zero-duration unavailable contract. Repair only the metric
rate calculation, focused tests and its contract documentation; preserve models,
counts, provenance and operational ownership. Acceptance: reject overflow for
both pair and tick rates; retain finite extremes, empty runs and zero-duration
semantics. No browser behavior change or deployment. Actual focused/integration
verification:34tests passed,530assertions,10.37seconds using30second per-test
limit; whitespace clean. Default5second baseline timing failure remains recorded
in recovery evidence; assertions were not removed or weakened.

Published draft PR #30, first package commit f4072a0. Actual CLI dry-run exit0,
175issues/21PRs/28reserved/0selected; no lease file. Standalone44pass and post-extraction
installed-host93pass. SHE-126/127/180 reconciliation comments link the draft and
retain incomplete status. Live pilot and recurring scheduler remain held by
specific readiness reservations, not silently enabled. Full JSON reports are
atomically written mode600; publication excludes raw issue comments/descriptions.


## Host workpad oversized-update retry-loop repair

Observed42,212-character handoff against40,000-character contract could fail both
host phases repeatedly without parking. The repair durably preserves exact raw
JSON, keeps original pending/publisher/history/implementation untouched, removes
only pilot approval, appends a bounded truthful rejection receipt and returns
nonzero before publication. A concurrent replacement guard avoids acting on a
superseded request; retries reuse archive/receipt. No workflow/scheduler, issue
source, live handoff or publisher-policy edit. Existing publisher runtime is
versioned unchanged solely as the workpad dependency missing from the repository.

Focused35tests and installed-host106tests passed, including fresh-process shell
short-circuit, exact40000/40001 boundary,42,212 Unicode/format-preservation,
API/write/interruption/retry, pressure-label preservation and no lost history.
Earlier unrelated exact-label assertion failure retained and resolved separately
by runtime owner. No live issue mutation, recovery command or agent launch here.
Acceptance/evidence and operator recovery: docs/symphony-workpad-oversize-repair.md.

Fresh clean-package gate:92tests passed; latest installed-host164passed
(other owners expanded the suite after the earlier106-test pass). Private readback
`/private/tmp/hbl-workpad-oversize-repair/`; no live hook invocation/issue mutation.

## Trusted-host Git publication slice — November 11, 2026

User authorizes isolated clones and a source-only worker contract: no sandbox Git metadata writes, unrestricted sandbox, main merge or deploy. Audit finds existing clones but instructions still require worker commits and `.git` handoffs; publisher lacks trusted scope enforcement. Next slice moves handoffs to `.hbl-handoff/`, stages a bounded exact-file snapshot into host-private Git storage without repository config/hooks/filters, commits/pushes/drafts/links through the existing publisher. Trusted per-issue assignment authorizes paths and baseline; model input cannot expand it. Preserve legacy workspaces/handoffs and all ignored state; fail closed on stale base, ambiguity, auth/scope/secret/symlink/race failures.

Acceptance: real source edits allowed while native `.git` writes stay denied; preflight covers shared metadata, failed fetch/commit, absent auth, duplicate publication and retry after partial publication. Test real Git with controlled remote fixtures; run one explicitly reviewed approved issue to a real draft sprint PR and Linear URL with no competing worker. Runtime concurrency/filter/resource holds remain unchanged. Ownership here: local publisher/workpad/isolation/worker procedures and focused tests only; scanner/scheduler/dashboard remain with their existing owner.

Delivered source slice: `host_git.py`, `handoff.py`, `prepare.py`, trusted publisher/workpad and independent-clone hooks implement exact-file assignments, source hash/mode checks, private deterministic commits and recovery receipts. Procedures and workflow tell workers to edit/test/handoff without Git writes. All previous workspace roots remain intact. Host installation made private before/after hash backups; never replaced unrelated runtime fields.

Acceptance evidence (2026-11-12 UTC): current checkout `/usr/bin/python3 -m unittest discover -s tools/symphony/local -p 'test_*.py'`:132passed/8.610s. Native `codex sandbox -P :workspace` source probe: sourceEdit=true, gitMetadataWriteDenied=true without metadata exception. SHE-121 resumed the original approved worker's retained real implementation in an independent clone pinned173f9530752b0e476583ad3ee7433b57a857b6bd;6unit tests/27assertions in native workspace-write,7trusted-host browser tests/3.0s. Trusted publisher created commit4845c3dadc1cc32c6d6e42b64cf6583410884b79 and draft https://github.com/adnanwahab/happybearlandia/pull/40 against the requested sprint, exactly10assigned paths, verified uploaded screenshot, real Linear attachment, pilot label removed. All pre-existing worker `.git` files including index/HEAD/refs retain hashes; host added only its legacy-compatible workpad snapshot. Original workspace/ignored state retained.

Limits: this is a recovered real-worker pilot; no fresh model was dispatched under memory pressure. Native runtime owner separately removes an implicit `.git` grant, verifies actual app-server policy and pins workflow against concurrent external edits. Installed combined190-test run had189pass and an unrelated Python3.9 scheduler HTTPError-close regression reported to that owner; the132-test publication package passes. No merge/deploy or bulk approval. Final retry/runtime evidence is recorded in `docs/symphony-host-git-evidence.md`.

Final coordinated gates: installed213Python tests now pass after runtime owner's scheduler fix; native310tests/0failure/6skipped plus all static/build gates. Pinned runtime cap1/max_turns20/source-only/dualfilter verified; live API0running/0retrying/0blocked. Actual app-server policy source-root-only. Live publisher repeat remains blocked by coordinating chat's automatic approval review citing earlier no-push restriction; its explicit approval request remains pending. No workaround, duplicate model, merge or deployment. Repair draft https://github.com/adnanwahab/happybearlandia/pull/42 (initial9611a46), pilotdraft40 and source evidence preserved.

Follow-up: one newly approved live repeat failed generically. Fixed actual-CLI module duplication that hid safe PublicationError reasons; genuine subprocess regression fails before/passes after, full133tests pass. Installed with backup/issue lock. No further live retry without separate approval; original PR40/receipt unchanged, underlying historical failure unrecoverable from redacted result. See evidence update.

## Permanent trusted assignment lifecycle — November11,2026

Implement admission inside the existing backlog coordinator: persist reviewed exact-file assignment before execution label, durable crash recovery, explicit standing-authorization renewal and existing verified handoff release. Extend the existing scheduler cycle rather than add another approval poller. Add host runtime/worktree/assignment conflict inventory, disposable deterministic lifecycle tests and macOS supervision templates with credential-free service definitions. Preserve all current workspaces and runtime ownership; no restart/concurrency increase without controlled verification. Live83/142/165 recovery depends on current host reviews, baseline, dependencies and exclusive scope; ready labels/descriptions do not create authority. Acceptance includes before/after-crash/label tests, idempotent reconciliation, expiry/revocation/baseline/conflict/symlink holds and full disposable replenishment. Live execution is conditional on actual operator evidence and resource holds, not a populated queue.

Delivered permanent assignment slice: existing coordinator now persists exact reviewed assignment and admission journal before labels, repairs only authorized orphans, and renews only explicit standing grants through safe maintenance. Receipt-backed handoff release, host ownership/freshness checks and launchd bootstrap/templates implemented without activating a second service.215source tests and238installed tests pass; disposable plists pass plutil; review-driven renewal/revocation regressions verified. Installed12files with private checksum backups and preserved deployed cache adapter. Live captured178issue/34PR audit plus fresh local state:0selected/28reserved; existing83human policy preserved,83/142staged reviews stale/ownership unresolved,165scope unreviewed.0live assignments created;0workers/0retries, concurrency1 unchanged. Memory/swap and missing approvals block actual worker validation/scaling; no live execution success claimed. Exactfiles, commands, supervision instructions and limits in docs/symphony-assignment-lifecycle.md and local/ASSIGNMENTS.md. No service activated, merge, deploy or source cleanup.

Final integration acceptance supersedes intermediate counts: source220pass/27.869s; installed243pass/20.145s. Added shared publisher validator (100files/64KiB/canonical ID/stable failure codes), held issue lock and final policy validation through remote label addition, and durable supervisor budget across launchd invocations. Redacted status distinguishes trusted admission vs execution labels and leaves review decisions unknown. Both final plists lint; no services/assignments/labels/runtime activation. Existing observer remains read-only/older version pending operator handoff. Feature6c506a0 provided to coordinating integration owner; detailed final evidence in docs/symphony-assignment-lifecycle.md.
