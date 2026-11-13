# Dear Congress feedback intake: held, host-only adapter

This bounded slice receives signed public feedback, verifies its exact canonical
GitHub bot comment, and durably records a truthful `received` receipt. It adds no
Symphony dispatcher. The current single worker, dual dispatch labels, assignments,
readiness, pressure gate, publisher and WORKFLOW remain untouched. PR #41's draft
improvement inbox is explicitly held/unmerged and is not imported or depended on.

No receiver, scheduler, credentials, reverse proxy or live Linear writes were
installed or exercised. Live intake/task linking remains **blocked on operator
configuration, current ownership review and a controlled service-schema test**.
An offline passing test does not establish production acceptance.

The next integrated slice requires operator review of canonical bot identity and
repository, actual Linear project/team/Backlog IDs, existing PR/task ownership and
host authentication. Acceptance is one signed canonical feedback record, one
verified proposed Backlog task or approved existing-task link, retry without a
duplicate, and no dispatch/status/assignment change. An operator must verify live
GraphQL field/input support and project `slugId` before enabling mutations; unknown
schema/auth/service outcomes hold locally, never claim task-linked.

## Wire contract v1

Source: Dear Congress `src/shared/hbl-governance.ts`; source SHA-256 at implementation:
`ef4d2c30e22cd2a4cb60d9016001a3d04876ade83e1ad67cddddca7d8db18892`.
The exact copied `FeedbackEnvelope` contract is:

```typescript
interface FeedbackEnvelope {
  contract: 'hbl-governance.v1';
  repository: 'adnanwahab/happybearlandia';
  repositoryId: number;
  feedbackId: string;
  number: number;
  version: string;
  headSha: string;
  base: string;
  commentId: number;
  commentUrl: string;
  alias: string;
  text: string;
  choice: 'yes' | 'no' | null;
  createdAt: number;
}
```

Repository ID is pinned to `1364565814`; `version` must be
`repositoryId:number:headSha:base`, with a 40-hex head. Extra fields are rejected.
Created time is Unix milliseconds. `POST /feedback` accepts at most 65536 bytes.
`X-HBL-Timestamp` is current Unix **milliseconds**, with at most five minutes skew.
`X-HBL-Signature` is `sha256=` followed by hex HMAC-SHA256 over the exact timestamp,
a period and exact raw request bytes. This matches Dear Congress `outbox.ts`, not
the separate batch-worker protocol. Keep TLS at the operator's trusted proxy.

Receipt JSON is exactly `{contract, feedbackId, status:'received'|'task-linked',
taskUrl?}`. `received` means durable verified receipt only, including when task
creation is held or awaiting retry. It does not claim actual Linear intake.
`task-linked` requires a verified same-project issue and exact feedback comment.
No credentials, tracker IDs or arbitrary provider response bodies enter receipts.

Signature validity alone is insufficient. Every request, including replay, reads
the pinned GitHub repository, PR issue and comment. Its numeric author must equal
host-configured bot ID, author type must be Bot, issue/PR/comment IDs and URLs must
match, created/updated timestamps must be equal, and the complete comment body
must exactly match the signed immutable envelope using DC's canonical formatter.
A pasted marker, edited comment, human-authored lookalike or changed same-ID
envelope is rejected. Fresh, identical redelivery is idempotent; stale signatures
are rejected. Authenticated feedback remains inert text, never a command.

## Disabled configuration and operator activation

All settings come from the trusted host environment, never a model workpad or
feedback. Do not provide any of these credentials to a Symphony worker.

| Setting | Purpose |
| --- | --- |
| `HBL_INTAKE_ENABLED=true` | Explicitly permit receiving; default off |
| `HBL_INTAKE_SECRET` | Shared DC delivery HMAC secret |
| `HBL_BOT_USER_ID` | Independently verified canonical numeric GitHub bot ID |
| `GH_TOKEN` | Optional host read credential for canonical GitHub verification |
| `HBL_INTAKE_PROPOSE_TASKS=true` | Permit proposed task/comment mutations; default off |
| `HBL_INTAKE_APPROVED_BY` | Actual operator approval reference; never invent one |
| `HBL_INTAKE_PROJECT_ID` | Actual verified HBL project UUID |
| `HBL_INTAKE_TEAM_ID` | Actual project team UUID |
| `HBL_INTAKE_BACKLOG_STATE_ID` | Actual same-team Backlog state UUID |
| `HBL_INTAKE_ACTIVE_TASKS` | Optional JSON mapping PR-number strings to existing verified issue UUIDs |
| `LINEAR_API_KEY` | Existing trusted host transport credential |

The expected project's slug is the actual current WORKFLOW project,
`hbl-1m-player-launch-week-1-da57f913e8aa`; its canonical `slugId` suffix is verified
against the configured UUID. Project membership and same-team state type `backlog`
are re-read before mutations. Do not guess IDs or default to Todo/In Progress.
An operator must audit active PR task mapping before authorizing new proposal
creation. Configure known active PR tasks to receive comments on those existing
same-project issues; no competing implementation issue is spawned for a mapping.
No dispatch label, assignment, agent/worker, promotion, approval, merge or deploy
operation exists in this adapter. Created tasks have only explicit Backlog,
project/team, title and description. Existing tasks retain their state.

Run only after review, from the repository (examples contain no credentials):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 ops/governance/intake.py
PYTHONDONTWRITEBYTECODE=1 python3 ops/governance/intake.py --drain
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops/governance -p 'test_*.py' -v
```

The listener binds only `127.0.0.1:8769`. `--port` changes the port; `--state`
selects a host-private directory (default
`~/.local/state/hbl-publisher/governance-intake`). The directory must be700 and
files600, regular, owned by the host and not symlink/hardlink targets. Keep this
state outside every model-writable checkout. The synchronous receiver and
one-shot `--drain` use a common flock; do not deploy independent hosts/databases.
No recurring job is installed; an operator may invoke bounded drain through their
existing host supervision after ownership review. HTTP access logs are suppressed.

## Durable grouping and recovery

SQLite stores exact envelopes/digests, receipt state, receipt cursors, groups,
retry count, due time and holding reason. Public action text is NFKC normalized,
case-folded and whitespace collapsed **within one PR** to group equivalent
feedback. Distinct actions or PRs stay distinct; no semantic-equivalence claim is
made. Every feedback record receives its own source comment on the shared task.

Client UUIDv4 issue and comment identities are generated once and committed in
the group/feedback records before any create. These stable stored identities
match Linear's documented UUIDv4 input requirement. Retry first reads those
same remote IDs and verifies project, stable group marker and exact comment body.
Ambiguous HTTP completion retains `received` and retries through the same stable
identities after bounded backoff; it never invents a replacement UUID. The existing
`coordinator_host.linear` transport is reused with a single attempt so mutations
are reconciled explicitly. Remote deletion, conflicting content, missing mappings,
unknown permissions or schema errors hold without dispatch. Preserve the DB and
holding reason; do not delete state to force another issue.

Offline tests cover default-off/no mutations, forged/expired signatures, bot
forgery, replay/conflict, normalized grouping, existing-task routing, ambiguous
create reconciliation, wrong-project holding and private file modes. No browser
behavior changed; browser tests are unnecessary. Full host/production integration
remains unverified. This README records this slice's plan/status instead of editing
the shared implementation plan or coordinator-owned files.

Schema reference checked during implementation: [Linear official GraphQL schema](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql). Live host schema/auth remains a separate unverified activation gate.
