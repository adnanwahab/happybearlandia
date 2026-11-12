# Decision Studio storage and recovery

Decision Studio writes JSON snapshots to `.data/decision-experiments` in a local checkout. Fly sets `DECISION_STORE_DIR=/data/decision-experiments` on the existing `hbl_data` mount. Explicit constructor paths and `DECISION_STORE_DIR` still work. Keep the app on one volume-owning Machine. World SQLite uses its own file on the same volume and has a separate backup procedure. [SQLite deployment and recovery](sqlite-fly-deployment.md)

## Migrate the old temporary store

Before replacing a Machine running the old configuration, use `fly ssh console -a happybearlandia --machine MACHINE_ID` to locate the configured store or the old default at `/tmp/happybearlandia-decision-experiments`. If multiple Machines served traffic, collect each store separately and review conflicting IDs before restoring. Export any data you need while the old Machine is still accessible. On local installations the legacy path was `happybearlandia-decision-experiments` under the directory reported by `bun -e 'console.log(require("node:os").tmpdir())'`.

Once you have the old store locally, stop local writers and copy it to the new location. Use an unused destination. The command refuses to overwrite an existing directory and preserves IDs, full runs, and associated summary files.

```sh
mkdir -p .data
bun scripts/backup-decision-store.js .data/decision-experiments /path/to/old/store
```

## Keep an independent backup

Run the copy with no Decision Studio writes in progress. The script copies committed experiment and optimization snapshots and their summaries and skips abandoned temporary files. Use a new private destination on a separate disk or send the copy to an access-controlled backup location off the Fly volume. Fly daily snapshots offer a second recovery option with a five-day default retention. [Fly volume snapshot policy](https://docs.fly.io/volumes/overview#volume-snapshots)

For a Fly backup, connect to the volume-owning Machine with `fly ssh console` and run these commands from the app directory. Use a fresh staging directory or timestamp for each backup.

```sh
umask 077
bun scripts/backup-decision-store.js /tmp/hbl-decision-backup
tar -C /tmp -czf /tmp/hbl-decision-backup.tgz hbl-decision-backup
```

On your workstation, download and check the archive before removing the staging files on the Machine.

```sh
umask 077
fly ssh sftp get /tmp/hbl-decision-backup.tgz ./hbl-decision-backup.tgz -a happybearlandia --machine MACHINE_ID
tar -tzf ./hbl-decision-backup.tgz
```

On an old Machine without the script, archive the legacy directory with `tar` during the same quiet window and download the archive before replacing that Machine. The restore command filters its contents.

## Restore a backup

Quiesce writers. Extract your trusted archive into a private staging directory and run the same script with the backup as its source. For Fly, upload the archive with `fly ssh sftp put --mode 0600` to the volume-owning Machine, extract it in a private directory there, and run the script on that Machine. If the destination already exists, first preserve that directory under a different name or restore to a new path and update `DECISION_STORE_DIR`.

```sh
bun scripts/backup-decision-store.js /data/decision-experiments /tmp/hbl-decision-backup
```

Open the recovered store and confirm an experiment can still load its results after a restart. Retain the independent backup until that check succeeds.
