# Source-only Symphony Git repair evidence

Observed2026-11-12UTC. No merge or deployment.

## Delivered files

- `tools/symphony/local/host_git.py`: host-private index/object store, reviewed exact-file assignments, validated source hashes/modes, deterministic durable commits, snapshot recovery.
- `handoff.py`: bounded nofollow handoff reads, identity checks and safe snapshots.
- `prepare.py`, `isolated-checkout.sh`, `check-isolation.sh`, `check-host-auth.py`, `source_preflight.py`: independent clones, authenticated host baseline preparation, sandbox/source checks, retained-work safeguards.
- `publish.py`, `workpad.py`: existing host GitHub/Linear transport integrated with source-only handoff; exact scope, no-force pushes, draft reconciliation, private history/receipts, terminal-handoff guards and legacy recovery.
- `test_host_git.py`, `test_handoff_boundary.py`, `test_publish.py`, `test_isolation.py`, `test_linear.py`, `test_workpad.py`, `test_workpad_oversize.py`: failure/retry/security fixtures.
- `tools/symphony/elixir/WORKFLOW.md`: source-only hooks and worker instructions; conservative one-turn template. Live native runtime lifecycle and final concurrency settings are separately maintained by the runtime owner.
- `PROCEDURES.md`, `README.md`, `.gitignore`, this record and implementation plan: operator contract and evidence.

## Verification

The132-test package passes on actual system Python3.9 in8.610seconds. Covers failed fetch, commit, auth, push, missing/duplicate/ambiguous PR, Linear link failure, partial recovery, ignored-state preservation, malicious Git hooks/config/PATH/filter, scope/secret/path/identity races, protected metadata and handoff lifecycle. Log: `/private/tmp/hbl-hostgit-local-final.log`.

Native `codex sandbox -P :workspace` with no `.git` exception reports sourceEdit=true and gitMetadataWriteDenied=true in a fixture and the fresh pilot clone. This proves the native sandbox command, separately from actual app-server configuration tests owned by the runtime repair chat.

The installed combined package run190tests had189pass/1error in the independently owned scheduler: Python3.9 `HTTPError(fp=None).close()` raises KeyError. Reported to its owner; not hidden as a publication-package success.

## Real recovery pilot

SHE-121 was already explicitly approved with ten exclusive paths. Its original real worker output, commits and ignored state remain in `~/code/symphony-pilot-isolated/SHE-121`. Resumed only reviewed source in fresh independent `~/code/symphony-source-only/SHE-121`, pinned sprint173f9530752b0e476583ad3ee7433b57a857b6bd. No model redispatch under memory pressure.

Exact source passes6Bun tests/27assertions inside native workspace-write, plus7host Playwright normal-entry/failure checks in3.0seconds. Inspected actual screenshot; production manifest remains honestly empty, populated test data synthetic. Logs: `/private/tmp/hbl-hostgit-pilot-sandbox-tests.log`, `/private/tmp/hbl-hostgit-pilot-browser.log`.

Trusted host receipt and GitHub independently verify draft [PR40](https://github.com/adnanwahab/happybearlandia/pull/40), commit4845c3dadc1cc32c6d6e42b64cf6583410884b79, exact10approved files, sprint/one-city-two-futures-20261111 base and verified SHA-pinned screenshot URL. Linear SHE-121 has the real PR attachment and no symphony-pilot/pressure-release label; status remains In Progress for review. Every pre-existing worker `.git` file retains its hash, including index/HEAD/refs; host added its compatibility workpad snapshot. Source remains uncommitted in worker clone; host private Git owns actual commit. Ignored node_modules and old workspace are retained.

Private assignment, before-policy backup, source fingerprints, durable transaction and publication receipt are outside the worker. Private before/after installation manifest preserves17original host modules and workflow. Never grant credentials or Git metadata write exceptions to workers. Failed or stale-baseline publication retains all source for reviewed reconciliation.

## Operational limits

This completes a recovered real-worker-to-draft path, not a new unattended model execution. Native runtime owner handles actual generated sandbox policy, terminal hook parking, resource hold and private workflow pinning after external edits to shared concurrency/label settings. Do not raise concurrency or approve further tickets from this evidence alone. No blanket approval, main/sprint commit, force push, merge or deployment.

Publication provenance was reconciled from the actual runtime log by its owner:22:46:57.155local SHE-121 start; before_run22:46:57.246 rejected a completed retained handoff; trusted after_run22:46:57.246–22:47:08.020 published it; claim removed22:47:18.139 after the pilot label disappeared. Zero model tokens. This was an existing runtime finalizer recovering an approved handoff, not a new worker implementation or a manually attributed authenticated command.

Resource snapshot:42GiB disk free;21.2GiB swap in use of22GiB allocated; memory_pressure37percent system-wide free. Runtime owner stopped the externally replaced dispatcher losslessly and is pinning the workflow privately before restart. No concurrency increase or resource-based dispatch authorization follows from this snapshot.

## Final coordinated verification

Runtime owner installed its Python3.9 scheduler correction and reports the full installed213-test suite passing, including this132-test package. Its complete native gates pass310tests/0failures/6skipped,100percent configured coverage, formatting/lint/specification/Dialyzer/build. Actual generated sandbox roots now contain only the source workspace, without a `.git` exception. Runtime PID26040 uses private pinned `~/.local/state/hbl-publisher/throughput-runtime/20261111-lifecycle-v2/{symphony,WORKFLOW.md}`, cap1/max_turns20/bothdispatchlabels/source-only. This chat independently queried the live API:0running,0retrying,0blocked,0modeltokens. SHE-121 slot is free; resource holds remain.

Live duplicate-publication retry remains unexecuted: the coordinating chat's automatic approval review rejected that exact host invocation, citing its earlier no-push restriction as insufficient authorization. It requested approval in that chat; no workaround was attempted. Existing live publication/receipt/GitHub/Linear evidence remains verified, and duplicate/partial recovery is covered by passing local tests. Do not describe the live repeat as passed. No new model run, merge or deployment.
