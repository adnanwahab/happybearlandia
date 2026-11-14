# Mini Symphony (Bun)

A local runner with bounded worker concurrency. Bun selects and records tasks; Codex edits each task's isolated Git worktree. It is independent of the Linear dispatcher in `../elixir`.

Requirements: Bun, Git, Codex CLI authenticated in this account, and a clean source commit to branch from. From this directory run:

```sh
bun run run.ts /absolute/path/to/happybearlandia
```

From the HappyBearLandia repository root, the same runner is available as `bun run symphony:mini`. Edit `tasks.json` while it runs to add tasks. Set `"enabled": true` to opt a task into execution; `false` keeps it in the imported backlog without dispatching it. Each enabled ID is attempted once. Results go to `state.json`; output goes to `logs/<ID>.log`; worktrees live in `workspaces/<ID>`. A zero Codex exit becomes `needs_review`, not an assertion that the change is correct. Review the worktree and tests yourself. New tasks fetch and begin from the current remote PR base; resumed worktrees preserve prior edits. Dependent tasks need earlier work integrated first.

After Codex exits successfully, the runner commits the task worktree, pushes its `mini/<ID>` branch, and opens a GitHub draft PR against the source repository's current branch. Set `MINI_SYMPHONY_PR_BASE` to override the target. State becomes `pr_created` on success or `publish_failed` on an auth, push, or PR error; publication errors are saved in the task state and log. On startup, pending `needs_review` and `publish_failed` items are retried. GitHub CLI authentication must be valid (`gh auth login -h github.com`).

Task states: `running`, `needs_review` (Codex exit 0, before publication), `publishing`, `pr_created`, `publish_failed`, `no_changes` (successful Codex run with no diff), `failed`, and `interrupted`. A task marked `retry: true` gets at most one attempt per runner session; it will not loop rapidly after a repeated failure.

When a same-repository `mini/SHE-<number>` or `mini/SHE-<number>-r<revision>` PR is merged, GitHub Actions links merged source evidence to the original Linear issue. Human acceptance review determines completion; merging alone never closes the issue. Add a Linear personal API key as the repository Actions secret `LINEAR_API_KEY`. The workflow ignores unmerged PRs and branches outside the Mini Symphony naming pattern.

Ctrl-C stops the current worker and records an interrupted attempt. Timeout defaults to one hour and can be changed with `MINI_SYMPHONY_TIMEOUT_MS`. The runner commits, pushes, and publishes draft PRs; it never merges or deploys. Remove an entry from state only after reviewing it if you intentionally want a new attempt; do not delete a worktree with unreviewed work.

### Remaining-queue recovery

Run `bun test tools/symphony/mini-bun/recovery.test.ts` from the repository root.
Publication now resumes after commit, push, PR creation, or an interrupted
`publishing` state. It checks for an existing matching PR before creation and
holds closed PRs or divergent local work for review. Disabled and terminal
Linear tasks are excluded from publication recovery and dispatch. `retry: true`
can explicitly retry `no_changes` once per session. Final Codex responses are
retained in `logs/<ID>.result.md`, including report-only outcomes and blockers.
Default concurrency is one; `MINI_SYMPHONY_WORKERS` accepts integers 1–10.

To refresh the queue, supply a complete snapshot containing `observedAt` (ISO
UTC within the last hour), `complete: true`, `issues` (full `id`, `title`,
`description`, `status`, `statusType`, `url`) and `pullRequests` (GitHub CLI
`headRefName`, `state`, `url`). Use fully paginated Linear project results and
GitHub `--state all`; retrieve full issue details rather than truncated lists.

```sh
bun tools/symphony/mini-bun/reconcile.ts snapshot.json
# Stop the runner, then persist the imported queue:
bun tools/symphony/mini-bun/reconcile.ts snapshot.json --write
```

The default prints a report without writing. Applying preserves unrelated tasks
and all worker state, imports full prompts, and disables the snapshot's tasks
pending triage. Enable only reviewed work with its dependencies integrated.
Merged PRs require acceptance review: a merged readiness report does not prove
that a feature was implemented. Human playtests and explicitly Claude-assigned
work retain external prerequisites. This command never closes Linear issues.
Do not replace the task queue while `.runner.lock/pid` exists.

