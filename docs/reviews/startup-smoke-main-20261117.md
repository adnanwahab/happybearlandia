# Startup smoke follow-up on main — 2026-11-17

Base: c3ec93c5 (merged PR #433). Main already contains visible World canvas and guide checks, attached-only top-panel check, startup readiness, route-link unit tests and full Chromium configuration. Keep main’s current primary CTA. Only the missing separate WebGPU console-error collector/assertion is added; uncaught JavaScript errors still fail independently.

Verified in an isolated main-based checkout:

- `bun test test/startup-route-link.test.js`: 2 passed, 0 failed; 13 assertions.
- `HBL_STARTUP_SMOKE_PORT=43182 npx playwright test --config=test/startup-smoke.config.js --workers=1`: 6 passed, 0 failed, 0 skipped, 0 flaky; 3.7 seconds. All six reports contain empty JavaScript and WebGPU error arrays.
- `git diff --check`: passed.

The initial sandbox attempt could not bind the server; the actual browser run above used host execution. No product UI, budget, runtime state, Symphony source or package configuration changed. The untracked root test/e2e/package.json is unnecessary for these commands and is excluded. This focused verification does not establish SHE-990 acceptance, performance-budget compliance or 25-hour reliability.
