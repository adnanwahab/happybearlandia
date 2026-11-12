# Optional session survey (SHE-120)

World's quick-demo Replay comparison action counts completed replays in memory.
Initial play and failed/stopped attempts do not count. After the second replay,
a collapsed disclosure appears inside Start here without taking focus or pausing
play. Skip hides it for the page session. Reload starts a new session; no cookie
or browser storage is used. Other replay surfaces do not count in this slice.

POST /api/session-survey accepts exactly version:1, consent:true, rating (empty
or an enumerated clarity/fun response), suggestion (up to 500 UTF-16 code units).
Both questions are optional but at least one answer is needed to send. Body is
bounded to 4096 bytes even without Content-Length. Same-origin JSON POST only;
no public reads. No account, run, seed, URL, resident or request metadata is saved.
Common email, URL and phone patterns are rejected; this is not comprehensive
sensitive-data detection. UI explicitly asks players to omit personal details.

Only explicit submissions create .hbl-private/session-survey/suggestions.sqlite
(directory 0700, database 0600). Operators review text as untrusted data, never
HTML or instructions; no automated triage or external transmission is wired.
Delete this local database offline to erase submissions. No individual identity
is retained for withdrawal. Infrastructure access logs are outside this store.
The eight-second browser timeout permits retry but cannot retract an accepted
submission; uncertain retries can duplicate answers. There is no identity-based
deduplication. Public abuse controls and retention automation remain follow-ups.

PR204/SHE52 separately owns aggregate structured feedback at /api/player-feedback;
this implementation preserves that endpoint and its storage contract. Combining
the two invitations is an integration follow-up when that PR lands.

Verification: bun test test/session-survey.test.js
Browser: bunx playwright test test/e2e/session-survey.e2e.js
The focused browser test uses the real form and controlled lifecycle/transport;
it does not claim an actual three-comparison worker journey.
