# Deploying SQLite on Fly

The app stores experiments and automatic household checkpoints in the same SQLite database. `fly.toml` mounts `hbl_data` at `/data` and sets `HBL_WORLD_DB_PATH=/data/world-experiments.sqlite`. The entire directory is mounted so SQLite WAL and shared-memory files share the persistent disk. Local `.data/` databases are excluded from the Docker image.

On Fly, startup verifies that the configured database resides on a separate writable block-device mount. Missing mounts, image filesystems, temporary filesystems, and symlinks escaping the mount fail before database creation. Local development continues using `.data/world-experiments.sqlite`.

## Existing deployment audit, 2026-11-03

Read-only `fly status --json` and `fly volumes list --json` found two stopped app Machines in dfw and **zero volumes**. That deployment does not yet provide durable SQLite storage. Local configuration validation passed; provisioning and deployment have not been performed.

## Operator steps

1. Back up any database currently on either existing Machine before removing or replacing it. A mounted new volume starts empty; deployment does not copy local or existing Machine data. Use SQLite's backup mechanism or `VACUUM INTO`, rather than copying an open database without its WAL.
2. Provision the volume: `fly volumes create hbl_data -a happybearlandia --region dfw --size 1`.
3. Keep exactly one app Machine: `fly scale count 1 -a happybearlandia`. Do this only after preserving any required existing data.
4. Deploy from this repository: `fly deploy --ha=false -a happybearlandia`. Check the resulting Machine has `hbl_data` mounted at `/data`.
5. If migrating an existing database, stop writers and restore its consistent backup into the mounted directory before serving users.
6. Verify in the deployed UI: create an experiment, invite someone and complete a conversation, wait for **Autosaved**, refresh, then restart the same Machine and confirm relationships and shared memories remain. Retain independent backups.

Do not scale this configuration to multiple database-owning Machines: independent Fly volumes do not replicate. Multi-Machine availability requires a replication design such as LiteFS or a shared database. A single Machine can have deployment downtime and a single disk is not a backup.

References: https://docs.fly.io/volumes/overview and https://docs.fly.io/flyctl/cmd/fly_deploy .
