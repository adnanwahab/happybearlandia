# Symphony throughput: measured follow-up to PR 30

The [SHE-256 concurrency decision gate](symphony-concurrency-gate.md) records
the unmeasured candidate table, proposed disposable-project protocol, budget
prerequisites and rollback to 1. No candidate above 1 is certified.

## Ownership and scope

The throughput coordinator owns `tools/symphony/local/{backlog_coordinator,throughput_policy,throughput_scheduler,throughput_metrics,install_dashboard_overlay}.py`, their focused tests, the dashboard overlay and this report. The existing host publisher/workpad hooks remain separate owners. The recovery coordinator owns `ops/symphony/workspace_preflight.py` (PR 33). Another release coordinator owns the retained SHE-121 changelog implementation and its verification/handoff. No file-ownership agreement or dispatch approval is inferred from an issue's priority or lane.

PR 30 was inspected and merged into the sprint before this branch. Its complete evidence, approval digests, exact files, ownership checks, durable host lock/leases, double inventory before grants and additive pilot-label policy are reused. This change adds scheduling and observation around that implementation.

## Observed before and after

| Observation | Before | After | Interpretation |
| --- | --- | --- | --- |
| Logical Linear queries for 175 issues | 877 | 18 | 97.9% reduction; complete connection pagination retained |
| Optimized live full audit | unavailable | 21.196 seconds, 175 issues, 22 PRs | One live sample, not a latency distribution |
| GitHub commands in that audit | unavailable | 24, zero retries | Physical Linear transport retries not instrumented |
| New-grant cap | 1, then another session set 4 | 1 with additional pressure-release label gate | No scale-up experiment performed |
| Resource baseline | 16 GiB RAM; 27.6–27.8 GiB swap used | still materially pressured | No safe justification for 4/6/8/12 workers |
| Recurring reconciliation | manual one-shot audit | bounded 60–300 second loop with durable metrics | Live operation remains observational until explicit readiness evidence |

The old query count is the prior implementation's logical query accounting on the same 175-issue inventory, not a fabricated baseline wall-clock benchmark. The optimized live scan returned all nested evidence without continuation pages; separate overflow/cursor tests verify pagination when needed. Inventory can change between scans.

PRs 27–29 were this chat's manually delegated release work, not recorded Symphony dispatches. Creation-to-merge durations were 176, 148 and 120 seconds: median148, nearest-rankp95 176, n=3. This small sample does not establish sustained throughput. No Symphony stage events for those three issues were found. A real logged SHE-27 run had approximately2.37 seconds before-run/startup,100.37 seconds in its Codex turn and7.4 seconds after-run/publication. Reasoning versus inspection versus implementation versus tests cannot be separated from those events.

Eligible-to-claim, commit-to-draft, first-pass CI, end-to-end accepted changes per worker-hour, queue wait p95 and comparative delivery throughput remain unavailable. The new dashboard displays unavailable values rather than substitutes. No duplicate issue implementation was launched for a benchmark. This slice proves scan reduction and fail-closed orchestration, not an end-to-end delivery increase.

## Behavior and safety

`throughput_scheduler.py` runs the original coordinator under its existing host lock. It audits first, evaluates resource/runtime/watchdog conditions, then uses the cached first inventory plus the original mandatory fresh inventory immediately before each grant. It rechecks operator evidence, runtime and resource readings after the audit. Unknown/stale inputs hold grants. Shutdown preserves leases, ambiguous grants and all workspaces. Leases are not expired merely because a worker disappears.

Trusted per-issue review records may add `scheduling` with lane `fast`, `feature` or `research`; gameplayImpact, scientificCorrectness, reliability, unblockingValue and risk in0–5; effortHours in0.1–168; successProbability in0–1. Ranking never creates approvals or ownership. Durable lease-history rotation gives3fast,2feature,1research slots, including when cap1 dispatches one task per cycle. Without these records, existing priority ordering remains.

New grants hold when available memory<2GiB, swap>4GiB, disk<10GiB, load/core>.85, inputs are stale/unknown, active leases need reconciliation, approvals are disabled, or review capacity exceeds2openPRs. These are conservative operator gates, not validated optimal hardware limits. Existing workers are never killed by this policy. Scaling above measured concurrency1 also requires trusted approver and accepted-change, failure and retry evidence. Candidates4/6/8/12 are modeled evaluations only; none is certified.

