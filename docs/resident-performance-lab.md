# SHE-236 resident performance lab

Measured on Apple M4, 10 logical CPUs, Darwin arm64, Bun 1.4.2. Source base `b963dd353538294cb0fbf5d34d5283fad6e10e68`; per-run source hashes and full machine metadata are in the evidence JSON. These synthetic results establish costs for this workload, not an interactive resident ceiling.

## Finding and delivered change

Fixed-step CPU simulation dominates the measured 100k workload. The sampled profile recorded 21.1% self time in native `entries` and 20.9% inclusive time in history `applyMinutes` (inclusive times overlap). The small production change enumerates and validates each interval’s need values once, then reuses those entries for lifetime, bucket and district accounting. No histories, model commits, rules, weights or arithmetic operations were removed.

The controlled original-history versus optimized-history comparison held the experimental heap sampler constant. At 100k the median step fell from 262.056 to 210.230 ms (19.8%). A later run with the final unchanged production full-sort sampler measured 236.315 ms. Timing variation is material: these sequential local runs do not provide a confidence interval or a guaranteed speedup. The initial exploratory run under concurrent test load measured 439.646 ms; it is retained as preliminary evidence and excluded from the gain comparison.

All three comparison/final runs produced identical full serialized-model SHA-256 hashes at each population size. Hash encoding is Bun’s `node:v8` serialization of `serializePopulation`; this is within-runtime equivalence, not a portable file format. Hashing and export are outside timing.

## Final execution measurements

Each size has one discarded warm-up and three measured fresh seeded runs. Each run advances sixteen fixed one-minute steps from minute 360 to 376, seed 42, with the versioned two-district synthetic context in JSON. Step percentiles pool 48 commits; the other phases contain three samples. p95 with three samples is the observed maximum. All values below are measured milliseconds.

| Residents | Original step p50 | Final step p50 / p95 | Final generation p50 | Snapshot p50 | Clone p50 | JSON p50 |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 4.485 | 2.951 / 4.759 | 1.952 | 1.185 | 3.311 | 3.554 |
| 10,000 | 30.765 | 24.729 / 27.074 | 9.367 | 2.427 | 3.370 | 3.035 |
| 100,000 | 262.056 | 236.315 / 406.413 | 64.213 | 13.049 | 3.344 | 2.866 |

Snapshots materialize 500 rows with the unchanged camera-aware production selector. Clone measures in-process `structuredClone`, not Worker message transfer. JSON measures stringify only. These separate phase medians must not be summed into a measured end-to-end latency.

| Residents | Unique typed-buffer bytes | Snapshot JSON bytes |
|---:|---:|---:|
| 1,000 | 703,008 | 2,040,307 |
| 10,000 | 7,018,752 | 2,021,215 |
| 100,000 | 70,172,996 | 2,032,195 |

Typed-buffer bytes exclude all object/Map/string overhead and GPU allocations. Sampled process heap/RSS includes previous phases and models; it is neither peak memory nor per-resident memory. No maximum-capacity claim follows from it.

## Current selection versus three practical alternatives

All four methods use exactly the same current people arrays, score, tie-breaking index, camera and 500-row budget. Each measured result is checked against the old full sort. Alternatives live only in benchmark code. Selection performs display queries; it is not a neighbor-interaction benchmark.

| Residents | Current full sort | Bounded max heap | Sorted insertion | Partition then sort |
|---:|---:|---:|---:|---:|
| 1,000 | 0.061 | 0.155 | 0.092 | 0.070 |
| 10,000 | 0.513 | 0.244 | 0.442 | 0.329 |
| 100,000 | 4.669 | 0.806 | 2.543 | 2.231 |

The heap’s 100k selection median was 0.806 ms versus 4.669 ms for full sort, but it regressed 1k selection (0.155 versus 0.061 ms). It also saves less absolute time than the history change in the measured 100k model path. The production selector is therefore left unchanged. Partition and insertion remain repeatable exact-result alternatives rather than unverified architecture claims.

## Source audit and limits

