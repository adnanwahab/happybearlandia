# Source-only worker and trusted-host procedures

Codex remains `workspace-write` with approval_policy `never`. Git metadata is
protected even inside a clone. Do not add writable `.git` permission exceptions.
Workers edit/test source and write data under `.hbl-handoff/`; host code owns
fetch, branches, staging, commits, pushes, draft PRs and Linear publication links.

## Worker procedure

1. Read AGENTS.md, product/implementation/module docs, the issue/workpad and
   `.hbl-handoff/base.json`. The host has already fetched the approved sprint
   baseline and created the isolated issue branch. Read-only Git inspection is
   allowed; never fetch, merge, switch, stage, commit, push or write `.git`.
2. Audit existing work before editing. Limit changes to exact assigned files,
   preserve all other modified and ignored state, and run the issue's tests.
   For UI changes test the normal route and failure paths; capture and inspect
   real media. A missing browser is a blocker, not a pass. A trusted host reviewer
   may separately verify the same source bytes without weakening the worker sandbox.
3. Atomically write `.hbl-handoff/workpad.json` with status progress/blocked/handoff
   and concise current-session notes (maximum40000characters, prefer12000).
   Existing history is retained by the host; do not recursively copy it.
4. When complete, write `.hbl-handoff/publish.json` version2 with issue/repository/
   exact branch/base/baseCommit, sorted changed `files`, SHA256 `fileHashes`
   (`null` for deletions), tested `fileModes` (100644/100755 or null), optional
   assigned media `artifacts`, and the complete PR `body` with actual commands/results.
   Hash the tested files directly with Python hashlib. Never stage to hash them.
   No shell commands or self-approved ownership policy belong in this data.
5. Stop after handoff. Do not change source after hashing without retesting and
   replacing the handoff. Keep In Progress until a real draft exists and an
   operator reviews it. If publishing fails, preserve source/handoff for host
   recovery; do not launch another implementation or repeat prohibited Git writes.

## Host preparation and approval

The active workspace root is `~/code/symphony-source-only`. Existing roots,
branches, commits, dirty files and ignored state remain intact. Migration means
creating a fresh independent clone and deliberately resuming only the same issue's
reviewed source files; it never resets or cleans the original workspace.

`isolated-checkout.sh` runs on the trusted host, refuses any nonempty target,
checks disk space, clones without hardlinks/alternates, and creates only
`symphony/SHE-<id>`. Git global/system configuration and hooks are disabled.
`prepare.py` verifies independent metadata, exact issue branch, host-owned
assignment, current approved sprint baseline, permitted pending changes and
host GitHub authentication. A complete retained handoff blocks another model run.
It fetches only in host-private Git storage and never resets a worker checkout.
A stale baseline fails closed for explicit lossless reconciliation and revalidation.

The operator—not the worker—creates a mode0600 regular assignment under the
mode0700 directory `~/.local/state/hbl-publisher/assignments/SHE-<id>.json`:

```json
{
  "version": 1,
  "issue": "SHE-123",
  "repository": "adnanwahab/happybearlandia",
  "base": "sprint/one-city-two-futures-20261111",
  "baseCommit": "<actual approved full SHA>",
  "files": ["<exact reviewed source path>"],
  "reviewedBy": "<operator identity and evidence>",
  "expiresAt": 0,
  "publishEnabled": false
}
```

The placeholder example is deliberately invalid until filled from actual review.
Expiry must be fresh and within24hours. Resolve native/prose prerequisites,
existing PRs, prior implementations and exclusive file/interface ownership before
writing it. Both existing dispatch labels and the concurrency/resource/review
policy remain independent gates; the assignment does not approve dispatch.
`publishEnabled` is held until required source-hash-matched validation is verified.
No credential or executable command is put in this policy or worker clone.

## Host commit and publication

Under the existing per-issue host lock, the publisher validates the model handoff
against the external assignment. A private Git repository/index stages only
validated regular-file bytes or explicit assigned deletions. Symlinks/hardlinks,
unsafe paths, out-of-scope changes, ignored/unlisted files, oversized data and
recognizable credential material are rejected. Snapshot hashes must match tested
source and remain stable during capture. No workspace Git configuration, hooks,
filters, helpers, signing or executable commands are trusted.

Snapshots and deterministic commits persist under private host state before
network publication. Worker index/HEAD/ignored files remain unchanged. Failed
fetch/auth/commit/push/PR/link preserves the source and snapshot. Retries reuse the
same commit, reconcile ambiguous GitHub responses, reuse one exact-branch draft
and repair its existing Linear workpad link. Pushes never force and only target
`symphony/SHE-<id>`; base is the approved sprint, never main. Closed/merged/non-draft,
wrong-base or duplicate PRs fail closed. The existing publisher uses host gh
Keychain authentication and strips credentials from Git/model subprocess envs.
It removes only symphony-pilot after linking the real URL, freeing dispatch without
changing review/main/deployment protections.

Legacy `.git/hbl-*.json` is read only for explicit recovery. Existing legacy commits
must also pass a fresh host assignment and credential/file-scope checks. Ambiguous
simultaneous old/new requests are preserved and rejected, never silently selected.
Do not delete original snapshots, regenerate identities or reset workspaces to retry.

## Media

Use the issue's authorized artifact channel. A committed inspected PNG is an
artifact only after the host uploads it; include its exact pushed commit URL in
the draft. A local path or guessed URL is not remotely uploaded evidence.

## Preflight verification

Run the Python tests with real disposable Git fixtures and fake network services.
`test_host_git.py` covers source-only commits, scope/secret/ignored/symlink guards,
failed fetch/auth/commit, partial push/link recovery and duplicate/ambiguous PRs.
The separate native probe runs `source_preflight.py` once using the installed
`codex sandbox -P :workspace -C <fixture> -- ...`. It expects source edit success
and Git metadata write denial; it grants no `.git` permission override. Do not run
that probe in an existing valuable Git directory or call nested-sandbox setup
failures a successful permission result.

## Automatic trusted assignment admission

The existing backlog coordinator now manages reviewed exact-file assignments before execution labels, recoverable maintenance and explicitly authorized renewal. See [ASSIGNMENTS.md](ASSIGNMENTS.md). Workers cannot create or renew these policies; publication remains independently held.
