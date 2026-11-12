# Permanent Symphony assignment lifecycle evidence

Observed November11,2026 (America/Chicago). No live dispatch, merge or deployment.

## Root cause and delivered change

The coordinator could add symphony-pilot without creating the host-owned policy
required by prepare/host_git. `assignment_lifecycle.py` now participates in the
existing coordinator lock/lease protocol: reviewed policy and recoverable journal
are durable before the execution label. Already-labeled orphans use the same
review checks; labels and descriptions do not manufacture authorization.

Standing authorization binds an exact original review, reviewer and validity
window. Renewal rechecks remote base, issue identity, approval evidence and
exclusive ownership. The journal retains both pending and predecessor digests,
recovering interrupted creation/renewal without overwriting a newer policy.
Independent publication authorization is preserved. Existing sources/snapshots
are never reset, cleaned or deleted.

The scheduler's maintenance-only pass can renew an already-owned standing lease
under a new-grant hold; it cannot repair a missing policy, add a label or admit
work. This avoids blocking all renewal with the existing stale-lease watchdog.
Final verification runs under the issue lock and immediately before replacement.
Draft release requires matching receipt, terminal workpad, real correct-base issue
branch draft/commit, Linear URL/SHA and no active runtime claim. Unfinished policy
ownership remains retained after an explicit administrative release.

Fresh host inventory rejects stale runtime snapshots, unknown runtime owners and
unreviewed or changed worktree ownership. Worktree review binds HEAD and a bounded
source fingerprint, including dirty/untracked/ignored path state except Git and
dependency stores. No repository Git filters/hooks are executed for that audit.

## Changed files

| Files | Purpose |
| --- | --- |
| tools/symphony/local/assignment_lifecycle.py | Admission plans, ownership, durable policy/CAS, renewal/recovery |
| tools/symphony/local/host_git.py | Shared canonical100file/64KiB assignment validator and closed failure codes |
| tools/symphony/local/backlog_coordinator.py | Assignment-before-label, orphan reconciliation, receipt-backed release |
| tools/symphony/local/throughput_scheduler.py | Integrated safe maintenance, authority refresh; retained Python3.9 HTTPError fix |
| tools/symphony/local/supervisor.py | Existing coordinator/single runtime bootstrap, credential-free launchd rendering, locks, health/backoff |
| tools/symphony/local/supervisor-config.example.json | Deliberately non-runnable host-path template; no credentials |
| tools/symphony/local/test_assignment_lifecycle.py |22 deterministic lifecycle/crash/revocation/security/scheduler cases |
| tools/symphony/local/test_supervisor.py |7 disposable render/process/credential/workflow tests |
| tools/symphony/local/test_backlog_coordinator.py | Existing fixtures now supply explicit host inventory/verified publication proof |
| tools/symphony/local/test_throughput_scheduler.py | Isolated per-host fixture roots retain publication/runtime hold regressions |
| tools/symphony/local/test_throughput_integration.py | Disposable private coordinator state parent; full replenishment retained |
| tools/symphony/local/ASSIGNMENTS.md | Authority format, standing grants and exact supervisor handoff instructions |
| tools/symphony/local/COORDINATOR.md, PROCEDURES.md | Current contract links; historical directions superseded |
| docs/implementation-plan.md, this record | Acceptance evidence and explicit live limits |

## Tests and installation

Actual system Python3.9 source suite:220tests pass/27.869seconds, including all
existing publisher/coordinator tests. Final installed package:243tests pass/20.145seconds,
including separately deployed cache/overlay integration. Regression fixtures
cover before/after policy replacement and label-response crashes, repeated
reconciliation without duplicate writes, authorized renewal, expired/revoked or
changed review, baseline changes, overlap/unknown owners, missing assignments,
permissions/symlinks, verified handoff/release and replenishment. Renewal crash
recovery is tested with a running claim through maintenance-only mode. Revocation
during a fresh scan leaves the assignment unchanged. Read-only adversarial review
confirmed the final two targeted fixes;2focused tests pass/0.011seconds.

Installed12host files with originals/checksums under
`~/.local/state/hbl-publisher/backups/assignment-lifecycle-1794460888/manifest.json`.
The deployed scheduler's observation cache adapter was preserved with a narrow
patch; the separate versioned read-only observer remains unchanged. No services,
config activation, execution labels, assignment files or runtime limits changed.
Both disposable launchd plists pass actual `plutil -lint`; no job was installed
or process started. Logs: `/private/tmp/hbl-assignment-full.log`,
`/private/tmp/hbl-assignment-installed-tests.log`. Installation manifest copy:
`/private/tmp/hbl-assignment-install-manifest.json`.

## Controlled live dry-run and exact assignment disposition

