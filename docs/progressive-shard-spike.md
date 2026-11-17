# Architecture E: bounded progressive shard spike (SHE-147)

## Scope and audit

Owned in existing isolated worktree `workspaces/SHE-147`, branch `mini/SHE-147`:
`world/shard-spike/`, `scripts/benchmark-shards.js`, `test/shard-spike.test.js`,
this report, evidence JSON and implementation-plan status. No delegation needed:
the model, barrier and measurement form one coupled slice. Read product design,
implementation plan, worker README, protocol and agent-count contract before edits.
No docs/architecture.md exists. GitHub SHE-147 PR search returned no matches.
SHE-141 and SHE-142 are Done in Linear; the scalar oracle files from SHE-142
are absent in this checkout. Its integration is explicitly pending, not copied
from another worktree or inferred from tracker status.

Existing live Population has one authority because housing/jobs share capacity;
existing pooled independent futures do not establish partitioned city equivalence.
This separate synthetic model does not modify either interface.

## Reproducible model and execution

Run `bun scripts/benchmark-shards.js`; test with
`bun test test/shard-spike.test.js test/agent-counts.test.js`.
The JS coordinator also exports `runShardSpike` with progress callbacks and a
browser module Worker entry point. Actual measurements use Bun Web Workers;
no browser measurement or production UI integration is claimed.

`synthetic-ring-flow.v1` uses LCG multiplier 1664525, increment 1013904223,
uint32 arithmetic, seed 42 and initial integer resource `LCG % 101` per cell.
Cells are synthetic city tiles with stable array-index identities on a ring.
One tick moves one unit right from each nonempty cell simultaneously. Ticks
have no physical-time calibration. The scalar reference computes the entire
ring; workers compute contiguous tiles from immutable tick-start values plus
one left halo. Sum, cell count and bounds 0–100 are conserved. There are no
observational inputs or calibrated human decisions. This tests partition
mechanics, not interacting-agent fidelity.

Every tick waits for all shards. Version/tick/range/length checks and full scalar
state comparison precede commit. Worker errors, timeout, stale responses and
incorrect values reject the run and terminate workers. No partial tick is
published. Progress exposes committed tick and diagnostic FNV-style hash;
this hash is not a cryptographic result authentication mechanism. Completion
order cannot change state. No retry or fault-tolerant checkpoint resume exists.

Limits: 8–65536 cells, 1–1000 ticks, 1/2/4/8 workers, 0–100 ms latency emulation.
Each worker receives one tile per barrier, so assignment fairness is min/max
completed scheduled tasks, not CPU-time fairness or a guarantee under imbalance.
Cross-shard events count halo dependencies (zero for one worker), not validated
human interactions. Successful runs drop zero dependencies by construction;
a missing dependency rejects instead of incrementing a successful-run drop count.
Lag is maximum request-to-availability wall time, including injected delay.
Bytes/sec uses measured wall time and UTF-8 JSON payload estimates in both
directions, excluding transport framing, structured-clone internals and heartbeat.

## Measured evidence and interpretation

`docs/evidence/she-147-shards.json` retains exact inputs, model, machine/runtime,
wall times, lag, bytes/sec, task distribution and hashes for all eight runs.
On the recorded Apple M4 / Bun 1.4.2 machine, 1024 cells × 20 ticks:

| Workers | Local wall ms | Estimated payload bytes | 5 ms emulation wall ms |
| ---: | ---: | ---: | ---: |
| 1 | 4.868 | 122220 | 116.413 |
| 2 | 3.807 | 125380 | 115.475 |
| 4 | 4.526 | 131680 | 115.519 |
| 8 | 6.969 | 144320 | 115.572 |

All state/oracle hashes are `cfb82fbc`, fairness 1, dropped dependencies 0.
These are single cold microbenchmarks including startup, messaging, scalar
validation and barriers, with no confidence interval. They establish replay
agreement for this fixture. They suggest overhead dominates at this size;
they do not establish browser throughput, million-agent scaling, offline
parity or remote correctness. Five milliseconds is an explicit synthetic delay
after each response, not a measured network or server adapter.

Tests: 11 pass, 0 fail, 298 assertions including the existing agent-count suite.
Coverage includes uneven tiles, seed boundaries, conservation, replay under
latency, malformed/stale results, worker failure and missing-message timeout.
No browser behavior changed; Playwright was not run. Browser worker launch and
scheduling remain unverified. No general lint/typecheck script exists in package.json.

## Remote/privacy decision and next slice

There is no remote or peer connection in this spike, and no opt-in inferred from
opening a page. Before a remote adapter: explicit per-run consent identifying
recipient and payload, revocation/cancellation, resource/bandwidth limits,
retention/deletion policy, authenticated encrypted transport, pinned rules/model
and source manifests, cryptographic input/output digests, independent verification,
replay protection and bounded deadlines are prerequisites. Real household,
location, health or relationship records must not enter peer payloads; use an
explicitly reviewed minimized synthetic/public contract. Consent alone does not
make private data suitable for peers.

Next integrate the available scalar oracle through an explicit model/identity/
clock adapter, measure real browser 1/2/4/8 workers and imbalance, then evaluate
a consent-gated server adapter. A production asynchronous cross-shard event log
needs sequence IDs, causal dependencies, duplicate detection, checkpoint barriers
and adversarial-result tests. Do not promise immediate global state or pure-device
independence for a future distributed backend.
