# SHE-45 acceptance follow-up — November 13, 2026

Status: replay-contract gap fixed and integrated tests pass. Full HTTP measurement
acceptance remains blocked by local listener permissions. No capacity claim.

## Audit and ownership

Initially clean branch `mini/SHE-45-r3`, HEAD
`5fdb96832cdb6d895b04e9ea95ad4b3aea0318eb`. Exclusive local ownership:
`ops/backend-load-test.mjs`, `test/backend-load-test.test.js`,
`docs/backend-load-test.md`, this report, and the issue implementation-plan entry.
No conflicting uncommitted work was present. No delegation was needed.

Read repository AGENTS.md, README, product design, affected implementation-plan
entries, City README, simulation admission contract and load-test runbook.
No docs/architecture.md or more-specific instructions exist for these files.

GitHub read-only inspection confirms [PR #167](https://github.com/adnanwahab/happybearlandia/pull/167)
and [PR #296](https://github.com/adnanwahab/happybearlandia/pull/296) merged into
the specified sprint base. Their code is present; neither merge nor process exit
is acceptance evidence. Preserve [the prior attempt](SHE-45-r2.md), including
its listener blocker. Linear read-only inspection confirms SHE-42/HBL-W1-029
is Done and links [PR #59](https://github.com/adnanwahab/happybearlandia/pull/59).
SHE-45 remains In Review with hbl-agent-ready and hbl-coordinator-approved.
No issue mutations or external messages were made.

Existing implementation already covers homepage, static JS, four creations,
bounded status polling and four same-run replays, readiness/build check, dry-run,
staging host guard, redirect refusal, no credentials/retries, maximum 65 requests,
two concurrent users, ten-second request deadlines and two-MiB response limits.
`ops/backend-load-local.mjs` starts normal server.js on explicit loopback with
isolated stores and no inherited service credentials or .env loading, then
cleans up. These features were retained rather than duplicated.

## Concrete change and provenance

Previously a replay HTTP 200 containing arbitrary JSON counted as successful.
The runner now validates the requested experiment, scenario, run index and run ID,
server saved-outcome verification status, current model version, seed and final
month, and replay step count. Invalid data counts as a replay error and stops new
work. Ten corruption cases cover these fields, alongside successful actual civic
handler, City worker and temporary SQLite integration.

Checked `world/city/api.js`, `world/city/run.worker.js`, `world/city/contracts.js`,
`world/city/seed.js`, `world/server-civic-api.js` and relevant worker/admission tests.
Recipe remains seed 45, 12 synthetic households, one baseline run, two months,
summary retention and current `city-systems.1.1.0`. Synthetic illustrative,
uncalibrated assumptions remain in every report. No simulation rules, source
results, data, ODD descriptions or storage contracts changed. Replay recomputes
saved inputs; the server compares saved outcome metrics. This is not independent
proof of every intermediate checkpoint or an empirical forecast.

## Commands and observed results

```sh
bun test test/backend-load-test.test.js test/city-worker-call.test.js test/server-civic-api.test.js test/simulation-admission.test.js
bun --no-env-file ops/backend-load-local.mjs > /private/tmp/she45-r3-local.json
python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0))"
git diff --check
```

- Baseline focused suite: 29 pass, 1 skip, 0 fail, 377 assertions, 4.29 seconds.
- Updated focused suite: 30 pass, 1 skip, 0 fail, 427 assertions, 14.28 seconds.
  Skipped test is the explicitly opt-in HTTP admission burst; transport-injected
  integration runs real City workers and SQLite, but does not prove HTTP behavior.
- Launcher: exit 1 before listening. Bun 1.4.2 macOS arm64 reports EADDRINUSE
  for port 0; launcher reports server exited before listening. Output JSON file
  is empty, not a measurement artifact. No workload requests were sent.
- Python bind: exit 1, PermissionError errno 1, Operation not permitted.
  This independently identifies a listener restriction. No escalation or alternate
  external target was attempted.
- `git diff --check`: passed. No package lint or repository-wide typecheck script
  exists; changed code is JavaScript. No UI change, so no Playwright/screenshots.

| Required observation | Result |
| --- | --- |
| Homepage/asset/create/status/replay p50 and p95 | Unmeasured: listener blocked |
| HTTP error rates and overload counts | Unmeasured: no HTTP workload |
| Client saturation | Unmeasured over HTTP; test verifies peak at most two |
| Server CPU, memory and queue depth | Unmeasured; report retains explicit nulls |

No synthetic timing values replace these missing measurements. Unit-test timing
is not staging evidence. On a host permitting loopback, rerun the launcher and
retain its JSON, checking ok, four IDs, all per-class summaries and peak in-flight.
Capture server resource metrics separately with units and sampling interval.
This bounded local workload provides no production-capacity inference.

## Preserved gates and remaining work

`.github/workflows/auto-merge.yml` holds the merge job with `if: ${{ false }}`;
it remains disabled. `ops/patch-voting/queue.js` retains defaults of five upvotes
and score three for advisory dispatch, not merge authorization. No policy, auth,
vote, check, secret, production data or deployment changes were made. Remote
branch-protection configuration was not inspected or changed.

No commit or new PR was created in this session. Branch above contains the local
review candidate; historical PR links identify overlap only. Next action is HTTP
verification on a loopback-capable host, then review of actual local-staging
measurements. Do not mark the missing measurements accepted based on these tests.
