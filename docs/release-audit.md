# HappyBearLandia release audit

Audit date: November 10, 2026. All production observations came from Fly metadata, public GET responses, or remote file existence and allocated-size checks. No production records were opened or changed. Use the [release checklist](release-checklist.md) before a release.

## Source and build inventory

| State | Evidence | Release disposition |
| --- | --- | --- |
| GitHub main | `fd43cc739b82b39dfe85a72db713b6d1ddaaf450`. PR #8 merged at 23:58:18 UTC. GitHub reports this branch unprotected. | Base the release on the current remote SHA and verify CI on the exact candidate. [Main commit](https://github.com/adnanwahab/happybearlandia/commit/fd43cc739b82b39dfe85a72db713b6d1ddaaf450) |
| Initial local checkout | `0343b718017fcbfee57a5a2bf92521e3c84950eb` for both local `main` and the cached `origin/main`. GitHub compare showed the remote nine commits ahead, zero behind. At the start of audit the checkout had 12 tracked modified files and approximately 187 untracked files. | Keep the shared edits intact. Integrate reviewed paths into an isolated checkout at the verified remote tip. Exclude incidental cache writes and run artifacts. [GitHub comparison](https://github.com/adnanwahab/happybearlandia/compare/0343b718017fcbfee57a5a2bf92521e3c84950eb...fd43cc739b82b39dfe85a72db713b6d1ddaaf450) |
| November 10 committed foundation | Range `51532a2..0343b71` contains 561 changed paths. It includes the Universe shell, persistent causal records, replay and Time Machine, Living Newspaper, Surprising Discoveries, Riverside Bakery, Living City, and Decision Studio storage. PR #7 supplied local browser dependencies for Game. | Treat this foundation as merged source. Production availability is a separate gate. [PR #7](https://github.com/adnanwahab/happybearlandia/pull/7) |
| PR #8 | Head `1af91da2cb8790675502b0bdcc58f3763ab7425f`. Adds six discoverability shortcuts and core GitHub Actions coverage. The PR check passed, and the workflow passed again on the merge SHA. | Keep the merged shortcut implementation and reconcile overlapping Living City browser assertions in the candidate. This workflow covers its named suites. It does not establish coverage for the working-tree releases below. [PR #8](https://github.com/adnanwahab/happybearlandia/pull/8) · [PR verification](https://github.com/adnanwahab/happybearlandia/actions/runs/42927152848/job/130216393637) · [Main verification](https://github.com/adnanwahab/happybearlandia/actions/runs/42927630933) |
| Production | Fly release 67, created at 20:51:33 UTC, image digest `sha256:deaed19df4bd96ea11809dd2b2e67180f79bcca61b4feebd0f964bcccbf05f30`. The available OCI revision refers to Bun’s base image and does not identify the application’s Git SHA. Release 67 predates the verified PR #8 merge. | Preserve this image reference and its configuration for rollback. Attach a verified application SHA to the next deployment record. [Fly releases](https://fly.io/apps/happybearlandia/monitoring) |

### Working-tree release candidates

The following groups were present locally at audit start. They need to be included deliberately in a release candidate and verified together on its exact source revision.

| Group | Main entry points | Boundary |
| --- | --- | --- |
| Map previews | `/`, `/tools/houston-map`, `/tools/flower` | Cached OpenStreetMap geometry and illustrative extrusion for Houston. Review Flower separately and leave the incidental Houston area-cache rewrite out unless it is an intentional, reviewed data refresh. |
| Playable Life | `/world`, `/world/house` | Existing Population checkpoints and the same saved resident. Review House navigation and restore with a fresh and an existing checkpoint. |
| Emergent civilization | `/world/civilization/` | Ideas, family history, Rashomon, Archaeology, planner experiment, debugger, and future search. Population saves and monthly City records are separate authorities. |
| Civilization laboratory | `/world/laboratory/` | Atlas, Genome, Cookbook, Assumption Jenga, feedback loops, constraints, and policy receipts. Local simulations and exact recorded-event reads. |
| City invention | `/world/invention/` | Reverse Simulator, Merge Studio, Breakpoints, and replay on the versioned monthly City plan. |
| Hidden systems | `/world/hidden-systems/` | Permit queues, schematic construction, and paired household outcomes on one seeded fixture. |
| Learning civilization | `/world/learning/` | Observatory, Prediction League, Citizen Assembly, and the local experiment journal. |
| Storm | `/world/storm/`, `/world/storm/response.html` | Synthetic water sandbox, impact comparison, recovery, and local treaty. Model accuracy and cross-city transfer remain outside this release. |
| Connected lives | `/world/connected-lives/`, `/world/timeline-braids/`, `/world/civilization-zoom/`, `/world/collective-mind/` | Compare exact supported saved checkpoints and use verified Population handoffs. Collective Mind is its own local simulation. |

### Open PRs

GitHub listed five open PRs. Their check rollups were empty at the audit. No PR merge or closure occurred in this audit.

| PR | Head and merge state | Disposition |
| --- | --- | --- |
| [#2 Constitution comparison](https://github.com/adnanwahab/happybearlandia/pull/2) | `a4fdefa0e44d5b9c0c2ed595ea719cc11cd1636e`, draft, conflicting | Main already routes both spelling variants to Constitution City. Compare remaining behavior with the current implementation before salvaging a narrowly scoped change. |
| [#3 Civic realism](https://github.com/adnanwahab/happybearlandia/pull/3) | `d5d3029b34268358b9a1e7a38d4059db24ce399f`, conflicting | Main already has the simulation observations, parameters, and state modules. Assess unmatched behavior and regression coverage separately. |
| [#4 Guided 100-futures policy simulator](https://github.com/adnanwahab/happybearlandia/pull/4) | `29bfade0c93c423045d7dbd47930a2f27376b83f`, mergeable | Adds two standalone files absent from main. It overlaps the product surface of the newer Living City and Laboratory workflows. Give it separate review before exposing or merging it. |
| [#5 Bar mode](https://github.com/adnanwahab/happybearlandia/pull/5) | `b7a16f59f28de8c5df7a8fce6ddcb824aeea729b`, draft, conflicting | Separate optional experience. Resolve route, server and House integration against current main in its own release. |
| [#6 Household comedy](https://github.com/adnanwahab/happybearlandia/pull/6) | `a57849111eae1461d6a306d294df9fe851ce438a`, draft, conflicting | Main already has comedy modules and this PR touches House files involved in Playable Life. Compare current coverage before carrying forward changes. |

## Production evidence

- Fly lists one started DFW app Machine `837967a7954128` with encrypted 1 GiB volume `vol_40o7pzjlmxlw5094` mounted at `/data`. The second 1 GiB volume, `vol_re1l90w123ngwj14`, is unattached. The earlier November 3 zero-volume observation is historical. The unattached volume’s contents and intended role were not verified. [Fly volume management](https://fly.io/apps/happybearlandia/volumes)
- Public GET returned **200** for [home](https://happybearlandia.fly.dev/), [route directory](https://happybearlandia.fly.dev/routes), [World](https://happybearlandia.fly.dev/world), and [configuration](https://happybearlandia.fly.dev/api/config). It returned **404** for [Time Machine](https://happybearlandia.fly.dev/world/causal.html), [Living Newspaper](https://happybearlandia.fly.dev/world/newspaper/), [Surprising Discoveries](https://happybearlandia.fly.dev/world/discoveries/), [Living City](https://happybearlandia.fly.dev/world/living-city/), [Civilization](https://happybearlandia.fly.dev/world/civilization/), [Learning Civilization](https://happybearlandia.fly.dev/world/learning/), [Storm](https://happybearlandia.fly.dev/world/storm/), [Connected Lives](https://happybearlandia.fly.dev/world/connected-lives/), and [Houston map](https://happybearlandia.fly.dev/tools/houston-map). The configuration response confirms HTTP availability, with no storage or revision attestation.
- Fly Machine config sets `HBL_WORLD_DB_PATH=/data/world-experiments.sqlite`. `df -Pk` showed 23% used and 721,580 KiB available. `du -sk` showed 179,624 KiB for the SQLite file and 27,792 KiB for its active WAL. The candidate uses the same volume path for World saves, House autosessions, and causal records. A raw copy of the main database file would omit committed pages still in the WAL. [SQLite backup mechanism](https://www.sqlite.org/backup.html)
- Fly showed attached-volume snapshots through November 10 11:53:10 UTC, with five-day retention. No independent production backup or staging restoration was verified. The app currently has one volume-owning Machine. The second volume is not active replication. [Fly volume semantics and snapshot limits](https://docs.fly.io/volumes/overview)
- The current Machine config lacks `DECISION_STORE_DIR`; the repository candidate sets `/data/decision-experiments`. The mounted path, `/app/.data/decision-experiments`, and legacy `/tmp/happybearlandia-decision-experiments` were absent at inspection. `/app/.data/city-history.sqlite` and `/app/.data/reality-shares.sqlite` each allocated 4 KiB, and `/app/.hbl-city` allocated 16 KiB. They are outside the persistent mount. Sizes establish presence only. City History contains source-backed cache records and cached comparison IDs. Reality Shares and `.hbl-city` may contain saved shares, journals or other modeled records. Determine which auxiliary stores need preservation before replacing the Machine. [Decision storage operations](decision-studio-storage.md)
- The workstation World database was approximately 2.2 GiB, already larger than the production volume. Do not include workstation data in a candidate build or use it as a production restore source. The baseline Dockerfile uses `COPY . .`. The baseline `.dockerignore` excludes local SQLite files but misses some workspace-only paths such as `.env.op`, `.hbl-city/`, and browser artifacts. Build from a clean tracked export and verify the context exclusions.

## Verification and open gates

- Local `bun test test/decision-storage.test.js test/world-database-path.test.js` passed all nine tests. A separate temporary WAL-backed SQLite fixture verified that `VACUUM INTO` captured both committed rows and that the resulting copy passed `PRAGMA quick_check`. These checks do not verify recovery from a production backup.
- Existing core CI passed for PR #8 and GitHub main at the recorded SHA. The full candidate must reconcile the shared checkout, use frozen dependencies, pass its core and feature browser journeys, and account for the broader suite failures or timeouts that remain. [Implementation plan and earlier results](implementation-plan.md)
- The release remains gated on an exact candidate SHA, reviewed test evidence, an independently stored and rehearsed backup, and explicit deployment authorization. The [release checklist](release-checklist.md) records the order and rollback criteria.

| Initial issue | Priority | Resolution evidence |
| --- | --- | --- |
| Candidate source diverged from local main | Release gate | A clean candidate at or above the verified GitHub merge SHA, with both the new journeys and PR #8 coverage. |
| Production route gap | Release gate | Candidate image linked to its source SHA, then HTTP and browser smoke for the advertised routes. Release 67 currently lacks the audited new pages. |
| Independent backup and recovery unverified | Release gate | A verified off-volume World snapshot and a staging rehearsal of migration, restart and rollback compatibility. |
| Workspace state can enter the Docker build context | Release gate | Excluded private local paths and a verified clean tracked build context. |
| Auxiliary persistence on the Machine root filesystem | Operations follow-up or release gate if data needs preservation | An explicit retention decision per store, with backups and durable paths for records that must survive. |
| Main does not require the core check | Process follow-up | Record the green candidate run manually or enforce the check through branch protection. |

## Candidate verification

| Check | Baseline or first attempt | Candidate evidence |
| --- | --- | --- |
| Entire Bun selection | The original working-tree attempt was interrupted after 2,225 passes and 18 failures, including economy assertions, blocked local WebSocket binding and House timeouts. It did not produce final totals. | The isolated candidate's first full attempt logged 130 passes and three failures before Bun 1.4.2 crashed with a main-thread segmentation fault. Neither full run cleared the release gate. |
| Core and storage | The merged PR #8 CI passed at `fd43cc7`. Two local default-budget core attempts each passed 72 and exceeded Bun's five-second limit in the existing 100-pair test. | 73 passed, zero failed with a 60-second test budget. The suite checked causal storage, checkpoint replay, Decision files and build/readiness. |
| Entire Playwright selection | The eight-minute candidate sweep discovered 348 tests. 91 passed, 12 failed, 245 were unrun. It ended at the overall limit and reported teardown timeouts. | The bounded sweep preceded the final party and release refinements. Failing or unverified areas include Build World, City renderer, City Speaks, dates, Decision journey and Living10k. The complete browser suite remains a release gate. |
| Sprint browser paths | The first combined pass exposed state leakage between the Discoveries and Time Machine recording tests. | Isolated Time Machine 3/3 and Causal Inspector 3/3. The recording test now starts on a fresh isolated store in CI. |
| Post-deployment smoke rehearsal | Production release 67 lacks the candidate routes. | 1/1 on a fresh local production-mode candidate mirror using file-backed storage. Both checks were healthy. First ready response arrived in 794 ms. |
| Restore | Production backups and staging data were not accessed. | A local WAL-aware backup restored a saved causal World run and Decision records, verified by HTTP against a fresh server. |

### Local workload sample

On the developer Mac with concurrent tests, `bun ops/measure-simulation.js` measured 100 matched 12-month commute futures at 21.70 s wall and 5.58 s combined user and system CPU time. RSS rose from 27.36 MB to 79.33 MB. The serialized comparison was 132,412 bytes. Creating the guided household checkpoint took 1.07 s wall and 0.25 s CPU, with a 35,381-byte checkpoint and a 36,103-byte save. These measurements characterize local runs. Fly CPU, memory and load headroom remain unmeasured. Sequential warm local HTTP p50/p95 latency was 0.07/0.19 ms for health, 0.08/0.15 ms for ready, 0.10/0.43 ms for the dashboard, and 0.09/0.27 ms for home, using 20 requests per route.

### Remaining issues

| Priority | Issue and next verification |
| --- | --- |
| P0 release gate | Obtain an independent production backup and rehearse the exact candidate and rollback image on isolated copies. Decide retention for the auxiliary stores before replacing the volume-owning Machine. |
| P0 release gate | Close or disposition the complete-suite failures, confirm CI on the draft's exact head and verify the intended image artifact. Inspect the previously pushed branch's Flower and cache changes separately before promotion. |
| P1 | Decision Studio and Population use separate models. An authoritative cross-model future requires a versioned entity/time mapping and checkpoint contract. |
| P1 | Verify the production CPU and memory budget and staging cold starts. The recorded local workloads do not establish Fly capacity. |
| P2 | Causal graph preview caps records and links. Open the expandable raw response for the full returned page. |

## Release integration follow-up

GitHub main remained at `fd43cc739b82b39dfe85a72db713b6d1ddaaf450`, with PR #8 merged. GitHub listed PRs #2, #5, and #6 still open. The draft release PR was open at `b0a680fd61eb2af8310684598a1d44819c8b98dd` during this review. Fly still reported release 67 complete and one started DFW Machine. [Draft release PR](https://github.com/adnanwahab/happybearlandia/pull/9)

The guided future initially failed in World because the saved Population run went through the WebGPU-only startup path. The saved synthetic home was also being replaced by a procedural town. The saved route now selects the compatible renderer and renders the checkpoint's synthetic footprint. Chrome passed both focused journey tests, including opening World with WebGPU unavailable, exact House navigation, Back, refresh, a repeated fork that reproduced the saved checkpoint, and invalid and missing saves. Decision Studio remains a separate authority and is linked from the journey.

| Classification | Release scope |
| --- | --- |
| Fully working and surfaced in focused browser runs | Guided saved Population future, the Universe directory and shortcuts, Living City commute comparison, Riverside Bakery investigation, and Surprising Discoveries. |
| Implemented but without a public production entry | Build and readiness probes, Simulation Health, and read-only post-deployment smoke. The local file-backed rehearsal passed. Fly is serving the previous release. |
| Partially integrated | Decision Studio and the saved Population journey share navigation. Their future, entity and clock mapping is still open. The monthly Causal Inspector is a separate recorded City authority. |
| Broken or unresolved in broad verification | The full suite has timeout, graphics, and legacy scenario failures. The focused Act Normal rerun passed all five tests after reducing GPU contention in the two-client test fixtures. The sleeping-bed test now exercises a real available bed and separately verifies that an occupied bed cannot move. |
| Not yet implemented | Authoritative Decision Studio future entry into a Population checkpoint and a production backup/restore rehearsal on staging. |

The focused persistence, health, replay, fork, and provider diagnostics suite passed 38 tests. The House garden suite passed seven, including the occupied-bed regression. The local post-deployment smoke rehearsal passed against file-backed storage and a synthetic build ID. GitHub's core verification passed at the audited PR head. [Draft CI run](https://github.com/adnanwahab/happybearlandia/actions/runs/42931209687/job/130230113740)

The repeat full Playwright attempt selected 354 tests. It ended at the eight-minute limit with 19 passes, 15 failures, 320 unrun tests and two teardown errors. It used an isolated source snapshot from before the guided renderer and party harness fixes. Failures covered Act Normal, World activity and construction, legacy journals and traditions, City Invention, renderer checks, community projects, and Collective Mind WebGPU. The trace evidence does not establish that all failures are pre-existing. Use the focused results for the supported release paths and keep the broad suite open.

An independent temporary file-backed startup reached readiness in 423 ms. All 80 loopback requests returned 200. The p95 values were 0.29 ms for health, 5.38 ms for readiness, 0.64 ms for the dashboard and 0.96 ms for home. A second sample under concurrent local tests measured 100 matched commute futures in 29.37 seconds wall time and 4.89 seconds combined CPU, with RSS increasing from 26.33 MB to 63.98 MB and a 132,412-byte result. The guided checkpoint was 35,381 bytes. This sample does not measure Fly capacity.

### Additional isolated checks

- Act Normal passed 5/5 focused browser checks. The native House party passed its full eight-guest save/reload, recap, and departure journey. The narrow viewport Skip control and all 23 focused party Bun tests passed. Four adjacent House workflows still failed during fixture or interaction checks, with one unrun in that sweep.
- The separate civilization browser sweep passed 12 of 19, failed one Archaeology assertion while loading, and reached its cap with six unrun. Archaeology passed alone after the browser expectation budget was set to 15 seconds. This sweep verified the homepage deck.gl iframe and unavailable-bundle message, a real Connected Lives handoff, and Collective Mind WebGPU in the local environment.
- A clean Git archive of `b0a680fd61eb2af8310684598a1d44819c8b98dd` built successfully using `bun install --frozen-lockfile` in the Docker image. Fly config validation passed. The image started with a disposable disk-backed Docker volume at `/data`, the Fly mount guard enabled, both readiness checks `ok`, and its exact build ID. The post-deployment browser smoke passed 1/1 against that local image. No production volume or data was used.
- Provider diagnostics redaction passed 20 focused Bun tests. An isolated server with synthetic endpoint paths confirmed that diagnostics omit private URL components while the configured paths still reach each test upstream.
