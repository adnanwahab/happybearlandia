# SHE-789 residents — implementation and acceptance evidence

## Delivered slice

Both the normal `/world` Legacy simulation and opt-in Living Population use
`world/population/pedestrian-routes.js`. The input is the same local-metre road
polylines rendered in World; this is an approximate sidewalk graph, not surveyed
entrances or GTFS. Trips turn along the sidewalk strips and cross at junction
ends. A keyed 2% allowance permits a short crossing between opposite sidewalks
of the same block. Missing/disconnected maps return an explicit straight-line
fallback. Building-access connectors can cross an unsurveyed frontage; arbitrary
geographic obstacles are not inferred.

Walking distance drives duration and committed movement. Population uses its
configured walking speed; Legacy retains 40m/min. Legacy explicit ground walks
force walking and use the sidewalk graph as well. In-progress route state,
conversation holds, outcomes and delays survive full checkpoints. Existing
checkpoints without the optional `residentRules` manifest keep their earlier
routing/automatic-social behavior. Fresh runs declare `sidewalks.v1`,
`resident-encounters.v1` or `legacy-resident-encounters.v1` beside the mechanism.
The enclosing compatible model and checkpoint envelopes are unchanged.

The original GLB is partitioned into twelve shared instanced head/body/limb
meshes. Swing phase follows actual displayed distance, with child/older stride
variation; a stationary pose stops swinging and pause freezes gestures. No
per-resident skeleton or scene object is allocated. This adds seven shared
humanoid draw calls compared with the former five-part rigid asset; a shared
speech mesh and two shared help-glyph meshes appear only when needed. Foot
placement is a stylized distance-matched gait, not skeletal inverse kinematics.

Automatic encounters reuse the existing relationship authority and recorded
outcomes. At most eight nearby pairs start per scheduling opportunity; housemates,
coworkers, neighbors and co-present park/food visitors are eligible. The synthetic
assumptions are four metres, three game minutes, a fifteen-minute resident
cooldown, awake/free participants and no override of a player walk, work/school,
care or house action. Population prepares pairs after an outer committed step;
Legacy checks every five game minutes after its minute step. Population snapshots
carry the active conversation; Legacy retains it on the actual person. Residents
face each other, wave and show an instanced pale speech bubble. Existing +8 social
need and relationship-memory rules apply once at initiation; not every modeled
conversation is friendly. Walking pauses and the extra elapsed minutes appear in
trip evidence rather than being silently omitted.

Population far-cluster aggregation is cached until the next authoritative frame,
filter or selection change, instead of rebuilding clusters on every animation
frame. Resident interpolation still follows the actual polyline and uses the
same received snapshots.

## Integration

- `deriveLivingContext` now passes road polylines through the worker context.
- `generator.js` installs the network and rules manifest; `behavior.js` consumes
  committed routes; `trip-display.js` projects route/progress/delay without ticking.
- `model.js` prepares bounded encounters and exports active encounter evidence.
- `relationships/model.js` can skip the full social inspector for automatic talks;
  manual interactions retain the previous inspector contract.
- Legacy `sim.js` integrates the same route helper and new
  `legacy-resident-encounters.js`; full and representative state retain new fields.
- The performance owner integrated the legacy `render.js` call: pass encounter
  heading, social/speech flags, gesture phase and age band to `setPerson`.
- No changes were made here to runtime scheduling, server routes, main UI markup,
  or the performance-owned world-view `update(now)` hotspot projection.

A previously exposed Legacy inspection discrepancy was fixed during replay:
`getActivitySnapshot()` now uses the restored transit seed context instead of the
construction options when a full checkpoint replaces a newly constructed world.

## Verification

`bun test test/resident-launch.test.js test/population-render-lod.test.js
 test/human-renderer.test.js test/legacy-checkpoint.test.js`: 21 passed, 0 failed.
The resident suite exercises mapped turns/intersections, honest route times,
junction versus explicitly rare mid-block crossings, missing/disconnected maps,
route-aware interpolation, checkpoint continuation, proximity/sleep exclusions,
actual social-need effects and travel delay, actual GLB opposite limb rotations,
rest pose, frozen gestures and evidence-backed bubbles. It includes the default
Legacy ground-command and conversation/checkpoint entry points.

Broader regression and browser acceptance results are appended below once run.
No physical phone, old laptop or Safari device result is claimed by these tests.


Final combined Population/model/replay/social regression command:

```sh
bun test --timeout 30000 test/population-model.test.js test/population-hotspots.test.js test/population-render-lod.test.js world/population/checkpoint.test.js test/social-network.test.js test/social-continuity.test.js test/human-glb.test.js world/population/walk-command.test.js test/resident-launch.test.js test/human-renderer.test.js test/population-trip-display.test.js
```

Result: **64 passed, 0 failed, 894 assertions, 9.16s** across eleven files.
After adding ordinary-worker metadata coverage and explicit player-interruption
coverage, `bun test test/resident-launch.test.js test/person-commands.test.js`
passed **18 tests, 0 failed, 138 assertions**. Earlier Legacy/history/person-command/
repeat-play regression passed **25 tests, 0 failed, 243 assertions, 47.65s**.

