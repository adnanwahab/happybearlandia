# Executed launch checks — November 14, 2026

HBL source baseline main3faa2699 plus isolated launch integration. These are actual executions, not proposed commands. Reports/logs remain in /private/tmp; browser traces/screenshots in test-results/civic-launch. No production model POST or release performed.

| Command / check | Actual result |
|---|---|
| `bun test --timeout 60000 test/civic-context.test.js test/law-behavior-playback.test.js test/law-behavior-api.test.js test/laws.test.js test/law-impact.test.js test/law-mechanism-contract.test.js test/law-visuals.test.js` | 42passed,0failed,678assertions |
| `bun test --timeout 60000 test/world-cycle-lifecycle.test.js test/population-scheduling.test.js test/civic-context.test.js test/law-behavior-api.test.js test/law-behavior-playback.test.js` after QA integration | 22passed,0failed,171assertions |
| `bun test --timeout 60000 test/future-machine-data.test.js test/future-machine-diff.test.js test/future-machine-share.test.js test/future-machine-fallback.test.js test/future-machine-evidence-trail.test.js test/city-replay-golden.test.js` | 44passed,0failed,340assertions; actual persisted120month pair and seed42Month0/16 checks |
| `bun run test:city` | 22passed,0failed,134assertions |
| `bun run test:models` | 106/106 replay invariant cases passed; housing.houston-stock-error rule passed |
| `bun run test:startup` | Final6/6passed23.9s; initial5/6 exposed lost eager World link, fixed link rather than weakening test |
| `bun test test/html-navigation.test.js test/universe-shell.test.js test/onboarding.test.js` | Bun matched2existingfiles;10passed,0failed,197assertions; no claim an absent third suite ran |
| `bunx playwright test --config test/civic-launch.browser.config.js` | Final9/9passed22.7s: actual paired population/city workers,320px/reducedmotion, strength revision, version mismatch, unsupported context, real weekly repeat, failed-worker retry, cancellation and deadline |
| Dedicated landing browser config | 3/3passed12s at1440/390/320, real keyboard CTA→seed42demo ready; test-only shared-loopback allowance used, production limit unchanged |
| Browser build `bun build world/constitution-city/app.js --target browser --outdir /private/tmp/hbl-launch-build` | 51modules bundled successfully |
| `git diff --check` | Passed |

## Browser evidence boundaries

The Civic browser run uses real local HBL API model output. An exact provider transport rewrite forwards the HTTPS HBL provider URL to the isolated local backend; it does not fabricate receipts. This tests native React, API contract, CSP permission, same-seed baseline,50%edited behavior, recorded actor/time, WHY/limits and safe public sharing. It does not establish that production has that API: live OPTIONS currently404.

HBL recovery tests inject a failed/silent worker only for failure/cancel/timeout paths; successful execution/replay uses the real Worker. Timeout test accelerates the existing120second timer; no production timeout is reduced. Civic recipe tests do not mock model outputs. Screenshots were visually inspected.

Earlier law recipe browser failures exposed missing explicit synthetic-context connection and a strict-locator ambiguity; fixed before final pass. Software SwiftShader QA was stopped due excessive CPU; final combined browser run uses installed Chrome/native Metal. No renderer performance number is claimed.

## Not established

No complete Safari/Firefox/a11y matrix, production serving-SHA parity, staging deployment/rollback, real user study, civic ballot submission or private-journal legacy authorization review. Companion Civic mandatory suite and accessibility results are recorded in its implementation documentation and final report. Test case totals overlap across focused runs; do not sum them into a unique-test count.

## Reviewed screenshots

- [HBL mobile recorded playback](assets/hbl-law-mobile.png)
- [World completed real-worker comparison](assets/world-completed.png)
- [Civic native mobile receipt](assets/civic-native-mobile.png)

All show synthetic local model data. They are evidence of rendered local behavior, not proof of deployment or calibrated outcomes.

## Companion Civic final verification

