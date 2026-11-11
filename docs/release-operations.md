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
