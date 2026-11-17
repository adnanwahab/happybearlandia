# Civic engagement launch report — 2026-11-14

## Result

The current product has a visible HBL flagship entry and a substantial deterministic synthetic housing comparison. The local `/world` worker now has bounded progress/cancel/error/retry behavior. The planned native Civic law-behavior explorer is merged in GitHub PRs but is absent from the current local Civic checkout and from the live `/synth` page. Civic production identifies its build as unknown. The joined launch journey is therefore **not ready to promote**.

## Verified in this pass

- Live HBL home page exposes `Play Demo` to Future Machine.
- Live Civic `/synth` shows frozen package capture and experimental synthesis controls, without the native recorded actor behavior viewer.
- Live Civic HBL PR preview labels responses non-binding and reports governance paused, 0/100 approved roster, no allowed bases, and no required checks.
- GitHub reports HBL #305 merged to the sprint branch; HBL #316 and Civic #120/#121 merged to `main`.
- HBL weekly lifecycle + population scheduling tests: 6 passed, 0 failed after correcting the fixture and excluding nested Symphony worktrees from Bun test discovery.
- HBL city suite: 22 passed, 0 failed. Focused Future Machine suite: see `TEST_RESULTS.md`.
- Civic full suite: 506 passed, typecheck passed, and route smoke passed. The optional accessibility command could not find its Playwright executable. See `TEST_RESULTS.md`.
- HBL model validation passed 106 replay cases. HBL startup browser smoke remains blocked before Chromium by `EADDRINUSE`.

## Changes in this checkout

- `.gitignore`: ignore generated nested Mini Symphony worktrees.
- `bunfig.toml`: skip `workspaces/**` during Bun test discovery.
- `test/world-cycle-lifecycle.test.js`: add `cycleResults` to the lifecycle fixture.
- Seven evidence and release documents in this folder.

These are local changes only. No commit, PR, merge, release, deployment, production write, vote, or outreach message was created.

## Next action

Reconcile the approved source and production SHA for both repositories, then complete and verify the already-merged HBL API → Civic native viewer on an approved staging pair. Keep civic governance paused and do not deploy until human review, storage/rollback, privacy, browser, and release-parity gates pass.
