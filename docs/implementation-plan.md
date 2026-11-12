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

## Local Symphony pilot repair (2026-11-11)

Slice: opt-in Linear issue -> independent clone -> required tests -> GitHub draft
PR against `sprint/one-city-two-futures-20261111` -> human review. One worker.
Prerequisites: authenticated Codex/Linear/GitHub, reachable sprint branch, one
operator-audited symphony-pilot issue with completed blockers and explicit file
and interface ownership. Existing shared worktrees are preserved, not migrated.

Tasks: back up workflow/hook; configure a separate clone root and per-attempt
isolation check; enable existing label filter; gate initial and retry dispatch on
resolved dependencies; supply real missing-skill procedures; require validated
draft PR before In Review; park blockers by removing the pilot label.

Acceptance: local Git fixture verifies isolated clone/fetch/merge/commit and
rejects shared metadata. Runner tests verify dependency and label eligibility.
Workflow rendering verifies blocker and draft-only instructions. Actual results
and pilot commands are recorded in tools/symphony/local/README.md.

Risks: independent full clones cost disk/time. Ownership and PR/Linear handoff
remain agent instructions, not server-enforced transactions. Required test,
media, credential and dependency failures remain blockers. No live pilot, remote
state changes, merge or deployment are authorized by this repair.

Read-only backlog evidence: SHE-81 is In Review without PR attachment and its
preserved workpad states implementation/ownership audit incomplete. SHE-170's
prose depends on HBL-1M-014 (SHE-141), but blockedBy is empty; SHE-141 is still
In Review. Structured dispatch gating cannot infer prose dependencies. Pilot
readiness requires explicit operator audit and ownership assignment, documented
in the local runbook. No tracker corrections or requeue were performed.

## Repository README and architecture illustrations (2026-11-11)

Updated the existing root `readme.md` with the flagship journey, local startup, actual
experience routes, code map, focused verification commands, and design/release
references. Added `docs/images/architecture-current.svg` and
`docs/images/architecture-target-2027-02.svg` as editable, accessible diagrams.
The February 11, 2027 architecture is a proposed three-month direction, not a
shipped integration or delivery commitment. It preserves independent model
state authorities and makes identity/time/metric mapping a prerequisite.

Preserved the earlier README sketches and references in `docs/original-readme-notes.md`.

Acceptance: local documentation links resolve; both SVGs parse and were rendered
in Chromium and visually inspected without clipping. README commands and routes
were checked against package scripts and existing module/entry documentation.
`git diff --check` passed. Documentation-only change; no application behavior,
deployment, or new end-to-end test run. Operational and cross-model goals remain
future work under their existing acceptance gates.


Status: local repair implemented and verified. Final build, format, specs/Credo,
coverage (301 tests, 0 failures, 6 opt-in live tests skipped; configured coverage
100%) and Dialyzer (0 errors) passed. Offline Git fixture and installed Codex
sandbox Git fixture passed, as did hook syntax and tracked diff whitespace checks.
No browser test required for this orchestration-only change. Existing dependency
advisories were reported by Hex; dependencies were not upgraded. The live pilot,
remote auth/media/PR integration, backlog ownership approval and SHE-81 recovery
remain intentionally unexecuted. No commit/PR reference: no staging, commit or
remote writes performed. See the local runbook for the exact authored manifest.


## Symphony trusted host GitHub publication repair (2026-11-11)

Implemented the smallest local-commit-to-draft-PR slice in
`tools/symphony/local/publish.py`, invoked through the existing host after_run
hook. Prerequisites are host gh Keychain authentication, host Linear access,
one approved SHE issue with a persistent workpad, and an independent clone.
Codex retains workspace-write; GitHub token environment inheritance is removed
and standard plaintext credential files fail preflight. Existing workspaces
and symphony-pilot dispatch filtering are preserved.

Acceptance: exact issue/path/branch/base/repository/SHA validation; clean index
and worktree; current sprint-base ancestry; explicit non-force issue-ref push;
verified open draft PR; persistent workpad link; parked successful dispatch;
host lock and idempotent reconciliation across push/create/link retries. No
agent-side GitHub auth, merge, deployment or real publication was performed.
The host never executes workspace Git hooks/configuration during publication.

