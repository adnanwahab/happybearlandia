# SHE-65 launch-load readiness audit

Status: blocked before execution, 2026-11-12. This is an audit and proposed
execution slice, not a load-test result or approval.

Source baseline: `b963dd353538294cb0fbf5d34d5283fad6e10e68`, branch
`mini/SHE-65`. The checkout was clean before this audit. No PR was created.
Only this new evidence document is changed; shared runtime and coordinator-owned
implementation plan remain untouched pending file allocation.

## Observations and overlap

Read-only Linear `get_issue` calls for SHE-65, SHE-45 and SHE-42 confirmed all
three are Backlog. SHE-65 is blocked by SHE-45 (representative staging request
generator), which is blocked by SHE-42 (bounded simulation concurrency).
No readiness label, approved target, numerical error budget, or exclusive
implementation allocation was supplied. The issue explicitly requires planner
prerequisite/ownership review before Todo and `hbl-agent-ready` dispatch.

`ops/measure-release.js` already measures four sequential read-only routes:
`/api/health`, `/api/ready`, `/tools/simulation-health/`, and `/`. It reports
nearest-rank p50/p95, status counts and mean response bytes, limits samples to
1–100 per route, rejects redirects and applies a five-second request timeout.
Reuse it for initial smoke measurements. It has no staged concurrency, scenario
creation/replay mix, resource telemetry, automatic stage budget stop, or recovery
phase. It is not evidence of service capacity. Renderer/people/city benchmarks
are separate simulation or client workloads, not this HTTP launch profile.

The existing release runbook and SHE-60 evidence require an approved staging
environment and single-writer storage topology. Historical coordinator reports
also retain the SHE-42/SHE-45 prerequisite holds. Historical evidence is not a
fresh staging verification. No deployment, remote requests, fixture writes,
Linear mutations or dispatch were performed by this audit.

## Next integrated slice, after prerequisite review

1. Coordinator allocates exact files and verifies delivered SHE-42/SHE-45
   contracts/tests. Confirm staging origin, build, isolated stores, operator,
   fixture cleanup authority, telemetry access and explicit execution approval.
2. Pin a versioned synthetic fixture, seed, request mix and creation/replay
   identity contract from SHE-45. Preserve authoritative saves. Do not replace
   the prerequisite generator with a second implementation in SHE-65.
3. Review a bounded profile before execution: proposed concurrency 1, then 2,
   then 4, at most 30 seconds per stage, with a maximum request count and rate
   selected by the operator. These numbers are proposals, not approved limits.
   Supply numeric latency, timeout, 5xx, 429, CPU, memory, queue and disk budgets,
   observation windows, recovery timeout and immediate cancellation behavior.
4. Capture idle baseline, run one stage, wait for telemetry/recovery, and advance
   only within approved budgets. Stop on an exceeded budget, missing telemetry,
   wrong build, readiness failure, unexpected redirect or data-integrity failure.
   Distinguish deliberate overload 429s from successful scenario completion.
5. Record recovery at baseline traffic, verify created/replayed records and
   no missing or duplicate writes, and retain a sanitized machine-readable
   receipt. Cleanup only the authorized test namespace.

Acceptance evidence must include exact argv and profile version, timestamps,
target/build/hardware, fixture/model/rules versions and seed, attempted/completed
requests, achieved request rate, per-stage/per-route p50/p95, denominators for
5xx/429/transport failures, resource/queue peaks, stop reason and recovery time.
Record raw observations separately from bottleneck interpretation. A stage
below a safeguard establishes only its observed traffic level; it does not
establish saturation capacity or support extrapolation to 1M concurrent users.

## Verification and remaining limits

Audit commands: `git status --short`, `git branch --show-current`,
`git rev-parse HEAD`, source inspection of `ops/measure-release.js`, searches
for load/concurrency tooling and read-only Linear issue retrievals above.
No live profile was run: capacity, bottleneck, p95, 5xx/429 and recovery are
**unmeasured**. Browser behavior is unchanged; Playwright is inapplicable.
The issue remains incomplete until prerequisites and staging execution are
approved and the actual measured receipt is reviewed.
