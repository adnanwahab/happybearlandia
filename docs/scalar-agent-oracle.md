# Scalar CPU agent oracle v1

`world/agent-oracle/scalar.js` is the standalone `scalar-agent-oracle.v1`
interface, rules `integer-household-walk.v1`, source `synthetic-households.v1`.
It is a small, uncalibrated reference for future backend comparisons. No
production, GPU, rendering or agent-counts adapter is supplied. No equivalence
to another model, empirical behavior or million-agent throughput is claimed.

## Recipe and units

`runOracle({agents, ticks, seed, stayHomeBps})` defaults to 1000 agents, 12 ticks,
seed 42 and 2500 basis points. Unknown keys, explicit nulls, noninteger or
out-of-range values fail. Limits: 0–10000 agents, 0–32 ticks, uint32 seeds
including zero, and 0–10000 policy basis points. There are no external data,
wall-clock inputs or hidden observations. All coordinates, resources, IDs,
times and random state are integers; no fixed-point rounding is needed.

Each tick is an abstract decision interval, with no calendar duration. Each
agent has a stable local integer ID, household `floor(id/4)`, and 50 initial
energy tokens bounded by 0–100. A household has at most four consecutive IDs;
the final household may be partial. Household home coordinates are
`(household % 16, floor(household/16) % 16)` on a synthetic toroidal 16×16 grid.
Different households can share cells but do not contact each other. One cell
is an abstract distance unit, not a meter. There are no births, deaths,
migration, household changes, disease or observed interpersonal networks.

PRNG: `s = (imul(s,1664525)+1013904223) >>> 0`, initialized to the recipe seed.
For every tick, visit agents in ID order and consume exactly two draws,
including constrained actors. First draw modulo 10000 is compared to
`stayHomeBps`; second draw's upper two bits select east/north/west/south.
Modulo reduction has a small specified bias and this LCG is not a calibrated
or high-quality scientific random generator. Paired policy runs retain the
same draws; this is a controlled synthetic comparison only.

1. Decision phase: if the policy draw is below the threshold or resource is
   zero, rest in the current cell and gain two tokens, capped at 100.
   Otherwise move one cell with wraparound and spend one token. The policy
   suppresses walking; it does not teleport an agent home.
2. Contact phase: visit households in order, then adjacent member pairs in
   order (not all pairs). If both are at their shared home, record contact
   and transfer one token from earlier to later member if the donor has a
   token and recipient is below 100. A blocked transfer still records contact.
   Transfers conserve tokens; decisions intentionally consume/replenish them.
3. Assert population, local identity, household and resource/coordinate bounds
   initially and after every complete tick. Empty populations and zero ticks
   produce no events. Empty resource extrema are null, not measured zeroes.

## Evidence and replay

The returned recipe, versions, initial state, final state and events are one
versioned run record. Event IDs are contiguous; events carry source/rules,
tick, phase, actor IDs, before/after values and parent IDs. Each contact depends
on both participants' latest event in that tick, including earlier contacts.
Decisions have no same-tick parents; their before-state is the committed prior
state. Contacts cannot precede decisions. `validateRun` checks bounds and
causal parent ordering then regenerates the entire run from its recipe and
compares every field, rejecting missing/extra events, altered source records,
metadata, summaries, transitions or hashes. Replay is recomputation verification,
not an independently implemented scientific model or arbitrary checkpoint loader.

State SHA256 hashes the JSON serialization of `{model,rules,source,input,initial,
final}`; event SHA256 hashes `{model,rules,source,input,events}` in that property
order. Record field order is defined by the implementation; validation expects
its exact serialized run structure (JSON round trips are supported). Timing
and machine fields are excluded. Goldens store compact recipes, both expected
hashes and invariant summaries in `test/fixtures/scalar-agent-oracle/golden.json`.
They are regression evidence generated from this implementation, not observations
or independent proof of rule correctness. Tests additionally check movement,
contact conservation, causal links, matched policy draws and tamper rejection.

## Existing-rule audit and adapter limits

- `world/metrics/agent-counts.js` is `synthetic-energy-transfer.v1`, a separate
  4096-resident fixture. Reuse its uint32 LCG recurrence concept, never its
  count adapter or limits. Its energy transfer has no movement/contact policy.
- Reuse `householdMembers` from `world/population/household-members.js` read-only
  with the helper's contiguous `households.start/size` representation. The
  oracle enforces its own immutable identity and membership invariant.
- `world/population/model.js` advances minute-based activities, employment and
  household systems, with separate IDs, weighted populations and mutable
  membership. `world/agent-simulator.js` models annual civic dynamics using
  floating resource/support fractions. Neither has a compatible integer clock
  or state transition contract for direct reuse here.
- `world/behavior/core/choice.js` uses floating softmax utility probabilities.
  Do not silently quantize or claim it is this oracle's integer threshold rule.

No identity/time mapping is verified across these models. Any future backend
must preserve this recipe, PRNG draw order, event order and integer semantics,
then match the stored hashes before claiming agreement. No cross-backend
measurement is available in this slice. Retaining all events bounds usefulness
and memory; this is deliberately a small CPU correctness reference.

## Reproducible validation and measured evidence

Run from the repository root (host PATH may require the absolute Bun path):

```sh
/Users/wahabma/.bun/bin/bun test test/scalar-agent-oracle.test.js test/agent-counts.test.js
/Users/wahabma/.bun/bin/bun scripts/benchmark-scalar-oracle.js
/Users/wahabma/.bun/bin/bun scripts/benchmark-scalar-oracle.js '{"agents":5,"ticks":2,"seed":0}'
/Users/wahabma/.bun/bin/bun scripts/benchmark-scalar-oracle.js '{"agents":10001}'
```

CLI emits JSON to stdout, accepts at most one JSON recipe, writes no files,
and exits 1 with a stderr diagnostic on invalid input. Default runs execute
sequentially at 1000 and 10000 agents, 12 ticks, seed 42, policy 2500.
`simulationMs` includes initialization, simulation, invariant checks and hashing;
`replayMs` includes validation and regeneration. There is no warm-up or statistical
throughput claim. A single observed sample on 2026-11-12, Apple M4 arm64,
Darwin 24.6.0, Bun 1.4.2 (process Node compatibility v26.3.0):

| Agents | Events | Simulation ms | Replay ms | Resource range |
| --- | --- | --- | --- | --- |
| 1000 | 12116 | 7.777 | 9.444 | 38–62 |
| 10000 | 121157 | 45.276 | 87.675 | 36–65 |

Both populations and their 250/2500 households were conserved. Actual timing
varies with host load. The complete deterministic expectations are in the golden
fixture; test coverage includes a fresh CLI subprocess matching both goldens,
repeat/replay, empty/partial households, seed endpoints, policy endpoints,
maximum tick horizon, invalid state/recipe and corrupted evidence. No browser
behavior changes; browser checks do not apply. No shared plan, engine, metric,
workflow, UI or CI files were changed. The scoped implementation plan and host
handoff evidence live in the ticket workpad, as required by its five-file scope.

Final focused command result: **17 pass, 0 fail, 2325 assertions** across both
suites (581 ms observed). Invalid CLI recipe `{"agents":10001}` exited 1
with `scalar oracle: Invalid agents` and no report. No repository-wide lint
or typecheck script is defined in package.json.