Verification: 13 offline publisher tests and the existing isolation fixture pass;
Python compilation, hook syntax and tracked whitespace checks pass. Live host
GitHub/Linear writes remain intentionally unexecuted. See local README for exact
pilot/retry instructions and credential storage assumptions. Full Symphony suite rerun: 301 tests, 0 failures, 6 opt-in live tests skipped.
The initial run found a fixed workflow wording assertion and a retry-timing
failure that passed on rerun. No commit or PR created by this repair.


## Symphony host workpad bootstrap repair (2026-11-11)

Slice: trusted before_run creates/reuses the single workpad before Codex starts;
after_run consumes a bounded local JSON status/evidence update before trusted
GitHub publication. Reuse publisher transport and host lock, stable creation UUID,
complete comment pagination and in-place updates. Prerequisites: approved active
pilot issue, isolated clone and host-only Linear key. Preserve never approval,
workspace sandbox, label filtering and publisher validation. No agents or remote
mutations authorized during repair.

Acceptance: new/existing/ambiguous comments avoid duplicate creates; multiple
workpads fail closed; transport retries redact errors; failed updates retain the
request; blocked updates park dispatch and prevent publication. Local runbook
includes SHE-179 operator-only recovery. Risks: remote API/auth not exercised,
one dispatcher required, external comment writers require manual reconciliation.
Validation: offline local suite 21 tests passed, including seven new lifecycle
tests; isolation fixture passed; full Elixir suite 301 tests, 0 failures, six
opt-in live skips. Python compilation and diff whitespace checks passed. No browser change.
No commit, push, merge, deployment or remote tracker update performed.


## Persistent UUIDv4 host workpad identity (2026-11-11)

Repair scope: `tools/symphony/local/workpad.py` and the existing host Linear
transport in `publish.py`; preserve sandbox/workflow configuration, pilot
filtering, publisher validation and existing workspaces. Prerequisite is trusted
host-private state, not workspace-provided identity or configuration.

Acceptance: persist a single UUIDv4 per immutable issue ID atomically before
creation; re-read existing workpads before writes; serialize concurrent local
bootstraps; reconcile ambiguous responses and fail closed on duplicates or
invalid/interrupted state. Report sanitized HTTP/GraphQL validation failures
without credentials, headers or arbitrary remote body text. Test only offline
with mocked Linear and temporary private state; no live mutations or agents.

Implementation delivered and verified: `HBL_TEST_CODEX_SANDBOX=0
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/symphony/local
-p 'test_*.py' -v` passes **49 tests**. Includes UUID version and private modes,
actual fresh-Python-process identity reuse, concurrent bootstrap serialization,
interruption before/after atomic rename, duplicate and ambiguous-create
reconciliation, sanitized GraphQL validation/HTTP errors, existing publisher
contracts and offline isolated Git fixtures. Syntax and whitespace checks pass.
Browser checks skipped because no browser behavior changed. No live mutation,
agent launch, push, repository merge, deployment or workspace migration ran.

Remote eventual visibility and independent external
writers remain a service boundary: one trusted host receipt/lock prevents local
duplicate creates; multiple live workpads always require manual reconciliation.


## Continuous coordinator resumption (2026-11-11, ec408d0)

Audited original six assignments, actual worktrees and durable queue. Existing
R01/R04/R06/R11/R12 delivered; U03 is REVIEW, not historical RUNNING. Independent
candidate gates: Canvas lifecycle8pass, actual Canvas/WebGL/MetalGPU resources3pass;
current-source combined121pass/3skip/947assertions. No product edits or integration.
Next slice: integrate existing scoped U03 through normal candidate/integrated gates
once unrelated dirty checkout changes are reconciled by their owners; then claim
U05 KPI semantics test for the existing UI worker. Review depth3 and retained
R13/R14 reservations prevent new dispatch; do not steal assignments or expand
failed scopes implicitly. R13/R14 release failures retained, no release approval.
Acceptance, owned paths, prerequisites and actual evidence recorded in
coordinator-next-dispatch.json and coordinator-resumption-status.md. No worker,
remote mutation, push, merge or deployment performed. Browser results recorded
in the resumption evidence after completion; earlier recording stays historical.

