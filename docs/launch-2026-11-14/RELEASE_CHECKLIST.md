# Release checklist — civic launch candidate

**Current decision: NO-GO for an integrated launch.** This is a source-based checklist, not deployment authorization.

## Source and build identity

- [ ] Record the approved HBL tag and immutable commit SHA; confirm the Fly app and serving image match. Local HBL `fly.toml` names `happybearlandia`; live build identity was not reconciled.
- [ ] Record the approved Civic tag and immutable commit SHA; verify `/version` reports the same release. Production `/version` displayed `Build unknown` during this audit.
- [ ] Confirm PR #316's HBL API is in the candidate and reachable from Civic's approved production origin. No live API request was made.
- [ ] Confirm merged Civic #120/#121 are included in the release. Live `/synth` lacked the native behavior viewer, so production parity currently fails.
- [ ] Reconcile Civic `fly.toml` app (`civic-synthesis`) against the actual production app, approved tag, and image. Do not rely on stale app IDs in prior docs.

## Product acceptance

- [ ] Run HBL `/world`: Balanced → Run cycle; record real output and elapsed time, progress, cancel, fail, and retry. Require terminal status within 120 seconds.
- [ ] Run the HBL seed-42 housing case; verify same model, seed and Month 0, +24 physical homes at Month 16, unchanged baseline, actual event receipt, and the documented limitations.
- [ ] On Civic `/synth`, change law 83 from 100% to 50%; verify correct request and receipt, matching start/seed/clock, actual actor timeline, stale-response handling, and error/retry state.
- [ ] Verify the live API from the approved Civic origin, unavailable/malformed/timeout/rate-limit paths, and absence of private journal/vote fields.
- [ ] Complete keyboard, 320/390px, reduced-motion, Canvas2D/WebGL, and current Chromium browser acceptance. Local listener failures are not evidence of a browser pass.

## Governance, privacy, and operations

- [ ] Preserve non-binding pilot language. Live Civic page currently shows governance paused, zero roster, no allowed bases, and no required checks configured. Do not weaken quorum, eligibility, branch policy, review or merge protections.
- [ ] Verify that no real ballot or private journal content enters public receipts, analytics, URLs, or screenshots.
- [ ] Confirm server-side origin allowlist, rate limits, concurrency limits, storage health, and single-writer volume against actual Fly state.
- [ ] Complete staging with separate data, backup/restore rehearsal, migration compatibility and rollback SHA before production.
- [ ] Obtain human review, merge/release approval, and explicit deployment authorization. No merge, tag, deploy, production write, or outbound message was performed by this task.
