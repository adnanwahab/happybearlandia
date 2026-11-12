# Server run queue

`RunJobManager` admits at most two running jobs and 32 waiting jobs by default.
The server handler accepts trusted `maxRunning` (positive integer) and `maxQueued`
(nonnegative integer) options; request bodies cannot override these limits.
Waiting jobs start in FIFO order, including after a running job fails. Existing
job IDs remain idempotent even at capacity. Excess distinct submissions receive
HTTP 429, `Retry-After: 1` and `Cache-Control: no-store`; the retry delay is advice,
not a capacity reservation. Job polling and deterministic result/cache contracts
are unchanged.

`GET /api/runs/metrics` returns `hbl-run-queue-metrics.v1`, with only numeric
aggregates and the schema version. It includes no IDs, seeds, inputs, timestamps,
error messages or labels. Responses use `Cache-Control: no-store`.

- `submitted`: valid resolved createJob attempts (including duplicates/rejections).
- `queued`: cumulative distinct admissions that had to wait.
- `completed`, `failed`: cumulative terminal job counts.
- `rejected`: attempts refused because both running and waiting capacity were full.
- `deduplicated`: attempts returning a previously admitted job.
- `running`, `queueDepth`: current active and waiting job counts.
- `maxRunning`, `maxQueued`: configured capacity.

At settled observation points:
`submitted = completed + failed + rejected + deduplicated + running + queueDepth`.
`queued` is a historical subset of admissions, not an additional outcome.
Malformed JSON, input-resolution/validation errors and polling are excluded.
Counters are process-local and reset on restart; they do not aggregate replicas.
This bounds active/waiting jobs, not retained completed jobs, cache size, request
body size, per-world adapter resources or execution time. No persistence or
identity-bearing operational logs were added.

Proof uses controlled synthetic adapters and seed 42, without changing simulation
rules or modeled results: `bun test test/run-job-manager.test.js test/server-civic-api.test.js test/server-experiment-store.test.js`.
