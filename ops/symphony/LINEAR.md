# Linear → Symphony → Codex: HappyBearLandia

Target Linear project: **HBL — 1M Player Launch: Week 1** ([open project](https://linear.app/shel-bernstein/project/hbl-1m-player-launch-week-1-da57f913e8aa)).
Default project slug: `hbl-1m-player-launch-week-1-da57f913e8aa`.

This opt-in configuration dispatches from **one Linear project** using
`run_25h.py --tracker linear`. It does not start new sessions or make
issues ready unless explicitly run and labeled. A separate GitHub Issues
configuration is also supported; do not run both against overlapping work.

## Linear project setup

Create/select a Linear project and copy its URL. The final URL component is
its `project_slug`. Create a **team** label `hbl-agent-ready`.

The versioned Linear workflow uses:
- `tracker.kind: linear` with host-supplied `LINEAR_API_KEY`.
- `tracker.required_labels: [hbl-agent-ready]`.
- `tracker.active_states: [Todo, In Progress]` (NOT `Backlog`).
- `agent.max_concurrent_agents` rendered from `--workers`.
- Workspaces isolated under a separate `workspaces-linear` directory.
- Workers open PRs against the sprint integration branch, not main.
- No automated merge, production deploy, or production data modification.

**Why Todo instead of Backlog?** Symphony v0.0.3's Linear adapter explicitly
checks nonterminal native blockers for `Todo` issues. CSV dependency text
does not automatically become native Linear blocker relations. Audit every
candidate, link `blocked by` dependencies, verify a unique file owner and
acceptance tests, move eligible tasks from Backlog to Todo, and apply the
`hbl-agent-ready` label. Do **not** bulk-label unreviewed tickets.

## One-worker pilot and 20-worker operation

Stop any currently running GitHub Symphony supervisor (Ctrl+C) before
starting the Linear dispatcher; they use the same dashboard port.

Run from a local checkout containing the latest
`ops/symphony/run_25h.py` and `WORKFLOW.linear.template.md`:

```bash
export SYMPHONY_BIN="$HOME/.local/bin/symphony-v0.0.3-macos_arm64"
export HBL_LINEAR_PROJECT_SLUG="hbl-1m-player-launch-week-1-da57f913e8aa"
read -s LINEAR_API_KEY
export LINEAR_API_KEY
unset GITHUB_TOKEN

python3 ops/symphony/run_25h.py --tracker linear --workers 1 --hours 1 --run
```

Test a single approved Todo issue with label `hbl-agent-ready`.
Confirm it is picked up, creates an isolated workspace, and produces a
reviewable PR and test evidence.

When your host, Codex quota, issue dependencies and CI/integration capacity
are verified, launch up to 20 concurrent worker sessions:

```bash
python3 ops/symphony/run_25h.py --tracker linear --workers 20 --ack-scale --hours 25 --run
```

The 20-worker option sets **maximum concurrency**, not a target number of
occupied sessions. Only genuinely ready issues are dispatched. The same
supervisor retries the daemon after crashes within a bounded budget and
stops after 25 hours. It does not enforce a token/dollar budget or ensure
20 workers can run on one machine. Put actual provider-side limits in place
and monitor CPU, RAM, disk, rate limits and PR integration latency.

## Planning/integration loops

Symphony does not create good backlog tasks by itself and cannot safely
treat every backlog issue as independent. Maintain a planning/coordinator
loop that:
1. Audits actual source, open worktrees, overlapping issues and merged PRs.
2. Converts free-text dependencies into native `blocked by` relations.
3. Approves a bounded, conflict-free batch by moving to `Todo` and adding
   `hbl-agent-ready`.
4. Checks new PRs in `In Review`, requires real CI evidence, and integrates
   only after explicit approval into the sprint branch.
5. Marks verified issues Done, removes their dispatch labels, and promotes
   newly unblocked tasks. Never mark a historical GitHub mirror Done solely
   because a local status note says VERIFIED; check the actual branch/PR.

## Known security limits

The Symphony Elixir v0.0.3 binary requires the explicit
`--i-understand-that-this-will-be-running-without-the-usual-guardrails`
acknowledgment, passed by this supervisor. It is prototype software and
is **not** a security boundary. Use a trusted isolated developer host with
scoped credentials, no production secrets and guarded branches, and do not
let untrusted issue bodies override your worktree/security rules. The
repository `AGENTS.md` currently describes up to six delegated workers;
reconcile that policy and measure integration before moving to 20.

The Linear connection inside ChatGPT does not automatically authenticate
the local Symphony process. Use a host-only `LINEAR_API_KEY` from Linear
Settings → Account → Security & Access. Symphony's current adapter strips
the declared tracker token from Codex child environments; do not assume
other environment variables and host credentials are protected.
