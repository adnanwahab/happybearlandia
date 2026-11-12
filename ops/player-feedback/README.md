# Consented player feedback — SHE-52

World's optional disclosure submits two structured choices: confusing/favorite,
and exploring/choosing/comparing/inspecting/sharing. Consent starts unchecked
and resets after a successful send or dismissal. Dismissal sends nothing;
closing the disclosure never pauses simulation. Requests omit credentials and
referrer and time out after eight seconds. A failed request can be retried;
the UI warns that an uncertain receipt may count twice. Dismissal during a
request aborts the browser request but cannot retract a count already accepted.

POST /api/player-feedback accepts only JSON `{version:1, consent:true, kind,
moment}` from the same origin, up to 512 bytes. Unknown fields are rejected.
GET and other methods return 405. No public list, export, or read route exists.
Storage initializes lazily after validation under the ignored, non-served
`.hbl-private/player-feedback/` directory (0700), in `counts.sqlite` (0600).
The single table contains kind, moment, and aggregate count only. Operators
can inspect it locally with SQLite; no external collection service is used.
These are counts of submissions, not unique players or representative samples.
There is no identity-based deduplication or rate limiting. Public scale abuse
controls and downstream triage remain separate work; do not use these counts
to execute work automatically. Ordinary infrastructure access logs are outside
this collector's control. No free text, account, run, seed, URL, or resident
identity enters storage. Retain counts only while useful and remove the private
database offline to clear them; individual withdrawal is unavailable because
no individual records exist.

Baseline overlap: onboarding/feedback-adapter.js and reality/outcome-feedback.js
present simulation evidence; dear-congress-feedback.js builds publishing drafts.
None is a consented player collection path. This feature leaves those modules,
model results, synthetic labels, and replay contracts unchanged. SHE-248's
aggregate triage can consume a future explicitly agreed adapter; it is not wired
here.

Verification (2026-11-12):

- `bun test test/player-feedback.test.js test/world-visual-feedback.test.js test/dear-congress-feedback.test.js`: 13 passed, 0 failed, 84 assertions.
- `git diff --check`: passed.
- `TMPDIR=/private/tmp bun install --frozen-lockfile`: passed, no lockfile changes.
- `TMPDIR=/private/tmp bunx playwright test test/e2e/player-feedback.e2e.js`: blocked by existing node_modules Bun shim (postinstall not run).
- Retried with temporary config `/private/tmp/she52-playwright.config.mjs`, absolute installed Bun, isolated port 3192: server startup blocked by EADDRINUSE. Chromium did not execute; no screenshot captured. Default port 3000 also returned EADDRINUSE. No existing process was stopped.

The committed browser test covers the normal World entry, unchecked consent,
opt-out with no request, network-error retry, minimal payload, omitted cookies
and referrer, and success consent reset. It mocks the collection transport;
real persistence and failure paths are covered by the API tests. Run it in a
working local browser/server environment before final review. No deployment,
production data change, commit, or PR publication was performed. Working branch:
`mini/SHE-52`.