If startup reports `No commits between ...`, the task branch may already be
contained in the remote sprint. The publisher fetches the latest base before
checking for changes, avoiding stale tracking-ref false positives. A clean task
with no ahead diff becomes `no_changes`; this does not mark Linear complete.

The waiting line reports **runnable** tasks separately from disabled tasks,
terminal Linear tasks and prior attempts. `enabled: true` does not rerun a task
with an existing result. New imports remain disabled until selected for work;
set their `enabled` to true to dispatch. For a reviewed prior `failed`,
`interrupted` or `no_changes` outcome, also set `retry: true`. Keep publication
failures for publication recovery rather than repeating model work.

### Explicitly approved follow-ups

An old `pr_created` or `no_changes` result is preserved as history. After reviewing
remaining work, `approveRemaining` creates an independent `SHE-N-r2` task and
worktree on the latest remote base, rather than deleting state or reopening a
merged branch. New follow-ups retain `issueId` and the original issue URL.
Open PRs and running/publishing tasks are preserved; absent/deleted issues are
disabled locally. Repeating activation before execution does not add duplicates.
Report-only tasks save a reviewable document under `docs/reviews/`.

With full approved issue details (including execution-approval note and both
ready/approved labels) and a fresh complete GitHub PR inventory:

```sh
bun tools/symphony/mini-bun/activate-approved.ts issues.json --prs prs.json
bun tools/symphony/mini-bun/activate-approved.ts issues.json --prs prs.json --write
```

Default is a dry-run. Explicit writing atomically replaces only `tasks.json`,
checks concurrent queue edits and relevant worker-state changes, and never
rewrites `state.json`. Use the complete remaining issue set: missing issues are
disabled. This is an explicit approval operation, not an unattended poll loop.
Follow-up merge synchronization maps `mini/SHE-N-r2` back to `SHE-N`; the updated
helper must be published before hosted Actions can use it. SHE182 owns that
publication integration. Required Actions secret setup remains a separate
operational prerequisite if it is absent; no hosted sync is claimed here.

### Dear Congress / separate project profiles

Dear Congress has an installed local profile for the Civic Synthesis board. From
`/Users/wahabma/Desktop/dear_congress`, run:

```sh
bun run symphony:mini:check
bun run symphony:mini
```

Its queue, state, logs, lock and worktrees are under Dear Congress's ignored
`.mini-symphony/` directory. Its base is `main` and its GitHub origin must match
`adnanwahab/dear_congress`. SHE249/SHE251 are linked to existing PR1 and held for
review; SHE252 is Done. No duplicate worker is launched just to fill the queue.
The HBL positional command and its existing task/state files remain supported.

The shared engine also accepts `--config profile.json [--check]`. A schemaVersion1
profile declares name, repository, githubRepository, linearProjectId,
linearProjectUrl, baseBranch and dataDirectory. Relative paths resolve from the
profile directory. Each task must carry the matching githubRepository and
linearProjectId. Repository origins, task scope and persisted project binding
are checked before dispatch; `--check` performs no state writes or model launch.
Locks identify any live owner PID, including bundled runners.

`import-linear.ts --config profile.json` performs a project-scoped, paginated,
full-description Linear scan and checks existing open PRs; default is dry-run.
It requires `LINEAR_API_KEY` via the environment and authenticated `gh`.
Add `--write` after stopping that project runner to atomically refresh task/state
files. The refresh holds incomplete dependency pages, preserves prior flags and
existing PR links, disables deleted/terminal work, and rejects concurrent state
changes. It does not create Linear issues, post comments, merge or deploy. This
is an explicit refresh, not continuous background polling.

The local Dear Congress package commands use `bun --no-env-file` to avoid
implicitly loading the app's environment file. The generated bundles can be
updated from this shared source without replacing profile/task/state files:

