# Continuous Codex implementation pipeline (opt-in)

This folder adds a **real dispatch contract** for the experimental
[OpenAI Symphony](https://github.com/openai/symphony) service, a bounded
25-hour local process supervisor, and an idempotent GitHub Issues intake.
It is **not enabled automatically** when this PR is merged.

## Ownership and workflow

\`\`\`text
Product goal / approved demo backlog
           |
Planner: audit, deduplicate, verify contracts/dependencies
           |
GitHub Issues (hbl-agent-task; add hbl-agent-ready only when unblocked)
           |
Symphony dispatcher (continuous poll, retry, issue/workspace isolation)
           |
Up to N Codex app-server implementation workers (one issue per workspace)
           |
Distinct branches + PRs against sprint/one-city-two-futures-20261111
           |
Integration coordinator: independent tests, review, serial merge
           |
Verified sprint branch -> feedback -> next approved planning cycle
\`\`\`

**Who starts the implementation threads?** Symphony does. The planner does
NOT manually start Codex chats. Symphony polls GitHub Issues for open issues
with both \`hbl-agent-ready\` and \`hbl-coordinator-approved\` labels, starts Codex app-server processes in
isolated workspaces up to the configured concurrency, and reuses capacity as
issues finish. The worker must push a branch and hand off a PR, then remove
its ready label so the dispatcher does not repeatedly process a finished task.

**Important:** only **five first-wave tasks (R01-R05)** are currently tagged
by the intake script as eligible for automatic dispatch. Other READY rows
have follow-on dependencies or coordinator ownership and must be reviewed
before adding \`hbl-agent-ready\`. Worker *slots* cannot guarantee
productive workers. Never fabricate scope to fill idle slots.

## Current deliverables and limitations

- \`WORKFLOW.template.md\`: Symphony GitHub Issues adapter, scoped issue label,
  source checkout, single-worker prompt, isolated workspace, retry/stall limits.
- \`seed_ready_issues.py\`: dry-run backlog import by default; \`--apply\` is explicit.
  Uses GitHub Issues API and deduplicates by \`[HBL Rxx]\` title.
- \`run_25h.py\`: renders the workflow, performs preflight, supervises the
  Symphony process for at most 25 hours, restarts after crashes within a
  bounded retry budget, and stops children on SIGTERM/SIGINT. No launch
  occurs without \`--run\`.

**Not delivered:** 50 preapproved independent coding tasks, automatic
planning/replanning, automated PR reviewing/merging, an enforced token/cost
budget, distributed 50-worker capacity, or a verified unattended 25-hour
run. They require additional integrations and operational validation.

**Safety:** integration is a *separate* coordinator; workers do not merge
into the sprint branch, main, or deploy. No release merge/deployment is
authorized by this configuration. Network access is allowed in the Codex
workspace sandbox for tests and Git remote operations; use a disposable,
isolated trusted host, tightly scoped GitHub credentials, no production
secrets, and the default reject-all-approval-request policy. Symphony is
prototype software; review its security posture before unattended use.

## Prepare the host

A durable Linux VM or equivalent is preferable for overnight runs.
A sleeping MacBook cannot reliably execute a 25-hour local daemon.
Verify host resource capacity and provider limits before increasing concurrency.

Install Git, Python 3.10+, Bun, the Codex CLI, and authenticate Codex
interactively on that host. Install the Symphony reference runtime
*separately* from the HBL codebase:

\`\`\`bash
git clone https://github.com/openai/symphony /opt/symphony
cd /opt/symphony/elixir
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
\`\`\`

These commands follow the upstream experimental
[Elixir README](https://github.com/openai/symphony/blob/main/elixir/README.md).
Use an installed release binary instead if preferred; verify the binary
for your OS and architecture. Do not assume it is installed on this machine.

Run the following from a local checkout of the **HBL ops branch**, and
configure the host-side GitHub token through a secret manager. It needs
repository issue and PR access (and repository contents permission only if
you intend to push code). Do NOT add it to a committed file.

\`\`\`bash
export SYMPHONY_BIN=/opt/symphony/elixir/bin/symphony
export HBL_SYMPHONY_WORKSPACES="$HOME/.local/share/hbl-codex/workspaces"

# Inspect curated tasks without changing GitHub:
python3 ops/symphony/seed_ready_issues.py --ids R01 R02 R03 R04 R05

# Once GITHUB_TOKEN is available, import ONLY the audited first wave:
python3 ops/symphony/seed_ready_issues.py --apply \
  --ids R01 R02 R03 R04 R05 --dispatch-first-wave

# Dry run: validate rendered dispatcher settings; starts no Codex:
python3 ops/symphony/run_25h.py --workers 6

# Launch an opt-in 25-hour dispatcher with six maximum active workers:
python3 ops/symphony/run_25h.py --workers 6 --hours 25 \
  --symphony-bin "$SYMPHONY_BIN" --run
\`\`\`

The supervisor exposes a local Symphony dashboard on
\`http://127.0.0.1:43110/\` and writes logs to
\`~/.local/share/hbl-codex/logs/\`. Run it under tmux, systemd, launchd,
or a supervised service on a host that remains awake. The host and Codex
account must have enough capacity. In the first live run, verify one
issue completes a real Codex session and opens a correctly targeted PR.

## Safety ceiling and recovery

The launcher enforces at most six workers, including with the deprecated
`--ack-scale` option. Start with one. Increase only after measuring the existing
host resource checks and integration capacity. The supervisor bounds wall time
and restart count; it drains the entire old process group before a retry, even
when the dispatcher leader has crashed. Inspect remote workers separately.

Both tracker templates require **both** `hbl-agent-ready` and
`hbl-coordinator-approved`. Readiness alone is never execution approval. Only a
trusted coordinator/human may grant the latter after reviewing ownership and
prerequisites. Template worker commands remove tracker/GitHub environment tokens
and disable inherited shell environment, while keeping `approval_policy: never`.
These are environment boundaries, not a replacement for a dedicated host and
filesystem/secret-manager isolation. Never store credentials in workspaces.

This older launcher remains opt-in and is not the installed source-only pilot.
The current coordinator, resource holds, durable leases, failure reports and
source-only publisher are documented in
[`tools/symphony/local/README.md`](../../tools/symphony/local/README.md).
No live activation, release authority or 25-hour reliability claim follows from
these offline checks. A runtime must enforce required labels on initial and
retry dispatch before being used with these templates.

## Planning and integration operating contracts

**Planner (separate Codex thread):** read \`AGENTS.md\`,
\`docs/demo-backlog.md\`, \`docs/two-futures-sprint-status.md\`,
actual source and tests. Audit each candidate, resolve duplicate work,
name exact owner files/contract/dependencies, add measurable acceptance
criteria. Create one GitHub issue per approved implementation slice with
\`hbl-agent-task\`; add \`hbl-agent-ready\` *only* when all dependencies
are verified and the files/interfaces are exclusively owned. Do not
silently approve scope from the proposed NB-* list. Recheck every 10-30m
or when the ready queue drops below the desired worker count. Keep the
queue smaller than the demonstrated integration capacity.

**Integration (separate Codex thread):** continuously inspect worker PRs
against the sprint branch, independently verify acceptance, test evidence,
security changes, and CI. Rebase or request rework when necessary. Merge
into the **sprint integration branch only**, in dependency order and only
when its owner explicitly authorizes automated integration into that
branch. Never push to main, deploy, waive protection or call a failing
test passing. Record the merged SHA and update the status ledger.

Those two roles are described here as contracts, **not** launched
autonomous services. The first shipped vertical slice is durable
dispatch and worker management. Keep a human responsible for integration
until automated gating and recovery are tested.

## Troubleshooting and stopping

- No workers: ensure at least one open issue has both required approval labels;
  check that this label actually exists and the token can read the repo.
- Workers cannot push: configure least-privilege Git authentication on
  the isolated worker host; a GitHub Issues API token alone does not
  automatically configure \`git push\`.
- Repeated failures: check the Symphony log, native app-server runtime,
  local Codex login/quotas, sandbox network setup and repo test commands.
- Too much concurrency: interrupt the supervisor with Ctrl-C/SIGTERM.
  It terminates its Symphony process group; inspect any remote workers
  separately before declaring them stopped.
- Integration overloaded: remove \`hbl-agent-ready\` from queued issues
  or reduce concurrency in the next supervised run.

For production-level operation, consider persistent tracker-side leases,
deduplication across *multiple* dispatcher instances, distributed resource
quotas, CI-enforced merge gates, and audited budget monitoring. Do not run
multiple Symphony instances against the same issue labels unless
coordination is proven; local claims are not a distributed lock.
