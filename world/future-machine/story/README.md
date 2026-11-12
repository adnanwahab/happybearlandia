# Future Machine story

`index.js` implements the frozen `buildStory`, `describeSelection`, and `renderStory` exports. It consumes the same monthly City snapshots and diff frames used by the stage. It never advances a simulator or mutates records.

The first renderable physical building divergence uses the shared `diff/firstDivergence` rule, with month and exact ID tie breaking. When none exists, significant nonphysical changes remain inspectable. Significant changes rank physical additions/removals first, then other additions/removals and changed-field count, with month and ID tie breaking. Repeated changes to the same entity/kind are deduplicated. Up to six stops are returned, first divergence first. This is a deterministic editorial selection rule, not a normalized financial, welfare, or causal magnitude estimate. Missing paired months are disclosed. Buildings and links alone count as physical changes under the shared contract.

The coordinator handles `onJump(stop)` by setting the shared month, updating both scenes, and calling `stage.focus(stop.entity)`. A false focus result must display an unlocated state without moving to a substitute entity. Pure `directorCommand` is additionally available for explicit mapped camera commands; it requires one exact collection/ID mapping, finite scene coordinates, and declared synthetic or sourced provenance. The helper never produces coordinates itself.

Receipts associate events only by exact entity references and the selected month. District events do not become household/building causes. IDs remain scoped by baseline/plan because City event IDs can collide between arms. Receipt payload, model version, and supplied dependencies are preserved; missing dependencies are disclosed, never inferred from temporal proximity. Narration is labeled interpretation separately from recorded events. Household comparisons use exact monthly City household and reciprocal unit assignment IDs; unavailable rent and missing households remain null, including in deltas. No Population or native House identity is inferred.

Verification: `bun test test/future-machine-story.test.js` covers first/large/zero differences, stable ordering, invalid and missing months, absent/ambiguous mappings, missing events, event arm identity and dependencies, exact household IDs, missing observations, text-safe DOM rendering, jump/disposal behavior, and a real seed-matched 120-step City pair with immutable Month 0 and Month 120. Browser entry-point integration belongs to the coordinator; no standalone route is owned by this worker. No interface changes requested.

The visual WHY trail is anchored to `{collection,id,month}` independently of the
viewed month. Evidence navigation retains its node IDs and records, marks the
clicked node with `aria-current="step"`, and offers Return to the anchor month.
The view labels both the viewed month and the month through which the trail was
recorded. Playback reuses this trail without rebuilding it. Explicit timeline
or outcome-chart scrubbing re-anchors the selected entity, so earlier frames
never gain future receipts. Selecting another entity replaces the anchor.
`renderEvidenceTrail` returns a callable disposer with `update(month,nodeId,
unlocated)` for presentation-only updates and accepts `onReturn` alongside
`onJump`; evidence jumps include the exact arm-scoped `nodeId`.

Rent WHY additionally mounts `../rent-decomposition.js` using the selected pair
frame. `decomposeRent(frame)` returns signed `price`, `composition`, recorded
`delta`, cohort means, counts and total plan-unit denominator, or an explicit
unavailable reason. New inventory must have a housing-project building ID and be
absent from the baseline; the remaining stock must match baseline unit identities.
The shift-share result uses all units exactly as `cityMetrics` does, including
vacancies. It does not describe household savings. The accessible stacked bar
uses absolute component magnitudes, with signed USD/month labels and identity;
zero components at Month 0 are labeled explicitly. Changing month refreshes an
open metric inspector. No simulator state or stored history is modified.

## Cinematic Game Director (SHE-183)

Future Machine also mounts a separate optional moment library after a completed
run. `game-director.js` selects copied records using `cinematic-city.v1`, with no
simulator imports, writes, random draws, or action callbacks. Inputs are the same
versioned arm/month histories as the stage. Output preserves run, seed, model,
arm, month and source identity. At most 24 moments are selected: reserve the
first available moment of each kind, fill chronologically with arm/source ties,
and suppress repeated entity/type moments. Construction start, topping and
completion are distinct milestones. Job-match decisions use City worker IDs;
there is no implied House/Population mapping or importance/welfare estimate.

`moment-narrative.js` separately authors optional observation quests, text
cutscene cards and explanations. Skip hides a card, replay reveals it and jumps
to its recorded month, and Inspect source opens the exact copied record. These
controls never rerun or command the model; every selected card remains replayable
until another run replaces the library. Disposal removes all listeners. There
are no automatic pauses, rewards, generated dialogue or invented outcomes.

City job decisions lack event IDs, so provenance uses arm/month/decision index
and actor ID rather than fabricating an event. Construction and constraint
moments retain their original event IDs. Chains require explicit dependencies
on strictly earlier events in the same arm; City currently emits no such causal
edges, so the normal City run does not claim a surprising chain. Missing edges
remain unavailable. Budget/affordability conflicts are labeled authored goal
tradeoffs, since this model has no recorded player-goal registry. Extending these
two categories requires producer evidence contracts, not inferred causality.

Checks: `bun test test/game-director.test.js test/future-machine-*.test.js`.
Browser coverage: `bunx playwright test test/e2e/game-director.e2e.js`.
