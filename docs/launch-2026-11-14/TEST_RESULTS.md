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
