# SHE-789 browser-local session diagnostics

Integration hooks (ready): add `<script type="module" src="/world/session-recorder.js"></script>` to World. Add a `/logs` navigation link. Recorder is inert until consent on `/logs`.

Performance/render owner: expose a cheap `window.hblSessionLogState = () => ({minute: livingWorld?.active ? livingWorld.getClockMinute() : world.t, seed: /* actual numeric model seed or null */, mode: livingWorld?.active ? 'living' : 'legacy', camera: camera.position.toArray(), target: controls.target.toArray()})`. Do not call expensive snapshot/export methods for this hook. No location/identity/free text fields are accepted. Unknown numeric seed remains null. Parent can integrate this hook after performance work.

Implementation in progress. `/logs` page and scrubber show a diagnostic trajectory/timing replay, explicitly not a game video or deterministic simulation replay. No remote upload; seven-day expiry, five sessions, 1800 events/30 minutes per session. Privacy consent is off by default and revocation deletes local logs. This uses the existing cryptographically random first-play session ID utility, with separate storage/schema from simulation authority replay.

## Delivered and verified

- `server.js` adds `/logs` and `/logs/` without changing unrelated routes or existing edits.
- `world/session-log.js`: closed diagnostic schema; new records and existing stored records are both minimized. Numeric seeds only; unknown seed/state explicitly null. Cryptographically random page-session identity reuses `createFirstPlaySessionId`. No identifiers across sessions.
- `world/session-recorder.js`: capture only after consent; coarse click locations/types, one state/FPS sample per second and fixed error categories. No recorder animation loop when consent is off. Persistence batches every five seconds and flushes on visibility/page exit. Other-tab opt-out immediately cancels capture. No network transport.
- `world/session-logs.{html,css,js}`: dark/serif/sans interface, consent, delete, session picker, play/pause, scrubber, click indicators, recorded camera trajectory, clock/seed/FPS/max-frame facts and error timeline. Explicit diagnostic-replay limitation and missing-state labels.
- Hard limits: seven-day age expiry on access/write; five sessions; 1,800 events; 30-minute session ceiling. Storage denied/full and unavailable secure RNG fail closed. Browser eviction is possible. Expiry runs on app access, not an operating-system background deletion service. Export, uploads, video and full-state recomputation are not provided.

### Verification

`bun test test/session-logs.test.js test/first-play-events.test.js`: 18 passed, 0 failed, 317 assertions (includes original first-play schema regressions).

`bunx playwright test --config /private/tmp/hbl-session-logs.config.mjs`: 2 passed, 0 failed against the normal production server on port 62693. Tests exercise `/logs`, persisted consent, production recorder module, numeric seed/time/camera capture, scrubber, play/pause, revocation/deletion, no-consent behavior and 390px overflow. Browser run required sandbox escalation; it succeeded. Screenshot `/private/tmp/hbl-session-logs.png` was visually inspected. The test state is synthetic; recorded 60fps in that screenshot is not a World performance claim.

`git diff --check -- server.js world/session-log.js world/session-recorder.js world/session-logs.html world/session-logs.css world/session-logs.js test/session-logs.test.js test/e2e/session-logs.e2e.js`: passed.

Coordinator still owns the final integrated World smoke: add script/link and cheap state hook above, restart its server to load `/logs`, enable consent, play World and confirm real camera/time/seed state in the returned log. Dedicated test server running at `http://localhost:62693/logs` (exec session 29878); parent server 62691 was untouched. No deployment or production data changes.
