# HappyBearLandia release checklist

Use this checklist after selecting a release. The November 10 audit was read-only. Backup creation on the production host, restore, deployment, restart, and production test writes require the operator’s authorization and a maintenance window. See the [release audit](release-audit.md) for the observed source and production state.

## 1. Freeze the candidate and review the diff

- [ ] Reconfirm remote main with `git ls-remote --heads origin main`. The audited tip was `fd43cc739b82b39dfe85a72db713b6d1ddaaf450`, the merge commit of [PR #8](https://github.com/adnanwahab/happybearlandia/pull/8).
- [ ] Create an isolated release checkout at the verified main tip. Carry over only reviewed changes from the shared checkout. In particular, reconcile the overlapping Living City browser assertions with PR #8 and keep its CI and homepage discoverability.
- [ ] Review the candidate with `git status --short`, `git diff --check origin/main...HEAD`, `git diff --stat origin/main...HEAD`, and `git rev-parse HEAD`. Use a clean tracked export for the build and check that credentials, caches created by the run, SQLite/WAL files, household state, recordings, and test artifacts are absent from the image context.
- [ ] Keep PRs #2–#6 out of this candidate unless a specific change is separately reviewed and added to its test scope. [Open pull requests](https://github.com/adnanwahab/happybearlandia/pulls?q=is%3Aopen+is%3Apr)
- [ ] Record candidate SHA, comparison URL, run IDs, and dependency lock checksum in the release notes. Keep the previously serving image digest and matching configuration in the operator’s release record.

## 2. Verify the exact candidate locally and in CI

- [ ] Use `bun install --frozen-lockfile` and `bunx playwright install chromium`. On Linux CI install browser dependencies with `bunx playwright install --with-deps chromium`.
- [ ] Run the core simulation, causal storage, replay, navigation, and Decision storage suite in the [merged workflow](https://github.com/adnanwahab/happybearlandia/blob/fd43cc739b82b39dfe85a72db713b6d1ddaaf450/.github/workflows/core-journeys.yml). Run its Universe shell, Time Machine, and causal inspector browser configs.
- [ ] Run `bunx playwright test --config test/civilization.browser.config.js` for the working-tree release journeys. Record test totals and commit SHA. An in-memory store is suitable for browser isolation. Use a temporary file-backed store for restart and migration tests.
- [ ] Run `bunx playwright test --config test/release-browser.config.js` for the guided saved future, Universe shell, Living City, Bakery, and Discoveries. Run `bunx playwright test --config test/time-machine.browser.config.js world-time-machine.browser.js --workers=1` on a separate server so the empty-state journey starts before any other test records the demo.
- [ ] Run the focused Bun tests for every included group and attempt `bun test` across the repository. For any failure or timeout, name the test, reproduce on the base if classifying it as pre-existing, and state the release impact. Affected core and release-path tests must pass.
- [ ] On the candidate verify no browser modules or workers return 404, causal JSON routes return the expected content type, and local dependency and GPU fallbacks remain usable. For the local server use a fresh private test directory or `HBL_WORLD_DB_PATH=:memory:`; avoid using the workstation’s existing saved database.
- [ ] Open the candidate’s CI run and verify the recorded SHA. GitHub reported main unprotected at audit time, so treat green checks as a manual release gate unless required status checks are configured. [Audited main CI run](https://github.com/adnanwahab/happybearlandia/actions/runs/42927630933)

## 3. Recheck production and preserve its data

These commands inspect metadata. Reread the Machine and attached volume before every deployment. The audited Machine and volume IDs are examples from November 10.

```sh
fly status -a happybearlandia --json
fly volumes list -a happybearlandia --json
fly volumes snapshots list vol_40o7pzjlmxlw5094 -a happybearlandia --json
fly releases -a happybearlandia --json
```

- [ ] Confirm exactly one application Machine writes the active SQLite volume, encrypted `hbl_data` mounted at `/data`, with adequate free space and a recent snapshot. The active Machine was `837967a7954128` and the active volume was `vol_40o7pzjlmxlw5094`. Investigate mismatches rather than creating, attaching, or deleting a volume. [Fly volumes](https://fly.io/apps/happybearlandia/volumes)
- [ ] Obtain a consistent World database backup from `/data/world-experiments.sqlite`, including committed WAL transactions, and copy it to private encrypted storage separate from Fly’s volume. Freeze writes when obtaining a single recovery point across SQLite and Decision files. Check free space on the backup staging filesystem and offsite destination. The preflight found an active WAL, so copying the main file alone is insufficient. [SQLite online backup and VACUUM INTO](https://www.sqlite.org/backup.html)
- [ ] Check whether Decision data appeared under `/data/decision-experiments`, `/app/.data/decision-experiments`, or the legacy temporary directory after the audit. If there is a store, copy it with the committed snapshot backup tool while writes are quiescent. Review the observed auxiliary City History, Reality Shares, and `.hbl-city` stores independently. Preserve any required data before replacing the Machine. Move durable auxiliary stores to the volume or document a specific retention decision before release. [Decision store backup and restore](decision-studio-storage.md)
- [ ] Verify the offsite checksum and record the database timestamp, release 67 image, current schema state and volume ID privately. A second unattached volume and Fly snapshots do not verify an independent backup. [Fly snapshot guidance](https://docs.fly.io/volumes/overview#volume-snapshots)

### SQLite backup procedure after authorization

On the volume-owning Machine, run from the app shell. Use a fresh private path and confirm capacity before staging a copy.

```sh
umask 077
df -Pk /tmp /data
hbl_backup_dir=$(mktemp -d /tmp/hbl-release-backup.XXXXXX)
bun -e '
  import { Database } from "bun:sqlite";
  const [source, destination] = process.argv.slice(1);
  using original = new Database(source, { readonly: true });
  original.query("VACUUM INTO ?").run(destination);
  using copy = new Database(destination, { readonly: true });
  if (copy.query("PRAGMA quick_check").get().quick_check !== "ok") throw new Error("Backup verification failed");
  console.log("SQLite backup quick_check passed");
' /data/world-experiments.sqlite "$hbl_backup_dir/world-experiments.sqlite"
sha256sum "$hbl_backup_dir/world-experiments.sqlite"
printf '%s\n' "$hbl_backup_dir"
```

Transfer to a private workstation or backup destination with `fly ssh sftp get <REMOTE_FILE> <PRIVATE_LOCAL_FILE> -a happybearlandia --machine <MACHINE_ID>` and compare SHA-256 on both ends. Use `shasum -a 256 <PRIVATE_LOCAL_FILE>` on macOS. Preserve the verified copy before deleting the temporary stage. The command was rehearsed on a local database with committed rows still in its WAL. The existing [SQLite deployment notes](sqlite-fly-deployment.md) describe the original provisioning and application smoke process.

## 4. Rehearse migration and recovery before deploy

- [ ] On an isolated staging volume, restore the backup copy under the same configured paths. Keep the original offsite copy immutable. Run `PRAGMA quick_check` on the staging database before and after the candidate opens it.
- [ ] Start the candidate against the staging copy. Confirm saved World experiments, household autosaves, and available historical records remain readable. Compare expected record counts and a known sample, then restart the staging server and recheck. Stage a disposable write for each save path where authorization permits. Verify Decision snapshots and summaries separately if present.
- [ ] Test the pre-release image with a **separate copy** of the migrated database. If backward compatibility fails, arrange a rollback recovery point before deploy and agree how to preserve or reconcile writes made after release. Application image rollback alone will leave the current database in place.
- [ ] Capture the actual staging smoke result, restore duration, and independent backup location. Stop here until the operator explicitly authorizes deploy and agrees the rollback trigger.

## 5. Authorized release and smoke

- [ ] Deploy only the verified build and match it to the candidate SHA. From the clean candidate checkout run `fly deploy --ha=false -a happybearlandia --build-arg HBL_BUILD_ID="$(git rev-parse HEAD)"`, or deploy the already verified image digest with the reviewed Fly configuration. Record that resulting digest as the reproducible release artifact. Expect a brief interruption with one volume-owning Machine.
- [ ] Recheck Machine identity and the existing `/data` attachment. Recheck Fly release state and logs. A volume mismatch, SQLite migration failure, read error, or unexplained data loss stops the rollout.
- [ ] Check public HTTP 200 for [home](https://happybearlandia.fly.dev/), [routes](https://happybearlandia.fly.dev/routes), [World](https://happybearlandia.fly.dev/world), [House](https://happybearlandia.fly.dev/world/house), [Time Machine](https://happybearlandia.fly.dev/world/causal.html), [newspaper](https://happybearlandia.fly.dev/world/newspaper/), [discoveries](https://happybearlandia.fly.dev/world/discoveries/), [Living City](https://happybearlandia.fly.dev/world/living-city/), [Civilization](https://happybearlandia.fly.dev/world/civilization/), [Laboratory](https://happybearlandia.fly.dev/world/laboratory/), [Invention](https://happybearlandia.fly.dev/world/invention/), [Hidden Systems](https://happybearlandia.fly.dev/world/hidden-systems/), [Learning](https://happybearlandia.fly.dev/world/learning/), [Storm](https://happybearlandia.fly.dev/world/storm/), [Connected Lives](https://happybearlandia.fly.dev/world/connected-lives/), and [Houston map](https://happybearlandia.fly.dev/tools/houston-map).
- [ ] With the staged save fixture, exercise Time Machine event replay, Bakery evidence, a same-seed Living City comparison, one approved Observatory experiment, and Storm comparison. Restore an existing resident from Connected Lives to the exact World and House checkpoint. Repeat production read-only smoke where data is already available. Ask for separate approval before creating test saves or recording scenarios in production.
- [ ] Run the read-only browser smoke against the deployed build with `HBL_SMOKE_URL=https://happybearlandia.fly.dev HBL_SMOKE_BUILD_ID=<verified-sha> bunx playwright test --config test/production-smoke.config.js`. Confirm both storage checks, the build shown on Simulation Health, and advertised route responses.
- [ ] Record actual Fly version, image digest, mount, smoke times and results. Keep the old image and offsite backup until the monitoring window ends.

## Local walkthrough URLs

Use the local application origin, `http://127.0.0.1:3000` with the default port. Start with [home](http://127.0.0.1:3000/) and select **Try Today’s Features**, or open the [Saved Future Journey](http://127.0.0.1:3000/tools/future-journey.html) directly. Create the demo checkpoint and follow its generated World and House links. The save ID in those links is created by the local store. Return to Worldline, change rain intensity, save the matched fork, then scrub between the recorded checkpoints.

- [Decision Studio](http://127.0.0.1:3000/world/decision.html)
- [Time Machine](http://127.0.0.1:3000/world/causal.html)
- [Living City](http://127.0.0.1:3000/world/living-city/)
- [Riverside Bakery](http://127.0.0.1:3000/world/journeys/bakery.html)
- [Living Newspaper](http://127.0.0.1:3000/world/newspaper/)
- [Surprising Discoveries](http://127.0.0.1:3000/world/discoveries/)
- [Causal Inspector](http://127.0.0.1:3000/world/causality/inspect.html)
- [Simulation Health](http://127.0.0.1:3000/tools/simulation-health/) · [Liveness](http://127.0.0.1:3000/api/health) · [Readiness](http://127.0.0.1:3000/api/ready)

### Rollback

Trigger rollback for sustained startup failures, inaccessible saved records, storage attachment mismatch, unexpected schema failure, or a blocking user journey. Freeze affected writes, preserve the current mounted state, and capture the failing release and logs. Use the known-good pre-release image and its matching configuration only when staging verified it against the resulting schema. The observed pre-release digest is `registry.fly.io/happybearlandia@sha256:deaed19df4bd96ea11809dd2b2e67180f79bcca61b4feebd0f964bcccbf05f30`. If the old app cannot read the migrated schema, restore an authorized recovery point onto an isolated or replacement volume first, verify it, and resolve writes made since that recovery point before switching traffic. Recheck the read-only smoke and document the recovery.

## Accessibility gate for each new or changed system

- [ ] Record the system, route, candidate SHA, tested journey and tester. Complete
  the journey using keyboard alone, including entry, entity selection, actions,
  errors, dismissal and return. Verify visible focus and no keyboard traps.
- [ ] Repeat with a screen reader and assistive/switch input. Verify names,
  headings, state changes, errors, modal focus and a semantic alternative to
  canvas-only actions. Record reader/browser and actual results.
- [ ] Measure rendered text contrast (4.5:1 normal, 3:1 large) and control/focus
  contrast (3:1), including overlays, selected, hover and error states.
- [ ] Enable reduced motion before entry and change it during play. Verify CSS
  and renderer/camera effects, flashing and transitions across the entire journey.
- [ ] Run focused accessibility regressions and the system's normal browser
  journey. Record blockers and unresolved failures; release requires these gates
  to pass for every included system. Automated checks supplement manual checks.
