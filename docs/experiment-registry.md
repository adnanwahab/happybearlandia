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
