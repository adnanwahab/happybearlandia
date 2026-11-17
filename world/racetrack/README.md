# Hundred-Future Racetrack

Normal entry: `/world/worlds.html`. The recorded comparison loads independently
of the existing live-world query parameters. Legacy live worlds retain their
own clocks and do not supply these lanes. The supplied recording always labels
its synthetic inputs, computed outputs and lack of observed sources.

## Projection receipt contract — racetrack-projection.v1

`contract.js` owns admission. A JSON bundle contains `{schemaVersion, tracks}`,
with at most 100 tracks. Import is local file reading only, capped at 2 MB. Each
track is the exact inspectable projection run receipt:

| Field | Contract |
| --- | --- |
| `schemaVersion` | `racetrack-projection.v1` |
| `id`, `label` | Stable local run ID (1–80 alphanumeric/underscore/hyphen) and label (≤120 characters); duplicate IDs excluded |
| `modelVersion`, `rules` | Current monthly City model and exact engine pack manifest; unsupported versions excluded |
| `recipe`, `seed`, `initialHash` | Existing validated Future Machine recipe, uint32 seed matching recipe, SHA-256 of original initialized state; all admitted lanes must match the first admitted lane's seed and original state |
| `metric` | Exact housingUnits / City unit inventory length / homes; fixed min 0, max 160 |
| `time` | Modeled month, origin 2026-01, exact ordered integer points 0–120 |
| `values` | 121 integer inventory observations in 0–160 or explicit `null` |
| `evidenceKind`, `provenance` | `synthetic-model-output`, exact provenance from the recipe's existing synthetic initializer |
| `checksum` | Existing `stateHash` SHA-256 over every other field; detects accidental corruption, not authenticity |

This is a metric projection receipt, distinct from `canonical-run-receipt.v1`.
It preserves the complete recorded metric trajectory and reproduction inputs,
but no full-state checkpoints, causal records, canonical receipt identity or
persisted experiment. Opening a lane displays its entire receipt plus selected
month/value. It does not silently rerun a different experiment. IDs are local to
the recording and do not map to Population/House identities or saved City IDs.
Untrusted imports can be authored by anyone; passing a checksum does not prove
these values came from model execution. The checked-in fixture is independently
regenerable from the actual engine. There is no production storage or API write.

Admission keeps compatible lanes and reports each excluded input's index and
reason. Missing months must be `null`; holes, omitted points, non-finite values,
out-of-range/fractional inventories and incompatible time or metric definitions
are rejected. A `null` hides the marker and reads “Missing observation”. There
is no zero substitution, interpolation, carry-forward or missing-value ranking.
Empty input or all-excluded input disables playback. Failed imports retain the
previous recording with an explicit error. Failed fixture fetches show an error
and never substitute live outcomes.

## Time and display

The horizontal position is `homes / 160`, fixed across all lanes and times, with
labeled 0/80/160 homes. Lane order is stable. Higher inventory alone does not
establish welfare, causal effect or a better policy. Playback advances exactly
one recorded month every 500 ms; scrubbing pauses it. Next lead change jumps to
the next recorded strict lead after an equal or lower preceding value. The change
list compares adjacent recorded points only: it reports the first recorded month
of that transition, not an inferred within-month crossing. Missing adjacent
values prevent a transition claim; a tie is never a lead. These authored
scenarios and pinned seed are not a probability sample or uncertainty estimate.
Rails, colors and markers are decoration, not resident counts.

No WebGL/canvas, live workers or scene resources are created by the racetrack.
The view uses 100 DOM rows, one playback interval and abortable event listeners.
Playback pauses on document hiding and receipt opening. Replacing data aborts
old lane listeners. Page exit clears playback, aborts fetch/listeners, drops lane
references and removes the rows/receipt text. A back/forward-cache pagehide pauses
playback while preserving the cached page. Actual browser/consumer hardware
frame time and resource disposal still require measurement; DOM cleanup alone
is not that evidence.

## Deterministic representative recording and checks

`representative.json` contains 100 actual City trajectories, each computed once
offline. There are no hand-authored outcome curves. Run:

```sh
bun --no-env-file scripts/generate-racetrack.js
bun --no-env-file test test/racetrack.test.js test/future-machine-data.test.js test/city-systems.test.js
HBL_RACETRACK_DOM=/absolute/path/to/happy-dom/lib/index.js bun --no-env-file test test/racetrack-dom.test.js
bunx playwright test --config test/racetrack.browser.config.js
```

The DOM dependency is optional using the repository's existing convention; the
DOM check skips without that environment variable. The browser check intercepts
static file requests at `http://localhost:39886/world/worlds.html`, serving actual
checkout bytes with the normal entry and import graph, without a local TCP
listener. It covers desktop/mobile screenshots, playback, receipt equality,
missing recording, unsupported model and cleanup. This isolates the presentation
check from the app's persistence/providers; it does not verify Bun HTTP routing.
Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an installed compatible Chromium.
See [SHE-746 evidence](../../docs/reviews/SHE-746.md) for actual results and limits.
