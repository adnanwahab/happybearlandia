# City Heartbeat contract (SHE-733)

Entry: `/world` → **City Heartbeat · recorded movement**, bottom left. Open or
Refresh to take a bounded snapshot of the current run's retained ActivityHistory.
This is not live analytics. Source is `window.hblWorldActivity`, the same adapter
used by the Activity dashboard. The view subscribes only for run invalidation;
ordinary updates do not repeatedly query or rebuild the chart.

`heartbeatPoints(history)` accepts `activity-history.v1`, nonempty `runId`,
positive `bucketMinutes`, supported query coverage, and ordered/nonoverlapping
buckets. Each point retains `runId`, `startMinute` as `minute`, `endMinute`,
`completedTrips` as `value`, and `agentMinutes`. Values must be nonnegative safe
integer trip counts and strictly positive finite raw agent-minutes. Unsupported
queries, unavailable coverage, missing counts/denominators or absent buckets
produce no point or a line break. Zero trips with positive observed duration is
a real zero. No interpolation spans a missing period. Missing leading/trailing
history is not extrapolated. Partial current buckets retain their actual recorded
denominator; their nominal hour bounds do not assert full-hour observation.

Units: raw completed trip emissions per recorded hourly bucket; raw recorded
agent-minutes alongside every point. These are counts of modeled trip completions,
not unique residents, city population, probabilities, or trips per capita. No
represented weights or sampled render positions enter the projection. Recorders
and retention remain owned by `activity-history.js`; source provenance, seed,
model/rules version and world inputs remain in the unchanged current authority.
The panel identifies its current run; the synthetic fixture declares its own
fixture rules and assumptions and is never loaded into the application.

Point click or period button maps to the exact bucket **start** in absolute
simulation minutes, not the peak's screen coordinate or an index. Living World
pauses through the shared playback controller, then calls the existing Population
`stepToTime` with that minute. This is same-run deterministic recomputation;
historical geometry/positions are not claimed as independently observed. Existing
fixed-step, initial-time, checkpoint, and work-budget restrictions can refuse a
seek and are reported, never rounded or bypassed. Legacy World lacks this replay
API: its recorded trace remains readable but selecting a period reports seeking
unavailable. Run changes invalidate the display. Seeks validate identity before
and after execution and verify returned exact minute. Errors never report success.

Evidence layers: map geometry may have its own observed OSM source; it does not
calibrate these trips. Population schedules and behavioral parameters are
synthetic assumptions; completed trips and duration accounting are computed model
effects. Selected-point opacity pulse and chart styling are decorative, respect
reduced motion, and convey no additional measurement or causal claim. No new
social/agent mechanism, stochastic draw or model inventory change is introduced.

Lifecycle: pagehide removes the panel, run subscription and listeners, invalidates
pending reads and releases DOM/SVG references. No chart timer, worker, WebGL
context, buffer or texture is allocated. An already submitted authority replay is
not canceled by panel disposal; the runtime retains ownership. Consumer-device
frame-time and memory/disposal profiling remain unavailable in this session.

Fixture: `test/fixtures/heartbeat/representative.json` deterministically represents
a crest at minute 420, missing [480,540), and a true zero at 540. Unit/integration
checks also run the actual Population worker and replay its recorded crest.
Focused browser fixture checks SVG gaps, exact selection, narrow viewport,
run invalidation and DOM disposal; it does not prove full `/world` renderer/device
performance. Run `bunx playwright test --config test/heartbeat.browser.config.js`.
