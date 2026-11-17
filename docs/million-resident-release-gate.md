# Million-resident release gate v1 — SHE-177

Status: review candidate; no measured million-agent release is approved.
This policy supplements the [release checklist](release-checklist.md) and
[operational count contract](agent-counts.md). Thresholds below are proposed
product acceptance budgets, not observations or evidence of feasibility.

## Acceptance and evidence

Run `bun ops/check-million-release.js evidence.json > report.json`.
Exit 1 and the report's named failures mean HOLD; exit 0 means the submitted
attestation satisfies policy, not that its measurements have been independently
verified by the program. Preserve both files with immutable raw evidence.
Never substitute a synthetic passing test fixture for release evidence.

Every receipt uses schema `hbl.million-release.v1`, the exact candidate commit,
run ID, model/rules/source versions, uint32 seed, scenario, device, OS, browser,
and raw artifact reference. All measurements and approvals refer to that same
candidate and run. Changing either invalidates the approval. The reviewer must
be a different person from the measurement author; operator approval is separate.

The report always prints weighted residents, explicit resident records, distinct
independently changed states, validated interactions per wall second, and observed
graphical instances separately. Counts follow agent-counts.md; never sum runs,
infer interactions from population × ticks, or infer rendering from allocation.
The measurement window must include at least 1M distinct changed individual
states with causal pair-event evidence, and at least 1M resident records.
Weighted population alone can only support “1M weighted residents.”

| Gate | Proposed acceptance threshold |
| --- | --- |
| Sustained model throughput | At least 1,000,000 validated pair interactions per wall second over a continuous 1,200-second consumer-device soak. Divide committed events by monotonic elapsed seconds including stalls; exclude warm-up only if separately recorded. |
| Full-device memory | Peak used physical device memory at most 80% of installed RAM; zero swap growth bytes and zero OOM/device-loss incidents. Include OS, browser, workers, renderer and GPU shared/dedicated allocations without double counting. JS heap alone is insufficient. |
| First play | Cold-load p95 at most 10,000 ms over at least 20 fresh-profile trials per supported device/browser row, from navigation to an accepted resident action with visible receipt; include asset loading. |
| Model correctness | Zero invariant violations and missing causal events; deterministic replay and seed-matched comparison pass. Include identity uniqueness, finite states, conservation rules, valid transitions and boundary cases appropriate to the versioned model. |
| Fallback | Every supported matrix row passes: WebGPU unavailable, device loss, worker failure, memory pressure, unavailable assets and unsupported replay version. Show an intelligible error or labeled lower-capacity mode, preserve saved state, allow retry, and remove the million-agent claim when capacity drops. |
| Independent review | Named reviewer approves exact evidence and candidate, with zero unresolved blocking findings; named operator explicitly authorizes the public claim. |

## Receipt shape and review protocol

Top-level provenance fields are `candidate`, `runId`, `modelVersion`,
`rulesVersion`, `sourceVersion`, `scenario`, `seed`, `device`, `os`, `browser`,
`artifact`, and `author`. Counts are under `counts`: `weightedResidents`,
`explicitAgents`, `updatedAgents`, `interactions`, `graphicalInstances`.
`windowSeconds` defines the shared count/throughput interval. `memory` contains
`installedBytes`, `peakUsedBytes`, `swapGrowthBytes`, `incidents`.
`matrix` is a nonempty array of supported device/browser rows, each with `device`,
`browser`, `artifact`, `trials`, `firstPlayP95Ms`, and `fallbacks`, an object with
boolean keys `noWebGPU`, `deviceLoss`, `workerFailure`, `memoryPressure`,
`missingAssets`, `unsupportedReplay`.
`correctness` has `invariantViolations`, `missingEvents`, `replayPassed`,
`matchedSeedsPassed`. `review` has `reviewer`, `operator`, `approved`,
`operatorApproved`, `blockingFindings`, `candidate`, `runId`.

The checker validates structure and thresholds; a human must verify artifact
integrity, timing instrumentation, causal validation, all advertised matrix rows,
full-device memory accounting, and approval authenticity. Archive raw event/run
receipts, hashes, benchmark command, warm-up, sampling method, memory trace and
cold-play trial times. Record model uncertainty separately from measured results.
No default or empty receipt can approve a claim. Publish failures alongside the
candidate report; an unavailable metric is a failure, never a zero.

## Audit and remaining dependencies

Observed checkout: count fixture and replay validation exist; core-journeys CI
runs their tests. Existing HTTP release timing does not measure model throughput,
first play or full-device memory. No million-agent evidence was supplied here.
Live PR audit was attempted with `gh pr list` but network access failed.
SHE-141 defines units; SHE-151 architecture measurements, SHE-171 headless runner,
SHE-173 GPU readback changes, SHE-175 browser matrix, and SHE-220 consumer-device
soaks must supply compatible evidence before approval. This checker does not
instrument those engines or change browser behavior. No public performance claim,
merge, deployment, or production mutation is authorized by these local checks.
