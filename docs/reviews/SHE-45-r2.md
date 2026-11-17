# SHE-45-r2 acceptance evidence — 2026-11-12

Status: working implementation increment; real HTTP acceptance blocked by local
socket permissions. No capacity certification or successful HTTP run is claimed.

## Audit and ownership

Branch `mini/SHE-45-r2`, starting HEAD
`53090035f6fa8d9df44c339928ecaf450c48ff44`, initially clean.
[Prior PR #167](https://github.com/adnanwahab/happybearlandia/pull/167) is merged
into `sprint/one-city-two-futures-20261111`. Its existing runner already supplies
four seeded journeys, homepage/assets, scenario creation/polling/replay, bounded
concurrency/timeouts/body size, readiness SHA validation, and percentile/error
reporting. Retained it; the missing slice was loopback support and full entry-point
execution. GitHub connector inspection of remote sprint runner confirmed overlap;
`git fetch origin` failed on read-only shared FETCH_HEAD; `git ls-remote` also
failed DNS. No claim that every remote branch was synchronized.

Linear SHE-42/HBL-W1-029 was inspected Done, linked to PR #59. Existing
`world/city/api.js`, `world/city/worker-call.js`, `world/server-civic-api.js`,
`test/city-worker-call.test.js`, `test/server-civic-api.test.js` and admission tests
provide working worker/overload contracts; no replacement implemented. SHE-45
already has both requested approval labels. No conflicting local edits existed.
Ownership is limited to the files listed in the implementation-plan follow-up.
Read product design, implementation plan, runbook and admission contract; no
`docs/architecture.md` or more-specific AGENTS.md was found in affected modules.

## Delivered and preserved

Explicit local-staging opt-in permits only HTTP literal loopback with a port;
other staging assertions and external HTTPS validation remain required.
The new launcher starts normal `server.js` with an ephemeral loopback listener,
isolated temporary working directory/stores and a minimal environment. It sends
actual fetch requests, checks the checkout SHA through real readiness, and cleans
up the server and stores on success/failure. No synthetic readiness fixture is
used by the launcher. Request recipe remains seed 45, 12 synthetic households,
two months, baseline scenario, summary retention and `city-systems.1.1.0`.
Replay remains recomputation of saved input, with no independent snapshot claim.
No simulation implementation or ODD mechanism changed. Synthetic uncalibrated
assumptions remain in every report. No UI changed.

## Exact verification

- `bun test test/backend-load-test.test.js test/city-worker-call.test.js test/server-civic-api.test.js test/simulation-admission.test.js`
  — 29 pass, 1 skip, 0 fail; 377 assertions, 4.30 seconds. Includes real City
  worker/SQLite integration through civic handler, deterministic worker equivalence,
  slot release, overload, build mismatch, malformed/oversized responses, target
  refusals, percentiles and request bounds. This integration injects transport;
  it is not evidence of full HTTP server behavior.
- `bun --no-env-file ops/backend-load-local.mjs > /tmp/she45-local.json`
  — exit 1 before listening; Bun 1.4.2 reports `EADDRINUSE` at port 0.
  No workload requests were sent, no JSON measurements generated; temporary
  directory cleanup executed.
- Independent Python `socket.socket().bind(('127.0.0.1', 0))`
  — `PermissionError [Errno 1] Operation not permitted`, confirming listener
  restriction rather than evidence of an occupied chosen port.
- `git diff --check` — passed.

| Required local measurement | Result |
| --- | --- |
| Homepage/create/status/replay/asset p50 and p95 | Unmeasured: listener blocked |
| HTTP error rates and 429/503 | Unmeasured: no HTTP workload ran |
| Client peak in-flight | Unmeasured here; harness caps at two |
| Server CPU/memory/queue saturation | Unmeasured; runner reports null |

Next action on a host permitting loopback: run the launcher command and retain
its JSON; inspect `ok`, all four IDs, per-class summaries and client peak. Capture
server resource metrics separately if saturation evidence is required. Maximum
65 requests, two users, ten-second request timeouts, four creates, no retries;
startup timeout is 20 seconds. Neither null server metrics nor absence of overload
establishes spare capacity. No production target or external account is needed.

No new commit or PR link: Git metadata is read-only outside this workspace's
writable roots. The existing PR link above is historical, not this follow-up.
No merge, deployment, production load, data change, secret or release-gate change.