Resumption final checks: current-source canonical13pass/1recordingskip,
responsive1440/390/320 threepass, saved-share/missing/corrupt/boundary fivepass;
zero failures. Hashed fresh artifacts and source-qualified U03 candidate proof
in coordinator-resumption-evidence.json. Integration remains held, not claimed.

## SHE-180 safe host backlog coordinator (implementation slice)

Build a separately invoked host coordinator: paginated read-only Linear/GitHub
inventory, conservative native/prose dependency and duplicate/ownership holds,
host-reviewed readiness evidence pinned to issue content/base SHA, durable
approval leases under one host lock, and opt-in additive pilot-label approval.
Default dry-run performs no remote mutations or lease writes. Cap three approval
leases initially; existing dispatcher remains concurrency one and unchanged.
Reuse local publish.py Linear transport/private-state conventions; do not reuse
legacy bulk intake or turn review labels into dispatch labels. SHE-126 workpad
confirms no delivered checklist; SHE-127 has no delivered report. Record this
reconciliation in the coordinator runbook rather than claiming those tasks done.

Acceptance: all project issues/connections/PR files paginated, missing evidence
holds; exact scope/tests/acceptance/base/operator review required; existing PRs
and active ownership block overlap; persist-before-write and reconcile ambiguous
label mutations; no running-task interruption/automatic expiry/reapproval;
restart/concurrency/retry and controlled three-issue offline pilot tests. Live
three-issue pilot remains unauthorized under the ticket's planning-only status.
Risks: prose cannot be proven semantically complete by regex, so require explicit
human dependency audit and map aliases; independently operated hosts/label writers
are outside flock. API snapshots cannot make multi-service reads transactional.
No workers, live approvals, push, merges or deployments during implementation.


## Symphony verified-throughput mission (2026-11-12 UTC)

Window: initial runtime audit approximately03:00 UTC through06:00 UTC. Restore
Linear → sandboxed Codex → trusted host publisher → draft sprint PR, then only
replenish independently verified eligible tasks. Never merge/deploy or modify
production data. Preserve frozen One City Two Futures interfaces and old clones.

Observed root cause: live PID35041 loads tools/symphony/elixir/WORKFLOW.md and
requires symphony-pilot, absent from all175 project issues. Applied concurrency1
by supported workflow reload and explicit single-issue approval; retain the
pilot gate rather than switch to separate PR20 dispatcher. Local49 offline
Python pipeline tests pass. Codex/GitHub Keychain auth and push permission pass.
Swap28.7GiB/29.7GiB prevents scaling until resource recovery is demonstrated.

First integrated slice: SHE27 isolated clone synchronized losslessly to f1174eb;
CI file ownership reserved; historical branch instruction explicitly reconciled
to symphony/SHE-27 for host publisher. Actual app-server sandbox verified
workspaceWrite/never. Commit be4c17c pushed by host; verified draft PR25 targets
sprint/one-city-two-futures-20261111, exact SHA matches host receipt.81 local
unit tests, YAML semantic comparison and diff check pass; all workflow commands
retained. Ubuntu24.04 Chromium install passed in real PR run43146084856; browser
suites still running. No claim of completed acceptance until remote checks read.

Prerequisites for next three-task batch: complete pilot check verification,
disjoint file ownership, no unresolved dependencies or duplicate implementation.
SHE79/SHE115 have clean committed implementations on existing local integration
branch b66a394; preserve rather than dispatch duplicates. SHE141 is a prospective
metric-contract owner pending historical claim reconciliation; SHE60/SHE61 are
prospective genuine operations/dependency audit tasks outside frozen app files.
No additional pilot labels applied. Full read-only eligibility report and live
worker/publication/resource evidence: tools/symphony/local/dispatch-report.md.

Risks: old review states lack linked PR attachments and require per-issue proof;
description-only blockers remain human audit; external CI/DNS/auth may block.
All incomplete work remains active/parked, not falsely moved to review or Done.