The recurring observer samples runtime once per completed full audit, not continuously at subsecond resolution. It persists redacted events and resources in mode0600 SQLite and atomic JSON under the private host coordinator directory. Descriptions, comments, prompts, credentials and raw tool output are excluded. It distinguishes repository-wide PR rates from Symphony branch rates, excludes long sampling gaps from utilization, and labels the remaining nonterminal project inventory as an estimate including unapproved work. First-pass CI/retry outcomes remain unknown without a trustworthy event feed. Commit-without-PR and stalled-CI detectors require populated publication/CI evidence; absence of those feeds is not evidence of success. Orphan detection is lease/runtime reconciliation, not a comprehensive OS process killer.

## Operation and rollback

Use the existing host authentication; never put tokens in a workflow, issue clone or worker environment. Keep the sandbox and pilot filter enabled. Run from the reviewed branch checkout:

```sh
python3 -W error::ResourceWarning -m unittest discover -s tools/symphony/local -p 'test_*.py'
python3 tools/symphony/local/throughput_scheduler.py --once \
  --workflow /Users/wahabma/happybearlandia/tools/symphony/elixir/WORKFLOW.md \
  --evidence "$HOME/.local/state/hbl-publisher/backlog-coordinator/she180-activation-readiness.json"
```

For continuous read-only monitoring replace `--once` with `--watch --interval 60`. The default `--max-cycles 10000` is bounded. No `--apply` means no approval label mutations. A host restarter must wait for the state API to return200 before starting the observer; its bounded transport retry also tolerates transient startup unavailability. The operator evidence currently disables approvals and has no readiness reviews; retain that setting until unknown active ownership and dependencies are individually reconciled. Parked In Progress issues continue to reserve capacity; do not silently release ownership based on an absent worker. Prose references to downstream issues must be reviewed before interpreting them as prerequisites; do not blanket remove dependencies.

After memory pressure is resolved and one issue has fresh ownership, tests and explicit digest-bound readiness approval, use the same command once with `--apply`. Keep cap1 and only that issue eligible. Remove the *additional* `symphony-pressure-release` required-label guard from the active workflow only as a deliberate operator release after verifying zero active/retrying workers, fresh safe resources and the single approved issue. Do not add this release label across the board. The ordinary `symphony-pilot` requirement remains. The scheduler requests the existing runtime refresh endpoint only after a new durable grant. A full inventory loop intentionally uses60–300seconds to avoid recreating API pressure; immediate completion-event inventory is not implemented.

Native dashboard installation uses the already installed Elixir application, not a second dashboard:

```sh
python3 tools/symphony/local/install_dashboard_overlay.py \
  --elixir-root /Users/wahabma/happybearlandia/tools/symphony/elixir
# Inspect the check-only result, then use --apply --backup /absolute/new/private/backup
```

Exact source anchors must match. Never overwrite a running escript with `make build`: its archive can mix old/new module indexes and return500. Verify the runtime reports zero running/retrying workers, stop its exact listening PID, build/test offline, copy `bin/symphony` to a unique versioned executable, and launch only that copy with the same held workflow. Verify `/`, `/api/v1/state` and `/api/v1/throughput`. No dual dispatcher. `--restore --backup <same path>` restores checksummed original router/dashboard only if installed files are unchanged; useful overlay files and tests are retained. Build a new versioned executable for rollback. Stopping the observer or reverting this branch does not delete its SQLite history, leases, workpads or issue clones. Do not remove a pressure hold merely to restore a previous unsafe cap.

## Remaining bottlenecks, in order

