# Player-voted patches + supervised agent factory

## Player-facing routes

- GET /vote-on-patch: accessible ballot and suggestion form.
- GET /api/patch-votes: current daily/weekly options, scores and your browser's vote.
- POST /api/patch-votes/:id/vote: JSON body {"value":1}, {"value":-1} or {"value":0} to withdraw.
- POST /api/patch-votes/suggestions: JSON body {"title":"...", "details":"..."}.

This code is a proposed feature branch, NOT a live deployment or an automatically running fleet. The current sprint owns six ongoing Codex workers. Do not interrupt or duplicate those assignments.

## Safety and governance

Only maintainer-curated candidates in ops/patch-voting/candidates.js can be exported as executable agent tasks. They reference existing U-series tasks in docs/demo-backlog.md. Raw player suggestions stay pending in private SQLite and cannot be promoted into a runnable prompt automatically. A maintainer first writes a bounded task with acceptance criteria, file ownership, dependencies and tests.

An eligible voted task must have a CLOSED ballot, at least five upvotes and at least three net votes. The coordinator separately certifies each prerequisite in ops/agent-factory/verified.json after real integrated verification. The initial verified list is deliberately empty.

One vote per browser cookie is an advisory anti-abuse mechanism, NOT proof of a unique human. Cookies can be reset. A large public rollout needs accounts or robust bot controls, edge rate limiting, moderation, auditing, and retention policy. The server enforces same-origin POST requests, small JSON limits, signed HttpOnly cookies and basic per-cookie throttling, but not strong Sybil resistance.

All work occurs on isolated worktree branches. The dispatcher checks allowed paths, focused tests and git diff integrity, then asks Claude/Gemini for optional advisory review. It never auto-merges or deploys. External-review output is untrusted and cannot override integration gates.

## Prepare the game server

On your private server, set:

    HBL_PATCH_VOTE_SECRET=<long random secret>
    HBL_PATCH_VOTE_DB_PATH=/your-private-persistent-volume/patch-votes.sqlite

Do not commit secrets, and do not put the database under the publicly served data/, world/, tools/ or game/ directories. Without a secret, the ballot remains read-only.

SQLite needs one durable shared store with correct filesystem permissions. A horizontally scaled deployment should move the vote store to a centralized database before public scale. This feature does not provision a volume or deploy the game.

Daily ballot entries close 24 hours after first seeding; weekly entries close seven days after first seeding. To start a new round, add reviewed candidates with NEW stable IDs. Updating an existing candidate title does not reset old votes.

## Private queue exporter

On the host with the SAME private voting database and current checkout:

    bun test test/patch-voting.test.js test/patch-queue.test.js
    bun ops/patch-voting/export-queue.mjs

The exporter writes .hbl-private/dispatch/ready.json with READY vetted tasks and reasons for exclusions. It never runs an agent itself.

Private suggestions can be read with createPatchVotingStore().listSuggestions() from ops/patch-voting/api.js on a trusted host. Do not expose unreviewed text to a coding model directly.

## Optional dispatcher

Use a SEPARATE trusted host/container rather than the game server. Install Bun, git and authenticated Codex CLI. Claude Code and Gemini CLI are used for independent reviews when present. The gh CLI is optional for draft PR creation. Provision narrow, separate credentials and cost budgets on this host.

    bun ops/agent-factory/dispatcher.mjs
    HBL_AGENT_MAX_WORKERS=6 bun ops/agent-factory/dispatcher.mjs --execute --loop

The default first command is DRY RUN. A single persistent dispatcher process with --loop polls the signed vote database and coordinator verification manifest every minute. It maintains private job state and a lock to prevent competing local dispatchers, with no automatic retries on failure. A blocked task's worktree and log stay available for review. Remove a stale lock only after verifying no dispatcher process is alive.

For opt-in draft PR creation, add --draft-prs. The PR remains a draft and must pass independent integration/browser tests and human release approval. If reviewers are unavailable, jobs block; --no-reviewers deliberately bypasses advisory model reviews but does not bypass integration gates.

Experimental maximum of 50 workers:

    HBL_AGENT_EXPERIMENTAL_50=1 HBL_AGENT_MAX_WORKERS=50 HBL_AGENT_DAILY_JOB_CAP=100 bun ops/agent-factory/dispatcher.mjs --execute --loop

That is a CONFIGURABLE CEILING, not 50 launched agents. The repository's AGENTS.md currently limits parallel agents to six. Do not enable higher concurrency until the maintainer revises that limit, provisions isolated machines/containers, applies provider rate/cost limits, and measures CI/integration throughput. Many concurrent rendering tests on one machine will contend for CPU/GPU resources.

## Continuous release loop

Player playtests → votes/suggestions → moderation → approved ballot → closed poll → verified dependencies → READY queue → isolated Codex worktree → targeted tests → independent Claude/Gemini review → optional draft PR → integration/browser CI → approved release → player feedback.

Measure first-run success, demo completion, share rate, replay correctness, crashes, memory, FPS, review backlog, failed jobs and verified merges per hour. Prioritize the existing One City, Two Futures flagship.

## Not implemented / operational limitations

- No agent runtimes or API credentials were provisioned. No dispatcher has been started.
- No deployment, merge, auto-release, or live operational dashboard.
- No authenticated human voting, robust fraud mitigation, moderation UI, distributed queue, or remote fleet provisioning.
- Recovery after abrupt dispatcher death is manual; state and logs preserve the evidence. Treat this as a pilot before multi-day unsupervised use.
- Running tests needs a Bun environment and installed repository dependencies. This conversation's GitHub connector can write and inspect files but cannot boot the game's browser runtime.
