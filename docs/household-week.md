# Household week recorded playback (SHE-130)

Select a Living World resident and choose **Follow household for a week**. The
existing House entry saves the complete starting Population checkpoint. The
`householdWeek=1` House mode restores that exact household and advances seven
24-hour periods through `runtime.observeHousehold`. Pause retains the committed
minute in the current page. Resume continues that authority; reloading an
unfinished week restarts from its immutable starting save.

The new `household-week.v1` report is stored in `save.view.householdWeek` beside
the complete child checkpoint. It contains the starting experiment ID, exact
household and member IDs, Population model version, seed and full configuration,
start/end ticks and minutes, and the unchanged fixed-step duration. Population's
model version identifies its bundled rules. No scalar-oracle tick/day mapping,
CityState adapter, or empirical calibration is claimed. Source geometry and
checkpoint inputs remain in the parent and child saves.

Eight daily observations retain savings, home/location IDs, activity, travel mode,
position, commute minutes, needs and available resident and household decision
traces. These are modeled samples. There is no interpolation between them.
The household cohort is fixed to the starting members; a changing membership is
not presented as an identity mapping to another model.

Matching worker events retain their complete payload, IDs and causal fields.
Events are deduplicated by exact ID and ordered by minute; equal-minute records
preserve source arrival order. Records already visible at the starting checkpoint
are excluded. Events match the household ID or a starting member ID. The report
keeps at most 2,000 matching events with an explicit eviction count. Worker frame
buffers can lose records before the collector sees them; therefore this count
is not a measure of all missing events. Empty daily intervals explicitly show a
gap, and empty traces mean no retained decision evidence. Unsupported actions and
cross-model trips have no controls in this replay.

On completion, the existing persistence API saves a child of the starting
checkpoint. A failed save can be retried without advancing time again. The
`weekReview=1` route renders only stored evidence, validates household and
checkpoint model/seed/clock identity, and destroys the runtime. It does not
recompute the week or certify event-driven historical recomputation. The parent
remains unchanged. Starting/final World links refer to those same saved records.

Verification commands:

```
bun test test/household-week.test.js test/house-bridge.test.js test/house-workflow-roundtrip.test.js
HBL_WORLD_DB_PATH=/private/tmp/she130-browser.sqlite HBL_PLAYWRIGHT_PORT=41930 HBL_PLAYWRIGHT_PARTY_PORT=41931 bun run test:e2e test/e2e/household-week.e2e.js
```

The unit/integration tests exercise the actual Population worker, independent
matching-event collection, deterministic checkpoint replay, source ordering,
retention, missing data, exact boundaries, UI event payload equality, pause and
resume, persistence failure/retry, parent immutability and read-only rendering.
Browser setup in this workspace returned `EADDRINUSE` before either local server
could start (ports 3190 and 41930); the Playwright journey is included but has not
run successfully. Browser layout and the full inspector-to-route journey remain
unverified. No project lint/typecheck script is defined.
