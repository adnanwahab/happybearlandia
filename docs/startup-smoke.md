# Local route startup smoke

Run `bun run test:startup` from the repository root after installing the locked
dependencies and Playwright Chromium. Set `HBL_STARTUP_SMOKE_PORT` to override
39961; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an installed browser.
The command starts its own server with disposable stores and refuses to reuse
an existing server. It returns nonzero for any failed route and continues
checking the other routes. No build ID, deployment or production URL is needed.

Six routes cover home, World, Future Machine, Saved Future Journey, Simulation
Health and the route directory. World uses the existing pinned synthetic demo
mode with 30 residents and low quality to avoid map-service startup dependencies;
this does not verify ordinary real-geography loading. Future Machine opens idle
rather than automatically computing 120 months. Home embedded previews are
blocked so their startup work is outside this check's scope.

The console prints one JSON record per route. Each test attaches the same
`startup-report`; the aggregate Playwright JSON is written to
`test-results/startup-smoke-results.json`, with failure traces under
`test-results/startup-smoke`. Reports include HTTP status, verified visible
selectors, startup faults and disabled controls. A failing selector appears in
`failure`; only successfully observed nodes are marked visible.

Disabled-control descriptions come from UI aria-description, title or
aria-describedby text. Missing descriptions are explicitly reported as
unobserved. The idle Future Machine timeline additionally has an asserted
initial-state capability reason: no paired run exists until Fork City. This is
identified as a smoke-contract interpretation, not observed UI copy. These
reports do not claim every disabled control has accessible explanatory UI.

This check verifies startup, not complete simulation correctness, frame rate,
external service availability, all links in the gallery, or production storage.
Keep running the existing focused journey tests and production release smoke
for those separate acceptance gates. No deploy, merge or saved-run action is
performed by this check.
