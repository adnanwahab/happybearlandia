# SHE-180 / SHE-126 / SHE-127 reconciliation

User authorized packaging, live read-only audit and a controlled three-issue pilot
in this chat on November 11, 2026 (America/Chicago). This supersedes SHE-180's
implementation-only activation restriction for that bounded pilot. It does not
authorize marking incomplete issues Done, merging, deploying, disabling checks,
or recurring scheduling before the pilot passes.

## SHE-126: readiness checklist

| Requirement | Delivered artifact | Residual acceptance |
| --- | --- | --- |
| Source/open/merged PR duplicate audit | COORDINATOR.md trusted review contract; classifier existing-PR/title/ownership holds | Actual source/semantic duplicate review is human evidence, not inferred completion |
| Native and prose blockers | Services.scan; classify; dependency fixtures | Non-SHE aliases require operator canonical mapping |
| Isolated worktree/file/interface owner | Exact branch/base and scope evidence; case-insensitive path/interface mutexes | Each candidate needs a current clean-clone/ownership audit; unresolved external claims hold |
| Exact tests/evidence and acceptance | Fresh operator review fields and reviewDigest pinning | Ticket tests are data; authenticated host never executes model-supplied argv |
| Security/no production writes | Add-label-only service; never sandbox and publisher unchanged | No merge/deploy/CI bypass path added |
| Readiness and review handoff | REVIEW_LABEL versus APPROVAL_LABEL separation; exact-branch draft release | Legacy hbl-agent-ready is not the active execution gate |
| Rollback/removing readiness | Explicit lease release after label absence; runbook operator parking | Coordinator deliberately does not remove running approvals |
| Truthful pass/fail examples | Offline three-issue pilot plus captured real held-queue audit | Live three-issue end-to-end pilot not yet proven |

SHE-126 remains incomplete: its exact ops-branch documentation/PR acceptance and
human review are not silently replaced by this host runbook. No status change to
Done is justified solely by this mapping.

## SHE-127: read-only queue and duplicate report

| Requirement | Delivered artifact | Residual acceptance |
| --- | --- | --- |
| Read-only paginated labeled-issue queue | All-project paginated scan, review-label classification, Markdown/JSON reports | Real scan completed against175issues; snapshot is time-qualified |
| Matching GitHub work/conflicts | All17PRs and their file pages; linked/closed/merged/conflicting PR holds | GitHub Issue mirror matching is NOT implemented; retain as an explicit SHE-127 gap |
| Native/prose unmet dependencies | blockedBy, references, verifiedPrerequisites, specific hold reasons | Requires current human verification of aliases and completion |
| Dry-run never dispatches | CLI dry-run tests and live zero-mutation audit | No pilot approvals granted from an empty readiness manifest |
| No source/issue changes from dry-run | Live reports write only host-local artifacts | Report generation is separate from PR packaging writes |

SHE-127's native blocker SHE-126 remains intact. Neither issue is marked Done.
The shared coordinator tests/report are reusable evidence, not permission for a
second queue implementation or an automatic requeue.

## Live activation hold

The real scan succeeded:175project issues,17repository PRs,877Linear read requests,
158.9seconds, base f794ba25e89ee1db9c1ee3a6bdc562e404ca1965. No approval label was
present. Nevertheless30InProgress issues reserve capacity under the current
fail-closed policy, and several lack any exact ownership declaration. The clearest
example is SHE-5: empty description, a bootstrap-only workpad and no file scope.
A lack of live Symphony jobs does not prove these external claims are released.
Do not rewrite statuses, fabricate file ownership or override capacity to fill a
three-issue pilot. Full reports are host-private; the public hold summary excludes
raw comments and issue descriptions.

Three inspected potential quality tasks are NOT approved: SHE-59 and SHE-33 have
unverified prerequisite SHE-9 plus retained replay/neighborhood ownership, while
SHE-45 depends on unfinished SHE-42 and an authorized staging target. These are
concrete reasons to hold, not a claim that those are the only possible candidates.

Next: owners explicitly reconcile retained active claims, verify prerequisites,
and supply three current independent candidate reviews. Then re-run dry-run at the
fresh remote base before any additive approvals. Recurring scheduling remains
conditional on actual pilot evidence, not offline test success.


Actual CLI follow-up completed with exit0:175issues,21PRs, base 3fb9652f83d49e2d39d55aee7b31b6593f8c5849,
28reserved active issues, no selected candidates and no lease file. This is a newer
snapshot than the initial30-reservation service audit. A public per-issue summary
is docs/evidence/she-180-cli-live-holds.md; raw full JSON remains host-local mode600.
Fresh standalone44tests pass; broader installed-host93tests pass after adapter
extraction. Existing no-Done/no-bypass status remains. User authorization is
recorded; the remaining activation dependency is verified readiness/ownership.
