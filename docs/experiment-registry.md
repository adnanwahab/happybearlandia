# Experiment Registry

Open `/world/experiment-lab.html`, load a civic plan, and generate and run its
worlds. Each completed batch automatically saves a browser-local IndexedDB
record. Hypothesis, intended use and evaluation criteria can be edited before
running, or saved as a new descendant snapshot afterward. Record links reopen
only in the browser that holds the record. The existing server snapshot API is
a separate persistence destination; automatic Lab saves do not upload records.

The registry captures the plan's intervention definitions, model descriptor and
adapter version, code release identifier, optional supplied Git commit, source
metadata, variables with provenance, overrides, base and per-world seeds, full
simulation results and evaluation criteria. Missing Git revisions remain null.
Inherited hypotheses and metric directions are defaults, not evidence of a
pre-registered scientific hypothesis or an empirically validated criterion.

Search combines hypothesis substring, exact model adapter version and
intervention ID/title/description substring. Text searches ignore case. The Lab
shows the latest 100 matches; the API returns all matches. Inspection, listing,
lineage summaries, audit bundles, share view models and Pensieve handoffs retain
an explicit result label. Simulation output is always synthetic even when its
inputs include measurements. Imported observations may explicitly declare
`registry.resultKind: "measured"`; missing provenance stays unknown. Labels do
not independently validate a supplied observation or its source.

## Existing server API extensions

- `POST /api/experiments` accepts the existing `{ snapshot }` envelope. A Lab
  record can be supplied as the snapshot, including its independent manifest.
- `GET /api/experiments?hypothesis=permits&modelVersion=hbl-civic-dynamics.v2&intervention=permits`
  filters immutable server records. Omitting filters preserves the existing list.
- `POST /api/experiments/:id/replay` regenerates a supported saved civic batch
  using its recorded seed, run count, inputs and overrides. The response contains
  `exact`, stored-record `integrity`, regenerated `comparison`, and a synthetic
  result label. A mismatch returns `exact: false`; missing evidence, unsupported
  adapters/model/code releases and invalid run counts return a 400 error.

Replay uses the existing generator, civic adapter and reproducibility manifest.
It checks stored worlds/results against their independent hashes before
comparing the recomputation. Hashes are consistency fingerprints, not signed
proof of authenticity. Object hashes follow JSON persistence semantics for
optional undefined values. Older hashes that included undefined object fields
may fail verification; their snapshots remain readable. No historical engine
binaries are archived. Only the supported civic code release/model combination
can be recomputed; other simulation authorities need explicit adapters rather
than an assumption of shared clocks or entity identity.

## Verification

`bun test test/experiment-registry.test.js` exercises durable server round-trip
replay, saved overrides, composed filters, tampering, provenance and unsupported
versions. `bunx playwright test --config test/experiment-registry.browser.config.js`
exercises automatic browser recording, reload, combined filters and replay.
The browser suite requires local server binding and Chromium.

## Agent Training Gym (SHE-192 local slice)

The normal server API also supports a headless synthetic resource-control gym:

```sh
# Save immutable environment and reward declaration first; retain returned id.
curl -X POST http://localhost:3000/api/experiments/gym -d '{}'
# Substitute the declaration id below. Only policyVersion is accepted.
curl -X POST http://localhost:3000/api/experiments/DECLARATION_ID/gym-run \
  -d '{"policyVersion":"stock-threshold.v1"}'
# Retain returned run id. Reopen the full report/trajectories, then replay:
curl http://localhost:3000/api/experiments/RUN_ID
curl -X POST http://localhost:3000/api/experiments/RUN_ID/replay -d '{}'
```

`world/agent-training-gym.js` is the executable contract. `hbl-resource-gym.v1`
pins the source/model/rules revisions, initial stock 2, capacity 4, binary demand
LCG constants, stock/tick observation schema, wait/replenish action schema,
eight-step limit, source kind, seeds and reward declaration. No external inputs
or dependencies are used. Replenish adds two units capped at four before demand;
served demand earns 1 point, unmet demand costs 2 points, replenishment costs
0.25 points. Total reward is the sum of components through termination. These
are authored assumptions, not measured behavior. One tick is one abstract step;
there is no City/Population entity or time mapping and no social mechanism.

The declaration is persisted before execution. A run pins its environment and
reward digest and links to its declaration as parent. Changing a reward requires
a new supported environment revision; arbitrary overrides are rejected. Only
`stock-threshold.v1` (replenish below two) and `wait.v1` are supported; no callbacks,
external agents, training dispatcher or learning optimizer are executed. Each run
records observations, actions, demand, reward components, next observations and
causal step references. Invalid actions and interrupted sequences terminate the
low-level episode explicitly; server-run policies always complete eight steps.
Fixed local computation (four episodes of eight steps) bounds execution; there
is no asynchronous job or timeout dependency. Replay limits artifacts to 64 KiB.

Training seeds 11/12 and held-out seeds 101/102 stay disjoint and are identical
across policies. Reports contain their separate sample counts, means and utility
units, policy/environment versions, synthetic provenance, limitations and lack
of population uncertainty estimates. Seeds are authored fixtures, not a secret
benchmark. Real-world evaluation remains `unavailable`, zero samples, null
provenance; simulated scores never fill it. Full trajectories and evaluation
share the same saved run snapshot. Rebuild refuses changed/missing artifacts or
unsupported versions; historical binaries are not archived. Replay recomputes
and compares all saved run evidence, including observations and evaluation;
consistency fingerprints do not authenticate submitted records.

Verify with `bun test test/agent-training-gym.test.js test/experiment-registry.test.js`.
No browser UI is added; the existing server API is the entry point.
