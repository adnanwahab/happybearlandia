# SHE-46: linkable scenario replay audit

Audited locally on 2026-11-12, branch `mini/SHE-46`, base
`b963dd353538294cb0fbf5d34d5283fad6e10e68`. No commit or PR created.
The workspace already contained the audit tests and plan entry; this pass
reviewed them, added a disposable-store guard, and recorded actual verification.

## Existing behavior and overlap

`world/reality/share-api.js` validates manifest/run identity and stores only the
selected future's proof and optional display host. Records explicitly say
`client-replay-required`: the server does not certify outcomes. The SQLite store
keeps shares immutable and expires them after 30 days. Missing and expired
records intentionally use the same public error.

`world/reality/runtime-core.js` verifies runtime/model versions before replay.
Opening a future recomputes terminal metrics and checks them against the stored
proof; month-specific scrubbing recomputes from the frozen manifest. These are
deterministic recomputations, not persisted intermediate checkpoints. The audit
does not establish empirical validity or cross-version reproducibility.

Existing `reality-share.test.js` covers validation, immutability, expiry, privacy,
and City/Population proof replay. `reality-share-flow.e2e.js` covers normal
homepage sharing to fresh recipients for both engines. Future Machine's separate
share tests cover versioned recipe fallback and incompatible links. No application,
simulation, receipt-export or persistence interface needed replacement.

## Added coverage

`test/scenario-replay-audit.test.js` uses synthetic three-household CityState
inputs, master seeds 0 and 4294967295, two futures, selected run index 1,
three months, permits=6 and no background parameter uncertainty. It persists and
reopens SQLite, compares terminal proof, then compares both full modeled arms
at months 0/1/3/0/3 against fresh runs from the original manifest. It checks the
derived selected seed, assumptions, immutable record, missing records, obsolete
model rejection, altered proof rejection and the exact expiry boundary.
Runtime/model versions and complete normalized inputs are retained in the
manifest (`reality-runtime.v1` and the current City model constant).

`test/e2e/scenario-replay-audit.e2e.js` exercises homepage creation, sharing the
second actual future, empty browser contexts, the same repeated scrub sequence,
synthetic disclosure and missing/expired/incompatible/tampered failures. Failure
assertions require meaningful messages, no selected state and no enabled
scrubber. Lifecycle fixtures edit only the dedicated server's temporary SQLite
database; real API, UI and model workers remain in use. The test skips without
the dedicated configuration so ordinary test runs cannot edit a development store.

## Observed verification

- `bun test test/reality-share.test.js test/scenario-replay-audit.test.js`:
  **10 passed, 0 failed, 127 assertions**.
- `bun test test/reality-compiler.test.js test/reality-workflow.test.js test/future-machine-share.test.js test/reality-share.test.js test/scenario-replay-audit.test.js`:
  **34 passed, 0 failed, 596 assertions**.
- `bunx playwright test --config test/scenario-replay.browser.config.js --list`:
  **1 test discovered**, configuration and test loading succeeded.
- `bunx playwright test --config test/scenario-replay.browser.config.js` and
  `HBL_REPLAY_AUDIT_PORT=39947 bunx playwright test --config test/scenario-replay.browser.config.js`:
  **blocked before browser execution**, Bun server reported `EADDRINUSE` on
  39946 and 39947. Read-only `lsof` checks showed no listener on either port;
  the underlying bind failure is unresolved. No existing server was reused.
- `git diff --check`: passed.

The incognito UI journey remains unverified until the dedicated command runs
where local server binding is available. No UI changed, so no UI-change screenshot
is supplied. No production data, deployment, merge, Linear dispatch gate or
Symphony runtime was changed. SHE-9 is recorded Done in the issue's prerequisite
checkpoint; this direct audit does not grant automated dispatch approval.
