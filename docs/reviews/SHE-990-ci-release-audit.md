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

## Additional pre-existing CI browser/runtime defects

The same original head's civilization-storm job134059656935 has two distinct
failures: observational civilization config cannot load (`import.meta` outside
a module), then gating first-run guided launch times out120s before ready
(4pass1fail). CI invokes Node-loaded `.js` configs in a package without ESM type.
The narrow config fix uses the same repository-root `process.cwd()` convention
as startup/other browser configs; no global package boundary change.

First-run previously launched the default Chromium headless shell, which was
known from the retained temporal investigation to produce native GPU failures.
Select installed full `channel:'chromium'` consistently with accepted startup and
temporal, retaining unsafe-WebGPU/software flags, required actualWebGPU assertion
and every test. `HBL_PLAYWRIGHT_PORT=43205 ./node_modules/.bin/playwright test --config=test/first-run.browser.config.js --workers=1`:5passed0failed3.6s, including guided realWebGPU launch and explicit unavailable-GPU view-only fallback.
This is local Chromium validation, not proof of a native Linux hardware adapter.

Civilization `--list` now loads all27tests. The actual suite subsequently exposes
a stale Houston carousel selector: test expected old `Open ... in a new tab`
aria-label, while current `tools/iframe-gallery.js` creates `Enter Houston
Neighborhood Map`. Update only that semantic link locator; preserve its exact
route assertion, iframe canvas checks, keyboard view toggle and screenshot change.
No product code or requirement is loosened. A parallel focused retry refused
the occupied54388port; do not reuse the active suite's server or suppress it.

Additional audited checks: canonical controls19/19 and actual Social→Talk pass
with empty JS/GPU arrays at `/private/tmp/hbl-pr470-release-controls/evidence`.
Owned local server and browser sessions stopped. Production SSH tooling and
release storage preflight work read-only; backup tool present, /data free675388KiB
and /tmp free7706944KiB. No backup, cordon, deploy or production write performed.

Actual observational civilization run after config loading fix:20passed,2existing
adapter-conditional skips,5failed,4.3min. One failure is the old Houston selector;
with the approved semantic-label update, focused Houston cases2/2pass4.5s,
retaining iframe/canvas/keyboard-view assertions. Three release-journey cases
remain real pre-existing contract failures: tests remove WebGPU and require
exact live saved-checkpoint navigation/Canvas2D or fatal-return path, while
current World redirects to static-city view-only (explicitly no model restore).
Do not weaken these assertions or claim they pass. This suite is explicitly
observational in existing CI; these failures remain owned by the release/fallback
contract rather than the one-line470presentation fix.

The90-day case failed on ENOENT trace recording because a concurrent focused
retry cleaned the shared Playwright outputDir before refusing the occupied port.
That harness collision was caused by this audit; it is not evidence of a model
failure. Rerun that case alone using a distinct output directory. No timeout or
assertion changed.
