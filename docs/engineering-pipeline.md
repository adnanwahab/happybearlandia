# Planning, dispatch and integration

The sprint branch is the integration baseline. `docs/demo-backlog.md` remains the approved product ledger; `scripts/pipeline/tasks.json` is reviewed execution metadata. Existing worker assignments are not stolen. External proposals require coordinator acceptance before becoming executable metadata. Historical contradictory rows need reconciliation by the backlog owner, not wholesale replacement.

The audit found no durable interactive claim/verification handoff. The existing bounded CLI runner is now integrated, but its nested sandbox preflight fails locally (`sandbox_apply: Operation not permitted`). Its fixture lifecycle tests do not establish live model execution. `scripts/pipeline-coordinator.mjs` bridges actual internal Codex workers; it does not invoke or bypass that unsupported sandbox.

Planning adds reviewed exact paths, dependencies, tests and browser checks to the manifest after source audit. Maintain 8–12 READY tasks only when approved independent scopes exist. Unconfigured tasks and active external scopes remain blocked; the initial conservative manifest enabled only U10; the reviewed execution overlay now reserves eight further independent reliability scopes. The separate backlog triage chat owns NB intake and stale-status reconciliation. NB proposals remain outside this executable manifest until their integration prerequisites and ownership are reviewed.

Dispatch uses at most three workers and a shared repository-wide atomic lock. Every worker needs a clean isolated worktree at the current integration HEAD. Directory reservations and interface mutexes prevent overlap. More than two pending contributions blocks new claims. The bridge records transitions under `<git-common-dir>/demo-pipeline/interactive.json`; this is runtime state, not committed product truth.

```sh
bun scripts/pipeline-coordinator.mjs init
bun scripts/pipeline-coordinator.mjs claim U10 receipts-worker /absolute/isolated/worktree
# Start the actual internal Codex worker with the returned ownership contract.
bun scripts/pipeline-coordinator.mjs submit U10 receipts-worker FULL_COMMIT_SHA
bun scripts/pipeline-coordinator.mjs integrate U10 coordinator /absolute/review.json
bun scripts/pipeline-coordinator.mjs report
```

`review.json` must name `reviewedBy`, contract-review `notes`, `modelChecks`, and reviewed screenshot paths for visible changes. Workers deliver exactly one scoped commit and actual tests/evidence. Integration rechecks a clean immutable handoff, runs the reviewed argv checks in the candidate, cherry-picks locally, repeats checks in the integrated tree, and only then records VERIFIED and integration SHA. It refuses main/master, dirty integration checkouts, scope violations and missing browser evidence. No production model or renderer is changed by the pipeline.

A failed check records REPAIR, retains the candidate and reserves ownership. It does not retry indefinitely, reset work or claim completion. The coordinator assigns a bounded repair after reviewing logs; integrated failures require explicit reconciliation before more dispatch. Crash/VERIFYING state remains reserved for inspection; no automatic lease stealing.

Tests: `bun test test/pipeline-coordinator.test.js test/demo-pipeline.test.js`. Real-process race tests establish exclusive claims. Temporary Git fixtures establish scope/capacity/backpressure and candidate→integration checks. U10 is the separately delivered real approved task used for the actual internal-worker demonstration.

Existing delivered branches can be recorded with `intake CANDIDATE_ID OWNER FULL_SHA`; they enter the unverified queue and count toward backpressure. Intake does not grant execution approval or accept model/UI claims. A live demonstration with U16 plus two NB candidates refused another claim with “Backpressure: integrate pending contributions first”.


R15 added `repair ID OWNER REASON`. After the first candidate verification failure, the current owner explicitly authorizes the single permitted repair, amends the scoped single contribution commit, then submits again. Two total verification attempts are allowed. Checks append with attempt numbers; failure records retain the original SHA, review and command output. REVIEW/REPAIR retain path/interface/capacity reservations. An integrated check failure cannot use repair to cherry-pick again: inspect/reconcile the integration checkout first. A third attempt is refused, including after refresh. This is on-demand coordination, not an automatically running daemon.
