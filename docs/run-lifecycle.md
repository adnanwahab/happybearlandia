# Plan simulation lifecycle

`/world/plan?proposals=t_bus&autorun=0` submits to the existing
`POST /api/world/experiments` endpoint and polls its returned `statusUrl`.
Snapshots now include `lifecycle`, `attempt` (starting at 1), and ordered `events`
with sequence, state, timestamp and attempt. These are backend observations, not
estimated progress. Preparation is `starting`; calling the paired runner is
`running`. A successful result is `completed`; an exception is `failed`.

Legacy `status` remains compatible: completed is `done`, failed is `error`,
starting is `running`, and retrying is `queued`. Existing consumers can continue
to use those fields. The Plan UI uses `lifecycle`, with explicit status text,
cancel controls for active states and retry controls for failed/canceled runs.
Transport errors retain the last observation and offer a status refresh.

`POST {statusUrl}/cancel` records `canceled` for an active run. Queued runs never
start; preparation and running attempts discard later results/errors/progress.
The paired runner receives its existing cooperative `shouldStop` callback.
Cancellation does not interrupt synchronous CPU work or an in-flight area fetch.
Terminal cancellation is idempotent and completed results stay completed.

`POST {statusUrl}/retry` accepts failed/canceled runs only (otherwise 409), waits
for the old attempt to settle, clears partial progress/error/result and records
`retrying` before re-entering the queue. Plan, seed, location and parameters stay
fixed. No automatic retry is enabled. The same seed/input identity does not
claim identical geography if the external area source changes between attempts.
Jobs and events are process-local and disappear on restart. Active jobs are not
evicted by the recent-job retention limit.

The existing paired admission budget still permits one preparing/running attempt
and eight waiting attempts. Retry must acquire that same capacity after the old
attempt settles; overload returns 429 with `Retry-After: 1` without changing its
attempt number or terminal state. A canceled attempt retains its reservation and
record until its queued/preparation/runner work settles, then releases it once.
Cancellation and status reads remain available under the server submission limit.

Reproduce the controlled lifecycle receipt:

```sh
HBL_LIFECYCLE_RECEIPT=docs/evidence/she80-lifecycle.json bun test test/run-lifecycle.test.js
bun test test/run-lifecycle.test.js world/experiments-api.test.js test/server-civic-api.test.js test/run-job-manager.test.js
bunx playwright test test/e2e/run-lifecycle.e2e.js
```

The JSON receipt records actual handler transitions using an injected synthetic
runner and controlled preparation gate. It tests lifecycle behavior, not a city
outcome. The existing tiny-town real runner test separately verifies completed
result compatibility. Browser tests inject API snapshots to check page wiring.