SHE-180 continuation: reuse the partial local coordinator and fixtures. Complete
immutable retained ownership, conservative release/retry reconciliation, complete
paginated inventory tests, private CLI audit/error output and the operator
evidence/runbook. Acceptance includes a repeatable offline three-issue pilot,
restart and concurrent-process tests and publisher/workpad regression coverage.
No change to live Symphony configuration, publisher or bootstrap; no live label
approvals or pilot launches. SHE-126 remains In Review with a workpad explicitly
reporting no implementation; SHE-127 remains Todo with no delivered comments or
attachments. Their existing contracts inform this implementation; neither ticket
is declared delivered or silently reassigned. Separate ops-branch artifacts must
be reconciled before enabling the host approval job.

## Release and backlog coordination — SHE-60 / SHE-61 / SHE-43 (2026-11-11)

Next end-to-end slice: three independently owned audit/procedure changes from
remote sprint f1174eb, each with targeted validation and a draft sprint PR. One
worker per issue; no live Symphony approval or concurrency change. SHE-60 owns
release-operations.md and new issue-specific dry-run tooling/evidence; SHE-61 owns
new dependency-browser-risk-audit report/tool/test/evidence; SHE-43 owns new
static-asset-caching-audit report/tool/test/local evidence. Coordinator owns this
plan and shared files. Existing U13/R01/R06/Worker6 browser/renderer and SHE-27
repair claims are retained; canonical suites, CI, server.js and release-checklist
are read-only to these workers. Open PR inventories and retained U03/R13/R14
pipeline reservations were checked and do not overlap the new paths.

Acceptance: actual Fly conventions and schema-safe recovery gates, reproducible
non-destructive procedure checks; dependency advisories separated from confirmed
exploitability and source-qualified browser evidence; measured localhost caching
inventory without unsupported immutable caching claims. GitHub environments are
empty and no approved HBL Fly staging target is established; SHE-43 staging
measurement remains blocked. No production commands/rollback/deploy or merge.
Implementation/status evidence: docs/release-backlog-coordination-20261111.md.


SHE-180 implementation status: local coordinator delivered in
`tools/symphony/local/backlog_coordinator.py`; operator runbook
`COORDINATOR.md`, disabled evidence template, README link and 31 focused tests.
Reuses host publisher Linear transport/private-state helpers. Keeps current
workflow byte-for-byte outside this implementation's scope: pilot gate,
concurrency1, never approval, workspace-write, workpad/bootstrap and publisher.
Native duplicate relations, archived issues, all connection pages, conservative
prose/alias audit, PR/source evidence, scope/interface mutexes and trusted review
freshness fail closed. Pending leases pin the complete review and survive API
ambiguity; released approval capacity retains file ownership for open drafts.
Two real coordinator processes sharing an offline service fixture prove three
claims/no duplicates, restart reconciliation and fourth-issue replenishment.

Actual final verification: 80 local Symphony tests passed, including 31 new
coordinator tests; CLI dry-run report path exercised with fake services; Python
AST parsing, disabled JSON parsing and tracked whitespace checks passed. Captured
source hashes were unchanged during the final suite. Concurrent local safety
edits were reviewed/preserved; a duplicate GraphQL argument and sanitized symlink
error mismatch were corrected before the passing final run. No browser test
required for this host-only change. Full Elixir suite was not rerun because no
Elixir/workflow source changed.

Remaining acceptance: controlled live three-issue pilot and remote schema/auth/
service-consistency proof require separate operator activation, per SHE-180's
explicit planning/implementation-only status and SHE-126/127 overlap gate. No
live approvals, scheduler installation, agent launches, tracker writes, push,
commit, merge or deployment. Source/base and clean-clone/test readiness use fresh
explicit human evidence; the coordinator does not claim to execute ticket tests
or semantically understand arbitrary prose. Exact checks/hashes and authored
paths: docs/she-180-coordinator-evidence.json. Next: operator reviews the disabled
runbook/config and authorizes the controlled live pilot only after overlap and
ownership reconciliation.