Final companion commit `0028e961578ca3d906550b07648daa9e4c6c3631`: `bun test`536passed,0failed,106478assertions; `bun run typecheck` and `bun run test:routes` passed. Real browser script `scripts/verify-law-launch-browser.mjs` passed3 actual HBL model requests and the native320px/reduced-motion/edit/actor/WHY/share/version/unsupported paths described above. Focused `/synth` accessibility passed5/5 projects (axe critical/serious and keyboard focus/skip-link checks). No voting test/action selected. Optional accessibility output/dependencies were moved outside checkout after the existing CSS source audit traversed generated assets; its assertions/timeouts were retained, and final mandatory suite passed cleanly.

Draft review candidates: [HBL320](https://github.com/adnanwahab/happybearlandia/pull/320), [Civic123](https://github.com/adnanwahab/dear_congress/pull/123). CI status is independently reported on the actual PR revision; local passing checks are not a claim all hosted jobs passed.

---

## Earlier independent sprint audit (historical evidence)

The following records the earlier checkout and observations named within it.
Later integration evidence above supersedes its implementation-status statements;
production and acceptance gaps remain explicit. Both source reports are retained.

# Test results — 2026-11-14

## HappyBearLandia

Commands ran against local checkout `00e974bdecf65e4a94b99eb34529574bfaa77e30` unless noted.

| Command | Result | Notes |
|---|---|---|
| `bun test test/world-cycle-lifecycle.test.js test/population-scheduling.test.js` | **6 passed, 0 failed; 48 assertions** | First run exposed a test fixture missing `cycleResults` and Bun discovering duplicate tests under nested `workspaces/`. Added the missing fixture state and configured `[test].pathIgnorePatterns = ["workspaces/**"]`; final run contains only the root checkout tests. |
| `bun run test:city` | **22 passed, 0 failed; 134 assertions** | City system, project-unblock, and server civic API integration. |
| `bun test test/future-machine-data.test.js test/future-machine-diff.test.js test/future-machine-story.test.js test/future-machine-scene.test.js test/future-machine-ui.test.js test/future-machine-recipes.test.js test/two-futures-evidence.test.js` | **53 passed, 1 skipped, 0 failed; 328 assertions** | The skipped case is Chromium controls/loading/failure/keyboard/mobile/cleanup. Seed-42 first physical divergence at Month 16 with 24 homes and matched 120-month replay pass. |
| `bun run test:models` | **Passed** | Validator completed 106 replay cases; `city.replay-invariants` passed. No model rules changed. |
| `bun run test:startup` | **Blocked before browser launch** | Playwright webServer could not bind port 39961 (`EADDRINUSE`). No startup journey or screenshot is claimed. |

## Civic Synthesis

Commands ran in checkout `174187454778d8130c19824fd93064c4f7260741` (`main`), which predates merged PRs #120/#121.

| Command | Result | Notes |
|---|---|---|
| `bun test` | **506 passed, 0 failed; 105,713 assertions across 126 files** | Passed with permission for disposable `data/test-db-*.json` fixtures and ephemeral local test servers. The initial restricted run was blocked by `EPERM` and `EADDRINUSE`, not failing assertions. |
| `bun run typecheck` | **Passed** | `tsc --noEmit`, exit 0. |
| `bun run test:routes` | **Passed** | Production HTML, bundled assets, read API, and 404 checks. Required test-only ephemeral server permission. |
| `bun run test:a11y` | **Unavailable** | The accessibility package has no installed `playwright` executable; command exited 127 before tests. No dependency install was attempted. |

## Live browser observations

- HBL homepage presents a primary `Play Demo` link to the Future Machine and labels the scenario synthetic. The simulation was not started.
- Civic `/synth` shows the frozen package-capture comparison and synthesis controls. Native law-behavior actor playback is absent; footer reports `Build unknown`.
- Civic's HBL PR preview labels itself non-binding and reports governance paused, 0/100 approved roster, no allowed bases, no required checks, and four fetched open PRs.

These are read-only page observations, not a live API request, runtime, accessibility, browser-size, or release-parity test. The Civic integration is not verified as deployed.

## Diff review

`git diff --check` passed. HBL defines no repository-wide lint/typecheck script.
No commit or PR was created.