The original broad attempt hit timing limits while other work ran and exposed
a Bun 1.4.2 `rejects.toThrow` stall on two worker-backed invalid-save assertions.
Instrumented direct replay/save/restore/30-paired-step/error checks completed in
about one second with unchanged post-error checkpoint. The test now explicitly
captures those same two rejected errors and verifies their type/message and
unchanged state; no rejection or atomicity check was removed. All five checkpoint
tests then passed in 1.37s; the combined rerun above is the final regression result.

Additional integration details: the worker packed-metadata allowlist now retains
`trip`, `socialEncounter`, actual name and home/location IDs. The ordinary-worker
test caught and fixed a separate manual-walk path: `applyWalkCommand` must retain
its admitted sidewalk route, not only its planned duration. Player commands
interrupt active conversations, clear both participants' visual hold and record
the interruption. The compatible older path remains supported.

The read-only `world.simulationSeed` exposes the exact existing numeric RNG
initializer for privacy-safe diagnostics without recording coordinate strings.
Full checkpoints retain/restore it; older checkpoints lacking that field return
null. The diagnostic seed alone does not recreate town geometry, external inputs
or command order. `world.getActivityIdentity()` cheaply exposes the authoritative
restored run identity without cloning the full activity snapshot.

A yellow instanced `!` hint is driven solely by finite actual needs below 30. It
is an inspection/help hint, not a claim that a quest exists. No new quest or model
effect is created by this glyph. Detailed browser/device acceptance belongs to
the coordinating launch verification; these checks do not claim physical phone,
old-laptop, Safari or a 50ms worst-frame bound.


## Final ODD and contract review — November 15

Checked all seven elements in `docs/models/population.md` and
`docs/models/legacy.md`, the inventory in `docs/models/README.md`,
`world/population/MODEL_CARD.md` and the current-trip read contract in
`world/population/DATA_FORMATS.md` against these execution paths:

- Population: `generator.js`, `model.js`, `behavior.js`, `walk-command.js`,
  `resident-encounters.js`, `trip-display.js`, `population.worker.js`, `runtime.js`,
  `checkpoint.js`, `renderer.js` and `world-view.js`.
- Legacy: `world/sim.js`, `world/person-commands.js`,
  `world/legacy-resident-encounters.js`, `world/legacy-checkpoint.js` and
  `world/simulation-state.js`.
- Shared relationship rules and renderer: `world/relationships/model.js`,
  `world/resident-rules.js`, `world/render/people/human-renderer.js` and the
  legacy `render.js` call site. Gait uses shared CPU-updated instanced matrices;
  it is not a SIMD kernel or a per-resident skeleton.

Discrepancies found and resolved in this review:

1. Rainy older Legacy checkpoints without a rules manifest had inherited the new
   physical-time choice cost. They now retain the former weather-comfort-adjusted
   generalized cost; fresh sidewalk rules retain actual routed walking time.
   Decision alternatives now retain their actual planned minutes and route kind
   so this distinction can be inspected without reconstructing a score.
2. Unknown rule manifests formerly passed restore and silently disabled the new
   mechanisms. Shared validation now rejects unknown, mixed-authority or extra-key
   manifests before model mutation in full/representative Legacy restores and
   Population state/codec restore. Absent/null manifests remain compatible.
3. Rule versions existed in checkpoints but were missing from ordinary snapshots
   and future recipes. Both are now explicit. The live runtime, future worker,
   replay and future inspection retain the selected rules; old future recipes
   lacking the manifest use prior rules rather than silently enabling new ones.
   Previous-run and social-network provenance retain the same manifest.
4. The Living Follow label could disagree with its Boolean state and had no
   `aria-pressed` value. One setter now updates Boolean, label and pressed state
   for toggles, new selection, reset, deactivation, local pan, household follow
   and pointer follow. Re-selecting the same resident preserves follow.
5. Population uses age label `senior`, while the gait recognized only Legacy's
   `older` label. Both now select the same stylized older pose/stride variation.

Focused evidence: `bun test test/resident-rules-compatibility.test.js` —
**6 passed, 0 failed, 70 assertions, 705ms**. Checks exercise actual rainy Legacy
selection through recorded alternatives, atomic rejection across saved-state
authorities, both new and old future generation/replay/inspection, idempotent
Follow presentation, and the senior gait alias. No browser or heavy regression
was started during the coordinator's quiet performance trace. The coordinator
reported its preceding combined 154-test/28-file run, 13 Chromium checks and
106 City replay cases; those are coordinator evidence, not additional runs here.

Read-only allocation-optimization review of `pedestrian-routes.js`: the new
spatial lookup retains the original projection arithmetic and `Math.hypot`
comparison, explicitly resolves equal distances by original lane index, and
allocates stable selected projection points rather than storing mutable scratch
arrays. Nearest and route caches remain derived WeakMap state; expanded bounded
retention changes cache lifetime rather than authoritative route records. This
source review found no arithmetic/tie/alias discrepancy; exact-route benchmark
evidence and final performance acceptance remain owned by the performance chat.

Retained limitations: outcomes and rates are synthetic assumptions; missing or
disconnected maps remain labelled approximations; matching a seed alone does not
recreate geometry, commands or discarded history. The `!` hint and gait create no
model event. Neither this review nor its unit tests establishes the requested
50ms worst-frame bound, physical-device acceptance or unlimited event history.