1. Host swap pressure and overlapping unreviewed ownership prevent safe dispatch. Resolve the process/resource cause and record real per-worker peaks before changing concurrency.
2. Reconcile26–30 reserved active issues individually. Verify merged PRs and preserve live work; approve a small player-facing ready buffer, not all backlog.
3. Add trustworthy stage/CI/publication outcome events to distinguish reasoning, tests, retries and accepted throughput. Use exact commit/check identity, never infer first-pass success from a final green state.
4. Compare nonduplicate representative tasks at concurrency1, then4 only after measured capacity permits; require accepted changes per worker-hour and conflict/retry cost. Reserve reviewer capacity. Move4→6→8 and only then12 after multiple comparable windows; hold or lower grants when accepted throughput falls or retries rise.
5. Workspace cloning still dominates some failures. PR33 separately introduces tested isolated copied-object preflight; do not share writable Git metadata. Package caches can be reused only with existing lockfile and integrity checks; shared writable dependency/build trees are not introduced here. Preserve ignored artifacts and never auto-delete issue clones.
6. Completion-event replenishment, live CI/publication collectors and independently reconciled oversized player-feature subtasks remain follow-up work. Prefer first-minute gameplay and One City, Two Futures slices after the dispatch gates are satisfied.

Human review remains required before merging. No production deployment, rollback or production data mutation is part of this work.

## Installed verification and exact files

The installed native runtime passed `make build fmt-check lint coverage dialyzer`:
305tests,0failures,6existing skips,100%coverage, zero Credo/Dialyzer errors. Existing
locked dependency advisories were reported by Hex; this change does not upgrade
them or claim dependency security certification. The installed host suite passed
104tests at this coordinator's checkpoint; another owner subsequently added a
workpad regression and independently verified105pass. The standalone package
suite and GitHub check run on the final integration commit are reported in the PR.
Playwright loaded the actual native dashboard, found its throughput panel and
reported zero page errors; screenshot retained privately. Original state API
remains available. No live-worker pilot was launched.

RuntimePID88616 executes the unique private `20261111-v1/symphony`; the observer
was first installed asPID88985 (`20261111-observer-v2`). Later tested observer
versions may replace that PID without rebuilding/restarting Symphony. The first
successful observation covered175issues/27PRs in26.999seconds using18logical
Linearqueries,27GitHubcommands,0GitHubretries. It found0ready/165nonterminal,
~0.89GiB available-memory estimate and~19.8GiB swap. The private metrics persist
across observer versions. Initial boot-race failure was retained as an unavailable
sample; do not count it as an empty queue. Repeated cycles measure the explicitly
held runtime's utilization, not a saturated workload's capacity.

The reviewed PR's exact changed-file manifest is `git diff --name-only
<current-sprint-base>...HEAD`. In addition to that manifest, installation changed
these existing local-only native files (not vendored by sprint):

- `tools/symphony/elixir/lib/symphony_elixir_web/router.ex`
- `tools/symphony/elixir/lib/symphony_elixir_web/live/dashboard_live.ex`
- `tools/symphony/elixir/lib/symphony_elixir_web/factory_throughput.ex` (new)
- `tools/symphony/elixir/test/symphony_elixir/factory_throughput_test.exs` (new)
- `tools/symphony/elixir/WORKFLOW.md` (cap1 and stricter label hold)
- `tools/symphony/elixir/test/symphony_elixir/core_test.exs` (allows only standard or stricter pilot filter)
- `tools/symphony/local/test_publish.py` (same strict filter regression)

Source backups: `/private/tmp/hbl-throughput-dashboard-backup-20261111` with
checksums; pre-ownership workflow `/private/tmp/hbl-workflow-before-throughput-ownership-20261111.md`;
original config-test/publisher-test bytes in matching private `/private/tmp/hbl-*-before-pressure-hold.*` files.
`overlays/runtime-pressure-hold.patch` records exact local configuration/test
changes. The active executable, logs, SQLite and host JSON are operational state,
not repository source; do not publish their raw contents. Build outputs/caches
were generated by required native checks. All existing worktrees, branches,
commits, workpads and credentials were preserved.

Two completed real observer cycles recorded zero grants and0.0utilization over90.166sampledseconds (the runtime was deliberately held). This verifies recurrence, not useful changes per worker-hour.

Final race regressions cover PR backlog/publication receipts arriving during the mandatory fresh scan, policy/resource changes during that scan, and shutdown during the final check. All retain pending ownership without adding the dispatch label. Final integrated standalone package:102tests passed with ResourceWarning treated as an error. Blocking categories count each affected issue once.

After installing the reviewed package beside existing host hooks, the full installed Python suite passed164tests with ResourceWarning treated as an error. Final observerPID91400 uses `20261111-observer-v3`; runtimePID88616 and all pressure gates remain unchanged.
