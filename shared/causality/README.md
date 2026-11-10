# Causality contracts v1

Import runtime APIs from `/shared/causality/index.js` in browsers or a relative path in Bun. TypeScript consumers resolve `index.d.ts`; interfaces live in `contracts.ts`. These modules have no dependencies. Existing JavaScript modules need no migration. Server static routing is integrated by the shell/server owners.

```js
import { canonicalId, RunContextSchema, createMetricRegistry } from './index.js';
const context = RunContextSchema.parse({
  universeId: canonicalId('universe', 'hbl', 'main'),
  worldId: canonicalId('world', 'hbl', 'main'),
  scenarioId: canonicalId('scenario', 'hbl', 'baseline'),
  runId: canonicalId('run', 'city', 'example'),
  seed: 42, modelVersion: 'city.v1', tick: 0,
});
const metrics = createMetricRegistry([
  {id: canonicalId('metric', 'city', 'population'), label: 'Population', unit: 'people', aggregation: 'last'},
]);
```

Canonical IDs use `kind:namespace:encodeURIComponent(localId)`. Never infer that equal local IDs across experiences identify the same entity. Register each explicit mapping through `createLocalIdMap`; unresolved mappings return null. IDs are identity references, not authorization credentials.

RunContext is authoritative simulation scope: universe, world, scenario, run, seed, model version and nonnegative integer tick. Branches create distinct run IDs; parentRunId records ancestry. NavigationContext requires universe/world/scenario and optionally experimentId/runId/branchId/tick/entityId. Use encodeNavigationContext/decodeNavigationContext for links; they preserve zero ticks and reject duplicate context fields. Universe-only helpers deliberately retain only the three universe fields. Navigation metadata does not create or restore a run.

All wire schemas expose parse (throws TypeError) and safeParse (success/data or success/error), reject unknown properties and coercion, and return detached values. Validate at ingestion. Event, Observation and Assumption require sequence, an adapter-assigned run-global ordinal; tick is simulation time. Storage owns uniqueness and ordering across batches. CausalSnapshot rejects mixed runs, future records, and duplicate record IDs. Edges use fromId/toId/evidenceIds and distinguish causal relations from correlations; storage checks referential integrity and causal ordering. Provenance is mandatory and distinguishes observed, simulated, assumed and derived data. No assertion of empirical truth follows from schema validity.

Metric registry entries explicitly define unit and aggregation. Register per-domain definitions, validate observations through registry.validateObservation, and aggregate only compatible scope/unit/aggregation. No implicit unit conversion or aggregation is performed by the contract layer.

Interventions are requests, not executable code. After InterventionSchema parsing call validateIntervention(request, adapter.interventions(), currentContext) immediately before mutation. The action must match exactly one allowlist entry, target kind must be allowed, parameter keys must match exactly, and values must satisfy bounded number/boolean/enumerated-string rules. Stale tick/foreign run requests fail closed. The caller must authorize target ownership and isolate forks before invoking the adapter.

Iframe messages use version 1, channel `hbl:causality`, requestId, context and a discriminated type. ready/context/select/navigate/error accept NavigationContext; snapshot/intervene require RunContext. select includes entityId; navigate includes experienceId and optional entityId; snapshot includes a CausalSnapshot; intervene includes an Intervention; error includes code/message. Always call parseIframeEvent(event, {origin: exactTrustedOrigin, source: iframe.contentWindow}) before dispatch. Origin/source validation is separate from permission to mutate. Reject navigation destinations outside the shell registry. Never accept arbitrary scripts or URLs. For snapshot/intervention envelopes nested contexts must match exactly. Source authorization, request correlation and replay protection are host responsibilities.

CausalAdapter exposes snapshot/context and allowlisted intervention execution. ReplayAdapter is a playback controller; DomainReplayAdapter describes serialization/restoration/event application for replay engines. CheckpointSchema validates portable state and recorded/verified labels; hashing and deterministic recomputation verification belong to the replay owner. A schema cannot establish that a supplied hash or verification label is truthful.

Checks: `bun test test/causality-contracts.test.js`; `tsc -p shared/causality/tsconfig.json`. Type checking covers public interfaces/declarations without converting the repository or adding a package dependency. The JavaScript implementation is exercised by runtime tests.