Verified implementation status: all three independently tested increments now
have draft sprint PRs: SHE-60 #27 (3727248), SHE-61 #28 (ec91298), SHE-43 #29
(ef70736). Latest source base f794ba2 incorporated losslessly after a freshness
guard; original implementation commits retained. Current-base combined checks:
34 pass/0 fail/1 existing skip/313 assertions; SHE-61 also2 Chromium passes,
SHE-43 has32 successful local GET/HEAD measurements. Exact scopes, individual
commands/results and pending hosted/staging gates are recorded in
release-backlog-coordination-20261111.md. No pilot labels or live dispatch;
SHE-43 remains blocked on approved staging acceptance, not marked In Review.

Final hosted verification passed on all three published heads (runs43148260243,
43148330528,43148403705). An external action subsequently marked the drafts ready
and merged #27/#28/#29 using adnanwahab; this task made no ready/merge call.
Do not claim they remain drafts awaiting review. External integration also marked
all three Done; SHE-43 was restored to In Progress because approved staging
HTTP/edge verification remains unmet. Full merge SHAs/timestamps and operator
actions are in release-backlog-coordination-20261111.md. No deployment, production
request, production-data mutation or source revert performed here.


### Symphony post-pilot batch03:37 UTC

Pilot PR25 is verified green(run43149012069) and separately merged into sprint
870c0ca; SHE27 Done. Explicit user-owned bounded World/browser repair preserves
exact saved navigation, Canvas/fatal fallbacks, all registry entries and frozen
model interfaces. Combined149unit/13release-browser checks pass; independent
ops additions17unit checks pass. Full remote checks pass.

Next integrated slices approved exactly SHE59/SHE141/SHE121, serial worker1:
100seed real City replay digest/mismatch harness (SHE9 canonical dependency
verified Done); executable six-count/evidence/rate contract with bounded measured
CPU fixture; honest merged-and-deployed-evidence-only Tools changelog, initially
empty because no deployed-version evidence is invented. Disjoint new paths and
acceptance recorded on issues; workers retain workpads/feature docs and leave
shared plan/CI/frozen interfaces to coordinator. Independent clean clones include
current merged baseline; no existing work discarded. Only SHE59 currently runs.

Live new-workpad bootstrap proves UUIDv4 and private0600/0700 host state. Next:
verify actual commits, draft sprint PRs, check outcomes and Linear links; then
replenish only audited unblocked ownership scopes. No main merge/deployment.

## Oversized host workpad retry-loop regression

Bounded repair: host workpad sync and offline tests only; no workflow, scheduler,
SHE-141 workspace/source/handoff or live publication edits. A valid status with
notes above40000chars currently remains pending, fails after_run, and then fails
before_run on every retry without removing dispatch approval.

Acceptance: preserve exact rejected JSON bytes durably in host-private state and
leave the original pending file/publisher request untouched; park only the pilot
label through the trusted host; append a bounded truthful rejection receipt while
preserving existing workpad history; return nonzero to prevent publisher handoff.
Both before/after phases must recover this case; retries reuse the same archive
and receipt. Archive/API failures must not claim success or lose input. Detect a
concurrent input replacement before parking. Test40000/40001 boundaries, original
42212-character regression, Unicode, retry, failures and normal successful updates.


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


### Symphony mission external hold04:03 UTC

Verified original draft pipeline produced merged PR25/SHE27, PR32/SHE59 and
PR34/SHE141 with green hosted checks. Independent seed report106/106 zero
mismatches/source hashes match,5targeted tests pass; metric contract33tests pass.
SHE121 clean committed/host-validated (6unit/7browser checks) but unpublished;
normal handoff preserved. SHE126 clone ready, no implementation; its approval
parked. Existing user-assigned runtime owner retains pressure gate; do not
bypass extra symphony-pressure-release requirement or resume model workers.
Dashboard and APIs healthy, read-only observer running,0active/0retrying, worker
cap1. Whole backlog not complete; end-to-end sustained three-hour throughput
not established. Resume requires operator resource/readiness clearance and
current-base verification, then existing SHE121 publication and scoped SHE126/
newly unblocked CPU-oracle work. Full live evidence: tools/symphony/local/dispatch-report.md.

