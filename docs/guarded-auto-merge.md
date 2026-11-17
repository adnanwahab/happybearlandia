# Guarded HappyBearLandia automatic PR merging

The previous `auto-merge.yml` was disabled (`if: false`) and had neither a five-minute schedule nor a manual dispatch trigger. This revision provides **best-effort five-minute audits**, a read-only manual dry-run by default, and an **opt-in** live merge path.

## Repository owner activation checklist

1. Review these workflow and script changes, verify the `node --test test/auto-merge.test.cjs` job and relevant CI pass.
2. Configure GitHub branch rules/protection for `main` and `sprint/one-city-two-futures-20261111`: require checks, at least one human approval on the current PR head, dismiss stale approvals, and prohibit agent/bot bypass. Repository files cannot activate these settings.
3. Repair conflicted PRs and preserve committed screenshots in verified CI artifacts or another durable evidence store; the merger now holds generated evidence.
4. Run **Actions → Automatic PR merging → Run workflow**, on `main`, leaving **dry_run=true**. Inspect the per-PR results.
5. Only after review of the safety gates, create or set the repository Actions variable **`HBL_GUARDED_AUTOMERGE_ENABLED=true`**. This turns on scheduled guarded merges, at most one PR per pass. Clear/set the variable to `false` to pause new automatic merges.

A manual live run (`dry_run=false`) also requires the variable to be `true`. The merge job checks exact-head CI, current-base ancestry, clean GitHub mergeability, an explicit `APPROVED` review decision and a separate human reviewer approving the exact head SHA. It refuses draft PRs, missing reviews, pending/failing checks, unresolved threads, protected workflow/agent-instruction edits, generated screenshots and held PRs. Only verified PR code is integrated, never automatically deployed. A successful Codex process is not evidence of acceptance.

GitHub's cron schedules are not guaranteed to run precisely every five minutes; for a strict 25-hour supervisor heartbeat use your existing local Symphony process. GitHub's native repository `allow_auto_merge` toggle is separate from this guarded Action.
