---
tracker:
  kind: linear
  provider:
    api_key: $LINEAR_API_KEY
    project_slug: "hbl-1m-player-launch-week-1-da57f913e8aa"
  required_labels: ["hbl-agent-ready", "hbl-coordinator-approved", "symphony-pilot", "symphony-pressure-release"]
  active_states: [Todo, In Progress, Rework]
  terminal_states: [Closed, Cancelled, Canceled, Duplicate, Done]
polling:
  interval_ms: 10000
workspace:
  root: ~/code/symphony-source-only
hooks:
  timeout_ms: 600000
  after_create: |
    exec /bin/sh /Users/wahabma/happybearlandia/tools/symphony/local/isolated-checkout.sh
  before_run: |
    /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/check-host-auth.py || exit 1
    /bin/sh /Users/wahabma/happybearlandia/tools/symphony/local/check-isolation.sh || exit 1
    /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/prepare.py || exit 1
    exec /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/workpad.py before
  after_run: |
    /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/workpad.py after || exit 1
    exec /usr/bin/python3 /Users/wahabma/happybearlandia/tools/symphony/local/publish.py
agent:
  max_concurrent_agents: 1
  max_turns: 20
  max_retry_backoff_ms: 300000
codex:
  command: env -u LINEAR_API_KEY -u GH_TOKEN -u GITHUB_TOKEN -u GH_ENTERPRISE_TOKEN -u GITHUB_ENTERPRISE_TOKEN codex --config shell_environment_policy.inherit=none app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
    networkAccess: true
---

You are working on a Linear ticket `{{ issue.identifier }}`
This is an unattended orchestration session.
{% if attempt %}
Follow-up context: follow-up attempt #{{ attempt }}. Resume existing work; preserve commits and workpad.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}
Description: {{ issue.description }}

## Scope and preflight

Work only in the provided isolated repository. Read AGENTS.md, docs/design.md,
docs/implementation-plan.md and affected module instructions, source and tests.
The trusted host has initialized/reused the single `## Codex Workpad` before
this session and moved Todo to In Progress. Read `.hbl-handoff/workpad.md` for its
snapshot. A missing workpad is host initialization work, never an implementation
blocker. Do not run Linear mutations, MCP writes or host scripts from the sandbox.
To update the workpad, atomically write `.hbl-handoff/workpad.json` containing
`{"status":"progress","notes":"plan, owned files, acceptance, commands and actual results"}`.
Allowed statuses are progress, blocked and handoff; notes must be 1–40000 characters.
Keep current-session notes concise (prefer under12000 characters). Do not copy
the full host snapshot or earlier workpad into notes: the host already preserves
that history. Repeatedly copying it can exceed the update limit and block handoff.
Record new plan/results and references to retained evidence instead.
The trusted after_run hook updates the existing comment and parks blocked issues
by removing only symphony-pilot. Preserve earlier evidence in your notes. The host
refreshes comments on every update and preserves the original comment content.

Before implementation, verify all blocking dependencies are completed and record
exact owned files, interface owner, prerequisites, acceptance criteria and test
commands in the workpad. A label is operator approval of readiness, not a waiver
of unresolved dependencies or ambiguous file ownership. If either is unresolved,
follow the blocker path before editing. Do not launch subagents.

The host owns status transitions. For In Progress or Rework,
resume existing work and address all PR review feedback without resetting scope.
For any other state or a removed symphony-pilot, hbl-agent-ready or
hbl-coordinator-approved label, stop without changes.
If the existing branch PR is closed or merged, block for operator reconciliation;
do not discard work or create a replacement automatically.

## Required procedures (available without installed skills)

The required pull, launch-app and github-pr-media procedures are documented in
`/Users/wahabma/happybearlandia/tools/symphony/local/PROCEDURES.md`.
Read that file before work. These are executable manual fallbacks for absent
skills, with the same validation bar. Do not pretend a missing skill ran.
Record commands and actual outcomes in the workpad. Never waive ticket tests.

The trusted host has fetched and pinned the approved sprint baseline and created
`symphony/<identifier>` before your session. Read `.hbl-handoff/base.json` for
`baseCommit` and exact assigned files. Never use origin/main. Do not fetch, pull,
merge, switch branches, add, stage, commit, push, run gh or write `.git`: Codex's
workspace-write policy intentionally protects Git metadata even in a clone.
Read-only Git inspection is allowed. Preserve existing modified and ignored state.
If baseline/scope is wrong, write a bounded blocked workpad update and stop; do
not attempt Git permission fixes, custom permission profiles or host scripts.

## Implement and validate

Reproduce the issue first. Maintain plan, acceptance, validation, owned files and
blockers in the same workpad. Implement the smallest integrated slice. Run all
ticket-required tests and the repository checks applicable to changed files.
For app behavior changes execute launch-app and github-pr-media procedures,
including the affected normal entry point and failure path. Missing browsers,
media upload access, dependencies or failed tests are blockers, never a pass.
Review the final diff. Do not include credentials or unrelated changes.

## DRAFT PR handoff gate

After editing ONLY the assigned files and completing required tests, leave the
changes uncommitted. Write `.hbl-handoff/publish.json` atomically as JSON data:
- `version`: 2; `issue`: ticket identifier; `repository`: adnanwahab/happybearlandia
- `branch`: symphony/<identifier>; `base`: sprint/one-city-two-futures-20261111
- `baseCommit`: exact host-pinned SHA from `.hbl-handoff/base.json`
- `files`: sorted exact changed source paths, never directories or globs
- `fileHashes`: mapping of each path to SHA256 of its tested bytes; null for deletion
- `fileModes`: mapping of paths to tested Git mode 100644/100755, or null for deletion
- `artifacts`: optional list of assigned changed media paths; host verifies their
  uploaded blob and appends the actual host-commit URLs after push
- `body`: complete draft PR description with actual tests/results and limitations

Use Python's hashlib to hash the source directly. Do not stage files to discover
hashes. Never include `.hbl-handoff`, credentials, ignored data, or files outside
the host assignment. Source edits and tests must precede the hashes. Do not change
any source after creating the handoff without rerunning tests and replacing it.
Write a concise status `handoff` update to `.hbl-handoff/workpad.json` and end the
turn. The trusted after_run code validates the independent host allowlist and
baseline, preserves a source snapshot, stages and commits in host-private Git
storage, pushes only the issue branch, creates/reconciles a draft sprint PR and
links its real URL into the same Linear workpad. Worker index/HEAD remain untouched.

Missing host publication permission, stale base or network failure preserves the
handoff and source for host recovery; never start another implementation or retry
prohibited Git operations. Keep In Progress until the actual draft is linked and
an operator reviews it. Human merge/release gates are unchanged.
Never merge, enable auto-merge, mark a draft ready, deploy or modify protections.

## Blocker path

Only stop early for a true external blocker or unresolved readiness/validation.
For ANY blocker (including Git permissions, auth, missing tools/skills after
fallbacks, dependencies, ownership, tests, media or PR checks), keep the issue in
In Progress (or its current active state), update its existing workpad with what
failed, exact command/evidence, impact and operator action needed, and write status `blocked` in the local workpad update. The host removes
`symphony-pilot` from that issue. Do not remove other labels. This parks retries
until a human resolves the blocker and explicitly reapplies the pilot label.
Never move blocked or incomplete work to In Review, Human Review, Merging or Done.
If tracker access itself fails, stop and report the blocker; do not claim the
workpad or label was updated. Operator must park the issue before restarting.
Final message reports completed actions and blockers. Do not include "next steps for user".
