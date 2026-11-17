# E6: sustained consumer-hardware soak (SHE-220)

Status: protocol and offline evidence review implemented; **no physical-device
results collected**. This reconstructs E6 from the full Linear SHE-220 description
read on 2026-11-12. Its referenced `million-agent-architectures.md` is absent in
this checkout. This document does not replace that broader architecture research.
Thresholds remain proposed pending SHE-177. Do not mark E6 complete from unit
fixtures, desktop emulation, or renderer benchmarks.

## Device matrix

| Tier | Required physical device | Rendering off | Rendering on | Fallback evidence |
| --- | --- | --- | --- | --- |
| T1 | 2023 Apple M-series or RTX laptop | Pending | Pending | Pending |
| T2 | 2021 integrated-GPU Windows laptop or Chromebook Plus | Pending | Pending | Pending |
| T3 | 2022 mid-range Android phone | Pending | Pending | Pending |
| T4 | iPhone 13–15, Safari; record exact iOS version and WebGPU availability | Pending | Pending | Pending |

Each row needs two 20-minute trials at the claimed population on the same
pinned model/rules, seed, scenario inputs and fidelity. Record physical model,
RAM, GPU, OS/browser versions, viewport, renderer/backend, power mode, charger
state, start battery percentage, ambient conditions and cooling interval in the
referenced evidence. Keep private identifiers out of shared artifacts. Use a
fresh tab and repeat the same setup for each trial. Counterbalance trial order
across repeats if available; one trial per mode cannot establish variance.

## Capture procedure

1. Pin the source commit, model/rules versions, scenario inputs, uint32 seed,
   claimed resident count, time mapping and fidelity. Confirm the worker owns
   simulation advancement and that the count represents actual resident state.
   A renderer instance count is insufficient. Keep the worker running in both
   rendering modes; turn off drawing only for the rendering-off trial.
2. Save initialization/warmup separately. Begin the measured window after setup.
   Record cumulative modeled time and monotonic elapsed wall time every minute;
   export their **interval deltas** as `modeledDays` and `wallSeconds`.
   Use twenty consecutive intervals of at least 60 seconds, covering at least
   twenty wall-clock minutes. Do not pause the wall clock while hidden.
3. Collect frame-time samples for the measured window with a documented method,
   and export p50/p95 in milliseconds. When drawing is disabled, explicitly mark
   frame metrics unavailable. Do not call synthetic worker ticks frames.
   Capture a memory high-water mark with a named measurement scope/tool (JS heap
   is not total process/GPU memory). Count main-thread tasks over 50 ms using an
   observer where supported. Record battery percentage before/after while
   unplugged; a missing Battery API can be supplemented by OS observations.
   If a metric cannot be measured, store null with its reason, never zero.
4. At elapsed minute 10, background the tab for 60 seconds and restore it.
   Record actual hide/restore timestamps, continued/paused work, catch-up,
   responsiveness and time to recover. Include hidden intervals in throughput.
   This is a deliberate scenario input; repeat it in both trials.
5. Record crashes, reloads and OOM observations with OS/browser logs where
   available. A crash does not prove OOM. Retain partial logs for failed runs;
   an incomplete run is not accepted as a twenty-minute result. Keep an external
   observer/log so process death cannot erase the only failure evidence.
6. Document a concrete lower-population, lower-fidelity or alternate-renderer
   fallback for each tier. Record whether it was tested and link its separate
   run; a suggestion is not a verified fallback. Preserve the original failure.

The existing `scripts/benchmark-renderer.js` measures renderer scenes and
`scripts/benchmark-agent-counts.js` runs a bounded synthetic CPU fixture. Neither
provides this worker/device capture. A population-specific telemetry adapter and
physical hardware access are prerequisites; this change does not launch a soak.

## Evidence format and review

Create one JSON report per physical device/configuration. Run:

```sh
bun scripts/soak-evidence.js path/to/device-report.json
bun test test/soak-evidence.test.js
```

Top-level required fields: `schemaVersion: 1`, `tier` (T1–T4), nonempty `device`,
`os`, `browser`, `capturedAt`, `sourceCommit`, `modelVersion`, `rulesVersion`,
`scenario` (inline configuration or immutable reference), `fallback` (concrete
configuration and tested/pending status), integer `seed` (0–4294967295), positive
integer `population`, boolean `webgpuAvailable`, and exactly two `runs`.
Use ISO UTC capture dates and exact source revisions. Keep raw traces and source
configuration alongside reports; evidence references should resolve for reviewers.

Each run contains:

```json
{
  "rendering": "on",
  "workerSimulation": true,
  "evidence": "relative/path/to/raw-trace-and-environment-record",
  "oom": false,
  "crashes": 0,
  "reloads": 0,
  "minutes": [{ "minute": 1, "modeledDays": 4, "wallSeconds": 60 }],
  "frameP50Ms": { "value": 16 },
  "frameP95Ms": { "value": 30 },
  "memoryHighWaterBytes": { "value": null, "unavailableReason": "No process-memory measurement available" },
  "longTasks": { "value": 2 },
  "batteryDropPercentagePoints": { "value": 5 },
  "background": {
    "hiddenAtSeconds": 600,
    "restoredAtSeconds": 660,
    "behavior": "Describe observed behavior and recovery latency",
    "evidence": "relative/path/to/visibility-and-recovery-log"
  }
}
```

This abbreviated example is illustrative, **not observed evidence**, and is
invalid until all twenty consecutive minute records and the second run
(`rendering: "off"`) are supplied. All five metric fields use the value/reason
structure. Values are nonnegative; battery drop is in percentage points.
If charging caused an increase, record that in raw evidence and mark the drop
measurement unavailable for this protocol rather than clamping to zero.

The CLI emits JSON and exits nonzero for invalid structure, failed proposed
gates or unavailable T2 retention. A valid report computes T2 minute-20 rate /
minute-1 rate, inclusive pass at 0.8; zero baseline is unavailable. T3/T4 use the
explicit OOM observation. T1 has no proposed numeric gate. Both modes are
reported independently. A zero exit is **not release approval**: this structural
checker does not authenticate logs, verify device eligibility, detect omitted
failures, verify fallback execution, or establish full-matrix coverage. Missing
metrics with reasons remain visible limitations requiring human review.

## Acceptance evidence and remaining work

Five focused Bun tests pass (33 assertions), including actual CLI rejection,
invalid/missing records, mode duplication, nonfinite throughput, percentile
ordering, wall-time normalization, zero baseline, 80% boundary and mobile OOM.
Fixtures are explicitly synthetic. No browser behavior changed; Playwright is
inapplicable to this offline tooling slice. No generic lint/typecheck script is
configured in package.json.

Next: integrate capture with the chosen worker runtime and claimed population,
collect eight physical-device trials plus fallback evidence, inspect failures
and unavailable metrics, and obtain SHE-177 threshold ratification. Preserve
Backlog/incomplete status until the actual device evidence exists.
