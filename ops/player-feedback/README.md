# Consented player feedback — SHE-52 / SHE-586

World controls contains a closed-by-default optional Feedback disclosure. It
never opens automatically or prompts again, including on reload. After reading
the privacy disclosure and checking consent, Wow or Confusing sends one reaction
for the selected World feature. World/exploring is the default; feature selection
is explicit, not inferred from gameplay. Wow maps to the existing v1 `favorite`
category. Consent resets on success, close, dismissal or local clearing.

Clear local feedback aborts the browser request and removes local choices and
consent. It does **not** withdraw an already accepted anonymous count. This limit
is disclosed before consent and again after clearing. Closing during a request
cannot retract a count already accepted by the server. Retrying an uncertain
receipt can count twice; the UI says so. No local/session storage or identifiers
are introduced. A stale response cannot overwrite cleared or newer feedback.

The UI has native keyboard controls, Escape-to-dismiss with focus restoration,
44px minimum button heights, polite status and visible focus. It uses static DOM
and CSS with no animation, GPU, canvas or simulation dependency. Collection is
optional; failure does not affect gameplay. Requests omit credentials and referrer
and time out after eight seconds. No live service was enabled or deployed by this
local change. The server route reuses the existing lazily initialized collector.

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

Historical SHE-52 verification (2026-11-12):

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

SHE-586 verification and remaining browser/withdrawal limitations are recorded in
[the review](../../docs/reviews/SHE-586.md). Focused browser command:
`HBL_BUN_EXECUTABLE=/absolute/path/to/bun bunx playwright test --config test/player-feedback.browser.config.js`.
The override avoids a known broken local Bun shim; omit it on normal installs.
