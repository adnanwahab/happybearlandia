# Architecture C: spatial event queues

Research adapter `world/spatial-events/model.js`, normal entry point:

```sh
bun test test/spatial-events.test.js test/agent-counts.test.js
bun scripts/benchmark-spatial-events.js > docs/evidence/spatial-events-benchmark.json
bun scripts/benchmark-spatial-events.js -1 # expected nonzero
```

## Scope and identity

This is a synthetic CPU spike, not the Population engine. Source
`synthetic-lattice.v1`, model `spatial-events.v1`, rules
`ring-arrival-unit-contact.v1`. Inputs: count 0–1M, uint32 seed (default42),
rounds 1–10 (default1), ring tiles 2–256 (default64), hot boolean.
Integer resident IDs are array indices, positions are tile indices, energy is
integer units initially10 and bounded0–20. Time is an uncalibrated integer unit.
There is no mapping to Population IDs or civil time. Reviewed Population's model
card: continuous interval needs and travel are incompatible with this event-only
clock, so no production rule reuse or equivalence is claimed. SHE-142 is Done in
Linear but its scalar source is absent here; the independent sorted-list test
oracle is local to this adapter. SHE-171 shared runner remains Todo.

Each resident starts at id modulo tiles (or tile0 in hot mode). Initial decision
time is FNV-style uint32 mix(seed,id) modulo17. A decision schedules arrival
1+mix(seed,id+round) modulo7 units later; arrival atomically hands ownership to
the adjacent ring tile. One unit later a contact attempt targets
(id+tiles) modulo count. Only distinct, co-located pairs with donor energy>0 and
recipient energy<20 transfer one unit. Another round schedules a decision one
unit later. Rates and contact topology are synthetic assumptions, not realistic
human contact estimates. Position remains at origin until arrival; there is no
continuous motion, in-flight state or needs integration.

## Scheduling and evidence

Per-tile binary heaps use total order (time, resident ID, kind). Decision,
arrival, contact kinds are0/1/2; each resident has one pending event, so this key
is unique. A coordinator heap selects tile heads with the same order. Old head
objects are ignored by identity; new events always have strictly later times.
This is single-threaded global coordination, not distributed conservative or
optimistic parallel simulation. Hot tile scheduling remains serial. Queue depth
counts live events; internal stale coordinator entries are not counted.

Scheduled/processed interaction counters count contact attempts, including
ineligible pairs. `modeledPairwiseInteractions` counts only committed transfers;
`stateUpdates` counts individual position/energy changes. Neither is a distinct
active-resident count. These exports are not the six-count contract adapter and
a million scheduled contacts must not be described as a million interactions.
Ordering hash streams time, identity, kind, tile and round through uint32
FNV-style mixing; state hash covers position and energy in identity order.
Hashes are compact regression checks, not collision-proof provenance. This spike
retains inputs and hashes, not an inspectable full causal event log.

Ownership is checked at every event and final membership is independently
scanned for duplicates and missing agents. Final expected adjacent displacement,
bounded energy, energy conservation, no late events and complete queue drainage
are asserted. An independent sorted-list scalar implementation checks transitions
and hashes for boundary populations, tie-heavy schedules, ring wraparound,
multiple rounds and uint32 seed boundaries. The single-global-heap scheduler
also agrees at10k. Recorded runs are replay-tested at all three requested sizes.

## Actual measurements and limits

See [machine-readable evidence](evidence/spatial-events-benchmark.json) for date,
CPU, OS, RAM, runtime, exact inputs, hashes, counters and post-run memory samples.
One sequential cold/warming process, no repetitions or confidence intervals:

| Residents | Distributed ms | Hot tile ms | Events per run |
| --- | ---: | ---: | ---: |
| 10,000 | 17.87 | 13.50 | 30,000 |
| 100,000 | 126.15 | 103.89 | 300,000 |
| 1,000,000 | 2299.77 | 1764.45 | 3,000,000 |

All six runs observed zero late events and passed ownership/resource invariants.
One million resident runs each executed one million adjacent handoffs. Live total
queue depth peaked at population size; hot-tile depth also reached population
size. Hot is faster here; this workload does not establish a parallel hot-tile
bottleneck. Timing includes generation, simulation and invariant validation,
excludes JSON output. Memory is process-wide after execution, not peak memory.
No render, browser, worker, GPU, empirical calibration, production equivalence,
sustained throughput or architecture-shootout ranking is established.

Ownership: existing isolated `mini/SHE-145` workspace; new spatial-events module,
CLI, focused tests, evidence and this document, plus implementation-plan entry.
GitHub PR audit failed due network access; no merge, dispatch or deployment.
Next integration needs the actual scalar oracle and shared benchmark runner,
causal trace retention and a defined Population identity/time/rules adapter.
