# SHE-995 prerequisite — trusted draft publication policy

Isolated branch `codex/autopatch-publication-policy-20261117`, base Mini Symphony
#445 `aeccdb2f`. Bounded prerequisite for AutoPatch child issues SHE-991–996:
regular PRs remain the default; only a trusted project's `draftIssueIds` list
selects draft publication, including revisions of each original issue.

Owned files: Mini Bun `publication.ts`, `project.ts`, `run.ts`, focused publication
and project tests, module README and this review record. Shared plans, live profile,
queue/tasks, labels, processes and deployment are outside this change.

Acceptance: explicit draft creation, recovery never promotes configured drafts,
clean owned regular recovery downgrades, default regular behavior retained,
canonical profile validation and task identity validation, fresh same-repository
head/base guards, mutation failures/lost responses/post-mutation head races fail
closed without a publication receipt and retry idempotently. No fork or arbitrary
older PR conversion, no automatic merge policy changes. A merged PR is held when
it cannot meet the configured draft policy. Draft status is already a recognized
hold in `integration-queue.ts`; it is not acceptance or merge authorization.

API: `publicationOptionsForTask(project,task)` resolves `{draft:boolean}` from the
trusted profile; `publishDraft(...,onResult?,options={})` preserves its historical
name and defaults to regular. The runner passes resolved options and records mode
in publication telemetry; `--check` reports the effective trusted policy. Runtime
code cannot be installed merely by editing worker prompts. The profile is loaded
at startup; operator must review implementation/checks and restart safely through
existing procedures before dispatching affected children.

Verification in progress: initial recovery/policy checks47 passed229assertions;
actual configured normal-entry draft fixture passed1test20assertions, using an
isolated real Git origin with fake GitHub/Codex executables (no external PRs).
A broader sandboxed run passed60tests but failed the existing real screenshot
fixture because its browser/server setup lacked host permission. Permissioned
full rerun is pending; that failure has not been represented as passing.

No live profile/task/label/process change, no merge or deployment. Focused runtime
review PR will be regular; later AutoPatch implementation worker PRs use drafts
only after the reviewed policy is actually loaded by the coordinator.


Final checks: permissioned `bun test tools/symphony/mini-bun/project.test.ts
 tools/symphony/mini-bun/publication-policy.test.ts
 tools/symphony/mini-bun/recovery.test.ts` passed62tests,443assertions,zero failures
(38.57s), including the real screenshot fixture. The two pure policy cases were
then moved into existing `project.test.ts` so the established `test:mini-symphony`
command exercises them without package-script changes. Existing integration queue
hold regressions passed13tests,95assertions (201ms); no queue logic changed.
No further browser launch remains running from this worker.

Final focused cases after moving pure tests and adding wrong-mode create/recovery:
14 passed,83assertions,49 filtered by explicit name selection,zero failures.
This verifies a successful `--draft` creation response with an actually regular PR
still yields no receipt, then recovers by a guarded downgrade without recreation.
`git diff --check` passes. All comprehensive and focused checks are reported
separately; filtered cases are not counted as newly executed tests.

Rollout prerequisite: approved code plus effective `--check` policy must precede
queue dispatch. Adding the list does not scan or bulk-convert existing
`pr_created` tasks; only normal scoped publication/recovery reconciles a task's
PR. Existing terminal/review/task-state behavior remains unchanged.
