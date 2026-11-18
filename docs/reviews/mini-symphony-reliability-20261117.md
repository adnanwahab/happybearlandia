# Mini Symphony reliability increment — November 17, 2026

The owner requested bounded reliability/throughput implementation and designated
HappyBearLandia as the canonical version-controlled Mini Symphony source. This
increment does not claim a completed 25-hour run or unattended integration.

## Delivered

- Canonical Bun source, project examples, reproducible runtime export with actual
  source/bundle SHA-256 manifest; no host queue/state, credentials or logs in the
  export. Existing installed runtimes remain separate until a reviewed restart.
- External content-addressed local browser artifacts, explicit capture/source
  metadata and a read-only, exact-head HBL CI upload workflow. Worker publication
  excludes screenshot and operator-state paths even on older non-ignoring bases.
  Existing binary history and PRs are preserved for individual reconciliation.
- Coordinator ownership of shared plans; per-issue records instead of competing
  edits to the shared roadmap. Elixir pilot and Bun runtime remain separate.
- Durable read-only integration audit with exact repo/base/head identity, latest
  check-run handling, independently verified human approvals, bounded repair
  leases, crash recovery and stale-result fencing. No automatic repair dispatch,
  merge, push, task rewrite or Linear mutation is added by this audit.
- Five browser configs use OS-allocated loopback ports and disposable stores.
  Worker re-imports borrow main-process URLs/stores through explicit lifecycle
  metadata. Tests cover two simultaneous actual Playwright runners and separate
  SQLite writes. Other fixed-port configs are listed in the isolation document.
- Server accepts disposable history and player-feedback paths without changing
  normal handler defaults.
- Dear Congress local workflow patch requires positive current-head nonauthor,
  nonbot maintainer approval and protected-base evidence, checked again before
  SHA-fenced merge. CI-completion audits supplement delayed cron. Summary counts
  distinguish audits, skips and actual confirmed merges. No live workflow state,
  branch protection or governance setting was changed by that patch.

## Verification

- Coordinator recovery, Linear import and durable integration queue: 37 tests /
  212 assertions passed.
- Export reproducibility, source-only publication and integration queue: 15 tests /
  134 assertions passed after publication exclusions were extended.
- Normal coordinator entry, real external browser captures and concurrent browser
  isolation: 21 tests / 321 assertions passed on the permissioned host.
- Remaining Mini recovery/cleanup/telemetry plus feedback/history regression:
  38 tests / 224 assertions passed.
- Dear Congress patch in isolated checkout: full Bun suite 537 passed; typecheck,
  route smoke and 7 focused policy tests passed. Patch applied to its local checkout.
- `bun run symphony:mini:check` confirms actual HBL project/base and concurrency1.
  The check reports ownership/queue state; it is not acceptance of feature PRs.
- No root lint/typecheck script exists. Diff checks and runtime builds passed.

Commands and detailed bounded scope are in the canonical Mini README,
`integration-queue.md` and `docs/browser-test-isolation.md`. Existing World controls
work was separately verified with55Bun tests and10Chromium checks before this
reliability slice. No social-model rules, assumptions, RNG or ODD contract change
is introduced by the Mini/browser infrastructure work.

## Live observations and operator work

Branch metadata reads returned `protected:false` for both repos' main and HBL's
sprint branch; Dear Congress detailed protection read returned404 Branch not
protected. Configure and verify protections in GitHub: appropriate exact-head
required checks, human approval, stale-approval dismissal, latest-push review,
strict/up-to-date branch, no force/deletion and no agent bypass. Preserve any
stricter rules introduced after this observation. This source patch cannot
establish that those settings are active.

At the host sample, the 16GB Mac used about7GB swap with26GB disk free and load
averages3.14/2.63/2.37. This is a point observation, not a25-hour resource profile.
Do not increase concurrency based on PR output alone. The active path remains one
Bun worker per project; changing the separate Elixir supervisor's six-worker
ceiling would not resize it.

After review, land these source/workflow changes, export a manifest-pinned build,
and adopt it at an idle boundary without deleting config/tasks/state or starting
another owner. Review/merge feature and repair PRs on their actual current head.
The read-only repair queue is not yet a trusted repair-worker dispatcher. A Bun
persistent-deadline supervisor/launchd service, automatic resource-gated lane
selection, broader config migration and a reviewed Dear Congress artifact CI
workflow remain implementation work. Starting a25-hour job is a separate explicit
operation; no availability or accepted-throughput target is claimed here.
