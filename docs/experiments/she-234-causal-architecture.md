# SHE-234: causal inspector architecture decision

Recommend complete City checkpoints plus versioned input replay for branching,
with recorded causal edges as an explanation index. Keep full engine execution
as the correctness oracle. Defer graph-directed execution until dependencies
are complete and measured equivalence survives adversarial tests.

## Audit and scope

Inspected checkout baseline `b963dd353538294cb0fbf5d34d5283fad6e10e68`,
product design, affected implementation-plan sections, module READMEs, source
and tests on November 12, 2026. There is no `docs/architecture.md` in this
checkout. Linear SHE-76 and SHE-90 are both In Review: reuse their existing
paired-history and event-trail work; this experiment owns neither implementation.
This is a local architecture investigation, with no push, deployment, issue
mutation or production behavior change.

Reusable evidence:

* `world/city/engine.js`: immutable proposal input, ordered resolvers on a private
  draft, shared capacity registry, counter-keyed random draws, opt-in traces.
  `contracts.js` and `systems.js` own versioned constraints and rules. Ordering
  dependencies organize pack execution; they are not complete field read/write
  declarations for skipping packs. Lagged feedback crosses monthly boundaries.
* `world/future-machine/data/` and `scripts/verify-city-seed-replay.mjs` already
  regenerate paired 121-frame histories with identical starting states and
  matched seeds. `docs/evidence/city-seed-replay-100.json` is existing evidence,
  not a fresh 106-case rerun in this task.
* `world/replay/engine.js`: complete checkpoint envelopes, canonical hashes,
  exact adapter versions, immutable selection and ordered inputs; verified
  recomputation requires an independently recorded target digest. Recorded
  playback remains unverified. Corrupted latest checkpoints fail closed.
* `world/replay/city-adapter.js`: complete CityState restoration and autonomous
  monthly stepping. Explicit `city.advance` transitions execute the engine;
  descriptive event records are not executable state deltas. The adapter
  explicitly rejects intervention-input replay: the benchmark's scheduled
  `addIntervention` call does not implement that missing production contract.
* `world/causal/adapter.js`: genuine input/output mechanism records, canonical
  entity mappings and simulated provenance. `world/causal/api.js` saves monthly
  complete demo checkpoints, but does not save independent target digests.
  Exact checkpoint retrieval therefore does not establish verified recomputation.
* `shared/causality/` and `world/causality/`: versioned context, units, immutable
  SQLite records, evidence edges and bounded explanation traversal with missing
  data. These are reusable storage/navigation contracts, not an execution graph.
* `world/causal-graph.js`: a separate normalized, weighted, damped iterative
  Decision graph. Its assumed coefficients and strongest-path descriptions
  cannot replace City transitions or supply missing City causal dependencies.

## Three alternatives

Here A means an initial authority plus a complete ordered input log, replaying
the model to a branch point. An exact transition-delta log is another possible
A implementation, but existing descriptive City events do not constitute one.
B restores a complete recorded checkpoint and re-simulates the suffix. C caches
time-indexed model nodes and recomputes only the invalidated dependency closure.
These are composable mechanisms, not mutually exclusive storage formats.

| Criterion | A: event/input replay | B: checkpoint re-simulation | C: targeted causal execution |
| --- | --- | --- | --- |
| Determinism | Requires pinned rules, total input order, initial state and keyed random draws; seed alone is insufficient | Same requirements plus complete checkpoint authority, queues and clock; avoids rebuilding prefix | Requires all A/B conditions plus deterministic invalidation, scheduling and random keys independent of skipped work |
| Storage | Initial state + inputs O(S+E); output evidence/digests add retention cost | O(KS+E) for K complete checkpoints; optional compression/deltas need validation | Node cache + time-indexed edges + inputs, potentially O(T(V+D)); not necessarily smaller than snapshots |
| Execution | Rebuild prefix and suffix, O(TF); exact delta playback could be cheaper but needs new semantics | Restore O(S), then O((T-k)F); denser checkpoints trade bytes for seek latency | Ideally O(affected nodes/edges); shared capacity and feedback may invalidate most of the city; full fallback remains necessary |
| Replay fidelity | Full recomputation can match stored digests; changed/missing model cannot silently substitute; exact historical transitions require retained deltas | Exact saved state at checkpoint; continuation still depends on model availability and completeness | Cached unchanged values are trustworthy only with complete dependencies, correct time expansion and equivalence to full state and traces |
| Provenance accuracy | Ordered inputs and recorded transitions support traceability; timestamps alone do not establish causes | State diffs show changes, not their causes; retain actual events, inputs and mechanism evidence alongside snapshots | Can explain executed mechanisms if edges are complete; authored/display edges cannot justify execution or empirical causation |
| Cross-view compatibility | Share RunContext, canonical entities, time and units | Same; reuse one recorded versioned state across views | Same, plus node-to-entity/time mapping; no inferred City↔Population/House identities |
| Complexity | Medium: reusable engine exists; versioned intervention adapter and input production remain | Lowest incremental cost: serializer, store and restoration exist; checkpoint cadence/retention remain decisions | Highest: read/write sets, lagged edges, new/deleted entities, shared allocation, cycle semantics, cache/version invalidation |
| Scientific validity | Matched-seed controlled interventions test model effects; deterministic replay does not validate equations | Same validity as A if authority and interventions agree; fewer computations confer no causal advantage | Must first prove computational equivalence; a graph diagram or matching headline metric cannot establish causal identification |