- **Per-agent work / update frequency:** `stepPopulation` runs activity, family, employment, needs, history and aggregate passes. Living World uses one-minute fixed commits; the existing people benchmark instead uses hourly outer steps. This lab uses the real one-minute entry point, with ordinary metrics/history intact. Coarsening the step would change semantics and was not used as an optimization.
- **Allocation / serialization / data transfer:** state is already typed-array oriented; only bounded rows are packed for Worker presentation. `packed` transfers position/activity buffers with accompanying metadata. JSON snapshots here remain about 2 MB because aggregate history and metadata accompany the sample. Full checkpoints preserve far more state. No transfer latency was measured.
- **Spatial queries:** current camera selection builds and fully sorts resident scores. The three alternatives above are measured. Simulation travel is a district/straight-line approximation; no million-person collision or neighbor-grid result is claimed.
- **Main-thread blocking:** the authoritative live model already runs in one Worker; household observation already batches unchanged commits. Independent futures have their own pool. Increasing future worker count does not shard the live model or shared housing/job capacities. Main-thread task duration and responsiveness remain unmeasured.
- **Rendering / CPU-GPU synchronization:** the Population adapter caps displayed residents at 500, uses instanced humans and points, and avoids unchanged buffer uploads. This source audit does not measure draw calls, GPU fences, uploads, render FPS or full-city geometry costs. There are no new GPU dependencies.
- **WebGPU unavailable:** the CPU model and headless benchmarks run without WebGPU. Main World already reports an explicit WebGPU-required error with retry/home controls rather than providing a WebGL renderer; this lab preserves that existing behavior. Browser fallback behavior was not exercised.
- **Scale:** Population configuration currently caps explicit people at 100,000. Represented population weights do not create independently simulated residents. Neither 1M explicit residents nor a calibrated social-interaction rate was tested. Morning-only, two-district results do not cover rush-hour travel, midnight settlement, commands, long retention or richer mapped geography.

## Reproduce and inspect

```sh
bun scripts/benchmark-residents.js 1000,10000,100000 3 > /private/tmp/resident-lab.json
bun --cpu-prof-md --cpu-prof-dir=/private/tmp scripts/profile-residents.js
bun test --timeout 30000 test/activity-history.test.js test/legacy-activity-history.test.js test/population-model.test.js test/population-needs.test.js test/population-world-view.test.js test/resident-performance.test.js test/population-visible-sample.test.js
```

Run timing commands without concurrent tests. The runner rejects out-of-range populations/repetition counts and fails on a selector or repeated-state mismatch. Source version, seed, clock, world context, raw phase samples, validation reports, sizes and limitations accompany every result. To reproduce the original-history comparison, restore only `world/activity-history.js` from the source base before running, then reapply the patch.

Evidence: [original history](evidence/she236-resident-baseline.json), [optimized history with heap experiment](evidence/she236-resident-optimized.json), [final production path](evidence/she236-resident-final.json), [initial noisy exploration](evidence/she236-resident-lab.json), [sampled CPU profile excerpt](evidence/she236-profile.md). The baseline/optimized pair used the same experimental heap presentation selector; simulation timings exclude selection. The final run uses the unchanged production full sort.

Related issue audit: SHE-151 architecture shootout is In Progress, SHE-149 interaction grids is Todo, SHE-171 million-scale headless/browser runner is Todo, and SHE-167 lazy initialization is In Review as read on 2026-11-12. No competing architecture, spatial-interaction backend or lazy allocation path was introduced. SHE-236 remains Canceled in Linear; this local investigation was performed under the user’s supplied request without changing issue status or publishing.

Verification: the listed focused suite passed 49 tests / 635 assertions in 8.41 seconds; [raw test log](evidence/she236-tests.log). An earlier run under concurrent benchmark load passed 33 tests and timed out one existing long-horizon case at its default 5 seconds; the 30-second run passed all cases. Existing Three.js renderer integration checks passed; no browser automation or real GPU check was run because production changes are confined to CPU history accounting. No lint/typecheck scripts are defined in package.json. `git diff --check` passed.
