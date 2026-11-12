# Agent count contract v1

`world/metrics/agent-counts.js` is the metric interface owned by SHE-141.
The normal executable entry point is `bun scripts/benchmark-agent-counts.js`.
It does not modify the City, Population, Future Machine or rendering engines.
Downstream adapters must supply their own versioned source/state/rule evidence;
this fixture is not an adapter for those engines.

## Operational units

All counts describe one run/window, not a sum across unrelated scenarios.

| Export | Unit and evidence |
| --- | --- |
| `residentRecords` | Individual source records resident in memory at the end of the window, including inactive records. Not interactions. |
| `independentlyUpdatedStates` | Distinct individual IDs whose own state changed during the window; each has its own stored energy, not a shared cohort state. An unchanged evaluation does not count. |
| `eventDrivenUpdates` | Committed individual state transitions attributable to validated events, including repeated changes to one individual. This rule changes two states per event. |
| `modeledPairwiseInteractions` | Validated ordered pair events with distinct resident IDs, causal before/after evidence, and at least one actual rule-authorized state change. One transfer is one interaction, not two updates. |
| `visibleAvatars` | Observed rendered individuals in a defined view/frame. Always 0 in this headless adapter; rendering evidence is unavailable. Never inferred from resident records. |
| `aggregateCohortWeight` | Sum of represented population weights, possibly fractional, independent of individual records. Default 0 here. A caller can annotate a finite nonnegative weight; it is not validated individual state evidence and never changes interaction/active counts. |

`activeCount` is the distinct changed-state count for this window, not allocated
capacity or population multiplied by ticks. This contract chooses changed states
rather than merely scheduled evaluations; consumers must preserve that meaning.
An agent can be active even if its end state equals its initial state.
`completedTicks` counts completed outer model iterations, including iterations
with no eligible pair. A tick is a discrete step with no physical-time calibration.

`interactionsPerSecond` is validated pair events divided by monotonic elapsed
wall seconds for the same execution window. `simulationTicksPerSecond` uses
completed ticks over that same duration. Both are null for zero duration;
negative, nonfinite and missing duration are errors. These are wall throughput,
not events per modeled second. `renderFPS` requires observed presented frames
over a separate render wall window; it is null here. Rendering inputs are rejected
by this headless adapter. GPU submissions or simulation ticks are not frames.

“1 million interacting agents” would require at least one million distinct
independently changed individual states with validated interaction evidence in a
declared window, plus source/model metadata. One million events alone does not
establish one million active agents. The fixture caps records at 4,096 and ticks
at 1,000 and cannot demonstrate that scale.
`interactionClaim(run)` validates the complete run before generating any claim.
The exact phrase “1M simulated interactions” is reserved for at least one million
validated pair events. Visual instances, population×ticks, or weighted cohorts
alone cannot authorize it. This bounded adapter can never emit that phrase.
Other systems' prose is outside this API's enforcement boundary.

## Versioned CPU fixture and evidence

Model `synthetic-energy-transfer.v1`, rules `unit-transfer.v1`, source
`synthetic-initial-energy.v1`, adapter `bounded-cpu-reference.v1`.
Every synthetic source record has a stable integer ID and initial energy 10.
The uint32 seed drives an explicitly versioned LCG selection sequence (multiplier
1664525, increment 1013904223, modulo 2^32). Each tick chooses one ordered distinct
pair; an empty donor produces no event. An eligible donor transfers one energy
unit to the recipient. Energy remains nonnegative and the sum is conserved.
Modulo selection is synthetic and not a calibrated social-contact distribution.

Every event stores ID, tick, participants, source/rules and before/after values.
Validation replays from the source records, checks ordering, eligibility and rule
changes, compares the final state, and regenerates the seed-matched schedule to
reject missing events. Equal final totals alone are insufficient. Unsupported
versions, omitted seeds, fabricated sources and no-op interactions are rejected.
The CPU test additionally applies an independent Map-based transfer oracle.
There is no second production/GPU backend in this slice; cross-backend equivalence
and downstream population CPU-oracle work remain unverified.

## Actual bounded measurement

Commands (Bun 1.4.2):

```sh
bun test test/agent-counts.test.js
bun scripts/benchmark-agent-counts.js 4096 1000 42 > /private/tmp/SHE-141-agent-counts.json
```

Observed 2026-11-12T03:41:48.561Z on mohammads-MacBook-Air.local,
Apple M4 / 10 logical CPUs / 17,179,869,184 bytes RAM, Darwin 24.6.0 arm64.
Seed 42, versions and limits as above. One cold execution measured 0.0010945
wall seconds with a monotonic clock, including fixture setup/event allocation,
excluding replay validation and JSON export. Counts were respectively
4096 / 1680 / 2000 / 1000 / 0 / 0 in table order. The raw derived rates were
913659.2051164915 interactions/sec and ticks/sec; render FPS was null.
This is a short, noisy microbenchmark with no warm-up, repetitions, confidence
interval, browser, rendering, GPU or worker measurements. It does not measure
sustained throughput, calibrated behavior, or a million-agent engine. Reruns
should reproduce counts and state, not timing. The command exports the full
runtime/machine metadata and limitations alongside the six counts.

Focused acceptance at this measurement: 7 tests passed, 261 assertions.
Shared implementation-plan and production integration remain coordinator-owned.
