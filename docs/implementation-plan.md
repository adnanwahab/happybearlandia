# HappyBearLandia Time Machine implementation

Source is the user-provided “The next 12 features I'd build for HappyBearLandia” design. The active checkout includes existing in-progress causality, replay, comparison and navigation work. Preserve those changes and reuse their contracts.

## November 10 product review

- [x] Define the bakery mystery before building its UI. The recipe model runs 241 monthly states from 2026 to 2046. It reuses the synthetic logistics solver and adds explicit operating and scheduling rules for Riverside Bakery and Luis.
- [x] Add exact City checkpoint selection by saved run and month. Keep the city model's existing time scale and link newspaper and discovery evidence back to that month. Derive the district heatmap from the selected state.
- [x] Integrate the worker-backed bakery journey, recorded headlines, shareable recipe, and comparison. Verify that a shared URL reproduces the same timeline and that an intervention after closure leaves the bakery closed.
- [x] Configure durable Decision Studio paths and verify local backup and restore. Hosted volume attachment and legacy migration require a deployment check.
- [x] Run the focused integration suites after integrating the City, bakery, and storage changes. The 64 focused Bun tests, 58 Decision Studio tests, and six distinct Time Machine and adjacent browser journeys passed.
- [ ] Complete the repository-wide browser run. The run hit its 150-second budget after reproducing three party-test failures from the pre-integration run.

The revised journey uses its own versioned recipe, synthetic household and business, and schematic comparison. The original milestones below remain the broader roadmap for the separate City model. A 3D swipe, public leaderboard, cross-app character continuity, and five-person playtest remain follow-on work.

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
