# Safe Symphony backlog coordinator (SHE-180)

Current assignment-before-label admission, standing renewal, host ownership checks
and launchd handoff instructions: [ASSIGNMENTS.md](ASSIGNMENTS.md). These supersede
the historical label-only admission descriptions below. Existing approval gates
remain mandatory; no new scheduler or automatic authority is introduced.

`backlog_coordinator.py` is a host-only one-cycle job, independent of the Symphony
poller. Run it periodically through an operator-managed scheduler. It does not
start Codex, create workers, execute ticket commands, edit workflow configuration,
move issue statuses, create workpads/PRs, remove labels, merge or deploy. The only
remote mutation available is adding the existing `symphony-pilot` label to one
eligible issue at a time. The unchanged trusted workpad hooks, isolated clones,
workspace-write/never sandbox and GitHub draft publisher remain responsible for
execution and publication. The review label `hbl-symphony-queue` is not dispatch
permission. Existing `hbl-agent-ready` labels do not authorize this coordinator.

SHE-180 explicitly requests implementation, not activation. No scheduled job or
live approvals were installed during development. Keep the current workflow's
one-worker limit. A coordinator approval cap of three is a reservation ceiling,
not authorization to run three workers or an instruction to fill every slot.

## Existing work and overlap

Read-only inspection of SHE-126/SHE-127 on November 11, 2026 found:

- SHE-126 is In Review, but its workpad explicitly reports blocked-before-code,
  incomplete acceptance and no implementation commit. It scoped a documentation
  checklist on the older ops branch; no delivered checklist was found locally.
- SHE-127 is Todo, natively blocked by SHE-126, with no comments/delivered report.
- The old `ops/symphony/LINEAR.md` exists on the separate ops branch, not this
  sprint. Its general checks informed this classifier; its historical ready-label
  and scaling instructions do not replace the current local pilot gate.
- `local/dispatch-report.md` is an existing human report, not machine-verifiable
  approval. The local host publisher's sanitized Linear transport and private-file helpers
  are extracted into coordinator_host.py for standalone packaging. No duplicate Linear issues/checklist or legacy bulk intake is added.

An operator must reconcile overlapping ownership and record `overlapReconciledBy`
before enabling apply. This implementation does not mark SHE-126/SHE-127 done or
waive their blockers. No remote issue/comment was changed.

## Read-only inventory

The scanner enumerates every issue in the pinned HBL project, then every comment,
label, inverse relation and attachment, following cursors until complete. Native
`blockedBy` uses the same inverse `blocks` relation as Symphony's Linear adapter.
Every repository PR (open/closed/merged) and its changed-file pages are read using
host Keychain `gh api --paginate --slurp`. A cyclic/incomplete response or GitHub's
3000-file PR ceiling aborts without further approvals. Linear uses the extracted existing
bounded, sanitized transport retries; GitHub reads retry three times.

Dry-run performs no remote mutations and creates no lease directory. Optional
reports are explicit local output writes. The JSON report captures comments,
workpad IDs, native blockers, prose issue references, attachments, PR metadata and
files, reviewed scope, digests and hold reasons for every issue. The Markdown
report summarizes every issue; it never hides held issues from the audit.
A missing workpad is not a hold: the trusted before_run hook initializes it.
Multiple workpads fail closed without deleting any.

## Trusted readiness evidence

The coordinator does not infer approval from prose, status or labels. A trusted
operator audits actual code, clean clone/base/branch, open and merged PRs, local
worker assignments, exact file/interface ownership, prerequisites and test commands.
This manual source audit is an explicit trust boundary. Test commands are recorded
as argv data, never executed by the authenticated coordinator. The coordinator
independently checks freshness, remote base identity, issue digest, blockers,
existing PRs, conflicts and capacity; it does not claim it ran those ticket tests.

Host preparation (operator commands; not executed by this implementation):

```sh
mkdir -p "$HOME/.local/state/hbl-publisher/backlog-coordinator"
chmod 700 "$HOME/.local/state/hbl-publisher/backlog-coordinator"
cp /Users/wahabma/happybearlandia/tools/symphony/local/coordinator-readiness.example.json \
  "$HOME/.local/state/hbl-publisher/backlog-coordinator/readiness.json"
chmod 600 "$HOME/.local/state/hbl-publisher/backlog-coordinator/readiness.json"
```

Evidence must be a direct file in that host-private directory, owned by the host
user, mode600, with no symlink/hardlink. Never accept evidence from a model-writable
issue checkout, issue attachment, or model-generated workpad. It contains no tokens.
Only the host environment supplies LINEAR_API_KEY; gh uses existing Keychain auth.
Nothing passes either credential to a worker or ticket command.

First run with empty reviews to obtain inventory/digests:

```sh
cd /Users/wahabma/happybearlandia
python3 tools/symphony/local/backlog_coordinator.py --dry-run \
  --evidence "$HOME/.local/state/hbl-publisher/backlog-coordinator/readiness.json" \
  --report /tmp/hbl-queue-audit.md --json-report /tmp/hbl-queue-audit.json
```

In `reviews`, key each operator-reviewed record by the immutable Linear issue UUID,
not the display identifier. Fields are:

