# Future Machine local handoff

Entry: `/world/future-machine.html`, linked on the homepage. Start normally with `bun run start`; the integration session also leaves an isolated demo server at `http://127.0.0.1:39885/world/future-machine.html`. Storage for that server is `/private/tmp/future-machine-local-20261111`, and `comparison.json` in that directory contains a working saved comparison URL at Month 120. Temporary files require an operator copy if they must survive system cleanup.

The visitor chooses the synthetic Riverside preset and a housing proposal or unchanged control, forks a persisted monthly City experiment, scrubs exactly Month 0–120, blinks or compares synchronized scenes, toggles ghosts, uses the change director, inspects exact City households and model events, exports evidence and shares a versioned recipe. Refresh reopens the same experiment/month. An absent saved record visibly reruns the bounded recipe; mismatched recipe/model/seed and incomplete replay fail explicitly.

## Decisions and limits

Monthly City is the sole authority. Both arms use the same initialized original, model version and seed. The common Month 0 is pre-intervention, 120 engine steps follow, and the baseline remains frozen. The `future-machine-synthetic.v1` generator explicitly assumes zero private parcel capacity, utility capacity 200 per district/network, and zero annual growth. These assumptions appear with results. Default outcome: 36 baseline versus 60 plan homes at Month 120; 1,000,000 illustrative USD cumulative plan capital spending. Housing completes in Month 16, subject to the engine's construction rules.

Scenes show recorded City buildings and active housing projects in a labeled nongeographic schematic. Heights are illustrative metres per recorded floor. No invented roads, residents or geometry pad the scene. Exact unsupported focus leaves the camera unchanged and explains why. The scene can separately validate sourced footprints, but this preset supplies none. No House/Population/Decision Studio identity or time mapping is asserted.

Replay recomputes detailed history from the stored manifest. It is deterministic in tests; it is not independently verified recorded-checkpoint equivalence. Current API replay omits causal traces. Entity-linked event receipts and modeled differences do not establish causality. Story significance is an editorial ranking, deduplicated by entity/kind. Missing evidence stays explicit. Mean travel minutes is an unweighted mean across modeled links, not a household commute. Tiny nonzero values display as less than 0.01 rather than rounded negative zero.

Cancellation aborts client work; already submitted City jobs can still complete and persist. The current pair is held in memory, with no global history cache. Replacing a pair disposes and recreates the stage. Imported large geometries, Safari/mobile hardware and hosted network performance remain unmeasured.

## Verification

- `HBL_FM_BROWSER=1 bun test test/future-machine-*.test.js test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js test/reality-share.test.js`: 74 passed, 442 assertions, no failures or skips.
- `HBL_RECORD_DEMO=1 HBL_FM_ARTIFACT_DIR=/private/tmp/future-machine-final-20261111 bunx playwright test --config test/future-machine.browser.config.js`: complete Chromium journey; zero diff, missing saved record, invalid/mismatched recipe, missing replay, responsive layout, forced no-WebGL, upper bound resources, navigation/disposal and a 40-second demonstration capture. See final implementation-plan entry for the completed run result.
- Local server restart preserved the completed baseline/plan pair and returned 120 replay steps with final Month 120. Storage tests also verify close/reopen, SQLite export integrity, manifest preservation, share record durability and backup restoration.
- `git diff --check` passed. Repository defines no lint or typecheck script. No whole-repository test result is claimed by this slice.

Local Chromium observations (not production guarantees): default saved-pair reopening approximately 0.65 seconds to ready, eight scene objects/geometries, roughly 68 MB sampled JS heap. Both replay responses total approximately 18.3 MB; normalized history JSON is 17.1 MB. Upper limit 120 starting households: about 2.1 seconds to ready, 50.9 MB history JSON and 77–103 MB sampled JS heap. Repeated scrubs stay within ten scene objects and disposal clears them. Large replay payloads need network and device validation before public scale-up. There is no perpetual scene animation loop; draw occurs on updates and camera interaction.

Final artifacts are in `/private/tmp/future-machine-final-20261111`: full-page 2036 screenshot, thumbnail, selected-month JSON evidence and WebM tour. The tour is a silent screen recording; narration is supplied as a script in `world/future-machine/share/DEMO.md`.

## Commits and ownership

Original feature commits and their integrated equivalents:

| Role | Worker commit | Integrated commit |
| --- | --- | --- |
| Data | f6fdaed541c4a98cd14e3292866dc21522d9f8a8 | 039a657 |
| Diff | b861c61 | 6d3c37f |
| Scene | fc9acc0 | c5dd746 |
| UI | 4436e5857ec44b5a4d2a6edbb22c2c2a1edb99aa | 6520c0e |
| Story | d18f4d086ed830b388ceac6c9ddbf4787f3ed957 | e2751b1 |
| Share | ffc41b0 | 77b7993 |

Integration worktree: `/Users/wahabma/happybearlandia`, branch `codex/future-machine-integration`. Composition/tests began in `a3191f9`; original route/contracts/storage additions were captured by the user's existing `ac3f503` commit. Integration fixes and this handoff follow in the final integration commit. No additional chats or agents were spawned, and no outbound chat messages were sent. Seven requested chats remain in Codex.

Changed areas: new HTML and `world/future-machine/{main,contracts,INTERFACES,data,diff,scene,ui,story,share}`, homepage entry, City/share storage environment in `fly.toml` and `server.js`, backup script, focused tests/browser config and documentation.

## Release blockers

No production deployment or production data changes were performed. Hosted mounted volume, free space, migration of legacy City/share paths with writers stopped, off-host backup and restore rehearsal, public traffic capacity/access controls, and device/network checks remain release gates. See `future-machine-storage.md` for local backup/restore and rollback instructions. A PR was not published.
