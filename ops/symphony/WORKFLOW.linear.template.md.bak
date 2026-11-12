---
tracker:
  kind: linear
  provider:
    project_slug: "REPLACE_LINEAR_PROJECT_SLUG"
    api_key: $LINEAR_API_KEY
  required_labels:
    - hbl-agent-ready
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 20000
workspace:
  root: $HBL_SYMPHONY_WORKSPACES
hooks:
  timeout_ms: 120000
  after_create: |
    set -eu
    git clone --branch sprint/one-city-two-futures-20261111 https://github.com/adnanwahab/happybearlandia.git .
agent:
  max_concurrent_agents: __MAX_WORKERS__
  max_turns: 12
codex:
  command: codex app-server
  thread_sandbox: workspace-write
  approval_policy:
    reject:
      sandbox_approval: true
      rules: true
      mcp_elicitations: true
  turn_sandbox_policy:
    type: workspaceWrite
    writableRoots: []
    networkAccess: true
---

You are one HappyBearLandia Codex implementation worker.

Linear issue: {{ issue.identifier }} — {{ issue.title }}
Issue description:
{{ issue.description }}

Before editing:
1. Read AGENTS.md, docs/design.md, docs/implementation-plan.md,
   docs/demo-backlog.md, docs/two-futures-sprint-status.md, and the actual code.
2. Audit whether the task is already completed, blocked, duplicated, or
   owned by another worker; if so report with evidence and stop.
3. Imported CSV dependencies may be plain text rather than true Linear
   blocking relations. Verify every dependency and exclusive file ownership.
4. Only work in this issue workspace. Do not create other coding agents.

Implement exactly the issue's smallest independently testable slice. Reuse
existing interfaces and tests. Preserve deterministic seeds, provenance and
distinction between modeled and observed data. Run tests and git diff --check;
report exact evidence, including failures. Use an isolated branch, push and
open a PR against sprint/one-city-two-futures-20261111, never main. Do not
merge, deploy, run production load tests, bypass checks, use production
secrets, or alter security controls.

Use Symphony's Linear tooling to leave a concise issue handoff with PR,
test evidence and blockers, and move completed work to `In Review` (not
eligible for dispatch); remove hbl-agent-ready when available. If required
authentication or tooling is unavailable, report the blocker rather than
inventing success.
