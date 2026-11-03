# SQLite deployment path (Models)

`database-path.js` exports `resolveWorldDatabasePath({env=process.env,...testDependencies}={})` returning actual SQLite file path. Default local path remains repo `.data/world-experiments.sqlite`; env `HBL_WORLD_DB_PATH` overrides it (relative local paths resolved, explicit :memory: local allowed).

When `FLY_APP_NAME` is set, HBL_WORLD_DB_PATH is mandatory, absolute and file-backed. Guard runs synchronously before any database/directory creation. It resolves symlink ancestors and verifies Linux `/proc/self/mountinfo`: database directory must lie on a separate writable block-device filesystem mount (ext4/xfs/btrfs), distinct from root device, never root/overlay/tmpfs or a root bind mount. Existing path must be a normal file and nearest directory writable. Missing nested directories under an actual volume are allowed for normal mkdir in persistence-store.

Default createWorldPersistenceHandler uses this helper; explicitly passed `dbPath` remains the isolated-test/explicit embedding API locally; on Fly it is validated by the same mounted-directory guard as the environment default. Fly.toml should set HBL_WORLD_DB_PATH='/data/world-experiments.sqlite' and mount the WHOLE /data directory, including SQLite WAL/SHM sidecars. No remote deployment, volume provisioning, or user data migration performed by this helper.

Validation LANDED:19tests125assertions passed for path guard +autosession disk persistence +immutable-save APIs (`/private/tmp/hbl-fly-database-path.log`). Mountinfo validation uses actual separate block-device identity (not an existing /data folder alone), longest matching mount, canonical symlink resolution, writable filesystem and parent checks. No .dataDB migration or remotevolume action performed.