Oversize regression delivered as draft PR #37, commit0ecb464, from an existing
filtered clean checkout (no extra clone/worker). Standalone92tests, focused35 and
latest installed-host164passed; earlier external guard/assertion failure retained.
Exact source/hashes and logs in private readback /private/tmp/hbl-workpad-oversize-repair/
and committed evidence. Publisher is versioned unchanged as the existing runtime
dependency; no workflow/scheduler, live issue metadata or publication recovery
actions performed here. Live SHE-121/SHE-141 recovery and SHE-126 allocation remain
other threads' responsibility; this task has no competing writer for those paths.


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


## Trusted-host Git publication slice — November 11, 2026

User authorizes isolated clones and a source-only worker contract: no sandbox Git metadata writes, unrestricted sandbox, main merge or deploy. Audit finds existing clones but instructions still require worker commits and `.git` handoffs; publisher lacks trusted scope enforcement. Next slice moves handoffs to `.hbl-handoff/`, stages a bounded exact-file snapshot into host-private Git storage without repository config/hooks/filters, commits/pushes/drafts/links through the existing publisher. Trusted per-issue assignment authorizes paths and baseline; model input cannot expand it. Preserve legacy workspaces/handoffs and all ignored state; fail closed on stale base, ambiguity, auth/scope/secret/symlink/race failures.

Acceptance: real source edits allowed while native `.git` writes stay denied; preflight covers shared metadata, failed fetch/commit, absent auth, duplicate publication and retry after partial publication. Test real Git with controlled remote fixtures; run one explicitly reviewed approved issue to a real draft sprint PR and Linear URL with no competing worker. Runtime concurrency/filter/resource holds remain unchanged. Ownership here: local publisher/workpad/isolation/worker procedures and focused tests only; scanner/scheduler/dashboard remain with their existing owner.

Delivered source slice: `host_git.py`, `handoff.py`, `prepare.py`, trusted publisher/workpad and independent-clone hooks implement exact-file assignments, source hash/mode checks, private deterministic commits and recovery receipts. Procedures and workflow tell workers to edit/test/handoff without Git writes. All previous workspace roots remain intact. Host installation made private before/after hash backups; never replaced unrelated runtime fields.

Acceptance evidence (2026-11-12 UTC): current checkout `/usr/bin/python3 -m unittest discover -s tools/symphony/local -p 'test_*.py'`:132passed/8.610s. Native `codex sandbox -P :workspace` source probe: sourceEdit=true, gitMetadataWriteDenied=true without metadata exception. SHE-121 resumed the original approved worker's retained real implementation in an independent clone pinned173f9530752b0e476583ad3ee7433b57a857b6bd;6unit tests/27assertions in native workspace-write,7trusted-host browser tests/3.0s. Trusted publisher created commit4845c3dadc1cc32c6d6e42b64cf6583410884b79 and draft https://github.com/adnanwahab/happybearlandia/pull/40 against the requested sprint, exactly10assigned paths, verified uploaded screenshot, real Linear attachment, pilot label removed. All pre-existing worker `.git` files including index/HEAD/refs retain hashes; host added only its legacy-compatible workpad snapshot. Original workspace/ignored state retained.

Limits: this is a recovered real-worker pilot; no fresh model was dispatched under memory pressure. Native runtime owner separately removes an implicit `.git` grant, verifies actual app-server policy and pins workflow against concurrent external edits. Installed combined190-test run had189pass and an unrelated Python3.9 scheduler HTTPError-close regression reported to that owner; the132-test publication package passes. No merge/deploy or bulk approval. Final retry/runtime evidence is recorded in `docs/symphony-host-git-evidence.md`.

Final coordinated gates: installed213Python tests now pass after runtime owner's scheduler fix; native310tests/0failure/6skipped plus all static/build gates. Pinned runtime cap1/max_turns20/source-only/dualfilter verified; live API0running/0retrying/0blocked. Actual app-server policy source-root-only. Live publisher repeat remains blocked by coordinating chat's automatic approval review citing earlier no-push restriction; its explicit approval request remains pending. No workaround, duplicate model, merge or deployment. Repair draft https://github.com/adnanwahab/happybearlandia/pull/42 (initial9611a46), pilotdraft40 and source evidence preserved.

