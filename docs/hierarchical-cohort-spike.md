# SHE-144: hierarchical cohort spike readiness

## Observed audit — 2026-11-12

This is a readiness/design record, not a measured prototype result. Worktree:
`/Users/wahabma/happybearlandia/workspaces/SHE-144`, branch `mini/SHE-144`,
starting commit `b963dd353538294cb0fbf5d34d5283fad6e10e68`.
The starting worktree was clean. This slice owns this document and its entry in
`docs/implementation-plan.md`; no engine or metric interfaces change.

The product design requires separate state authorities and explicit identity,
time and metric mappings. There is no cohort implementation in this checkout.
`world/metrics/agent-counts.js` supplies the completed SHE-141 six-count contract,
but its bounded energy-transfer fixture is not a movement/household/policy oracle.
Its 4,096-record limit must not be raised to imply a million-agent model.

Read-only Linear audit found SHE-141 and SHE-142 Done; SHE-171 is Todo and is a
structured blocker of SHE-144 in addition to the two prose dependencies.
SHE-142 links to [PR #50](https://github.com/adnanwahab/happybearlandia/pull/50),
whose description identifies `scalar-agent-oracle.v1`, integer movement and
resources, household contacts, policy decisions, 10,000-agent/32-tick bounds,
and compact goldens. Neither `world/agent-oracle/scalar.js` nor the oracle tests,
goldens, CLI or documentation exists in this checkout. Tracker completion is
therefore not evidence that the prerequisite source is available locally.

GitHub connected PR search for SHE-144, SHE-142, SHE-171 and cohort returned PRs
50, 35 and 34; no matching cohort or runner PR was returned. Search is not proof
of exclusive ownership or remote branch freshness. The CLI PR query failed to
connect; the connected search succeeded. No merge state was inferred from a PR
description. No remote writes, worker dispatch, merge or deployment occurred.

## Next integrated slice (pending prerequisites)

1. Have the repository owner synchronize the reviewed scalar oracle and resolve
   the SHE-171 runner dependency. Audit its actual rules and goldens before
   selecting aggregation keys; do not reconstruct them from the PR description.
2. Implement a bounded headless cohort adapter and CLI using those rules.
   Group by every state component needed for the next transition, including
   household/contact dependencies. If exact grouping scales with population,
   measure that loss of compression rather than hiding it. Any approximated
   interaction closure needs a separate version and documented error model.
3. Maintain integer leaf weights with district and city rollups. Assert the
   non-overlapping leaf sum is exactly 1,000,000 initially and after every step,
   split and merge. Parent rollups must never be counted again as residents.
4. Derive inspection representatives from versioned seed, leaf key, tick and
   sample index, independent of inspection order. Represented mass belongs to
   either the leaf remainder or its disaggregated children, never both. Define
   whether children are weighted samples or individually evolved residents.
   Track actual distinct individually changed states separately from sampled,
   allocated and evaluated records, following SHE-141 semantics.
5. Compare weighted mean, second moment and variance with the independent scalar
   oracle for matched bounded inputs at every tick. Declare metrics, units,
   tolerances and population weighting before measuring. A million-weight
   replicated synthetic fixture may test mass invariants, but does not establish
   million-individual oracle agreement or interacting-agent throughput.
6. Verify zoom-in/out without time advance restores identical authoritative
   state and distributions. Reinspection at the same tick must reproduce samples;
   inspection order must not affect simulation. Test advancing while inspected,
   merge boundaries, empty leaves, partial households, seed boundaries and invalid
   weights. Compare inspected versus uninspected runs with matched seeds.

## Acceptance evidence still required

Record model/rules/source/adapter versions, all scenario inputs, uint32 seed,
abstract tick semantics, oracle mapping and deterministic hashes. Label sources
as synthetic unless backed by observations. Report mass at every transition,
actual individual-update counts, moment errors, replay and zoom results in
machine-readable runner records. Measure split/merge, step and inspection costs
separately with machine/runtime, repeat count and reproducible commands; timings
must not enter deterministic identity. Report unavailable rendering/GPU metrics
explicitly. No globally persistent identity or unsampled pairwise causal history
is promised by this architecture.

The current slice establishes no cohort performance or scientific-equivalence
result. Actual local verification: `bun test test/agent-counts.test.js` passed
8 tests / 266 assertions on Bun 1.4.2. That verifies only the existing metric
contract. Browser checks are inapplicable to this documentation-only change.
No lint/type-check scripts are defined in the root package. Resume with the
prerequisite source audit; implementation and benchmark acceptance remain open.
