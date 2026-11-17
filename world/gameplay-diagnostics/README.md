# Local gameplay diagnostics v1

This module captures explicitly supplied, consented difficulty/defect categories.
It does not subscribe to gameplay, collect milestone counts, or modify simulation
provenance. Nothing imports it into the application UI in this slice.

```js
import { createDiagnosticCollector } from './collector.js';
import { exportDiagnosticFixture, importDiagnosticFixture } from './fixture.js';
const collector = createDiagnosticCollector({ capacity: 32 });
// Only call following explicit player consent:
collector.optIn();
// collector.capture(event) returns fixed codes; see contract.js for closed fields.
const local = exportDiagnosticFixture(collector); // {ok:true,json}; no I/O
collector.withdraw(); // disables capture and clears events/dedup state
```

All envelope keys are required, including nulls: schemaVersion
`hbl.gameplay-diagnostic.v1`, route/surface, symptom, source, renderer, build,
modelVersion/rulesVersion/dataVersion, elapsedBucket, status and replay.
`contract.js` is the exhaustive enumeration. Null renderer/build/versions/replay
means unavailable; never substitute a current version for missing historical
information. Rules versions are currently unavailable (null); model versions
support bakery-v1 and city-systems.1.0.0/1.1.0, data supports future-machine.v1 or
null. Build accepts only a full lowercase 40-hex Git SHA or null. No account,
session ID, timestamp, free text, URL, stack or arbitrary metadata is accepted.

Replay is null or `{modelVersion,rulesVersion,dataVersion,seed,recipe}`. Versions
must match the event. Seed is uint32. Optional recipe is null or the real bakery
recipe `{version:'bakery-v1',seed:2911,reopenMonth:null|72..240}` and must match
the replay model/seed and bakery surface. Other recipe types require a reviewed
contract change. Replay consistency is not proof of reproducibility or verified
recomputation; see ../replay/README.md. Bakery's seed identifies fixed synthetic
inputs; player-lab policy timing seed is a separate value and is not substituted.

`observed-error` identifies caller-observed errors; `synthetic-scripted` identifies
scripted fixtures. `scripted-step-failed` requires the latter. These are assertions
by the caller, not automated inference of player confusion or proof of a defect.
Do not pass raw player-lab receipts: their messages, paths and source fingerprints
have a broader privacy surface. The test explicitly projects only permitted facts
from a deterministic injected failure through the existing runPlayer entry point.
That injected failure is not evidence of a real application defect.

Default capacity is 32, configurable 1–128; events have a 1024-byte ceiling. Oldest
unique events are evicted when full. Exact normalized duplicates within retained
events are ignored without refreshing age; evicted events may be captured again.
Dedup memory has the same bound as the queue. Copies isolate caller mutations.
Both clear() and withdraw() stop capture, empty the ring and forget dedup state;
optIn() is required to resume. Consent is memory-only and cannot be imported.

The fixture adapter returns a deterministic JSON string, with schemaVersion
`hbl.gameplay-diagnostic-fixture.v1` and at most 128 events. Import requires fresh
destination consent and validates the entire bounded batch before capture;
capacity eviction follows normal capture rules. Export does not drain the ring.
No transport, persistent storage, browser download, timers, listeners, model calls
or production endpoint exist. A caller retaining an explicitly exported string
owns that copy; withdrawal can clear only this collector's memory.

Run `bun test test/gameplay-diagnostics.test.js`. UI wiring and actual player
consent controls remain coordinator-owned future integration work.