Follow-up: one newly approved live repeat failed generically. Fixed actual-CLI module duplication that hid safe PublicationError reasons; genuine subprocess regression fails before/passes after, full133tests pass. Installed with backup/issue lock. No further live retry without separate approval; original PR40/receipt unchanged, underlying historical failure unrecoverable from redacted result. See evidence update.
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

## Improvement services: first shared slice — November 11, 2026

Audit actual sprint33e84c3, active worktrees, host workflow, CI and Linear before
implementation. Reuse merged SHE180 PR30/31/37, existing replay/benchmark artifacts
and current one-worker, dual-label resource hold. SHE7 is absent; SHE52/SHE120
are incomplete and overlap. Simulation feedback presentation is not consented
player collection. Existing research worktrees contain experiments, not an
OpenAlex/Crossref acquisition service. Preserve all of these owners and stores.

Central owner: this branch alone owns new ops/improvement core schema, private
SQLite proposal inbox, atomic receipts/cursors/budgets, CLI and read-only adapter
to existing coordinator reports. It stores proposed work, not simulation runs.
The default dry-run must not create state or contact services; --record writes
only the local inbox. Neither mode executes proposed test argv or grants labels.

Three separately owned follow-ons were created under existing product issues:
SHE246 (parent185), research metadata/cache in ops/improvement/research/;
SHE247 (parent189), evidence normalization in evaluation/;
SHE248 (parent196), consented aggregate triage in feedback/. Each owns its module,
fixtures and tests only, can test with an injected sink, and waits for the shared
contract before integrated handoff. No execution approval or live activation.

