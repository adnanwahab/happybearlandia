# Counterfactual forks

`createForkEngine` in `engine.js` orchestrates private asynchronous child runs. Inject
`loadParent(runId)`, `cloneCheckpoint(parent,tick)`, `authorize(actor,parent)` and a
versioned adapter map. Actor IDs must be stable authenticated strings. Authentication
must never trust actor IDs supplied in the request body. Parent context must match
its canonical run ID. The parent is passed by value to authorization and replay.

`checkpointCloneFromReplay(service)` uses HistoricalStateService verified
recomputation, requiring a recorded target digest and compatible replay adapter.
It preserves original checkpoint identity and the verified replayed state digest.

`createEconomicForkDomains()` composes the existing FlowMap, business and household
implementations. Its explicit state envelope is documented in economic-domains.js.
Only `logistics.link-closure` is enabled, with an exact boolean `closed` parameter
and a canonical `link` target that must exist in the checkpoint. Business period
must equal fork tick. Horizon is measured in business periods, bounded to 1000 by
default. Logistics is an interval result; the same explicit delivery availability
is applied during each projected business period. Geometry-to-network, business
and household allocation mappings are required; none are inferred.

Per-domain streams use SHA-256(parent seed + ':' + domain), truncated to uint32.
Paired baselines must use these same streams. Seeds are independent of child IDs
and unaffected domain execution order. Returned records are synthetic model
outputs, not observed geometry or regenerated narrative text.

`createCounterfactualHandler({engine,authenticate})` exposes:

- POST /api/causality/forks with Idempotency-Key and
  {parentRunId,tick,horizon,interventions}; returns 202 {branchId,jobId,status}.
- GET /api/causality/forks/:encodedBranchId
- GET /api/causality/forks/:encodedBranchId/lineage
- GET /api/causality/jobs/:encodedJobId

Errors are {error:{code,message}} with 400 malformed requests, 403 authorization
or origin rejection, 404 missing records, 409 incompatible/conflicting state,
413 oversized bodies, 422 invalid bounded interventions, 429 quotas, and 503
unavailable dependencies. Async recomputation errors appear on failed jobs.
Private children and job outputs are visible only to their owner. Local lineage
includes parent IDs but does not expose parent state.

Current deployment boundary: the public causal store has no authenticated private
ownership contract. The registered default handler fails closed with 503. Hosts
must configure authenticate/authorize and an authoritative private parent loader.
The engine uses process-local maps: jobs, quota reservations and idempotency do not
survive restart or coordinate across replicas. Durable worker/store integration is
required before enabling production multi-process private branching. No public
or production fork service is enabled by this implementation.
