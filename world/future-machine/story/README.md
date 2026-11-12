# Future Machine story

`index.js` implements the frozen `buildStory`, `describeSelection`, and `renderStory` exports. It consumes the same monthly City snapshots and diff frames used by the stage. It never advances a simulator or mutates records.

The first available difference is selected chronologically, with exact collection/ID tie breaking. Significant changes rank physical additions/removals first, then other additions/removals and changed-field count, with month and ID tie breaking. Repeated changes to the same entity/kind are deduplicated. Up to six stops are returned, first divergence first. This is a deterministic editorial selection rule, not a normalized financial, welfare, or causal magnitude estimate. Missing paired months are disclosed. Buildings and links alone count as physical changes under the shared contract.

The coordinator handles `onJump(stop)` by setting the shared month, updating both scenes, and calling `stage.focus(stop.entity)`. A false focus result must display an unlocated state without moving to a substitute entity. Pure `directorCommand` is additionally available for explicit mapped camera commands; it requires one exact collection/ID mapping, finite scene coordinates, and declared synthetic or sourced provenance. The helper never produces coordinates itself.

Receipts associate events only by exact entity references and the selected month. District events do not become household/building causes. IDs remain scoped by baseline/plan because City event IDs can collide between arms. Receipt payload, model version, and supplied dependencies are preserved; missing dependencies are disclosed, never inferred from temporal proximity. Narration is labeled interpretation separately from recorded events. Household comparisons use exact monthly City household and reciprocal unit assignment IDs; unavailable rent and missing households remain null, including in deltas. No Population or native House identity is inferred.

Verification: `bun test test/future-machine-story.test.js` covers first/large/zero differences, stable ordering, invalid and missing months, absent/ambiguous mappings, missing events, event arm identity and dependencies, exact household IDs, missing observations, text-safe DOM rendering, jump/disposal behavior, and a real seed-matched 120-step City pair with immutable Month 0 and Month 120. Browser entry-point integration belongs to the coordinator; no standalone route is owned by this worker. No interface changes requested.


## Selected-change assistive narration (SHE-123)

The normal Future Machine entity inspector offers **Describe selected change**.
The coordinator uses the current frame and diff, with the displayed run ID, model
version and seed. `describeModelChange` describes the A/B contrast at the selected
month, not a change between two dates. It reports up to four exact scalar fields
(including zero and null), household income/savings units, or inventory presence.
Additional and structured fields refer to the exact inspector records; no causal
claim or cross-model identity is generated. Strings are bounded and rendered as text.

`renderStory` accepts additive `onNarrate`; the persistent `mountChangeNarration`
region is initially empty, polite and atomic. Only the native button invokes it.
Selection, playback and story rerenders never write the region. Identical consecutive
requests are deduplicated; the last requested description stays visible with its month
until another request. Disposal removes handlers and the region.

Verification: `bun test test/assistive-narration.test.js test/future-machine-story.test.js test/future-machine-diff.test.js`.
The opt-in Chromium check uses `HBL_FM_BROWSER=1 bun test test/assistive-narration.test.js`
and covers keyboard activation, live-region mutations, duplicate suppression, silent
month changes and cleanup. Actual screen-reader speech needs manual verification.
