# Spatial neighbor benchmark — SHE-149

Implemented `world/spatial/neighbor-index.js` and the normal headless entry point
`bun scripts/benchmark-spatial-neighbors.js [count] [seed] [repeats]`.
This is a synthetic snapshot broad-phase experiment, independent of production
Population, City, physics and scalar agent-model rules. It allocates one million
distinct position indices; it does not establish one million interacting agents.

## Scope and provenance

Work is isolated in workspace `SHE-149`, branch `mini/SHE-149`, starting at
`b963dd3`; initial working tree was clean. Ownership: the new `world/spatial/`
module, benchmark CLI, focused test, this report, JSON evidence and the SHE-149
plan entry. No shared engine interface changes. The direct user issue request
provides implementation scope; no worker dispatch, Git mutation or publication.
Connected Linear read on November 12 marks prerequisite SHE-142 Done, linked to
PR50. Its scalar-oracle files are absent on this checkout. This experiment uses
its own independent small geometric oracle; integrating scalar movement snapshots
requires the prerequisite source and an explicit identity/coordinate adapter.
GitHub CLI could not connect; subsequent connected GitHub searches for SHE-149
PRs and open spatial PRs returned no matches. No absence claim beyond those queries.
No `docs/architecture.md` or more specific module agent instructions were present.

## Contracts and synthetic assumptions

Model `spatial-neighbors.v1`, source `synthetic-lcg32-four-hubs.v1`, rules
`euclidean-inclusive-radius.v1`. LCG32 uses multiplier 1664525, increment
1013904223, modulo 2^32. X and Y consume consecutive draws; these are synthetic,
uncalibrated positions. Seed 42; one static snapshot per skew, seed-matched across
methods and repeats. Integer coordinates have abstract units and no model clock.
IDs are array offsets; callers must keep positions immutable for the index lifetime.
There is no mapping to household/resident IDs or simulation ticks.

Default extent is 4096 square units, tile width 16, contact radius 4. Fractions
0%, 1%, and 10% occupy four 16×16 transit hubs equally; remaining positions span
the full square. Hub members occupy the first floor(count×fraction) IDs. The
experiment measures broad-phase candidate checks and inclusive squared-distance
matches. It excludes self, retains co-located distinct IDs, and performs no
collision resolution. Counts are directed queries, not unique physical pairs or
rule-authorized interactions. Query traversal examines only intersecting tiles.

Hash bins use a JS Map of injective numeric tile keys to dynamic ID arrays.
Sorted bins comparison-sort a Uint32 ID permutation by tile and ID, store Float64
unique tile keys and Uint32 offsets, and binary-search each queried tile.
Coordinates support [-32768,32768], tile widths [1,32768], radii [0,32768], and at
most 1M IDs. Large radius/small tiles can be expensive; the benchmark uses 4/16.
Both are unbounded occupancy bins: capacity 256 is a diagnostic threshold,
never a truncation cap. Overflow agents means sum(max(occupancy−256,0)).

## Reproduce and verify

```sh
bun test test/spatial-neighbor-index.test.js test/agent-counts.test.js
bun scripts/benchmark-spatial-neighbors.js 1000000 42 3 > docs/evidence/spatial-neighbors-1m.json
bun scripts/benchmark-spatial-neighbors.js 0 0 1
bun scripts/benchmark-spatial-neighbors.js 1000001 42 1 # expected nonzero
```

Raw [measured evidence](evidence/spatial-neighbors-1m.json) includes machine,
runtime, command, seeds, input/result hashes, individual timings and memory.
18 fresh sequential Bun subprocesses: three repeats × three skews × two methods.
GC occurs before/after build, outside build timing. Input allocation is excluded.
No warmup; query timing includes result allocation, excludes sorting/hashing and
oracle. Each stratum uses up to 256 evenly spaced IDs: population and separately
hub-only. Hub queries deliberately oversample the hub population. Reported table
values are medians of three per-process measurements; p95 is a within-process
query percentile, not a confidence bound. Small cold samples are noisy.

Measured November 12, 2026, Darwin 24.6.0 arm64, Apple M4, 10 logical CPUs,
16 GiB memory, Bun 1.4.2. Time values below are observations on this machine.

| Hub fraction | Method | Build ms | Population p95 µs | Hub p95 µs | Retained heap delta MiB | RSS delta MiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 0% | Hash | 40.52 | 7.67 | — | 14.85 | 34.77 |
| 0% | Sorted | 439.87 | 5.83 | — | 4.67 | 21.45 |
| 1% | Hash | 34.62 | 4.96 | 21.04 | 17.51 | 30.92 |
| 1% | Sorted | 438.74 | 4.58 | 19.92 | 4.67 | 21.08 |
| 10% | Hash | 32.72 | 161.08 | 99.38 | 19.12 | 30.91 |
| 10% | Sorted | 449.99 | 152.71 | 137.25 | 4.68 | 20.91 |

Memory deltas are runtime observations, not exact data-structure sizes. RSS includes
allocator/build high-water effects; GC and typed-buffer accounting differ by runtime.
Sorted retained typed index storage is exactly 4,786,436 bytes in these runs;
hash typed index storage is zero because its storage is JS containers, not free.
Both share 8,000,000 position bytes, excluded from build deltas. Temporary sort
storage, Map/array overhead and keys are not represented by typed byte counts.

| Hub fraction | Population candidates / matches (256 queries) | Hub candidates / matches (256 queries) | Max tile | Overflow tiles / excess IDs |
| --- | ---: | ---: | ---: | ---: |
| 0% | 9,475 / 759 | — | 35 | 0 / 0 |
| 1% | 16,878 / 1,884 | 647,505 / 98,332 | 2,516 | 4 / 9,022 |
| 10% | 658,219 / 102,200 | 6,406,810 / 986,275 | 25,014 | 4 / 99,017 |

Counts match across methods and all repeats; zero IDs dropped. All 18 input/result
hash comparisons agree within skew. Each sample checks all 256 queries on a small
fixture and eight evenly spaced queries on the million-index snapshot against an
independent exhaustive distance loop: 4,752 comparisons, zero mismatches. Unit tests
also cover seeds 0/42/uint32-max, 0/1/50/100% hubs, negative coordinates, exact
radius and tile boundaries, duplicate positions, empty data, invalid inputs and
600 coincident IDs exceeding nominal capacity without lost matches. No exhaustive
million-agent all-pairs correctness claim is made.

Interpretation: hash builds were much faster in this implementation; sorted bins
used less observed retained memory. Query advantage varies by skew, and both
must visit the same dense candidates. This does not identify a production winner:
comparison sorting, JS container allocation and immutable snapshots are specific
choices. Incremental updates, radix/counting sorts, cache effects, physical collision
response, calibrated transit geography, sustained timestep costs and GPU/browser
backends remain unmeasured. No browser behavior changed, so Playwright is inapplicable.
