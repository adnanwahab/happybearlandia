# Three-repository source intake (SHE-252)

This extends `backlog_coordinator.Services`, the existing scheduler's guarded
`run_loop`, private assignments, isolated checkout and source-only publisher. It
creates no competing dispatcher. **Nothing in this PR installs or enables it.**
The observed host still uses the local Elixir WORKFLOW, two required approval
labels and max_concurrent_agents1. Do not infer that committed defaults are live.

## Baseline and ownership

Stacked on `codex/symphony-assignment-lifecycle` (926df82), the committed source
matching the installed assignment and trusted host-Git integration. PR42 (host
Git repair), PR43 (continuation/replenishment) and the active host were inspected.
Those changes have separate owners; this PR does not overwrite their live files,
update a loaded workflow, replace an assignment or modify the Civic UI checkout.
Resolve/merge that integration baseline before retargeting to the approved sprint.

The existing HBL project remains the single loaded runtime intake. Route proposed
Linear tickets for the three repos into that explicitly configured project/team.
A different project requires a separately reviewed runtime tracker configuration;
this code does not start another dispatcher or silently change the project slug.

## Read-only audit

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tools/symphony/local/backlog_coordinator.py \
  --source-inventory --json-report /private/operator-chosen/report.json
```

This makes paginated GitHub reads through the existing host gh authentication,
creates a temporary local database, reports every source disposition, and discards
the temporary state. It never creates a Linear ticket, comment, label, PR or agent.
All three repositories are exact constants in `repository_routes.ALLOWLIST`.
The initial executed report is `docs/evidence/she-252-source-inventory.json`.

## Host configuration (explicit operator step, not executed)

First preserve the installed runtime and existing assignments. Review this diff,
run tests, reconcile the source baseline, then copy only reviewed host modules.
Keep the existing labels, sandbox, worker count and resource gate. Configure a
mode600 `repository-routes.json` beside existing private assignments:

```json
{
  "version": 1,
  "enabled": false,
  "reviewedBy": "REPLACE WITH ACTUAL OPERATOR REVIEW",
  "repositories": {
    "adnanwahab/dear_congress": {
      "repository": "adnanwahab/dear_congress",
      "base": "REPLACE WITH VERIFIED APPROVED BRANCH"
    },
    "adnanwahab/digital_pensieve": {
      "repository": "adnanwahab/digital_pensieve",
      "base": "REPLACE WITH VERIFIED APPROVED BRANCH"
    }
  }
}
```

The original HBL route retains its approved sprint. Other repositories fail closed
until their private route is enabled. Issue bodies, comment markers, worker
handoffs, environment URLs and intake membership cannot supply this authority.
A private readiness review may include `repository` plus `source`:

```json
{
  "repository": "adnanwahab/dear_congress",
  "source": {
    "repositoryId": 1430459801,
    "issueId": 123,
    "number": 1,
    "revision": "REPLACE WITH EXACT CURRENT SHA256 FROM INTAKE"
  }
}
```

These are additions to ALL the existing required review fields: issueDigest,
baseSha, branch, exact files/interfaces, dependencies, audits, tests, acceptance,
reviewer and expiry. The coordinator scans target-repo PRs and approved branch
SHAs while retaining one global capacity/ownership ledger. Unknown route holds.
Admission still creates a host assignment with publishEnabled false. It does not
infer a review from source text or blanket-add labels. The host preflight and
publisher re-read an assigned source before model execution / publication; closed,
changed, wrong-ID and unverified sources hold without discarding work.

The isolated checkout derives its origin/base from that private assignment.
`prepare.py` writes the exact repository/base into `.hbl-handoff/base.json`.
When integrating the worker prompt, replace the HBL-only publication bullet with
“repository and base must equal the host-pinned values in base.json.” Read each
target repository's own AGENTS/README/tests; do not require HBL-only product paths
in other repositories. Do not change approval/pressure labels or sandbox policy.
This is an operator-reviewed configuration migration, not an edit to the running
host WORKFLOW by this implementation.

Enable observation in the EXISTING scheduler's private evidence JSON:

```json
{
  "sourceIntake": {
    "enabled": true,
    "maxOperations": 1,
    "pilotSources": [],
    "enableMirrors": false,
    "enableStatusDelivery": false,
    "repositories": {}
  }
}
```

This records local intake/revision/checkpoint/outbox state and the v1 UI projection
on normal scheduler reconciliations. Remote writes require `--apply` plus explicit
source controls. Public status reporting does not grant execution approvals and
can explain resource/assignment holds. There is no standalone agent launch path.
The SQLite store uses full synchronous commits and private file permissions. Keep
its database and lock together; never delete it to resolve an uncertain receipt.

## Verified webhooks

An existing trusted host ingress may call
`Store.webhook(raw_bytes, delivery_id, signature_256, secret, event)` before
acknowledging a delivery. Load the secret only on that host. It checks HMAC-SHA256
with constant-time comparison, event/action, payload bounds and exact repo;
it persists the delivery digest and source update atomically. Same delivery ID +
same digest is a no-op; changed content under a delivery ID is rejected. An older
event cannot replace a newer revision. PR records are excluded. The periodic full
scan repairs missed events and rechecks individually missing issues. No public
webhook listener or webhook registration was added/enabled in this PR.

## Recovery and statuses

The coordinator's existing approvals/assignments remain implementation authority.
Intake never interprets issue instructions as scope, commands or permission. It
proposes a Linear mirror using a persisted deterministic source UUID, reuses native
source links or existing mappings, and creates no execution labels. Source text
is included as explicitly untrusted context. Duplicate or incomplete mirror
inventories hold creation. Work remains visible as waiting with a specific cause.

Existing drafts are reconciled and no empty PR is fabricated. Published receipts
carry repository, issue, source revision and tested head SHA. A draft does not
close the source; a merged link still requires evidence/maintainer reconciliation
before claiming the requested implementation is complete. Contradictory/infeasible
assessments require an evidence link and feasible alternative and never close an
issue automatically. Generic failures are retryable waiting states, not infeasible.

Source claims serialize exact overlapping files in a repo and retain ownership
past wall-clock expiry. Expiry is not evidence that a model stopped. Explicit host
reconciliation with the prior owner/revision and stopped-process evidence is
required before reassignment. Normal dispatch uses existing private assignment
leases; the intake claim primitive is not a second launch authority.

Remote status delivery reserves a UUID, bot identity and creation intent before
posting. A separate file lock spans remote operations; SQLite commits the intent
before the request, so a hard exit cannot roll it back. Reconcile all comment
pages against BOTH stored mapping/nonce and authenticated bot ID. A copied marker
in somebody else's comment cannot authorize an edit. Uncertain creates with no
receipt are held, never blindly posted again. Receipt and delivered digest are
persisted; material changes edit the one verified comment. Body changes during
an uncertain request cannot reset the creation intent. Failed delivery is visible
in the UI projection; no notification is claimed before its receipt verifies.

Retries use bounded exponential backoff (300–3600seconds, max3), then require a
changed source condition or explicit operator reconciliation. No failed issue
consumes all implementation capacity. When source intake is enabled, eligible
reviewed tasks rotate among repos using durable admission history and oldest-first
ordering within a repo; no-vote issues remain eligible.

## Separately enabled live pilot — NOT RUN

1. Obtain operator approval for one real open implementation issue per repo;
   audit current source, existing PRs, exact files/dependencies/tests, base and
   resource/ownership evidence. The executed inventory found no open source
   issues in Dear Congress or Digital Pensieve, so no three-repo live pilot can
   be claimed from that inventory. Do not invent pilot issues without approval.
2. Set maxOperations1 (at most3 supported), provide at most3 immutable
   `github:<repoId>:<issueId>` pilotSources and explicit per-repo teamId/projectId.
   Independently enable mirror/status writes if intended; preserve all worker gates.
3. Use the one existing scheduler, retain concurrency1, and review the ordinary
   private readiness review/assignment for each proposed task. Install the reviewed
   prompt migration above before admitting a non-HBL worker.
4. Capture real source issue, Linear UUID, assignment, tested source hashes, draft
   PR/head SHA, bot comment ID/URL and receipt. Verify response-loss recovery via
   a restart, without starting another model for a finished handoff.
5. Stop on auth, resource, API, test or identity failures. Do not merge/deploy or
   mark the parent complete after only a partial implementation.

Rollback: disable sourceIntake.enabled, enableMirrors and enableStatusDelivery in
private policy, stop its normal scheduler cycle gracefully, retain all SQLite,
outbox, source clones, branches, leases and receipts. Do not remove running-worker
approval labels or forcibly reclaim a lease. Restore prior reviewed host modules
only after reconciling in-flight work. No app deployment rollback is involved.

References: https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks
and https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries.
