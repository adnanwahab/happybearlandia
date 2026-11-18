# Policy Impact Explorer delivery record

## Slice and ownership

Deliver one public synthetic housing proposal through authenticated creation, immutable versioned persistence, bounded paired simulations, exact checkpoint visualization and a shareable embeddable URL. The coordinating agent owns server integration, the shared implementation plan, final verification and PR creation. API and viewer workers own their code/tests; this documentation worker owns the integration contract, demo fixture and model-description additions.

Acceptance: schema/auth/privacy rejection; stable idempotent IDs/URLs; frozen snapshots; same-seed reproduction; unsupported and wording-only edits produce no invented effects; paired compatibility; exact checkpoint scrubbing; failures/partial/retries/restart retention; restrictive per-viewer framing; existing Constitution City and Experiment Lab regressions. Final evidence must include actual commands/results and a browser capture.

## Model-description review

Reviewed `docs/models/city.md` and its seven ODD elements against `world/city/engine.js`, `world/city/contracts.js`, `world/constitution-city/{mappings,plan,runtime-core}.js`, `world/constitution-timeline.js`, `world/paired-comparison-api.js`, `world/server-civic-api.js`, `world/experiment-api.js`, `world/hbl-simulator-bridge.js`, `world/plan-parameter-patch.js` and Experiment Lab's imports. The feature orchestrates the existing Monthly City authority; it adds no agent rules, resident IDs, model clock or independent ABM.

Existing mapping documentation describes the assumed `h_lots` +4 permitted homes/parcel, `f_drainage` +0.12 resilience and `t_brt` +30 transit capacity with 0.8 travel-time multiplier. These are reviewed software assumptions, not empirical calibration. The API must preserve those limits and explicitly declare the illustrative capital envelope. The new adapter rejects prose-to-number inference rather than executing the Experiment Lab heuristic compiler. A removal compares authorization presence/absence from the shared initial state and does not erase already built assets. A textual modification has no new numerical assumption.

A material retention distinction is documented: Constitution City ordinarily regenerates selected states from its frozen runtime manifest, whereas Policy Impact retains executed state checkpoints and presents only those recorded checkpoints in its time machine. Monthly observations may exist without a retained renderable state. This is not a new City clock or a license to interpolate missing states.

## Verification evidence

Documentation-worker check: the fixture content hash was independently calculated from sorted compact UTF-8 legal JSON using Python SHA-256. The fixture also passed `validatePolicyPreview` from the API worker implementation via Bun and returned the independently calculated hash. End-to-end execution awaits the coordinating agent's integrated check. Final Bun/Playwright results, screenshot path and PR reference must be added here or in the PR before review approval.

## Remaining limits

Synthetic scenario outputs only; no current-law verification, legal judgment, empirical forecast, calibrated probabilities, hydraulic model, lane-level transit model, complete household accounting or unsupported constitutional effects. Only public content is accepted. Civic Synthesis framing requires the actual approved deployment origin in server configuration. No merge or deployment is performed.
