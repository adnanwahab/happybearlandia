# Advisory integration and repair queue

This is a separate queue from `tasks.json` and `state.json`. Coding completion,
repair completion, CI success, review, merge and product acceptance remain
separate states. No command in this slice merges, pushes, changes Linear, rewrites
worker tasks, dispatches a repair agent or claims a PR accepted.

## Read-only GitHub audit

Use an authenticated GitHub CLI with read access. Store the queue outside feature
branches; do not commit live PR inventories or local ownership state.

```sh
bun --no-env-file tools/symphony/mini-bun/audit-integration.ts \
  --repo adnanwahab/dear_congress --base main \
  --output /private/tmp/civic-integration-queue.json

# HBL checks must be explicitly confirmed for its sprint branch; no main-policy guess.
bun --no-env-file tools/symphony/mini-bun/audit-integration.ts \
  --repo adnanwahab/happybearlandia \
  --base sprint/one-city-two-futures-20261111 \
  --required-check 'EXACT VERIFIED CHECK NAME' \
  --output /private/tmp/hbl-integration-queue.json
```

Repeat `--required-check` for every required check. Dear Congress/main defaults
are `bun test`, `bun run typecheck`, `route smoke test`, from its documented policy.
These defaults are not evidence that GitHub branch protections are installed.
HBL has no guessed default. Audit the actual branch rules and workflow names
before configuring its check list.

The CLI completely paginates PRs/reviews/check runs, verifies the selected
repository/base and unchanged PR/base SHA around each observation, and reads
current-head check and status data. It refuses an incomplete/failed inventory and
preserves the previous queue. There are no GraphQL/REST mutations. If the API is
unavailable, a rerun is a new observation, not a new repair attempt. For status
inventories exceeding one 100-record combined-status page, it refuses incomplete
evidence rather than guessing. Scans and CLI reads are bounded.

Classification distinguishes conflicts, failed/pending/missing CI, unresolved
mergeability, policy holds, missing human review and candidates for human merge.
Only the newest check run per app/name counts; an old green run cannot conceal a
new failed run. A candidate for human merge requires all configured current-head
GitHub Actions checks, explicit `APPROVED`, independently verified human
maintainer approval on the current head, no outstanding change request, and clean
mergeability. Permission-query denial leaves approval unverified. This is an
advisory observation; the trusted integrator must recheck GitHub branch rules,
latest SHA/checks/reviews and required product acceptance immediately before a
human merge. The audit never grants merge authority.

## Durable repair ownership

Entries are keyed by repository, PR number and exact head SHA. History survives
repeated scans, closed/absent PRs and replacement heads. Classification considers
observations fresh for five minutes (configurable up to fifteen). Missing or
stale data cannot grant a repair. Default repair budget is two attempts per head,
with an explicit maximum of three. A new head creates a new budget and invalidates
any old lease with an ownership receipt; it is not acceptance of the old work.

`claimIntegrationRepair` and `finishIntegrationRepair` are pure coordinator APIs.
A trusted coordinator must serialize queue updates using the same local queue
lock, atomically persist the returned leased queue **before** launching a repair,
and stop/cancel an old worker after a head change or lost lease. Neither function
runs a worker. Every lease has an owner, unique token, exact head, start and expiry.
Finishing requires the same owner/token/head before expiry. Reused tokens and
stale worker results are rejected. A later complete scan can recover an expired
lease; the expired attempt still consumes its budget. A crash after a lease is
persisted cannot reset the retry count.

Code repair failure may use the remaining budget. Authentication, policy and
environment failures are held for the operator; increasing retries cannot fix
those conditions. A successful repair becomes `awaiting_verification`, never
accepted. Reinspect new source and fresh CI rather than treating a successful
worker process as a passing integration. Review-only/CI-pending/missing-check
states do not dispatch code repair.

`writeIntegrationAudit` uses an exclusive sibling `.lock` directory and an atomic
rename. It never breaks another owner's lock. If its process dies with a lock,
inspect `owner.json`, verify the process is gone and preserve the queue before
removing that stale lock manually. Automatic stale-lock stealing and automatic
repair execution are intentionally outside this bounded slice.

## Verification

```sh
bun test tools/symphony/mini-bun/integration-queue.test.ts
```

Tests cover current-head classifications, old-green/new-failed reruns, approval
absence/staleness/bots/permissions, duplicate/partial inventories, idempotence,
leased crash recovery, bounded failures, changed-head fencing, atomic-store
failure and normal CLI execution against a read-only GitHub fixture. No live
GitHub merge/protection or 25-hour reliability claim is made by these tests.
