# SHE-990 related PR review — November 17, 2026

Read-only review of PR470 (`260a185002eb1809310b75e7d7865d745121a300`)
and PR474 (`fbf4a2aa147670184a554dfdf718f205ab3097cb`) against their actual
GitHub base, main `c3ec93c5719c04bb596f2958d499a1c767da61a4`. The source
repository's local `main` is not that base; all comparisons use the explicit
base SHA. Both heads already descend this base. There are no intervening remote
main commits to replay, so rebasing onto current main is a no-op. Do not rebase
these PRs onto the unrelated local sprint branch. No source PR branches or remote
refs were modified.

Review inspected every changed product/test file, retained receipt and script.
No new correctness defect was identified in the changed implementation. PR470
is a verification-only receipt: its intentionally failing sidewalk reproduction
must remain distinct from the new passing acceptance regression. PR474 removes
the default terminal scrub delay, retains drag cancellation and explicit debounce,
preserves authored facade transforms/materials and releases instance buffers.
Its strict performance targets remain failed according to the retained cold
measurements; focused checks do not supersede that result. No merge or deployment
is authorized by this review.

Checks repeated in the isolated shared-object clone
`/private/tmp/hbl-she990-pr-review`, with dependencies linked from the original
checkout. The original dirty checkout and existing PR worktrees were untouched.
Browser commands required host execution because sandboxed server listen failed.

PR474 exact head:

- `bun test test/future-machine-neighborhood.test.js test/future-machine-resources.test.js test/future-machine-scrub-preview.test.js test/future-machine-scrub-identity.test.js test/future-machine-effects.test.js test/future-machine-scene.test.js test/first-interaction-budgets.test.js`: 38 passed, 1 opt-in skipped, 0 failed; 9,188 assertions.
- `HBL_STARTUP_SMOKE_PORT=43189 ./node_modules/.bin/playwright test --config=test/startup-smoke.config.js --workers=1`: 6 passed, 0 failed in4.2s. Captured pageerror arrays empty. This standalone PR's startup test does not collect GPU console errors; no fresh zero-GPU assertion is claimed.
- `HBL_STARTUP_SMOKE_PORT=43189 ./node_modules/.bin/playwright test --config=test/portal.browser.config.js --workers=1 --grep 'primary launch and Back'`: 2 passed, 0 failed in9.5s, normal and reduced motion.

PR470 exact head:

- `bun test test/temporal*.test.js`: 27 passed, 0 failed; 102 assertions.
- `node --check` for the temporal runner and three retained control/social/sidewalk scripts: all passed.
- `bun --no-env-file scripts/verify-temporal-recovery.mjs`: 6 passed, 0 failed in10.9s. Four integration cases explicitly assert empty JavaScript and WebGPU console-error arrays, including both canonical World cases. The two existing fixture cases do not acquire a GPU renderer.
- `HBL_STARTUP_SMOKE_PORT=43189 ./node_modules/.bin/playwright test --config=test/startup-smoke.config.js --workers=1`: 6 passed, 0 failed in3.5s; captured pageerror arrays empty, with the same standalone GPU-collector limitation described above.
- `git diff --check` against the explicit base passed for both PRs.

Full browser artifacts remain in this clone's `test-results/temporal-recovery`
and startup report; portal output is under `test/test-results/portal` due to its
existing config. Portal updates a tracked generated `.last-run.json` only in the
disposable clone; that generated change is not part of this review.
