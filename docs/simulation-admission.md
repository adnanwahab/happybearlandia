# Anonymous simulation admission

The server entry point applies a shared fixed-window budget before dispatch or
body parsing: six POST submissions per socket client address per 60 seconds,
and 60 submissions per process per 60 seconds. Covered families are `/api/runs`,
`/api/world/experiments`, `/api/city-experiments`, `/api/decision-experiments`,
and `/api/decision-optimizations`, including start and fork subroutes. Requests
ending in `/cancel` or `/pause`, reads, and preflight requests bypass admission.
Rejected submissions never reach the simulation handler. Invalid submissions
also consume admission budget. Existing per-request workload validation and
worker concurrency/deadline controls remain authoritative.

429 responses contain `code: simulation_rate_limited`, a positive integer
`retryAfterSeconds`, matching `Retry-After`, and `Cache-Control: no-store`.
Wait that many seconds before resubmitting; continued competing traffic may
consume the recovered budget. No identity, token, or request body is returned.

Identity uses Bun's socket address, never Authorization, cookies, or forwarded
headers. Unknown addresses share one bucket. Behind a proxy, visitors may share
a bucket; deployment-specific trusted proxy identity needs separate review.
At most 4096 live identities are retained; overflow fails closed until an entry
expires. Exhausted identities are never evicted to admit new ones. State resets
on process restart and is independent per replica. This is a submission-rate
bound, not a dollar quota or a guarantee against expensive individual jobs.
Fixed windows permit a burst across a window boundary. Distributed edge limits,
authenticated quotas, deployment tuning and staging capacity measurements remain
operational follow-ups; this change does not alter billing or deployment gates.

Baseline overlap: City replay already has worker reservation, timeout and abort
controls (`world/city/api.js`, `test/city-worker-call.test.js`); world paired
experiments serialize execution and clamp seeds/years/population; Decision APIs
validate workload and manage active workers. None supplies this shared socket
client admission budget. Models, seeds, results, and provenance are unchanged.

Verification: `bun test test/simulation-admission.test.js test/server-civic-api.test.js test/city-worker-call.test.js`.
The opt-in HTTP test (`HBL_ADMISSION_HTTP=1` with the same command) sends 20
simultaneous submissions and checks six accepted, fourteen 429, six downstream
calls, and recovery after clock advancement. Its local attempt was blocked by
the sandbox refusing loopback listen (`EADDRINUSE` for port 0). It was not
observed passing; staging load remains required. Default tests check admission,
expiry, global capacity, bounded identities and existing worker behavior.
