# Release experiments (SHE-203)

This is a navigation experiment on one running application, not an image canary.
It routes one explicit entry path to existing control/candidate paths. Direct
candidate links are not gated: select a navigation change whose exposure is
bounded by this entry, and do not use this for security, data migration, or a
change to shared simulation rules. Keep one SQLite writer. Deployments and image
recovery still require the [release operations checklist](../../docs/release-operations.md).

## Private setup

Keep all inputs/history outside the served checkout, owned by the operator (0700
directory). Files created by the CLI are 0600. Filesystem access is the approval
trust boundary. Human names and approval references are operator assertions;
this system cannot authenticate a human or independently verify consent/reports.
Agents must never fabricate a human approval. A writable history can be altered
by its owner; retain independent backups for audit. One host reads the history;
do not distribute independent writable copies across servers.

Create a JSON spec with these fields (all evidence references point to private
records; never store player names):

```json
{
  "id": "navigation-v1", "seed": "assignment-v1",
  "candidateRevision": "exact-candidate-sha", "controlRevision": "exact-control-sha",
  "goNoGoEvidence": "private SHE-67 report reference",
  "selectionRationale": "Staff volunteers selected before outcomes",
  "consentRequired": true,
  "populationSize": 100, "maxTreatment": 2, "minPerArm": 2,
  "metric": "completed the normal journey (boolean)",
  "regressionThreshold": 0.2,
  "windowStart": "2026-11-12T00:00:00Z", "windowEnd": "2026-11-13T00:00:00Z",
  "entryPath": "/release-preview",
  "candidatePath": "/world/future-machine.html", "controlPath": "/world/",
  "participants": [
    {"id": "p1", "consentEvidence": "private receipt 1"},
    {"id": "p2", "consentEvidence": "private receipt 2"},
    {"id": "p3", "consentEvidence": "private receipt 3"},
    {"id": "p4", "consentEvidence": "private receipt 4"}
  ]
}
```

```sh
bun ops/release-experiments/cli.js create /private/experiment/history.json /private/experiment/spec.json
bun ops/release-experiments/cli.js status /private/experiment/history.json
```

Configure `HBL_RELEASE_EXPERIMENT_FILE` to that absolute history path and
`HBL_RELEASE_IDENTITY_SECRET` to a private random secret of at least 32 characters
on the serving host. With no history configured the application is unchanged.
A corrupt configured history returns 503 (fail closed). History is re-read per
request, so decisions take effect without restart. Keep it small; this is a
bounded private pilot, not a high-volume telemetry store.

A trusted operator provisions `hbl_release` cookies for invited participants
using the exported `participantCookie(experimentId, participantId, secret)` helper.
Provision via the host's trusted enrollment process; use Secure, HttpOnly,
SameSite=Lax, Path=/ and a lifetime bounded by the experiment window. This slice
has no public enrollment UI. Never accept an unsigned participant header or
put a secret in a URL. Consent must be collected before issuing a cookie. An
absent, forged or cross-experiment cookie receives control. The deterministic
SHA-256 ranking assigns up to maxTreatment eligible participants, at most 10%
of the declared population, leaving a control arm. It does not prove population
size or statistical representativeness. Rebuild a new experiment if consent is
withdrawn; stop distributing the entry until the updated roster is in place.

## Outcomes and decisions

Record exactly one observed outcome per assigned participant, including failures.
Do not silently discard missing outcomes. Both arms need minPerArm observations;
status exposes counts and missing arms, but does not impute absent outcomes.
Use the same written metric/window/source in both arms. Sources are supplied
by the operator; no automatic product telemetry or causal inference is claimed.

```json
{"participantId":"p1","success":false,"observedAt":"2026-11-12T01:00:00Z","evidence":"private journey log"}
```

```sh
bun ops/release-experiments/cli.js observe /private/experiment/history.json /private/experiment/outcome.json
```

Control success rate minus treatment success rate strictly greater than the
written threshold proposes rollback once both sample floors are met. Units are
absolute proportions (0.2 = 20 percentage points). The proposal persists even
if later results recover. It blocks promotion; it does not execute a rollback.
Notify the incident commander and use SHE-60 severity/containment procedures.
A human reviews the proposal and records a decision JSON:

```json
{"action":"rollback","proposalId":"navigation-v1:rollback","human":"release owner","approvalEvidence":"private signed approval","reason":"regression reviewed","decidedAt":"2026-11-13T01:00:00Z"}
```

```sh
bun ops/release-experiments/cli.js decide /private/experiment/history.json /private/experiment/decision.json
```

Approved rollback routes this entry to control; it does not undo data or roll back
an image. For those, use `ops/release-operations-dry-run.js` and SHE-60. After the
window closes, treatment expires to control pending a human decision. Promotion
uses `action: "promote"`, the same human/evidence/reason/date fields, and a current
`goNoGoEvidence` reference to the SHE-67 report (exact SHA, checks, regressions,
cost/performance, model limits and critical blockers). It requires sufficient
samples, no rollback proposal, and a closed window. For consent-required changes,
promotion still excludes people without consent in the roster; broader enrollment
requires a new reviewed roster/experiment. No automatic path reaches everyone.

The CLI locks mutations and atomically replaces replayable event history. A
crashed writer's lock requires operator review before removing the lock; never
run concurrent manual edits. There is no deployment command in this system.

Verification: `bun test test/release-experiments.test.js test/release-health.test.js test/release-operations-dry-run.test.js`.

Actual-server smoke (requires local listening permission):
`HBL_RELEASE_HTTP_TEST=1 bun test test/release-experiments.test.js`.
The restricted implementation environment refused the Bun listener with
EADDRINUSE on port 0; that smoke is opt-in and browser behavior remains unverified.
