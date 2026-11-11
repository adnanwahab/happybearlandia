# Bounded demo pipeline

Run from the repository root with Bun, Git and an authenticated `codex` on PATH:

```sh
bun scripts/demo-pipeline.mjs --dry-run
bun test test/demo-pipeline.test.js
bun scripts/demo-pipeline.mjs --duration-minutes 120 --max-workers 3 --base sprint/one-city-two-futures-20261111
```

The last command starts the requested two-hour budget. It was **not** run as a two-hour sprint during development. CLI guidance: https://learn.chatgpt.com/docs/non-interactive-mode . The installed `codex exec --help` and `codex sandbox --help` are the compatibility references. No SDK dependency is needed.

## Approval and ownership

`docs/demo-backlog.md` is authoritative for ID, priority, acceptance and source status. `tasks.json` supplies reviewed execution metadata only: exact relative file/directory reservations, interface mutex names, dependencies, kind (`feature` or `verification`), test argv arrays and browser argv arrays. The dispatcher rejects missing checks, omitted source dependencies, unknown task IDs, unsafe paths and unexpected metadata fields. It never converts existing RUNNING/REVIEW assignments into local ownership. Historical VERIFIED entries are BASELINE, **not** tests executed by this run.

The initial executable slice is approved U10: a dedicated receipt-history regression test, not a production UI edit. All other unfinished entries remain BLOCKED until a coordinator resolves their precise ownership and verification commands. Do not release existing assignments just because their manifest is old. Reserve shared interfaces explicitly even when files differ. All changes, including tests, must be inside reservations. Case-insensitive directory-prefix conflicts prevent overlapping claims. This policy detects commit-scope violations; file reservations are scheduling guards, not separate OS read restrictions.

Replenishment promotes approved UPCOMING rows automatically after verified prerequisites. To decompose an approved objective, add reviewed child rows with acceptance/dependencies to the backlog, then matching metadata. The tool deliberately does not ask a model to invent requirements or automatically approve its own decomposition. Cyclic/unmet dependencies remain queued. Changing approval/metadata during a live run stops dispatch for review. A new metadata version cannot silently reinterpret a resumed run.

## Execution and safety

One atomic repository-wide directory lock serializes coordinators across all worktrees. State resides in `<git-common-dir>/demo-pipeline/`; dry-run uses `.pipeline-dry-run/` and never creates Git worktrees, launches Codex, or changes real run state. Dry-run writes `docs/pipeline-status.md` and preview `status.json`, including the selected tasks. It demonstrates scheduler selection; tests also demonstrate actual conflict avoidance.

Execution creates one local `codex/pipeline-*` coordinating branch/worktree from the supplied base and separate worker branches/worktrees. The existing base checkout is untouched. A worker gets one bounded `codex exec`, workspace-write sandbox, denied approvals, disabled direct network, ignored user config, and no recursive agents. The environment passed to children omits service credentials. Model service connectivity/authentication still comes from Codex. Existing ignored dependencies are not copied into new worktrees: install or prepare local dependencies yourself if a task requires them. Do not enable unrestricted access to work around a missing dependency or OS sandbox failure.

Coordinator checks run through `codex sandbox` with workspace-write and network disabled; preflight must pass before launching a coding worker. Commands use argv, never shell interpolation. Test commands are reviewed local configuration and must not perform external writes. Sandbox support varies by CLI/platform; unsupported/nested sandboxing fails closed. There is no unsafe fallback. Local-only Git operations disable hooks. No push, deployment, main merge, infrastructure provisioning or production access is implemented.

Workers must create exactly one non-merge commit and report its full SHA, actual tests and evidence. Commit scope, clean worktree and report are checked. The coordinator independently runs configured unit/browser checks, serially cherry-picks with `-x`, then repeats checks against the integrated tree. Browser checks are mandatory when `userFacing` is true. Do not set it false for a UI change. Commit/test evidence is required for VERIFIED. Failure before integration permits at most two total attempts (fresh retained worktree per attempt); final-period failures block instead of spawning repair features. Integration conflicts or integrated regression failures stop dispatch and preserve the candidate for human repair. Failed branches/worktrees are never reset, removed or silently overwritten.

