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
