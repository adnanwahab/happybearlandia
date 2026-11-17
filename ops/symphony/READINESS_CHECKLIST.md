# Symphony issue readiness and dispatch review

Use this checklist for one bounded issue before dispatch and again at PR handoff.
Record reviewer, UTC timestamp, issue UUID/identifier, source SHA, report location,
and a PASS or HOLD with concrete evidence for every gate. Missing, stale,
contradictory or inaccessible evidence means HOLD; a queue label is not approval.
This document grants no execution, publication, merge or deployment permission.

## Authority and version boundary

Read [AGENTS.md](../../AGENTS.md), [product design](../../docs/design.md),
[implementation plan](../../docs/implementation-plan.md), affected module docs
and any nearer instructions. Reuse the classifier and evidence schema in
[COORDINATOR.md](../../tools/symphony/local/COORDINATOR.md), the
[reconciliation](../../docs/symphony-coordinator-reconciliation.md), and
[source-only procedures](../../tools/symphony/local/PROCEDURES.md).
Do not create another dispatcher, classifier, lease store or approval service.

The checked-in [WORKFLOW](../../tools/symphony/elixir/WORKFLOW.md) uses Linear,
active states Todo / In Progress / Rework, concurrency 1, and requires BOTH
`symphony-pilot` and `symphony-pressure-release`. `hbl-symphony-queue` is a
candidate label; legacy `hbl-agent-ready` is not this dispatcher's permission.
The older [ops README](README.md) describes a separate opt-in GitHub adapter;
its templates and scaling instructions do not authorize the current Linear host.
`ops/symphony/LINEAR.md` is absent here; do not invent that local dependency.

Verify the actual host workflow path, runtime revision, hooks, workspace root,
filters, worker count, resource hold and runtime owner before approving. Source
is evidence of repository configuration, not proof of installed configuration.
For example, this checkout says max_turns 1 while historical installed-host
reports describe 20. Never copy a historical setting over the runtime owner's
configuration. SHE-126's November 12 issue records a resource hold and removal
of pilot approval; only fresh operator evidence can clear that hold.

## Review record and gates

| Gate | PASS evidence required | HOLD / rejection evidence |
| --- | --- | --- |
| 1. Scope and target | Observable acceptance, smallest integrated slice, exact allowed paths, normal entry point and explicit exclusions; current design/source audit | Invented path/API, unbounded work, incompatible contract or unauthorized release scope |
| 2. Existing implementation | Search actual source/tests and all open, closed and merged PRs by issue ID, aliases, title, behavior and changed files; record search time/base, relevant PR URLs/SHAs and semantic conclusion | Existing implementation, native duplicate, matching PR or overlapping work without reconciliation; title search alone is insufficient |
| 3. Dependencies | Read native blockedBy plus full description/comments/attachments; map prose aliases and non-SHE names to canonical issue IDs; record dependencies explicitly, even [] | Missing alias mapping, unverified prerequisite, inaccessible inventory or contradictory completion claim |
| 4. Prerequisite completion | For every prerequisite: Done AND concrete merged/source/test evidence at the reviewed base; inspect inverse relations too | In Review, closed PR without delivery proof, missing commit, or prose blocker absent from native relations |
| 5. Isolation and ownership | Exact absolute clone path, repository, issue branch, full approved base SHA, independent metadata and clean-start evidence; exact file/directory reservations, shared-interface owner, active/retained assignments and leases audited | Shared metadata, unknown external claim, stale base, overlapping parent directory/interface, retained missing-issue claim or abandoned-looking workspace without owner release |
| 6. Verification | Exact runnable argv, cwd, prerequisites and expected observable assertions; later attach actual exit/results, source hashes and evidence locations | Guessed script, unrun test described as passing, skipped failure path, stale evidence or model-generated argv executed by credentialed coordinator |
| 7. Safety and product contracts | workspace-write/never, protected Git metadata, host-private credentials/policies; preserve privacy, accessibility, deterministic provenance and applicable release gates | Request to expose credentials, widen sandbox, change CI/protections, deploy, merge or alter production data without separate explicit authorization |
| 8. Dispatch authority | Current trusted review bound to issue digest/base/scope, unexpired operator evidence, complete fresh scan, capacity/resource clearance and explicit operator approval | Candidate/legacy labels alone; missing pressure release; unknown active ownership; stale/incomplete scan; unresolved hold |
| 9. Integration handoff | Hash-matched tested source, host receipt and one real same-repository exact-branch draft against approved sprint; checks and independent reviewer recorded | Local JSON mistaken for a PR, wrong base/head, duplicate/non-draft/closed PR, failed checks or missing receipt |

