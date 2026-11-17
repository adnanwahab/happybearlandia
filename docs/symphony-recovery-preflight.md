# Recovery prerequisite probe

The live dispatcher uses `symphony-pilot`, Todo/In Progress/Rework, independent
clones and one worker. The alternative PR20 dispatcher is not active. A complete
175-issue inventory found zero execution approvals. In Review is not evidence of
implementation. Existing PR25/26/30 work must be reconciled before dispatch.

## Observed causes

| Failure | Evidence / component | Remedy |
| --- | --- | --- |
| No eligible issues | Live43111 reports zero running/retrying;175-issue two-page audit reports zero pilot labels | Review a single genuine incomplete candidate before approval; retain the current gate |
| Shared Git metadata denied | Historical SHE7/11/126 `FETCH_HEAD: Operation not permitted` | Existing independent-clone hook; never widen access to shared metadata |
| Structural check accepts unwritable metadata | Disposable read-only `.git` passes installed check, actual commit fails128/index.lock permission denied | Actual sandboxed commit prerequisite probe |
| Incomplete readiness evidence | PR30 audit retained28 active statuses/unknown ownership, selected none | Reconcile actual claims and dependencies; never bulk reset or label |
| False prerequisite classification | SHE7 explicitly calls SHE8/56/66 downstream; conservative classifier treats every issue reference as prerequisite | Preserve facts in operator review; classifier-generated approval remains held pending owned reconciliation |
| Integration backlog | PR25/26 browser fixes already exist; PR30 coordinator already merged | Reuse contributions, no duplicate fixes or alternate dispatcher cutover |

## Executable check

Run on the trusted host, from a reviewed checkout:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 ops/symphony/workspace_preflight.py
PYTHONDONTWRITEBYTECODE=1 python3 ops/symphony/workspace_preflight.py --object-cache /path/to/operator-reviewed/checkout
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ops/symphony -p test_workspace_preflight.py
```

The first command pins the actual GitHub repository and sprint branch. It checks
10GiB free, executables, plaintext-credential boundary, Codex login, host GitHub
read/push permission, independent metadata, host fetch, sandbox branch/commit,
frozen dependency installation without lifecycle scripts, and sandbox imports.
Host authentication remains on the host; credential variables and Git injection
variables are absent from sandbox commands. Standard plaintext GitHub credentials
fail before sandbox execution, matching the installed before_run guard.

Only a newly allocated disposable clone is written. It cannot overwrite a ticket
workspace or active ownership. No model is launched, remote branch pushed, issue
approved, workflow changed, or server started. Each command is bounded; timeout
kills its own process group before clone removal. Errors omit remote output.
Exit0 means this prerequisite probe passed; exit75 retains a sanitized hold.

This is **not** proof of model quota, branch protection/actual push acceptance,
browser availability, ticket-specific tests, task readiness, dispatch, publication
or replenishment. Those require the actual pilot. The CLI has no skip options;
partial/offline fixtures can never report `ready: true`.

An optional operator-reviewed Git object cache avoids re-downloading unchanged
history. Objects are copied with `--no-local --no-checkout`, without hardlinks or
alternates; dirty/untracked cache files are not copied. The origin is then pinned
back to GitHub and the actual sprint fetched and checked out before any dependency
installation or code execution. Do not use an unreviewed worker checkout as the
host cache. This option neither changes the live clone hook nor bypasses fetch.

Actual verification:11 focused tests and19 total ops tests passed. The initial
full remote probe passed at870c0ca. Two subsequent full remote clones timed out
at180seconds and failed closed with successful clone removal. The object-cache
probe passed all9 checks in5.9seconds against remote0d115ec, with cleanup. Exact
sanitized observations are in `docs/evidence/symphony-recovery-preflight.json`.

Live SHE141 completed commit9df1c3b, but a42,212-character handoff exceeded the
host40,000 limit and caused before_run retries. Recovery preserved its original
handoff/publisher JSON intact and losslessly merged the sprint as e611c16. One
existing population test hit the default5second timeout at6.6seconds; unchanged
assertions passed with30seconds:33tests/525assertions. Another operator then
changed the handoff; the recovery compare guard stopped without overwriting it.
No recovery approval/lease was added. Actual publication remains separately
verified; these checks do not claim it occurred.

## Ownership and integration boundary

The recovery change owns only the two new `ops/symphony/*workspace_preflight.py`
files and this note. Active peer chats own installed workflow/hooks, coordinator,
scan/scheduler/metrics and PR25. This change does not overwrite their files or
install a competing scheduler. Wire the reviewed probe into host preparation
before execution approval, separately from the worker's local checks. A successful
probe does not waive the classifier's unresolved ownership/readiness holds.

First candidates, **not blanket approvals**:

| Issue | Owned files | Gate |
| --- | --- | --- |
| SHE7 | `world/first-play-events.js`, `test/first-play-events.test.js`, `docs/first-play-event-contract.md` | No incoming dependencies; prior attempt made no code; initial single pilot needs durable lease and eligible state |
| SHE11 | `scripts/benchmark-cold-start.mjs`, `test/cold-start-report.test.js`, `docs/cold-start-performance.md` | No incoming dependencies; wait for first end-to-end pilot |
| SHE141 | `world/metrics/agent-counts.js`, `scripts/benchmark-agent-counts.js`, `test/agent-counts.test.js`, `docs/agent-counts.md` | Old claim explicitly released in latest description; refresh clean base/evidence before approval |

SHE126/127 share PR30 functionality;126's specific ops checklist and127's GitHub
Issue mirror matching remain to reconcile. SHE142 waits for141;171 also requires
142 in prose despite its narrower native relation. SHE79 is Done via PR26;
83 still needs an approved canonical export contract and84 waits for83. The
audit cannot truthfully certify ten dependency-free tasks from these facts.
