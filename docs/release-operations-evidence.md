# SHE-60 release-operations evidence

Baseline: `f1174eb9a5cead6892370d25af97167a0babb54b`, branch
`codex/she-60-release-operations`. Coordinator allocated this issue the four files
below after inspecting Linear history, active Symphony state, retained pipeline
claims and open PR file inventories (#2/#5/#6/#20/#21/#25/#26). No competing claim
was found on these paths. Shared release-checklist, server, CI and plan remain
coordinator-owned. Existing ownership declarations and production data are intact.

## Delivered increment

Existing probes, WAL-aware backups and schema-safe rollback guidance were reused.
Added explicit single-writer/no-canary policy, incident severity and commander/
operator roles, staging build/storage checks, rollback proposal gates, exact image
redeployment argv and recovery closeout. The new offline reviewer validates record
completeness and produces review-only argv. It cannot execute Fly commands.

Owned files:

- docs/release-operations.md
- ops/release-operations-dry-run.js
- test/release-operations-dry-run.test.js
- docs/release-operations-evidence.md

## Actual validation — 2026-11-11 America/Chicago

On Bun `1.4.2 (744846f84)` in the isolated issue clone:

- `bun test test/release-operations-dry-run.test.js test/release-health.test.js`:
  **13 passed, 0 failed, 69 assertions**. Existing readiness/storage failure paths
  remain covered. New tests exercise current Fly topology, missing/private/local
  staging evidence (normalized IPv4/IPv6 loopback, unspecified and .localhost names), wrong recovered build, inaccessible storage, mutable images,
  failed compatibility, missing approval malformed incident records and rejected execution requests.
- `bun --no-env-file ops/release-operations-dry-run.js`: exit 0; repository-config
  report has `problems: []`, `singleWriterRequired: true`, `canaryAllowed: false`,
  `productionVerified: false`.
- `git diff --check`: passed after documentation/tool review.
- No lint or typecheck script is defined in package.json. No browser/UI behavior
  changed; Playwright is not required for this doc/offline-review increment.
  The runbook retains the existing production-smoke gate for actual staging use.

Official Fly deploy/release documentation and local `flyctl deploy --help` were
used to inspect command syntax. Only local help was executed, not deployment.
Fly documents attached-volume and canary restrictions. This is a dry-run runbook
review, not an actual disaster-recovery rehearsal or release authorization.

## Remaining operational prerequisites

No approved staging environment or production-derived backup was supplied. The
coordinator's read-only GitHub environment list was empty, and Fly app inventory
had no approved HBL staging target. No live stage health/readiness, production
restore, feature rollout, actual rollback, secret/config change or deployment was
performed. All such actions remain separately authorized operational gates.

SHE-60's documentation acceptance is non-destructive dry-run review, which is
implemented and tested here; these remaining release gates must not be reported
as completed release experiments. SHE-203 consumes the checklist and remains a
separate future implementation. Publication and Linear status updates are handled
by the trusted coordinator; this worker used no remote write credentials.

## Current-base revalidation before publication

The initial results above remain historical evidence against sprint `f1174eb`.
The coordinator's publication freshness guard stopped before pushing when the
remote sprint advanced to `f794ba25e89ee1db9c1ee3a6bdc562e404ca1965`. The coordinator
merged that base losslessly into this issue branch at
`77ff0f84143f5c17aad9dc5f188d3d33fd050a1e`, preserving the original issue commits.
No issue-owned path conflicted with the manifest/replay and saved-World/browser
repairs contributed by their existing owners.

Revalidated that combined source with GitHub/Linear token environment variables
removed: `bun test test/release-operations-dry-run.test.js test/release-health.test.js`
passed **13 tests, 0 failures, 69 assertions** on Bun 1.4.2.
`bun --no-env-file ops/release-operations-dry-run.js` exited 0 with `problems: []`,
`singleWriterRequired: true`, `canaryAllowed: false`, `productionVerified: false`.
`git diff --check` passed. This repeats the issue's local acceptance against the
new base; it does not establish staging or production verification. Publication
remains exclusively the trusted coordinator's action.