For gate 2, start with read-only `rg` searches of discovered source paths and
`git log --all --oneline`; local refs alone cannot prove remote PR absence.
The host scanner paginates repository PRs and their files; a human must still
review semantic overlap. GitHub Issue mirror matching remains a documented
SHE-127 gap. A historical reconciliation snapshot is not a fresh inventory.

For gates 3–5, retain claims from active jobs, external workers, open PRs and
missing issues. Status changes, idle dashboards and age do not release ownership.
Case-insensitive directory reservations and shared interfaces are exclusive.
Shared interfaces need one coordinator owner; separate workers must not each
invent changes to the same contract.

For gate 6, capture failures and skips honestly. UI changes require the normal
route, relevant failure paths, accessibility checks and inspected browser/media
evidence as applicable. Simulation changes require model/rules versions, source
or synthetic assumptions, seed/inputs, identity/time mapping and replay/invariant
checks. Documentation-only work needs path/command/link audit and whitespace
verification; it does not require browser media or simulation tests.

## Exact clone and trusted evidence

For a newly approved source-only worker, the host prepares an independent clone
under `~/code/symphony-source-only`, branch `symphony/SHE-<number>`, base
`sprint/one-city-two-futures-20261111`. Record the resolved absolute clone path
and full base SHA; never substitute main or guess the path from an issue title.
Read `.hbl-handoff/base.json` for the actual assignment. Host operators use the
existing isolation/preparation procedures; workers do not run host hooks.

Read-only worker inspection from the assigned clone:

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git diff --check
```

Compare these results with host base/assignment evidence. Dirty retained work
must be reconciled, not reset or cleaned. A different branch or missing assignment
is a publication/readiness hold, not permission to switch branches or write Git.

Use the exact review fields documented in COORDINATOR.md and the
[example manifest](../../tools/symphony/local/coordinator-readiness.example.json).
Reviews are keyed by immutable Linear UUID and pin issueDigest, baseSha, branch,
reviewer/expiry, dependency/duplicate/ownership audits, clean-base evidence,
files/interfaces, tests/testEvidence and acceptance. The host-private evidence
must be a direct mode0600 regular file in its mode0700 coordinator directory,
not a worker-authored policy or attachment. The separate host assignment owns
publication scope and publishEnabled; it does not grant dispatch.

## Read-only audit and truthful examples

These commands are source-verified interfaces, not a claim of live execution.
From the repository root, help needs no credentials:

```sh
python3 tools/symphony/local/backlog_coordinator.py --help
```

Only the trusted operator host, with its existing private evidence and host auth,
may run the following read-only service scan. The report options write local
files containing sensitive issue/comment data; keep the output directory private.
The path below assumes the operator already prepared that directory per the
coordinator runbook. Do not copy credentials or raw reports into a worker clone.

```sh
python3 tools/symphony/local/backlog_coordinator.py --dry-run \
  --evidence "$HOME/.local/state/hbl-publisher/backlog-coordinator/readiness.json" \
  --json-report "$HOME/.local/state/hbl-publisher/backlog-coordinator/audit.json" \
  --report "$HOME/.local/state/hbl-publisher/backlog-coordinator/audit.md"