Authenticated complete read-only snapshot:178project issues,34PRs, current sprint
173f9530752b0e476583ad3ee7433b57a857b6bd;18Linear calls/36GitHub calls/0GH retries.
Applied the new coordinator's dry-run to that captured remote inventory and fresh
local runtime/worktree/assignment state. It selected0 and retained28occupied
reservations. Report mode600 `/private/tmp/hbl-assignment-live-dry-run.json`.
This is captured-remote/fresh-local audit evidence, not a live apply or worker run.

- **SHE-83:** existing four-file human-approved assignment at current173f953
  remains unchanged, publishEnabled=false. No replacement created. The separate
  staged coordinator readiness review still names older33e84c3 and lacks current
  cleanBaseEvidence; unresolved active ownership remains. Automatic adoption or
  renewal requires independently current compatible review identity. No standing
  renewal authorization was invented.
- **SHE-142:** no assignment created. Staged five-file review is stale at33e84c3,
  lacks current cleanBaseEvidence and has unresolved active ownership. Existing
  PR35 also contains a conservative issue reference requiring reconciliation;
  this is not a claim that the scalar oracle is already implemented.
- **SHE-165:** no assignment created. Missing trusted operator readiness review
  and exact independently approved file/interface scope. Its label/prose is not
  sufficient. No scope was guessed.

Exactly0new live assignments created. Disposable fixtures create SHE-83 and
other synthetic issue policies only inside temporary directories, never Linear.

Actual final API:0running/0retrying/0blocked/0modeltokens. Existing authoritative
terminal retains workflow concurrency1/max_turns20/dualfilter/source-only root.
Swap21,498MiB in use of22,528MiB allocated; another host observation reported
roughly80MiB available RAM. No worker start or scaling is justified. No claim of
one or three actual Codex executions is made.

## Remaining operator decisions

Review current compatible authorization/ownership evidence for83/142, reconcile
PR35's reference and retained unknown ownership, and establish an exact scope for
165 before approval. A standing renewal grant must explicitly authorize that
exact ticket/review; neither this implementation request nor a ready label
creates it. Resolve resource pressure and verify one real executing Codex worker
before any increase. Keep publication independently disabled until source tests
and reviewer validation succeed.

Supervisor installation steps are in tools/symphony/local/ASSIGNMENTS.md. The
other terminal owns the live runtime; an explicit owner handoff must precede
launchd bootstrap. Default templates stay observation-only with approvals disabled.
No new poller was launched and no running service was replaced. Native expected
failure parking and pipeline health integration are owned by the coordinating
chat and are not claimed as delivered by this change.

## Final integration hardening

Independent integration repros are covered: admission and publisher share the exact100file/64KiB/canonical identity validator; issue lock spans label lookup and remote addition, with policy expiry/digest/publication flag checked at the final mutation boundary. Tests advance time or change the policy during label lookup and assert no execution approval. A second callback check in Services.approve covers the scheduler's intervening guard. Current issue and review digests remain authority, never labels.

Supervisor restart attempts now persist across wrapper/launchd invocations. A tested second invocation creates no new failed child after the durable budget reaches3. Selective KeepAlive does not restart a normal HELD exit. Only an observed300second healthy service or explicit operator-reviewed config generation can reset the budget; credential/config failure is a terminal hold. Clean bounded coordinator cycles continue under the same wrapper. Existing coordinator/watch processes are held, not duplicated.

Scheduler-status now includes redacted assignmentMaintenance closed codes and actual queue observations. Execution-label count is separate from current trusted-admission approval count. awaiting_review is null because actual review decisions are absent, with open_draft_prs reported separately. No raw review, source, pending policy or comments are projected. Latest source220pass and22focused lifecycle tests pass; final installed243tests pass after checksum-preserving deployment.

## Final installed acceptance

After the integration hardening, final installed Python3.9 suite:243tests pass/20.145seconds (`/private/tmp/hbl-assignment-installed-final.log`). Both deployed cache tests and the observation adapter are retained. Final backup/checksum manifest: `~/.local/state/hbl-publisher/backups/assignment-final-1794461535/manifest.json`; local copy `/private/tmp/hbl-assignment-final-install-manifest.json`. Latest disposable selective-KeepAlive plists both pass actual plutil lint under `/private/tmp/hbl-launchd-final-4wkctdzd`; no job installed or process started. Source feature commit6c506a0 on codex/symphony-assignment-lifecycle is supplied to the existing coordinating chat for integration instead of a duplicate independent dispatcher or authority.

No live assignments were created or renewed; original83policy and all prior source remain. Existing versioned read-only observer remains inactive for apply and has not been replaced. Its older status projection can remain unknown until an explicitly reviewed deployment/handoff uses the new package; installed code alone is not claimed as active continuous supervision.