| Field | Required evidence |
| --- | --- |
| `issueDigest` | Exact audit digest of current identity/title/description/comments/blockers/attachments |
| `baseSha` | Full current remote sprint SHA from the audit |
| `branch` | Exactly `symphony/SHE-<number>` |
| `reviewedBy`, `expiresAt` | Named operator and Unix expiry within the next24hours |
| `dependencyAudit` | Human audit of all prose, including aliases/non-SHE dependencies |
| `dependencies` | Every prerequisite as canonical SHE identifier, explicitly `[]` if none |
| `verifiedPrerequisites` | Per prerequisite identifier: concrete verification/merged-commit evidence |
| `duplicateAudit`, `implementationAbsent` | Actual source and PR search evidence, and literal `true` |
| `ownershipAudit` | Existing worker/worktree/interface audit, including external assignments |
| `cleanBaseEvidence` | Actual clean isolated clone, exact base and branch verification evidence |
| `files` | Exact relative paths or directory reservations; no globs, traversal or `.git` |
| `interfaces` | Exclusive shared interface names, explicitly `[]` if none |
| `tests`, `testEvidence` | Nonempty argv arrays and evidence they are runnable at reviewed base |
| `acceptance` | Nonempty list of observable outcomes |

Every SHE reference in description/comments is conservatively treated as a
prerequisite (excluding self). This can over-hold related references; an operator
must reconcile source text rather than silently suppress a blocker. Alias/non-SHE
semantics require the human dependency audit and canonical dependency mapping.
Native/prose prerequisites need Done plus explicit verification evidence; In Review
is not completion. Missing/expired/stale evidence holds. Any matching existing PR,
including closed/merged, holds for reconciliation. Duplicate titles and open PR
file conflicts hold. Unknown/stale active ownership holds all conflicting approval
work conservatively. Active lease scopes and case-insensitive parent-directory
reservations remain exclusive; shared interfaces are also mutexes.

## Leases, restart and recovery

One exclusive host flock covers the full apply scan/reconciliation/mutation cycle.
`leases.json` is atomically replaced and fsynced, mode600; the directory is700.
A pending lease is durable before any label addition. A timeout can mean success:
restart first re-reads live labels. An observed approved label reconciles to active,
without adding again. A pending absent label may retry the same issue claim only
if its issue digest, complete operator-review digest, base, reserved scope,
readiness and capacity still pass. Pending leases cannot be reinterpreted with
new tests, acceptance, interfaces or scope on restart. API retries use an
idempotent add-label mutation, never replace the complete label list.

Leases never expire by time and no running task is interrupted. Existing labels
and active In Progress/Rework issues consume capacity even if they predate this
coordinator. Unknown ownership holds rather than stealing assignments. A missing
issue retains its reservation for operator reconciliation.

Capacity is released when the execution label is absent and the actual same-repo
issue branch has an open draft PR against the sprint base. Other status changes
alone do not release approval capacity. Merely mentioning an issue in an
unrelated/fork PR cannot release it. Open PR file/interface ownership still prevents conflicting work even after
approval capacity is released. If a label disappears without verified handoff,
the lease stays held. For explicit operator release, add the immutable issue UUID
and reason to `releases`; the label must already be absent. This does not stop a
worker or remove any remote label. Active issues still count against capacity.
Released leases prevent accidental automatic reapproval of the same issue;
rework requires separate operator reconciliation, not deleting lease history.

Do not delete leases, reset state or run independent coordinator hosts against
this queue. Corrupt/interrupted state and changed readiness between scans halt
approval. Correct the cause, refresh the operator review if needed, then rerun.
Other-host/external label writers are outside flock: only one trusted host should
own approvals. Multi-service reads cannot be transactional; apply re-scans all
services immediately before every additive mutation, but cannot prevent an
external write after that check. Stop and reconcile such races.

`cap` defaults to3 and can be lowered without revoking running work. Values above3
(up to12) additionally require `scaleApprovedBy` and `concurrentDraftProof` listing
at least three actual same-project, same-repo open draft PR numbers at the correct
base. This only adjusts reservation capacity; changing worker concurrency remains
an independent operator decision based on resource and publication evidence.

## Activation and controlled pilot

After explicit operator authorization and overlap reconciliation, set
`enableApprovals: true` and nonempty `overlapReconciledBy`, review only selected
issues, then invoke `--apply` instead of `--dry-run`. The command runs once and
exits; a supervised timer can invoke it every few minutes with no overlap (flock
serializes accidental overlap). Do not embed it in Codex hooks or change the
review label into Symphony's execution filter. No scheduler was installed here.

Live three-issue pilot (not executed):

1. Audit exactly three independent Todo issues, native/prose blockers, no existing
   PR/implementation, exact files/interfaces, clean base and runnable tests. Keep
   `cap: 3`, current worker concurrency1, and no other unreviewed approvals.
2. Run dry-run and inspect complete report; only the three intended issues may
   be proposed. Enable apply only after the operator accepts that report.
3. Apply once and restart once; verify three distinct leases and exactly those
   approval labels, with no duplicate claims. Existing hook initializes workpads.
4. Watch actual sandboxed execution and host draft publisher. After each label is
   parked and exact-branch draft verified, confirm released capacity; add a fourth
   independent reviewed candidate to prove replenishment without overlapping PRs.
5. Stop on any API/ownership/publication failure. Preserve leases/workspaces and
   receipts. Review CI/media/drafts manually. Do not merge/deploy as part of pilot.

Offline controlled pilot covers three approvals, restart/no duplicate, exact draft
handoff and replenishment of a fourth. It is not proof of real auth, remote schema,
service visibility, sandbox execution or draft publication. SHE-180's live pilot
criterion remains pending separate activation authorization.

```sh
HBL_TEST_CODEX_SANDBOX=0 PYTHONDONTWRITEBYTECODE=1 \
  python3 -m unittest discover -s tools/symphony/local -p 'test_*.py' -v
```

No browser behavior changes; browser tests are unnecessary for this coordinator.

## Three-repository GitHub intake

See [SOURCE_INTAKE.md](SOURCE_INTAKE.md) for the disabled-by-default SHE-252 extension, source inventory command, shared UI contract, routing, recovery and bounded pilot. Existing assignment/resource gates remain authoritative.
