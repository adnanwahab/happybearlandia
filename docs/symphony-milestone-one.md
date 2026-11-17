# Symphony Milestone 1: SHE-83

Status: not verified end to end. Concurrency remains one; Milestone 2 is held.

## Authority and ownership

The human explicitly authorized SHE-83. A subsequent human review in chat
`01a1cae3-d8cd-73f1-9113-73b93a0c6c17`, question
`call_2fb9ae8bd83a426ab069c86412c5840f`, approved baseline
`173f9530752b0e476583ad3ee7433b57a857b6bd`, six-hour expiry, publication disabled,
and exactly these files:

- `world/future-machine/share/run-receipt.js`
- `scripts/export-run-receipt.js`
- `test/run-receipt.test.js`
- `docs/run-receipt.md`

The existing mode0600 host assignment records that actual approval; do not
overwrite it or invent a second review. That chat already owns the minimal
admission, restart and publication implementation. The orchestration repair chat
owns runtime integration. This audit adds evidence only; no duplicate worker,
service, branch or implementation was launched.

## Observed baseline

At 2026-11-11 23:26:32 America/Chicago, state API reported zero running, retrying
and blocked workers, zero model tokens. Throughput API reported cap1, max_turns20,
source-only root and both symphony-pilot/symphony-pressure-release labels.
SHE-83 remained Todo with no PR attachment. Assignment existed with exact scope
and approved SHA, publishEnabled false. Existing resource hold was active.
The separate operator-approved current-pressure proposal also requires actual
healthy fresh observations; historical swap warning alone is not clearance.

## Independent verification

Installed host tests: `python3 -m unittest test_assignment_lifecycle test_host_git
test_publish test_supervisor` from tools/symphony/local: 58 tests passed in
10.089seconds. Disposable fixtures cover assignment-before-label, interrupted
assignment replacement, ambiguous label success, revoked/expired review, retained
workspaces, deterministic host commit, ambiguous push/create/link recovery and
duplicate supervisor rejection. These are fixture results, not a live SHE-83 run.

## Live completion protocol

1. Verify current native admission changes and pressure policy together; keep
   never/workspace-write, both labels, trusted publisher and cap1. Retain all
   prior assignments, leases, handoffs and source.
2. Revalidate baseline and ownership; retain the actual reviewed assignment.
   Require current healthy pressure evidence before granting the pilot release.
3. Capture complete before-state, exact process identity, workspace source hashes
   and execution/session identity. Launch via the single existing dispatcher.
4. Require the ticket's real receipt/replay/CLI acceptance and focused tests:
   `bun test test/run-receipt.test.js test/future-machine-share.test.js
   test/future-machine-data.test.js test/example-receipts.test.js`.
5. At a preserved, tested terminal handoff with publication disabled, check zero
   active workers and obtain explicit operator approval for the concrete live
   restart. Never terminate unrelated work. Destructive injection uses fixtures.
6. Restart only the verified owned process. Recover the retained handoff through
   the trusted host without a second model implementation. Independently verify
   exact tested source hashes before enabling publication.
7. Reconcile one exact symphony/SHE-83 branch, deterministic commit and one OPEN
   draft against the approved sprint. Link that actual SHA/URL in the existing
   Linear workpad; retry ambiguous operations without a new branch/commit/PR.
8. Capture after-state and publication receipt. Release the coordinator lease
   only when the exact draft/head and Linear link are verified and no execution
   claim remains. Recheck the next independently reviewed candidate; do not
   infer SHE-142 baseline authorization from its older dispatch approval.

## Remaining evidence

No live worker launch, ticket acceptance run, controlled restart approval/proof,
implementation commit, draft URL, publication link, verified slot release or
next-ticket admission has been demonstrated by this audit. The milestone remains
incomplete until logs and before/after state establish all of them.

## Fresh pressure and independent peer verification

Pressure/publication worktree commit582c475 focused tests:55passed in13.003s
(`test_pressure_admission test_current_pressure test_host_git test_publish`).
This commit is infrastructure evidence, not the missing SHE-83 implementation.
Fresh paired host observations: {"activation": "operator-review-required", "active_workers_cancelled": false, "allow": false, "metrics": {"interval_seconds": 23.039036749862134, "swap_growth_bytes_per_second": 0.0, "swapout_bytes_per_second": 6058919.9763672985}, "policy": "darwin-current-pressure-single-worker.v1", "reasons": ["sample 1: native pressure is not normal", "sample 2: native pressure is not normal", "sample 2: CPU above 85%", "swap-out rate exceeds policy 1 MiB/sec"], "warnings": ["sample 1: historical swap usage exceeds 4 GiB", "sample 2: historical swap usage exceeds 4 GiB"]}

Raw evidence: `/private/tmp/hbl-milestone-one-pressure.json`. Both samples
failed native pressure; the second also exceeded85%CPU, and measured swap-outs
were approximately5.78MiB/sec against1MiB/sec maximum. No launch authorized by
these measurements. Host assignment validation and exact workspace ref match
passed; none of the four new implementation files exists yet.