```sh
bun build tools/symphony/mini-bun/run.ts --target=bun --outfile /Users/wahabma/Desktop/dear_congress/.mini-symphony/runner.js
bun build tools/symphony/mini-bun/import-linear.ts --target=bun --outfile /Users/wahabma/Desktop/dear_congress/.mini-symphony/import-linear.js
```

Project workers also receive a filtered CLI/runtime environment, excluding app
DB, bot and Linear credentials even when a parent shell/package runner loaded
an environment file. The host retains its credentials for approved publication.

Project profiles can set `syncIntervalMs` (at least10000) and `heldIssues`
(issue-to-reason map). The runner then refreshes the project at startup and between
tasks using `LINEAR_API_KEY`; absent credentials are reported and local tasks still
run. The Dear Congress profile uses60000ms. Failed/overlapping refreshes preserve
local edits; the live runner retains ownership of state/claims. Duplicate workflow
states are terminal. Explicit holds persist across refreshes. The GraphQL scan
uses bounded20-issue pages, expands dependency pages separately, and guards cursor
cycles and source identity. An incomplete dependency scan holds only that issue.
Sync-owned dependency holds release when blockers clear; operator disables persist.
Profiles may set `prerequisiteIssueIds` to hold feature work until those issues are
completed. Dear Congress currently requires SHE-281 (deployed source recovery);
a merged analysis-only PR does not satisfy that prerequisite.
Existing processes must restart to load an updated bundle, but task-file imports
are picked up by the existing watcher without restarting a worker.

### Measuring25-hour sessions

The local HBL dashboard is `/mini-symphony`. Every instrumented coordinator start
gets a new session ID and writes `telemetry/sessions/<id>/session.log` (curated
text) plus matching `events.jsonl` (measurement records) under its own data root.
Heartbeats are15seconds; missing intervals over60seconds are uncredited. The
first chart separates uninterrupted runtime from actual worker-active time,
publication, waiting and unobserved intervals. Imported/reused PRs never count as
new session output. Existing raw task logs remain local and are not served.

See [the measurement contract](../../../docs/mini-symphony-observability.md) for
definitions, limitations, operator source configuration and log locations.
Restart an old runner after its current worker finishes to load instrumentation;
legacy state cannot establish a historical25-hour session. HBL's normal command
uses no hot reload so source edits do not accidentally restart a long experiment.

### Regression checks for reviewed follow-ups

`bun run test:mini-symphony` tests the shared source in this repository.
`follow-up.test.ts` exercises numeric revision selection independent of priority
ordering, preserves merged attempt receipts, suppresses duplicate open PRs,
checks explicit retry limits, and verifies real task-file refresh under changing
dependencies and failed scans. The importer refreshes the highest rN revision
and disables older family members. Per-task `executionInstruction` survives
Linear prompt refreshes. Fresh attempts use new IDs/worktrees; existing published
attempts cannot be restarted with `retry:true`.

### Optional port-conflict auto-debug

```sh
bun run symphony:mini --auto-debug
```

Off by default. Explicit `EADDRINUSE` or server-port-in-use output triggers at
most one additional Codex repair pass in the same worktree, even if the original
worker exits zero. Both passes share the original task timeout. Stop, timeout or
spawn failure cannot trigger another attempt. Other test failures are unchanged.

The pass diagnoses the failing command, repairs test port allocation/readiness/
cleanup where appropriate, reruns the failing test and required checks, and
reports passed or blocked. It is instructed never to kill processes, weaken tests,
change production or replay commands copied from logs. This first version has
no automatic process-killing facility. The normal worker sandbox still applies;
this is bounded agent assistance, not a deterministic test-verification service.

The append-only task transcript and original `<ID>.result.md` remain available.
The repair result is separate: `<ID>.autodebug.<session>.result.md`. Missing,
malformed or blocked repair reports hold publication as failed; a reported pass
still produces only a draft PR requiring review. Curated session logs expose
`auto_debug_started` / `auto_debug_finished` without copying private output.
`--check --auto-debug` displays the option without launching workers.