```

Dry-run is default, requires --evidence, starts no workers, grants no labels and
creates no lease directory. Inspect exit status, complete inventory, base/digest,
per-issue reasons, selected list and retained leases. Report files are deliberate
local writes. Never run --apply from the sandbox. Installed CLI/report behavior
has changed across revisions (including the historical PR31 packaging fix);
verify installed --help and revision against this source before relying on it.

The following are synthetic expected outcomes, not observed live approvals:

| Example inputs | Expected classifier evidence | Reviewer decision |
| --- | --- | --- |
| One Todo issue, empty native/prose prerequisites after alias audit, implementation absent in source/all PRs, exclusive files/interfaces, clean exact branch/base, fresh trusted review and available capacity | Issue row has eligible true and reasons []; selected contains only that identifier | Source readiness PASS. Dispatch remains HOLD until runtime owner separately clears resource/pressure gate and authorizes pilot approval; dry-run itself changes nothing |
| Prerequisite SHE-126 is In Progress even though native blockers were accidentally omitted; prose references it | reasons includes prerequisite SHE-126: completion/verification missing; candidate absent from selected | HOLD; repair dependency evidence through its owner, do not suppress prose references |
| A merged PR already implements the issue, or an open PR owns its files | reasons includes existing PR/merged/closed implementation requires reconciliation or open conflicting PR | HOLD for semantic reconciliation, reuse delivered work rather than spawn a duplicate |
| Empty reviews or unknown active ownership; no live worker visible | missing operator review evidence or unknown active ownership reason; affected candidates not selected | HOLD; idle runtime is not ownership clearance |

Exact reason strings can gain detail across versions. Inspect the complete row;
an empty selected list and exit0 can mean a successful scan of a held queue.
An offline regression command for the reused classifier is:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s tools/symphony/local -p 'test_backlog_coordinator.py' -v
```

Passing fixtures prove modeled behavior, not host credentials, live prerequisites,
resource clearance or actual publication.

## Dispatch, PR review and safe parking

1. After all gates pass, the operator records explicit approval. New work starts
   Todo; the trusted hook transitions to In Progress. Existing In Progress/Rework
   resumes the same owned work. Review labels and legacy ready labels are not
   substitutes for the current pilot AND pressure-release filters. Never add a
   pressure-release label to bypass the runtime owner's hold or raise concurrency
   to match the approval reservation cap.
2. Worker edits/tests assigned source only. Follow PROCEDURES.md for atomic
   `.hbl-handoff/workpad.json` and version2 `publish.json`: exact issue/repository/
   branch/base/baseCommit, sorted files, SHA256 fileHashes, fileModes, optional
   assigned artifacts and complete PR body with actual tests/limitations. Keep
   notes concise; no self-authored host policy, credentials or Git writes.
3. Host validates the independent assignment and tested hashes, snapshots/commits
   privately, and publishes/reconciles one draft. Reviewer checks real URL, exact
   head SHA/base, source hashes, host published receipt, Linear link and required
   CI at that head. Local handoff creation is not publication success. Retest
   changed bytes and refresh handoff if source or baseline changes.
4. Integration coordinator independently reviews acceptance and checks, resolves
   dependencies and scope, then hands off for separately authorized sprint
   integration. Record reviewed/merged SHA only when it exists. Keep incomplete
   or unpublished work active; do not mark Done from an offline test. No main
   merge, auto-merge, deployment, protection bypass or production changes here.
5. On unexpected access, destructive request, test failure or stale ownership,
   stop new work and write a bounded blocked workpad with exact evidence and
   operator action. Trusted hook parks by removing only symphony-pilot; verify
   removal rather than claim success if transport fails. Preserve source,
   snapshots, pending handoff and history. Do not interrupt active jobs or delete
   leases/workspaces to manufacture capacity.
6. For an operator-approved lease release, first verify execution label absence
   and no active worker, then record immutable UUID plus reason in releases per
   COORDINATOR.md. Missing label alone does not free a lease without verified
   exact draft handoff or explicit release. Open PR scope remains reserved;
   released history prevents accidental reapproval. Publication errors require
   host recovery of retained output, not a second implementation session.

## SHE-126 delivery boundary

This slice owns only this file. Existing README/templates, workflows, application,
CI, shared implementation plan and release settings remain coordinator-owned.
The issue's latest scope selects the actual sprint rather than inactive PR20.
Acceptance evidence must include a relative-link/path audit, source/CLI command
review and `git diff --check`; no live scan, approval, dispatch or PR is implied.
A local checkout with a different branch or no host assignment can produce a
reviewable document, but cannot claim a valid Symphony publication handoff.
