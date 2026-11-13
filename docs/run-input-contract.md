# Public civic run input limits

`POST /api/runs` accepts saved experiment references or inline
`civic-experiment.v1` experiments and optional `world-batch.v2` batches.
The existing seed, model and rules records are preserved. Omitting a batch
requests generation; an explicitly supplied empty or malformed batch is rejected.
World rows must be objects with nonempty string IDs.

Preflight runs before generation, fingerprinting, allocation of job results or
scheduling. Requests are streamed up to 4,000,000 UTF-8 bytes (including JSON
whitespace); exceeding that limit cancels the stream and returns HTTP 413.
Invalid JSON, nonfinite numbers, arrays over 100,000 entries, more than 250,000
JSON nodes, or nesting beyond 32 levels return HTTP 400. Generation is also
limited to 250,000 run-variable cells, counting at least one cell per run, to
prevent a small input from multiplying into an excessive generated batch.
Numeric run/chunk/concurrency options retain their existing finite clamping.

When supplied, `createdAt`, `updatedAt` and `timestamp` fields require UTC ISO
strings in `YYYY-MM-DDTHH:mm:ss.sssZ` format, including a real calendar date.
These optional metadata fields do not set the simulation clock. JavaScript NaN
and infinities are rejected by resolver preflight; wire JSON tokens `NaN` and
`Infinity` are invalid JSON and overflow such as `1e999` is rejected as nonfinite.

Errors expose at most 240 message characters. Failed background jobs remain
pollable as `failed`; explicit `RunJobManager.wait()` callers still receive the
failure. Polling-only clients do not leave a rejected promise unhandled.

Reproduce with:

```sh
bun test --timeout 15000 test/run-input-security.test.js test/run-job-manager.test.js test/server-civic-api.test.js
```

Fixtures are synthetic, use seed 42, and pin civic/world schema versions. CI
includes them in `core-journeys.yml`. The suite verifies rejection before job
creation, exact size/depth boundaries, valid recovery after rejected requests,
stream cancellation, and a child Bun process surviving a background failure.
This contract covers `/api/runs`; other simulation APIs retain their own limits.
It does not establish aggregate queue, cache, rate or multi-client memory quotas.