S = authority bytes; E = input-log size; K = checkpoint count; T = horizon;
F = full-step work; V/D = nodes/dependency edges per time slice. These are
qualitative bounds, not measured production scaling laws.

## Smallest discriminating experiment

Use one 30-household synthetic City, seed 42, 24 months. Save the complete state
after month 12. Add housing policy d1/24 units/1,000,000 illustrative USD after
that checkpoint, before month 13. Compare A from month 0 with B from month 12.
Keep the original control and parent immutable. Check every suffix step's full
state, proposals, resolutions, events, decisions, causal records, observations,
flows and diagnostics, rather than just endpoint KPIs. Inputs at the checkpoint
boundary must be applied exactly once.

For C, the minimal credible discriminator is a time-expanded dependency closure
for that same intervention, with a complete checkpoint as its starting cache.
Include governance, financing, construction, all shared resource competitors,
housing/employment/transport feedback and next-month reads. Recompute the closure
and compare every suffix output against B. First test a sparse isolated change;
then a shared capacity bottleneck and a flood causing entity/availability changes.
Require zero differences before comparing time or claiming savings. Intentionally
omit one dependency to prove that the oracle catches stale values. If closure
cannot be established, report unsupported and fall back to B.

No complete C execution contract exists here. Implementing one would duplicate
substantial model work, so this slice implements A/B only and records C as
unsupported, with B's full suffix as its conservative fallback. A units-only edit
of the control endpoint is a negative control that fails full-state equality;
it is not a graph prototype or evidence against a correctly implemented C.
This bounds the experiment honestly: C speed and memory remain unmeasured.

## Local results and reproduction

Run `bun experiments/she-234/benchmark.mjs > docs/evidence/she-234-benchmark.json`
from the repository root. Evidence includes runtime/platform, exact source
hashes, model/rules versions, inputs, seeds and raw case measurements. Three
seeds (7, 42, 2911), three repetitions each, one excluded warmup. Only branch
execution is timed; hashing, archive construction, serialization, IO, API,
workers and browser costs are excluded. A always precedes B, so timing is
exploratory and subject to order/JIT/GC bias; no statistical speedup claim.

The retained run observed A median 43.50 ms for 24 steps and B median 18.88 ms
for 12 steps. The retained JSON contains all raw measurements. All nine
cases had identical complete suffix outputs, preserved parents, and differed
from control. A payloads were 27,110–27,115 bytes; B payloads 34,173–34,251 bytes.
These are alternative minimal starting payloads, not total archive footprints;
both need provenance and verification retention. For the first seed, all 25
states occupied 866,435 raw JSON bytes, output events 75,796 and causal records
28,315. Actual SQLite/index/compression costs are unmeasured. Trace bytes do not
measure a complete executable graph.

This scenario uses the ordinary synthetic generator, including its private
development and utility constraints; it is not the tuned Future Machine demo.
The policy may remain constrained. State divergence does not imply 24 completed
homes, resident benefit or real-world causal validity.

## Migration and acceptance gates

1. Retain current APIs, immutable records, replay labels and full City engine.
   Add independent target authority digests at original run creation; never
   generate the alleged reference digest within the replay being verified.
2. Add a versioned City input envelope/adapter for allowlisted interventions
   and shocks, including stable ID, sequence, run, tick and before/after-step
   semantics. Checkpoint after all inputs for a tick. Reject duplicates, foreign
   contexts, unsupported versions and missing inputs; retain old adapters or
   expose recorded checkpoints when recomputation is unavailable.
3. Use checkpoint-backed branches through the existing fork owner, preserving
   parent/run lineage and explicit authorization. Start with periodic checkpoints
   plus selected branch points; choose cadence from real seek latency, bytes and
   retention budgets. Do not mandate every-month full snapshots globally from
   this small engine-only benchmark. Store one versioned run for all views.
4. Extend recorded mechanism coverage without inventing missing edges. Keep
   interpretation, empirical observations and modeled outputs distinguishable.
   Keep City, Population and Decision clocks/identities separate until mappings
   are explicitly tested.
5. Only then trial C behind an opt-in benchmark/shadow path. Declare complete
   read/write sets and lagged dependencies, cache identity/version and allocation
   conflict sets. Fall back to full suffix execution on unknown coverage. Adopt
   only if exact equivalence and end-to-end resource improvements are measured.

Required rollout tests: matched control/no-op and nonzero interventions; seed
0/uint32 maximum; tick 0/checkpoint/last tick; exactly-once same-tick inputs;
unavailable/corrupt checkpoints; missing/conflicting independent digests; model
drift; parent isolation; full-state/event equality; shared-capacity contention;
lagged feedback; annual/quarterly cadence; entity creation/deletion; missing
observations; interrupted writes and restart/export restoration. C additionally
needs missing-edge fault injection and full-fallback parity. View integration
must preserve run/entity/month/units, including unavailable identity mappings.

Executed focused checks: 34 tests passed, 0 failed, 481 expectations across the
benchmark and existing checkpoint replay, World causal adapter, causal reads,
causal graph and City systems suites. These include actual persisted API replay,
checkpoint corruption, version drift, ordering and missing-evidence failures.
No browser behavior changed; Playwright is inapplicable. No repository-wide lint
script exists in package.json; whitespace validation is recorded in the plan.
No production intervention replay, graph executor, retention migration or
cross-model adapter was delivered. Next action is the versioned input adapter
and independently recorded digest slice above, coordinated with SHE-76/SHE-90.
