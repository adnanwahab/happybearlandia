# Future Machine storage and release gate

Future Machine uses the existing City experiment API and SQLite manifests. Its share URLs carry both a saved experiment ID and a bounded versioned recipe; if a saved record is unavailable the page explicitly recomputes the recipe. Detailed monthly states are recomputed, not stored checkpoints. Baseline and plan remain in the saved experiment; a new proposal creates a new experiment.

The Fly configuration now points `HBL_CITY_DATA_DIR` to `/data/city-experiments` and `HBL_REALITY_SHARE_DB_PATH` to `/data/reality-shares.sqlite`. The latter is for the existing Reality Compiler share service; Future Machine recipes require no separate share database. Both paths are outside static roots. Do not deploy this configuration until existing `.hbl-city` and `.data/reality-shares.sqlite` have been inventoried and migrated under a stopped writer. This change does not migrate hosted data.

For a local or operator backup, stop the server and all SQLite writers first. Use a new destination outside storage:

```
bun scripts/backup-future-machine.js /path/to/city /path/to/reality-shares.sqlite /path/to/new-backup
```

The command checks SQLite integrity, snapshots each database with `VACUUM INTO` (including committed WAL contents), verifies the outputs, and writes `backup.json`. It never overwrites a backup. Per-file snapshots are SQLite-consistent; a cross-file consistent backup requires stopped writers. A failed backup can leave an incomplete new directory; discard that directory and retry with a fresh destination.

Restore with writers stopped: copy `backup/city` to a new private City directory and `backup/reality-shares.sqlite` to a new private share path, point the environment variables to those paths, then start the server. Check the original experiment status, replay, and a share read before traffic returns. Keep the previous storage untouched for rollback. Restrict backup permissions and keep copies off the single database-owning Machine.

Local acceptance is covered by `bun test test/future-machine-storage.test.js`: 120 finance records, immutable initial manifest, CityStore close/reopen, SQLite export integrity, share close/reopen and restored backup. Remaining release gates: actual mounted volume and free space, stopped-writer migration, off-host backup/restore rehearsal, capacity and rate controls appropriate to public traffic, and explicit deployment approval. No production deployment or production data change was performed.

### City save compatibility

New City experiment manifests carry `saveFormatVersion:1` independently of the
simulation `version`. `world/city/save-format.js` defines the v0 (unversioned)
to v1 migration. Migration adds metadata only, on a clone at read time, and
returns a receipt in experiment GET and replay responses. It does not rewrite
either persisted manifest copy or any run evidence. Unknown future or malformed
format versions are rejected. Add a tested migration before incrementing the
format version; model/rules upgrades retain their separate version gate.

Replay now compares every stored final run metric to recomputed metrics. Success
includes `verification:{status:'matched',scope:'final-metrics',differences:[]}`.
A difference or missing outcome evidence returns HTTP409 with an explicit error
and verification report; callers cannot display that replay as verified. This
checks final metrics only, not intermediate events or full-state equivalence.
Migration receipts explicitly state that recorded outcomes are unchanged. These
contracts apply to monthly City experiments, not other simulation save stores.
