# Release operations

This release exposes `/api/health`, `/api/ready`, and the [Simulation Health dashboard](/tools/simulation-health/). Liveness answers whether the HTTP process can respond. Readiness checks the required World and causal SQLite tables and read/write access to the Decision Studio directory. A readiness failure returns 503. Probes use local storage and cache their result for two seconds. They leave saved records unchanged.

## Before a release

- Record the current image/build, Git revision, database schema compatibility, mount layout, and the operator responsible for rollback.
- Confirm the existing World and Decision stores resolve to the persistent volume. Keep the single-writer topology. See [the SQLite Fly deployment checklist](sqlite-fly-deployment.md).
- Run `bun ops/release-health.js` against the configured stores inside the deployment environment before allowing the release to serve. The app repeats the SQLite compatibility check before its existing startup migrations. An empty World file or a recognized legacy World-only schema can initialize. An unrecognized schema or newer causal migration fails closed. This bounded preflight reads schema metadata and cannot establish full file integrity.
- Supply the build’s public commit revision as `HBL_BUILD_ID` at build time. The endpoint accepts a 7–64-character hexadecimal ID. It reports `unknown` for production images missing a valid ID.
- Verify a new independent backup by restoring it to an isolated directory. A disk snapshot or a passing readiness check alone does not verify restore.

## Backup and restore drill

- Identify the actual database file and Decision Studio directory on the existing Machine. Record the observed schema and storage locations privately. The earlier audit may not reflect current Machine or volume state.
- Quiesce writes before taking a coordinated backup of both stores. Use SQLite’s `.backup` or `VACUUM INTO` to a new destination for the SQLite database. Keep the source file, WAL, and shared-memory sidecars together while backing up. Use `bun scripts/backup-decision-store.js <new-destination> <source-directory>` for the Decision Studio snapshots.
- Include any separately configured City Lab, journal, or other authoritative stores in the release inventory. Back up or explicitly account for those separately. The two required readiness checks cover World and Decision storage.
- Check the copied database using `PRAGMA quick_check;` and verify the result is `ok`. Record archive checksums, file sizes, timestamps, and access controls. Retain a verified copy outside the serving Machine.
- Restore to new paths, point an isolated server at the restored World and Decision stores, and verify both readiness and representative saved-record reads. Verify the exact revision can open the restored schemas.

## Measure and verify

Run `bun ops/measure-release.js http://127.0.0.1:3000 20` for a sequential HTTP smoke measurement. It reports status counts, body sizes, and nearest-rank p50/p95 response times. These are client-observed timings for four read-only routes. Record the origin, build, hardware, cold versus warm conditions, and sample count when comparing releases.

Confirm `/api/health` and `/api/ready` both report the expected build. Open the main entry point and dashboard, then read representative World and Decision records. Treat unexpected responses, a changed build ID, or an inaccessible store as release blockers.

## Rollback

Keep the previous image and verified pre-release backup available until the new build passes verification. Before switching builds, pause writes and run the previous image’s compatibility check against an isolated copy of the current data. If compatible, roll back the image and verify both probes and saved-record reads before reopening writes. If compatibility fails, restore the verified pre-release copy to fresh paths while preserving the current data and WAL for recovery. Account for writes after the backup before redirecting traffic. Record the observed readiness, build, and data verification results.

## Release scope and ownership (SHE-60)

SHE-60 owns this runbook, its offline dry-run reviewer and issue-specific evidence.
The release coordinator retains `docs/release-checklist.md`, shared plan/status,
`server.js`, Fly configuration, CI and production authority. Existing storage
preflight, backup/restore and smoke procedures above remain authoritative; this
section supplies the previously missing incident and image-recovery decisions.
The baseline is sprint `f1174eb9a5cead6892370d25af97167a0babb54b`.

## Flags and canary policy

There is no general release feature-flag, percentage rollout or release experiment
system implemented by this runbook. Do not invent an environment variable to
suppress writes or declare a canary successful. Existing simulation switches are
model inputs, not release kill switches: changing them would change the result.
If a feature already has a documented flag, record its real name, current value,
owner, rollback value and tested behavior privately before using it. Otherwise
contain the incident through the operator's approved maintenance procedure or a
compatible image rollback. SHE-203 owns any future release experiment system.

