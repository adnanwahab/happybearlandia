# SHE-990 CI and deployment audit — November 17, 2026

Owned files: `.github/workflows/core-journeys.yml` and this issue receipt only.
Base: PR470 exact808897d1; root owns integration, communications and deployment.
Plan: inspect actual failed CI, move existing browser installation before the
first real screenshot test that needs it, preserve all assertions and browser
checks, then repeat the normal Mini Symphony suite and verify workflow ordering.
Acceptance: no omitted tests, unchanged install command, real desktop/mobile
screenshot publication/recovery checks pass; remote CI still gates merge.

## Failure evidence and fix

PR470 core journeys `verify` job134059654383, run44089219631, failed on
`bun run test:mini-symphony`: missing Chromium headless shell1243 executable.
The real before/after screenshot test fails at Chromium launch; the normal-entry
screenshots case records failed instead of pr_created. Other tests pass.
The workflow installed Chromium only after Mini Symphony, so a fresh CI runner
could not satisfy these already-enabled browser tests. Move that existing install
step immediately before Mini Symphony; no cache dependency, test skip, threshold
change, continue-on-error or behavior patch. Existing later browser journeys use
the same install. Raw failed log retained privately at
`/private/tmp/hbl-pr470-failed-verify.log`.

## Merge and deployment gates

PR470 has no review submissions, inline threads or discussion comments at audit.
No dependency on474: changed product code is only the legacy paused presentation
settlement. Both base refs are actual remote mainc3ec93c5. Branch protection404
reports unprotected; repository rulesets list is empty. These do not waive the
user's requirement for all checks to pass. CI had pending runs and this real
failed verify job; do not merge the failed head.

No GitHub deployment workflow exists in this checkout. Approved path is the
Fly CLI documented in `docs/release-checklist.md`, `docs/release-operations.md`,
`docs/sqlite-fly-deployment.md`: build from verified merged clean checkout,
`fly deploy --ha=false -a happybearlandia --build-arg HBL_BUILD_ID=<candidateSHA>`,
retain single-writer volume topology, preserve old image and independently
verified consistent backup/restore, run release preflight and exact-build-ID
read-only production smoke. Do not create production test records without
separate authority. User's current explicit deployment request supersedes old
no-deployment status in historical implementation-plan receipts.

Read-only current Fly audit: one stopped app Machine837967a7954128; encrypted
hbl_data volumevol_40o7pzjlmxlw5094 mounted at/data. Two additional volumes are
unattached. Latest release71 complete November14 uses image
`registry.fly.io/happybearlandia@sha256:c028e2026372810f66d5dca1c27b08ba6cb4a225977215de239b36c4933a50f3`.
Automatic volume backups enabled, but this alone does not establish restore
verification. No deployment or production mutation was performed by this audit.

## Local verification

- Exact470808897d1 startup: `HBL_STARTUP_SMOKE_PORT=43201 ./node_modules/.bin/playwright test --config=test/startup-smoke.config.js --workers=1`:6passed,0failed,3.7s. Pageerror arrays empty; suite has no GPU console collector.
- `bun --no-env-file scripts/verify-temporal-recovery.mjs`:6passed,0failed,10.1s; integration JS/GPU arrays empty.
- `HBL_STARTUP_SMOKE_PORT=43202 ./node_modules/.bin/playwright test --config=test/sidewalk-sync.browser.config.js --workers=1`:2passed,0failed,29.3s, desktop13.4/mobile14.5s; JS/GPU arrays empty. Prior43201setup refused an occupied port rather than reusing it.
- `bun run test:mini-symphony` after ordering change:63passed,0failed,524assertions,11files,34.47s. Both previously failing real-browser screenshot cases pass.
- Static workflow order: Chromium install precedes Mini Symphony and its operator browser journey; later Chromium/Firefox/WebKit install remains unchanged. `git diff --check` passes.

Production read-only baseline before any deployment: `/api/health`200statusok and
`/api/ready`200statusready, World/Decision storageok, both report existing build
`2f9741bd8843ba0f5dcd85cf9c343e559e52e79b`. Fly CLIv0.5.10darwin/arm64.
This is the previous build, not proof of candidate deployment.
