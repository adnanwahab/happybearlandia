# Operator emergency mode

SHE-967 adds an optional process-local admission hold to the existing single-writer
Bun server. Configure `HBL_EMERGENCY_FILE` with an absolute path in a protected,
operator-owned directory outside the repository and public/static roots before
starting the server. Unset means disabled. No HTTP endpoint changes the flag;
`GET /api/emergency-mode` exposes only active state and the comparison URL.
Do not give the application or untrusted users permission to modify the directory.
The operator needs filesystem access to the same host/volume as the process.

Create the empty flag file to activate; remove it to deactivate. The handler checks
its existence synchronously before dispatch on each request, without restart.
An inaccessible flag fails closed; ENOENT means inactive. Ensure the parent exists
and verify configuration before a drill. Multiple replicas require independent
operator coordination; this is not a distributed control plane. State survives
restart only when the configured path is on retained storage. Changing the env
setting requires restart. No production configuration is part of this issue.

During activation, `/` and `/world/future-machine.html` (including shared-link
queries) serve a static, script-free comparison table for all 121 months. Viewer
copy explicitly says this is the default rather than the requested shared scenario.
The page includes seed, model/recipe/source versions, scenario inputs, initial
and full arm hashes, units, synthetic assumptions and uncertainty limitations.
It is a reduced read-only experience: there is no 3D scene, policy editor or new
share creation. Reload its normal-play link after deactivation to restore the
normal application. Existing loaded tabs are not forcibly reloaded; rejected
submissions explain the hold and give the fallback URL.

When a flag path is configured, the server computes both default arms once before listening, using the unchanged
monthly City engine and normal Future Machine normalization. It creates no SQLite
experiments. Initial and full normalized history SHA-256 checks plus terminal
homes/spending checks fail startup on mismatch. Updating model code requires a
reviewed update of these pins and deterministic replay evidence. This verifies
recomputation against pinned outputs, not independent checkpoint equivalence.
No real geography, private residents, request bodies or operator path appear on
the page. The entire table is held as HTML, without retaining full histories.

The pre-dispatch gate rejects simulation POST families already covered by admission,
plus mutation methods under `/api/experiments`, `/api/city-experiments`,
`/api/world-experiments`, `/api/world-homes` and `/api/world-edits`. This includes
costly City replay POSTs. PR preview creation/retry/touch is rejected; stop remains
available. Rejections use 503 `emergency_read_only`, `Retry-After: 60` and no-store.
Polling, metadata reads, health, cancellation/pause and governance retain existing
authorization and behavior. The ordinary admission budget still applies after
rollback. This is not a universal database freeze: unrelated APIs, existing preview
workers, browser-local simulation, WebSockets and external services are outside
this bounded hold. Static preview media remains available.

Accepted jobs drain using their existing lifecycle and persistence ownership.
Activation neither deletes records nor terminates a worker between writes. A
request that passed the gate before activation may still submit/finish afterward;
there is no transactional global barrier. Do not kill the process to obtain a
stronger hold. Check accepted job IDs reach existing terminal states and compare
store/worker inventory before declaring a staging drill complete. Existing job
atomicity/cleanup limits remain; this gate does not repair pre-existing orphans.

## Local and staging drill

1. Run focused regression tests:
   `bun --no-env-file test test/emergency-mode.test.js test/simulation-admission.test.js test/future-machine-paired.test.js test/city-worker-call.test.js test/server-civic-api.test.js`.
2. On a host permitting loopback listeners run the isolated HTTP drill with
   `HBL_EMERGENCY_HTTP=1 bun --no-env-file test test/emergency-mode.test.js`.
3. With separate staging authorization, use disposable stores and configure a
   protected flag path. Open normal play; record accepted job IDs and initial
   store counts. Activate while a bounded accepted job is running.
4. Verify homepage and shared-link entry display the default disclaimer, all
   months and provenance; capture narrow/wide screenshots and reviewed copy.
   Check a new run and preview retry return 503 without new records, while status,
   cancel and preview stop remain available. Wait for accepted jobs to terminate;
   reconcile their records and worker slots. Do not use real user records/load.
5. Remove flag; check public status becomes false, normal page returns and a new
   bounded run completes. Record revision, model versions, IDs, hashes and redacted
   evidence. Retain no private request payloads. If recovering flag access fails,
   correct permissions first; do not silently treat storage errors as deactivation.

Rollback: remove the flag for immediate normal dispatch. If reverting code is
necessary, use the normal separately authorized reviewed release procedure; no
schema changes or data migration are introduced. Do not delete saved experiments.
Staging drill, actual overload measurements and browser screenshots remain missing
until executed; local mocks or a draft PR do not satisfy staging acceptance.
