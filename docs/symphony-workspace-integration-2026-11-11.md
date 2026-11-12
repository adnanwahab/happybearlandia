# Symphony workspace integration audit — November 11, 2026

User request: recover and integrate completed work from inactive Symphony workspaces while preserving original work, following the disk-space audit.

The three independent read-only reviews covered `~/code/symphony-workspaces`, `~/code/symphony-pilot-isolated` and `~/.local/share/hbl-codex/workspaces-linear`. The live Symphony endpoint at port 43111 reported zero running, retrying and blocked jobs before integration. No original workspace, shared bare repository, database or personal file was deleted or rewritten.

## Integration result

Local branch: `codex/merge-complete-symphony-20261111`.
Base: `f1174eb9a5cead6892370d25af97167a0babb54b`, verified against the remote sprint ref. The existing dirty primary checkout remains on its original branch with its local changes intact. No push, PR creation, release/main merge or deployment was performed.

SHE-89 contained six untracked, completed receipt-example files at source HEAD `42a821b03839bcfed127a727b01ea6158a687e45`. They were adopted byte-for-byte from `~/.local/share/hbl-codex/workspaces-linear/SHE-89`, without committing or changing that workspace. This is recovery of an uncommitted deliverable, not a merge of a nonexistent task commit. The files use the existing monthly City generator, normalization, bounded recipe codec and evidence exporter; they do not introduce a simulation engine or production persistence.

The housing receipt records seed 42 and month 16: 36 baseline homes, 60 plan homes, +24 homes, and 1,000,000 illustrative USD plan capital spending. The seed-7 month-120 zero-control receipt has identical paired observations. Both disclose synthetic assumptions and recomputation limits. The fixtures are illustrative model evidence, not empirical forecasts.

The branch intentionally uses the current sprint: `origin/main` at `78c3c5145a23a1300c1919fd70effc843052a3af` lacks imported Future Machine modules required by these files. Porting them there alone would not work.

## Other workspace findings

- Legacy Symphony root: 55 workspace HEADs equal the existing `ec408d03` sprint baseline. All tracked-clean; 52 fully clean. Three small untracked notes describe blocked/unstarted work and were left alone. No unique completed source contribution to merge.
- Pilot root: 27 repositories, of which 20 are unchanged baseline copies. Six are incomplete checkouts with mass staged deletions; existing tracked file contents match baseline. Their indexes must not be treated as completed deletion work.
- Pilot SHE-179 has two documentation commits, already merged through [PR #24](https://github.com/adnanwahab/happybearlandia/pull/24) into sprint merge `f1174eb9`. No duplicate merge was made.
- Linear SHE-70's uncommitted CI runner pin was deferred: no actual hosted runner check was available, and it is independent of the recovered receipt slice.
- Linear SHE-115 cancellation extraction lacks associated tests/completion evidence and was deferred. Empty and partial checkout indexes were not adopted.

No workspace is certified for retirement by this review. Ignored data and remote preservation of every source artifact have not been exhaustively established, and SHE-89's original untracked files remain local. This task does not claim additional disk recovery.

## Validation

- `bun scripts/example-receipts.js --check`: two receipts regenerate byte-for-byte with matching canonical hashes.
- `bun test test/example-receipts.test.js test/future-machine-share.test.js test/future-machine-data.test.js test/future-machine-diff.test.js`: **25 passed, 0 failed, 218 assertions** on the isolated integrated branch.
- Independent SHE-179 offline pipeline audit: eight tests passed; the already-merged documentation was not imported again.
- Browser checks skipped: the adopted change is an offline fixture generator and tests; application/browser behavior is unchanged.
- Whitespace and source-copy integrity checks passed.

## Recovered source integrity

Each SHA-256 below hashes the exact source file bytes and the matching adopted bytes. These byte hashes are distinct from canonical receipt hashes in `test/fixtures/example-receipts/hashes.json`.

| Path | SHA-256 |
| --- | --- |
| `scripts/example-receipts.js` | `acafea57b231f023f728bfa51f9f47871f1a54567748fcb966b08fe157e6444a` |
| `test/example-receipts.test.js` | `ad9659be4370e05f69583d6b90807b007d6edd35a21f53ff1a571b4b0b679c3d` |
| `test/fixtures/example-receipts/README.md` | `1af8b56211c65107747962bc250c9e286bc7a5de01daf9427adb7c1e6b3509f5` |
| `test/fixtures/example-receipts/hashes.json` | `4d509d7e71ad425d3917c086b82a74faebf1ba0dacb6ef679da071d704d15d0e` |
| `test/fixtures/example-receipts/housing-month-16.json` | `c57993d51eb89b47d5d5bedbcecc666e54f90bd9f710801e8d6e93abdf8be1de` |
| `test/fixtures/example-receipts/zero-control-month-120.json` | `47d3210743118031c6cba0bcefb9b0bcb4fe29120d14672f0f2df4734232c82f` |
