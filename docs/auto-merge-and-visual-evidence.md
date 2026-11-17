# Guarded auto-merge and browser-evidence runbook

## Merge admission

Repository setting **Allow auto-merge** and Actions variable `HBL_GUARDED_AUTOMERGE_ENABLED=true` must be enabled. The scheduled `.github/workflows/auto-merge.yml` evaluates at most one reviewed candidate for a native GitHub auto-merge action every five minutes. Manual workflow dispatch defaults to a dry-run. If native auto-merge is disabled, the tested legacy REST merger can merge one strictly eligible PR and explicitly dispatch main verification.

Eligibility fails closed for drafts, forks, unapproved/stale/bot/self reviews, unresolved threads, requested reviewers, hold labels or comments, conflicts, stale bases, missing exact-head named CI, missing verified baseline, workflow/AGENTS instruction changes, or committed generated screenshots. Only the named non-blocking screenshot/observational performance checks are ignored; unknown/security/functional statuses remain blockers.

## Fast gate and post-merge checks

`core-journeys.yml / verify` keeps its check name for existing branch protections, but runs a fast core security/replay/navigation suite on PRs and main. Do not remove any required branch-protection check without an explicit audit. `post-merge-observations.yml` runs the previous full browser/integration checks and civilization/storm observations after main is updated, or manually on demand. `model-validation.yml`, city replay and path-specific safety checks remain independent PR checks and may still block merges. Full post-merge failures are visible but do not retroactively make an unsafe PR eligible.

## Screenshots

The Mini Symphony publisher no longer captures/commits PNG evidence into its task branches. A separate observational `pr-screenshot-evidence.yml` workflow checks out the exact PR head and base, captures desktop/mobile before/after locally with disposable state, and uploads PNGs and JSON manifests as the `pr-screenshots-...` artifact (14-day retention). Screenshots are intentionally not an approval/merge gate, and no screenshot URLs in a PR point to unavailable blobs. The local `.mini-symphony-evidence/` path is ignored; earlier PR branches already containing committed evidence still require individual cleanup and a new commit. This patch does not rewrite historical PR branches.

## Audit

The automatic merger produces a run summary and uploads `auto-merge-audit-...` JSON artifacts (30-day retention) with one record for each enumerated open PR: skipped with a precise reason, selected for native merge, merged by fallback, or deferred to next pass. GitHub Actions runs can be delayed; a 5-minute schedule is not a guaranteed SLA. On an error inspect the run and audit, fix the underlying hold, and dispatch a read-only dry-run before re-enabling operational changes. Do not bypass reviews or critical CI to increase throughput.