Acceptance for this slice: strict versioned source/hypothesis/acceptance/test/
dependency/dedup validation; transactional proposal + cursor ingestion; replay
and conflicting-revision behavior; durable restart and intake limits; no lost
cursor on failure; private state; dry-run zero filesystem/remote mutations;
existing-issue/PR/dependency hold projection from fresh complete coordinator
reports. Source references are structurally checked, not factual verification.
Paper retrieval, CI execution, feedback collection and live services are later
phases. Delivered core has 26 passing focused tests (independently rerun) and
150 passing existing coordinator regressions. A dedicated CI job runs the new
contracts. Real SHE180 dry-run scanned 178 issues with no selections. Actual CLI
default dry-run created no state; local record stored one proposal/checkpoint;
restart replay produced zero new proposals; final dry-run left DB bytes/mtime
unchanged. Existing SHE141 delivery was held rather than duplicated. Source
hashes and sanitized observations: docs/evidence/improvement-intake-smoke.json.
Independent review's corrupt-receipt finding was fixed and regression-tested.
No browser behavior changed; local Playwright is not applicable. Published
[draft PR #41](https://github.com/adnanwahab/happybearlandia/pull/41); hosted CI is
pending final-head verification. Next tasks are SHE-246, SHE-247 and SHE-248,
each linked to that contract PR. No execution labels or persistent service
activation were applied. User explicitly requested keeping the PR draft;
the separate merge/cleanup owner was notified to exclude it.
## Continuous Symphony backlog slice — November 11, 2026

Requested result: safely drain explicitly reviewed work through existing single
Symphony dispatcher, preserve source-only host publisher ownership, and test20
continuation turns without repeating completed implementations. Runtime owner
owns native lifecycle/parking, workflow agent limits, observer/cache/metrics;
separate host-Git owner owns hooks, publisher, workpads and SHE-121 recovery;
readiness coordinator exclusively audits/approves SHE-83 and SHE-142. No shared
issue-file claim or duplicate implementation is created by this slice.

Observed prerequisites: PR36 and PR37 merged; observer19cycles/0grants/0ready;
actual runtime externally restarted asPID97590, file cap2 vs observer1 untilreload.
Both required pilot+pressure-release labels remain. Approvals disabled, reviews
empty and no leases. Kernelmemorypressure2(warn),16GiBRAM,~19.3GiBswap means
no resource clearance; restore cap1 and retainhold. SHE79/141 Done does not prove
SHE83/142 absent or their file ownership approved. Source-only host hooks are
not installed yet and current workspace/publisher roots disagree.

Acceptance: terminal local handoff/blocked ends same-thread continuation atturn1;
incomplete work retains same thread/workspace up to20; after_runonce and failures
park with useful host-recovery reason rather than retry implementation; pending
publication cannot restart on next poll. Add strict local-only native overlay,
backup/restore and fullnativegates. Cached read-only inventory must carry age and
never satisfy an authoritative apply scan. No producer/dispatcher duplication,
blanketapprovals, skippedtests, merge, deployment or production mutation.

Verification plan: focused native realOTP/fakeappserver lifecycle+parking tests,
cache/privacy/freshapply regressions, integrated Python suite, required native
format/lint/coverage/Dialyzer/build only after idle-stop, real dashboard smoke.
If physical resource pressure persists, prove source-only publication with
retained tested SHE121 output through hostowner; do not claim an actual running
worker or end-to-end useful throughput absent observation. Pending independent
readiness/user capacity prerequisites remain explicit in final report.


Continuous-slice actual checkpoint: native makeall310/0fail/6skip and100%configured
coverage;173standalonePython3.9tests;214installed-hosttests. Actualruntimepolicy
nowonlycanonicalworkspace writableRoots, no implicit.gitexception. Between-turn
terminalhandoff+hookfailurepark tested; maxturns20 installed withcap1/dualfilter.
Unknownterminalinterferenceconfirmedbyuser: privatepinnedworkflow/runtimev2 now
ownsdispatch. Cachedobserveravoided2of3fullscans, keepsfreshapplyauthority. Real
retainedSHE121outputpublishedasdraft40viahostafter_run; oneexplicitlyapproved
idempotentretryfailedexit1 andwasnotrepeated; newCLIdiagnosticfixinhostownerPR42.
SHE83/142 pilotlabels exist butnoclaims/newmodeltokens; resource/cleanclone/25active
ownership/reviewholdsremain. Source-onlyassignments/readinessstagedinactive.
No live implementation occupancy or delivery-throughput improvement claimed.

Finaluserhandoff: keepotherterminalruntime; stopthiscoordinator'scompetingrestarts/configwrites. ObservedPID32399/sharedWORKFLOWcap1/20/dualfilter/0workers; privatev2preservedinactive. Read-onlyobserver33294/v5 usesactualworkflow. PR43draftrecordsfinalownership; productiveexecutionstillblocked,notclaimedcomplete.

## SHE-124 — explicit weekly retention denominators

Scope decision: browser-local, opt-in Reality Compiler session-cohort observations.
There was no analytics collection or matching open PR in the read-only GitHub
audit on 2026-11-12. This issue workspace is isolated on `mini/SHE-124`.
The analytics module owns its storage contract and dashboard; the only application
integration is completed comparison / successful shared-replay callbacks. No
simulation authority, model seed or run provenance changes.

Acceptance: distinct sessions after 30-minute inactivity, deduplicated callbacks,
separate play/shared denominators, Monday UTC half-open weeks, next-week return
windows, withheld immature rates and empty-cohort handling. Dashboard states
local scope, bot heuristics, storage limits and anonymous-session rather than
user counts. Collection excludes automation and browser privacy signals and
records no URLs, link IDs or simulation payloads.

Limitations: local session-cohort proxy; a later play session in this browser
qualifies earlier cohort sessions. Browser storage clearing and capacity eviction
cause missing observations; bots cannot be perfectly identified. Concurrent
localStorage writes can lose observations. Site-wide reporting needs a separately
reviewed collection, consent, storage and access-control contract.

Verification: `bun test test/weekly-retention.test.js test/reality-workflow.test.js test/reality-share.test.js` passed 17 tests / 99 assertions; `git diff --check` passed.
Attempted a Chromium dashboard smoke, but Bun could not bind the local ephemeral
server (`EADDRINUSE`); browser rendering and the full application journey remain
unverified. No merge, deployment, production change or Symphony dispatch
approval occurred. Site-wide reporting remains follow-on work.
