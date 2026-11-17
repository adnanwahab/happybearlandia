# SHE-82 verification — 2026-11-12

Observed checkout base: `b963dd3`, branch `mini/SHE-82`. GitHub issue/PR search for `repo:adnanwahab/happybearlandia "SHE-82"` returned no matches. Linear issue was In Review. No issue state, remote branch or production data changed.

## Reproduce

```sh
bun test test/decision-request-race.test.js test/decision-client-traces.test.js test/decision-integration.test.js test/advanced-studio.test.js test/decision-continuity.test.js test/future-machine-data.test.js
bun build world/decision/studio.js --target browser --external '/vendor/*' --outdir /private/tmp/she82-browser-build
```

The six race cases use deferred promises rather than timing or random scheduling. The actual studio coordinator functions are loaded into a VM with DOM/rendering spies. Lifecycle-only fixtures represent old/new experiment responses; they are not modeled simulation outcomes. Edited inputs change seed 42 to 99 and policy labels old to new. No random seed is used for test scheduling; engine integration/replay tests use their existing versioned fixtures. No simulation rules changed.

Cases: delayed creation; delayed startup; delayed poll success/error after a new run; delayed saved-record success/error; superseded creation failure while a fresh request remains busy; and obsolete reopened watcher progress/error. Each asserts that the active draft/result ownership remains current. The polling case also verifies watcher destruction and that the URL does not revert. Previously displayed experiment results may remain visible with the existing explicit prior-input label until the new run delivers results.

Regression confirmation: running these same tests against `git show HEAD:world/decision/studio.js` produced **0 pass / 6 fail**. With the fix, **6 pass / 0 fail**. The final six-file suite passed **31 tests / 625 assertions / 0 failures**. Adjacent integration verification includes actual Decision API execution, cancellation, persistence and deterministic Future Machine replay. `git diff --check` passed.

Browser bundle succeeded (45 modules), with `/vendor/*` left as the existing runtime import. An initial build without this external option could not resolve the server-provided Three.js path. The repository has no lint/typecheck scripts.

Playwright attempt: `bunx --no-install playwright test test/e2e/future-machine-race.e2e.js` stopped before tests because its web server could not bind port 3100 (`EADDRINUSE`). No browser result is claimed. These coordinator tests verify asynchronous ownership, not native DOM events or actual browser rendering. Future Machine's existing request-identity guard and cancel/restart browser test were left unchanged. Server-side cancellation of superseded Decision jobs is outside this slice; submitted immutable jobs can finish and remain reopenable.
