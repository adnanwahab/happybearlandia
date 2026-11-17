# Architecture D: adaptive CPU/GPU fidelity spike (SHE-146)

## Audit, 2026-11-12

This is a prerequisite audit and implementation contract, not a completed
simulation or measured performance result. Owned workspace:
`workspaces/SHE-146`, branch `mini/SHE-146`, baseline `b963dd3`.
This slice owns this document and its implementation-plan entry only. No workers
were dispatched, production models changed, or Git publication performed.

The full Linear issue requires CPU explicit-goal/complex-interaction execution,
WebGPU vectorized neighborhood transitions, and cohorts for inactive distant
regions. Acceptance requires tier-switch benchmarks at 10k/100k/1M, separate
actual CPU/GPU updates, identity conservation, and divergence from a small
all-high-fidelity reference.

Observed prerequisites:

- Linear SHE-142 is Done and links [PR #50](https://github.com/adnanwahab/happybearlandia/pull/50).
  Its description reports `scalar-agent-oracle.v1`, integer movement/resource
  state, ordered household contacts and deterministic replay, bounded to 10k
  agents and 32 abstract ticks. These are upstream reported results, not locally
  reproduced evidence. `world/agent-oracle/scalar.js`, its benchmark and goldens
  are absent at this checkout's baseline.
- Linear SHE-171 is Todo and has no attachments. It is a structured blocking
  dependency of SHE-146, in addition to SHE-141 and SHE-142. Its required runner
  separates compute, render and combined phases at 10k/100k/1M.
- `world/metrics/agent-counts.js` implements a different synthetic energy-transfer
  fixture, limited to 4,096 residents. It has no movement, household, GPU or
  cohort adapter. Keep those limits and its versioned contract unchanged.
- Read-only GitHub connector search for SHE-146/SHE-142/SHE-171 returned PR #50
  and the agent-count overflow follow-up PR #35. No matching Architecture D or
  runner PR was returned. This is search evidence, not an exhaustive ownership
  guarantee. Shell GitHub queries failed to connect; PR #50 merge state was not
  verified. Other architecture and benchmark workspaces already exist and must
  retain their ownership.
- Product design requires independent simulation authorities and verified
  identity/clock mappings. There is no `docs/architecture.md` in this checkout.

## Next integrated slice and prerequisites

First synchronize a reviewed base containing the real oracle, establish the
SHE-171 runner interface, and recheck active PR/file ownership. Do not copy a
second oracle into this spike or reinterpret renderer particles as residents.
Then implement a bounded headless tier-switch slice using the oracle's identity,
clock, integer rules and seed semantics. GPU capability absence must produce an
explicit unavailable result. CPU fallback must count as CPU work.

Proposed interfaces below are design decisions awaiting the upstream contracts,
not exported APIs or claims of working integration:

1. A versioned policy chooses CPU for explicit goals/complex interactions,
   vectorized execution only for supported neighborhood rules, and cohorts for
   distant inactive regions. Record policy inputs, thresholds, cadence and
   reasons. Use hysteresis so camera motion cannot cause unbounded thrashing.
2. One authoritative owner per resident per logical tick. Commit transfers at
   tick boundaries after source work completes and GPU readback succeeds.
   A failed transfer retains source ownership. Transfer resident identity,
   state tick, pending causal dependencies and deterministic random position;
   never silently reinitialize a promoted resident.
3. Cohorts retain an explicit membership map and declared aggregate sufficient
   statistics. Reconstructing individual states is a modeled approximation;
   record its rule and uncertainty. Cohort weight never increments independent
   resident-update or interaction counters. Define how cross-tier contacts see
   a consistent tick snapshot before enabling them.
4. Keep completed CPU resident transitions, completed GPU resident transitions,
   cohort operations/represented population, ownership transfers and pending
   work separate. Dispatch count is not completion evidence. Report upload,
   readback, scheduling, compute and validation time independently.

## Acceptance tasks

- Test seed-matched CPU/GPU agreement for the vectorizable subset against the
  scalar oracle, including empty and boundary populations, dispatch padding,
  integer limits, invalid inputs and unsupported rules.
- Test promotion/demotion/repeated switches with exact ID-set equality,
  disjoint ownership, no double tick, monotonic state time and preserved causal
  parents. Inject asynchronous readback/transfer failure and retry; verify no
  partial commit or duplicate transition. Compare replay hashes including
  tier decisions, not only final population totals.
- Run a small all-high-fidelity reference and matched adaptive recipe. Report
  per-resident errors and aggregate/distribution divergence for supported
  movement, resources and contacts. State tolerances before interpreting the
  measurements; record missing metrics and cohort reconstruction loss.
- Through SHE-171's normal runner, measure 10k/100k/1M with a fixed policy,
  seed, horizon and switch schedule. Record model/rules/policy versions,
  starting-state hash, units, machine/runtime, adapter identity and limits,
  actual completion counters, peak memory and transfer overhead. Preserve
  failed/unsupported sizes. Do not extrapolate successful small runs to 1M.

GPU comparison and large benchmarks remain unverified. Main risks are state
transfer cost, stale neighborhood reads, cohort reconstruction loss, differing
random draw order and GPU memory/dispatch limits. This spike must report the
fidelity loss alongside any measured economy; it cannot claim production
Population equivalence without a separate identity/time/rule adapter.

## Local verification

`bun test test/agent-counts.test.js`: **8 passed, 0 failed, 266 assertions**
(Bun 1.4.2). This verifies the existing bounded metric contract only.
No browser behavior changed; Playwright is inapplicable to this documentation
slice. No GPU adapter was requested, no GPU updates measured and no benchmark
sizes were run. Resume implementation after the missing oracle and runner
contracts are available in the owned checkout.
