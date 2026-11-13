# Mini Symphony queue audit — November 12, 2026

Observed Linear: 30 Backlog and 4 In Review. Observed GitHub complete PR inventory:
262 merged and 5 closed, no open PRs. These counts describe different entities.
Local task state initially recorded 220 pr_created and 28 no_changes. The live
runner changed state during this audit; no state or task queue was overwritten.
Full descriptions and the timestamped reconciliation report are stored privately
in `.hbl-private/mini-recovery/`. They contain an observation, not a live feed.

## Findings and actions

- SHE-70: independently verified merged PR25 against the sprint and successful
  hosted core-journeys check; moved from In Review to Done in Linear.
- SHE-62: actual worker output requires real first-time testers and an invitation
  channel. Automated browser tests cannot supply human comprehension results.
- SHE-69: actual worker output lacks accepted player findings/cohort evidence.
- SHE-137: worker reports missing camera integration and equivalence verification;
  its no_changes exit is not acceptance. Requires shared-file ownership review.
- Ten new SHE-259–268 playtest issues were absent from the imported task queue.
  Full prompts now exist in the private snapshot, ready for queue triage.
- Ten backlog issues have merged mini PRs: SHE45,44,29,65,64,63,192,11,256,165.
  Require acceptance review rather than duplicate implementation. PR53/SHE165
  contains readiness documentation, not the diagnostics feature. Do not blindly
  mark all merged issues Done. Other branch conventions also need inspection.
- Six remaining experiment issues explicitly request Claude. SHE228/SHE212 have
  no_changes outcomes needing review. SHE253 has a failed publication. SHE14
  was actively retried by another runner during this audit; preserve its work.

## Delivered runner changes

`publication.ts` resumes clean committed work and discovers existing PRs after
partial failure. It fails closed for closed PRs, unexpected branches, additional
local edits and differing open PR heads. Startup includes interrupted publishing
states, respects disabled/terminal tasks, and explicit no_changes retries are
bounded to one per session. Final responses are retained separately; output
logging appends serially. Default concurrency is one with validated overrides.

`reconcile.ts` is a dry-run CLI over complete full-description snapshots. Explicit
--write refuses an existing runner lock, preserves unrelated tasks and all state,
and imports selected issues disabled for triage. No live queue apply or restart
was performed. This is an operator-invoked refresh, not continuous Linear polling.

Verification: six focused Bun tests pass, including real disposable Git remotes
and faults after commit, push and PR creation, closed-PR protection and queue
hold/preservation. Bun runner bundle passes. No browser behavior changed.

Remaining: stop the existing runner normally, refresh the snapshot, apply the
queue import, assign shared-file ownership and dependencies, then enable the
next reviewed task. Review acceptance for merged report-only deliveries and
supply human evidence where requested. No new implementation deliveries, bulk
closure, merge or deployment are claimed by this audit.