The checked-in Fly topology mounts `hbl_data` at `/data` and requires one database
writer. Do not choose Fly `canary` or `bluegreen`, add a second writer, or claim
zero downtime. Fly canary deployments are incompatible with attached volumes;
independent volumes do not replicate. Use an explicitly approved staging app
with separate storage for rehearsal and the existing `--ha=false` convention for
a separately authorized production release. Keep health checks enabled. Do not
use `--strategy immediate`, skip checks or set an unsupported auto-rollback flag.
See [Fly deployment strategies](https://docs.fly.io/launch/deploy) and
[Fly volume constraints](https://docs.fly.io/volumes/overview).

## Incident checklist and severity

These are operational decision thresholds, not performance measurements or an
automated rollback system. Before a release, the incident commander and operator
must accept or tighten them for the candidate and record the monitoring window.

| Severity | Trigger | Required response |
| --- | --- | --- |
| SEV1 | Suspected lost/corrupt saved data, wrong volume, schema corruption, secret exposure or cross-user data access | Halt release immediately; contain affected access/writes using the approved maintenance process; preserve logs/current data; incident commander and storage/security owner decide recovery. Never automatically restore over the serving data. |
| SEV2 | Three consecutive `/api/ready` failures at 30-second intervals after the 15-second startup grace, wrong build ID, repeated startup failure, or an acceptance-critical normal journey cannot complete | Stop promotion, notify commander/operator, compare known-good behavior and prepare a rollback proposal. A data-integrity signal escalates to SEV1 without waiting for the sampling window. |
| SEV3 | Isolated non-critical regression with healthy stores and a verified workaround | Record impact, owner and next update; stop broader promotion; choose bounded fix versus rollback with the human release owner. |

- [ ] Open an incident record: severity, first observed time/timezone, affected
  routes, actual expected/observed build IDs, previous/current image digests,
  scope of affected writes and saved-record IDs (private), assigned commander,
  rollback operator, storage owner, communications owner and next update time.
- [ ] Preserve bounded, scrubbed logs and the current data/WAL. Avoid copying
  secrets or player data into GitHub/Linear. Record evidence references privately.
- [ ] Confirm the actual Machine, mount, disk capacity and schema. Do not trust
  historical Machine/volume/image IDs in the November 10 checklist.
- [ ] Establish and verify write quiescence before a coordinated recovery point.
  The app has no generic maintenance-mode flag; if writes cannot be safely
  quiesced, stop and obtain an operator-approved containment method rather than
  pretending a flag exists.
- [ ] Commander proposes recovery; a human release owner explicitly approves the
  target image/config, compatibility evidence, expected interruption and handling
  of writes since the backup. No automation or agent approves its own rollback.

## Approved staging health checklist

No staging app is authorized by this document. An operator must supply its app,
origin, candidate digest/build, separate storage and permitted test actions.
Never substitute `happybearlandia.fly.dev` or localhost and call it staging.
Local fixtures are useful, but remain labeled local evidence.

Before allowing traffic or rehearsing recovery on that approved target:

- [ ] Restore independent copies at its configured paths; verify SQLite
  `PRAGMA quick_check` and Decision snapshot checksums; keep the original backup
  immutable. Include City/share and other authoritative stores in the inventory.
- [ ] Run `bun ops/release-health.js` inside that target with its actual configured
  stores. Require exit 0. This is bounded compatibility/access inspection, not a
  full integrity or backup attestation.
- [ ] Read `/api/health` and `/api/ready`, at least three times 30 seconds apart
  after the startup grace. Require HTTP 200, expected build ID, liveness `ok`,
  readiness `ready`, `worldStorage=ok` and `decisionStorage=ok`. Spacing exceeds
  the probe's two-second cache TTL. Check errors as well as body text.

  ```sh
  # Read-only example, only after an approved staging origin is supplied.
  curl --fail --silent --show-error "${HBL_STAGE_ORIGIN:?}/api/health"
  curl --fail --silent --show-error "${HBL_STAGE_ORIGIN:?}/api/ready"
  HBL_SMOKE_URL="${HBL_STAGE_ORIGIN:?}" HBL_SMOKE_BUILD_ID="${HBL_EXPECTED_BUILD:?}" \
    bunx playwright test --config test/production-smoke.config.js
  ```

- [ ] Read a known saved World record and Decision snapshot and verify their
  recorded provenance/seed/model against the manifest. Reopen the same records
  after an authorized staging restart. Any synthetic scenario remains labeled.
- [ ] Separately test the **old image** with its matching config against an
  isolated copy of the **current migrated schema**. Run compatibility inspection,
  both probes and representative record reads. Document pass or failure.
- [ ] Record origin, image digest/build, exact commands, times, readiness bodies,
  smoke results, sample record checksums and restore duration. A failure or an
  unavailable browser remains an unmet gate, never a waived test.

## Image rollback proposal and authorized execution

Read-only discovery commands, on the trusted operator host:

```sh
flyctl status --app happybearlandia --json
flyctl volumes list --app happybearlandia --json
flyctl releases --app happybearlandia --image
```

Record a known-good immutable `registry.fly.io/happybearlandia@sha256:<digest>`
and its public build ID from the actual release record. Do not automatically
choose “the previous array entry,” use a mutable tag, or reuse a historical
digest without revalidation. Image selection does not revert secrets, `fly.toml`
or database migrations. Review the prior configuration separately, including
mounts, process command and environment. Preserve the current config as evidence.

First perform the offline record review described below. This prints a proposal
only. If the old image cannot read the current schema, **do not run image-only
rollback**. Use the backup/restore drill above with authorized fresh recovery
paths, preserve the failing data and reconcile post-backup writes with the
storage owner before redirecting traffic.

Only after explicit human approval and the complete staging/compatibility gates,
the rollback operator may run the following **mutating** command. It is documented
here, not executed by this task:

```sh
flyctl deploy --app happybearlandia \
  --config "${HBL_PREVIOUS_REVIEWED_CONFIG:?}" \
  --image "${HBL_PREVIOUS_IMAGE_DIGEST:?}" --ha=false --strategy rolling
```

`HBL_PREVIOUS_REVIEWED_CONFIG` is a privately retained, reviewed Fly config for
that image with the correct app/mounts. These shell names are operator inputs,
not application feature flags. Recheck the single-writer topology and exact image
before executing. Plan for downtime; do not create/delete/reattach volumes or
alter secrets as an implicit part of image rollback. Official command references:
[fly deploy](https://docs.fly.io/flyctl/cmd/fly_deploy) and
[fly releases](https://docs.fly.io/flyctl/cmd/fly_releases).

## Recovery verification and closeout

- [ ] Confirm actual serving image, matching config, Machine and `/data` mount;
  exactly one writer; no new migration/read errors. Repeat health/readiness
  sampling with the **recovered** build ID, not the failed candidate's ID.
- [ ] Verify known saved records, lineage/checkpoint hashes and model versions;
  reconcile every accepted write since the selected recovery point. Probe success
  alone never proves no data loss.
- [ ] Run read-only production smoke with the recovered build only after its
  operator authorizes that verification. Production test saves, restarts and
  restore writes need separate explicit authorization.
- [ ] Human release owner reopens writes/traffic after storage and journey checks;
  observe the agreed monitoring window. Retain the failed image/data and verified
  backup; do not delete evidence to “clean up” the incident.
- [ ] Commander records the timeline, impact, recovery point, actual results,
  unresolved loss/uncertainty, customer communication and follow-up owner. Close
  only after verification, not merely because `fly deploy` returned success.

## Offline runbook dry run

`bun --no-env-file ops/release-operations-dry-run.js` inspects checked-in Fly
mount/path/readiness conventions only. It never contacts Fly or probes stores.
For an incident, use `--record <private-record.json>` to review an operator record.
The JSON must include strings `incidentId`, `incidentCommander`, `rollbackOperator`,
`humanApproval`, `previousConfig`, `backupEvidence`, `restoreEvidence`,
`savedRecordEvidence`, `writeReconciliation`, `mountEvidence`, `stagingEvidence`
and `compatibilityEvidence`; plus `previousImage`, `previousBuild`, `severity`,
`writesQuiesced`, `singleWriterConfirmed`, `oldImageReadsCurrentSchema`,
`evidenceScope: "approved-staging"`, distinct HTTPS `stagingOrigin`, and the
captured `stagingReady` response. Use private evidence references, not secrets or
player data. `previousConfig` names the reviewed config; its content and the
truth of all record assertions require independent human inspection.

The tool fails closed for missing evidence, incompatible schemas, wrong builds,
unavailable storage and local/production origins presented as staging. It never
executes a command; even `RECORD_COMPLETE_FOR_HUMAN_REVIEW` means only that fields
are complete. It neither verifies their truth nor grants approval. No `--execute`
mode exists. See [SHE-60 validation evidence](release-operations-evidence.md).

## Bounded navigation experiments (SHE-203)

The [release experiment operator guide](../ops/release-experiments/README.md)
documents the implemented private CLI, signed selected-participant routing,
control comparison, written threshold proposals and explicit human decisions.
This is a same-process navigation gate, not a Fly image canary or maintenance
switch. It does not relax the single-writer, backup, incident or SHE-67 go/no-go
gates above. No candidate image is automatically deployed or promoted.