## Budget and recovery

Duration defaults to 120 minutes and cannot exceed 120; concurrency defaults to and is capped at three. The final 20 minutes prohibit feature dispatch, permitting approved verification work. Active tasks drain, task/browser checks and configured regression commands record evidence. If no approved eligible work remains, the tool finishes early rather than fabricating activity. Each worker is bounded by `workerTimeoutMinutes` (maximum 30) and the original absolute deadline; individual checks are capped at ten minutes and the deadline. At deadline or SIGINT/SIGTERM, owned process groups are killed and work is retained. Small Git metadata operations have a ten-second timeout; final persistence/OS termination can finish just beyond the wall-clock deadline. No new feature/agent command starts past it.

```sh
bun scripts/demo-pipeline.mjs --resume
```

Resume preserves the original deadline, attempts, completed work and ownership; it does not grant another two hours. Ordinary pending candidates can continue verification. If a previous coordinator died during RUNNING/VERIFYING/INTEGRATING, the entry becomes INTERRUPTED and keeps its reservation. Do not automatically steal a lease from an uncertain process. Inspect `owner.json`, saved PIDs/process groups, worker logs/reports, Git status/history and any cherry-pick state. After confirming the old coordinator **and every child** stopped, remove a stale `lock/` directory. Reconcile uncertain tasks in `state.json` explicitly: set PENDING_INTEGRATION only for a valid clean single commit with its existing `base`, `commit`, `worktree`, report and checks; set VERIFIED only after independently verifying the integrated commit/evidence; otherwise BLOCKED. Never delete worker changes. A crash between cherry-pick and persistence intentionally requires this review instead of replaying a potentially applied commit. To start a fresh budget, archive the entire state directory and retain its worktrees/branches after review.

## Status and evidence

`docs/pipeline-status.md` is the visible summary. Real `status.json` and `state.json` record active/ready/blocked/verified tasks, claimed owner, acceptance, files, attempts, timestamps, PID, actual process exits, last tests, integration SHA, elapsed wall time, next action and latest accepted task. Logs, per-attempt result JSON and final worker reports remain in the common state directory. The latest accepted task is a reported improvement, not an automatic assertion of visual quality; browser artifacts must be inspected for visual claims. Regression argv can include existing recording commands when locally supported and approved. Source backlog is never rewritten to imply completion; review integrated evidence before updating it.

## Development verification

`bun test test/demo-pipeline.test.js` covers selection, file/interface conflicts, dependency promotion, freeze, limits, atomic locking, exit/errors/deadline, actual Git worktrees/commit integration, resume, bounded repair and failed verification. Lifecycle fixtures simulate only the Codex executable and sandbox wrapper; they do not prove a model ran or the OS sandbox is available. Live checks must be reported separately. This change has no browser-facing behavior, so Playwright is not needed to verify the dispatcher itself.

Actual development results (2026-11-11): 11 dispatcher tests passed (53 assertions), existing story/data regressions 14 passed (82 assertions), repository dry-run selected U10. Native sandbox probe `codex sandbox -c 'sandbox_mode="workspace-write"' -c 'sandbox_workspace_write.network_access=false' -- bun --version` exited 71 with `sandbox-exec: sandbox_apply: Operation not permitted` in this chat. The common Git directory was also outside the chat's writable roots. No live model task or two-hour sprint was run. Run the bounded command on a host where both sandbox enforcement and local Git worktree writes work. Narrative/compound-only backlog references are surfaced as blocked records until normalized; they cannot authorize a dispatch by themselves. Machine-readable status is also written to `docs/pipeline-status.json`.
