# Local browser suite isolation

The root `playwright.config.js`, `test/first-run.browser.config.js`,
`test/plan-choices.browser.config.mjs`, `test/future-machine.browser.config.js`
and `test/startup-smoke.config.js` now allocate their default ports through the
OS on `127.0.0.1`. First-run and Plan Choices no longer compete for 39889.
Explicit `HBL_PLAYWRIGHT_PORT`, `HBL_PLAYWRIGHT_PARTY_PORT`, `HBL_PLAN_TEST_PORT`,
`HBL_FM_PORT` and `HBL_STARTUP_SMOKE_PORT` remain authoritative in their respective
configs. `0` requests automatic allocation. Empty, malformed and out-of-range
values fail immediately; occupied explicit ports report a collision. These
configs refuse to reuse an unrelated server.

`test/support/browser-environment.js` creates a fresh temporary directory per
suite for World, monthly City, Decision, reality shares, character journals,
Detective, patch votes and temporal history. The temporal history environment
path requires the integrated server's `HBL_TEMPORAL_DB_PATH` support. Servers use
`--no-env-file`, so a local app `.env` file does not replace these test paths.
Artifacts keep their existing configured destinations. The helper removes only
its owned temporary directory on normal runner exit; a force-killed runner may
leave a temporary directory to inspect and remove later.

Playwright reimports configuration in workers. A shared `globalSetup` passes
metadata descriptors to those workers at runner setup and restores its private
environment variable at teardown. Config imports themselves never mutate
`process.env`. Workers borrow the exact parent port and store and never delete
that store. The shortened party test obtains the separate party service URL
from runner metadata instead of assuming 3257. A caller using that test outside
the root config must explicitly supply `HBL_PLAYWRIGHT_PARTY_PORT`.

Playwright requires a known URL before launching its server command. The OS
probe therefore closes immediately before the child binds. Another process can
still claim that port in the small handoff window; startup then fails rather
than probing an unrelated app as a successful fixture. This does not remove OS
socket restrictions: sandbox `EPERM`/Bun `EADDRINUSE` may require a permitted host
run, and browser Mach-port restrictions are independent of port selection.

Verify helpers and real concurrent worker handoff without launching a browser:

```sh
bun --no-env-file test test/browser-environment.test.js
```

The regression starts two Playwright runners concurrently against disposable
loopback fixture services. Both must discover their own URL, start with an
empty real SQLite database, write their own receipt and clean up their store.
It also verifies explicit ports, collisions, invalid inputs and all five
migrated configs' URLs, environment paths and reuse policy.

## Remaining migration scope

The inventory contains 111 existing root/test configuration files (112 with the
new isolation fixture), including 84 existing own `webServer` declarations.
Sixteen configs directly import the Future Machine base. Those that preserve its
server environment inherit its temporary stores and loopback setting. Overrides
that replace the entire environment do not gain those paths automatically.

This is a bounded migration, not a claim that every suite is isolated. In
particular these directly derived configs still replace the base's automatic
port with a legacy fixed default: evidence-trail-real, first-interaction,
first-play-diagnostics, future-machine-copy, future-machine-race,
future-machine-recent, future-machine-share-card,
future-machine-share-reliability, onboarding-experiment, renderer-disposal and
symphony-unblock. Other standalone configs also retain their old setup. Migrate
those through the helper with their existing override names and route-specific
readiness checks in follow-up work. Production smoke and externally managed
server-only configs are intentionally unchanged.

The server now accepts `HBL_TEMPORAL_DB_PATH` and
`HBL_PLAYER_FEEDBACK_DIR`; the shared helper supplies disposable paths for both.
A suite exercising consented feedback POSTs must use that environment rather
than a developer-owned server. Existing handler defaults remain unchanged.
