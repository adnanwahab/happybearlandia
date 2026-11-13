# Small-user backend load test (SHE-45)

This prepares a bounded staging workload; it is not a capacity certification.
The initial checkout already contained untracked `ops/backend-load-test.mjs`
and `test/backend-load-test.test.js`. They were retained and extended rather
than replacing the City API or simulation. Existing `world/city/api.js` handles
creation, completion polling and replay; `world/server-civic-api.js` is its normal
server entry. The existing worker tests cover replay slot release and aborts.
Linear SHE-42 (HBL-W1-029) was observed Done on November 12, 2026. The checkout
has a two-active-job City budget with 429 overload responses. Verify the actual
staging deployment has that behavior before execution.

Ownership for this slice: the runner, its test file, this runbook and the SHE-45
entry in the implementation plan. Branch: `mini/SHE-45`. No production deploy,
merge, source-control protection or dispatcher approval changes are included.

## Operator preparation

Use a dedicated disposable staging app and store, with no production proxy,
production data, or production storage mounts. Confirm the origin/app association
and serving build independently. A hostname containing a `staging` component is
required but cannot prove infrastructure isolation. The configuration fields are
operator assertions, not evidence that someone granted permission.

Create a private JSON file (the example uses a deliberately nonresolving domain):

```json
{
  "origin": "https://hbl-staging.example.invalid",
  "approvedOrigin": "https://hbl-staging.example.invalid",
  "environment": "staging",
  "app": "hbl-staging",
  "buildSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "disposableData": true,
  "concurrencyPrerequisite": "SHE-42 verified"
}
```

Replace the app, origins and SHA with reviewed staging values. The staging
server must advertise that exact SHA through `HBL_BUILD_ID` and report ready at
`/api/ready`; mismatch stops before scenario writes. No credentials or cookies
are sent, redirects are rejected, and no requests are retried.

```sh
bun --no-env-file ops/backend-load-test.mjs /private/tmp/hbl-staging-config.json
bun --no-env-file ops/backend-load-test.mjs /private/tmp/hbl-staging-config.json --execute > /private/tmp/hbl-staging-load-result.json
```

The first command validates and prints the plan with zero network requests.
Run the second only against independently approved disposable staging. Nonzero
exit means refused or failed; retain its report when available. Do not retry a
lost POST response: it may have committed. Inspect the staging store before any
rerun. Record start/end time, serving build, app/machine identity and operator
approval with the private report.

## Workload and interpretation

Two concurrent users each perform two sequential journeys: GET homepage, GET
`/world/future-machine/main.js`, POST a City scenario, poll its completion at
one-second intervals (ten attempts maximum), then POST replay for that same
experiment, baseline scenario and run index zero. The recipe fixes seed 45,
12 synthetic households, one run, two months and summary retention. The report
records the model/rules version and recipe. Replay recomputes using the saved
manifest; it does not mutate the source run or claim independent snapshot proof.
Coefficients and city inputs are illustrative and uncalibrated, not forecasts.

Limits: four creations, at most two client requests in flight, 65 total requests
including readiness, ten seconds per request, two MiB per response. The first
failure stops new work; already in-flight requests may complete. Successful IDs
are returned as `createdExperimentIds`. A failed response can leave an accepted
write whose ID is unknown. Preserve and inspect the disposable store; the runner
does not delete runs or invent a deletion API. Stop with Ctrl-C if operator
metrics exceed the staging budget; disconnected creation can continue server-side.

Each request class reports nearest-rank p50/p95 latency in milliseconds (including
body consumption), error count/rate and 429/503 count. A small sample's p95 is
usually its maximum; polling traffic is included separately. Timing varies even
though request inputs are repeatable. Failure samples contain sanitized categories,
not response bodies. This is a cold/request-path probe, not a browser cache model.

Saturation reports client peak in-flight and elapsed time. Server CPU, memory and
queue depth are explicitly null until independently measured. Capture staging
CPU/memory, active workers/queue depth, storage latency/free space and 429/503
counts over the same time window using existing operator monitoring. Attach those
observations separately with units and sampling interval. Absence of 429s does
not prove spare server capacity. This workload intentionally does not ramp past
two users; do not increase it implicitly to force saturation.

## Verification and remaining evidence

```sh
bun test test/backend-load-test.test.js test/city-worker-call.test.js test/server-civic-api.test.js
```

Final verification: 22 tests passed, zero failed, 177 assertions (4.19 seconds). The integration
case uses the actual server civic handler, real City workers, isolated temporary
SQLite storage and repository homepage/asset files; readiness is a fixture and
network transport is injected. Other cases exercise dry-run, production/config
refusal, serving-SHA mismatch, overload, response-size limits, invalid creation
contracts, percentile calculation and request bounds.

No live staging origin/approval/metrics were supplied. Staging p50/p95, error rates,
server saturation and deployment identity remain unmeasured; unit/integration
timings are not staging evidence. No UI changed, so Playwright/screenshots are
inapplicable. No PR has been created by this task.

## SHE-45-r2: disposable loopback staging

Run from the repository using `bun --no-env-file ops/backend-load-local.mjs > /private/tmp/she45-local.json`.
This launches the actual `server.js` on an ephemeral port bound to `127.0.0.1`,
with a fresh temporary working directory, isolated stores, no inherited service
credentials, and `.env` loading disabled. It checks the current checkout SHA via
readiness, uses the same bounded recipe and request limits, stops the child and
removes the disposable directory in `finally`. Startup has a 20-second deadline.
It does not change admission budgets. Application source/assets are symlinked
read-only by convention; hidden default stores stay in the disposable directory.

The runner accepts HTTP only with `localStaging: true`, literal `127.0.0.1`, an
explicit port, and the existing staging/disposable/build/prerequisite assertions.
Local reports label their environment and carry no production capacity inference.
`HBL_BIND_HOST` configures the application listener; the launcher sets loopback.
The external HTTPS staging path retains its existing validation.

Fresh verification and the listener blocker are recorded in
[the follow-up report](reviews/SHE-45-r2.md). The earlier unmeasured-staging status
above is historical; no successful HTTP measurements are yet available here.
