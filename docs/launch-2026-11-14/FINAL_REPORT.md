# Civic launch implementation report

## Delivered local candidate

- Homepage prioritizes the60second housing demo with requested copy, keeps all experiments and direct World navigation.
- Main receives the existing sprint Run reliability repair: visible progress, completed/failed/cancelled states, native worker errors, retry, stale-response protection and120second deadline.
- Existing law receipt is reused unchanged. API now has a30second cooperative deadline and504 failure instead of an unbounded comparison wait.
- Strict public revision/seed/law/strength/model context joins Civic and HBL without private text, identities, tokens, arbitrary origins or inferred outcomes.
- HBL shared recipe entry directly runs the same bounded default synthetic world/horizon as the API; map services and captured legal packages are unnecessary. Mobile dialog stays bounded; version mismatch and unsupported context fail explicitly.
- Companion Civic candidate puts the native explorer first, collapses advanced synthesis controls, labels structured synthetic amendment scope, supports actor/checkpoint inspection and share/reopen, validates request identity and deadlines, fixes exact-origin CSP and source entry/navigation defects.

HBL integration branch: `codex/civic-launch-integration-20261114`, based onmain3faa2699. Independent entry commit914ce3e6 and QAcommite827be67 were integrated asdd9bee4a/d4532372. Parent contract/integration and companion commits are listed in the PR handoff. Primary dirty sprint checkout and existing workers/worktrees were preserved.

See TEST_RESULTS.md for actual commands and counts: combined HBLbrowser9/9, landing3/3, startup6/6,106model replay cases and focused API/replay/unit suites passed. These are local candidate results, not production qualification.

## Release blockers / incomplete plan items

No production deployment or protected-branch merge. Live URLs remain https://happybearlandia.fly.dev/ and https://civic-synthesis.fly.dev/. Read-only audit found unknown/null serving commit identity and HBL API preflight404. Existing HBL Dockerfile defaults HBL_BUILD_ID to unknown when a build does not provide it; that is a source explanation, not proof of the historical image's build invocation. Current Civic build pipeline already requires a validated40hex buildcommit; runtime null identity therefore cannot be fixed by inventing a SHA. Release owner must inspect the actually deployed image/release and publish an approved tagged build.

The entire24hour plan is not claimed complete. Full flagship-to-saved-civic-proposal binding, all proposal card/objection/outcome acceptance, aggregate funnel instrumentation, real participation privacy audit, all-browser accessibility qualification and release staging remain open. P1/P2 are held. Existing event provenance is reused; receiptv1 is not expanded to invent causal event IDs absent from it.

## Private outreach

20 personalized drafts with20 verified official organization routes are outside public Git in an operator-private0700 directory.11 readable email routes,5forms,2obfuscated email links,2phone-only routes; only3named roles verified.17named-recipient selections remain. All pending approval;0sends/submissions/calls/replies/interviews. Public OUTREACH_PLAN.md contains organization slots and review workflow only.

## Next highest-value action

Human review of both tested integration branches, resolve any required CI/a11y findings, reconcile the serving release identities, then verify an explicitly approved staging pair with rollback. Only after those gates should production release, launch promotion or individual outreach sending be authorized.

## Review handoff

- [HBL draft PR320](https://github.com/adnanwahab/happybearlandia/pull/320), source revision `dc6b65f631017ee5fc82c1c99a73e1d4d8453d8e` plus this evidence-only follow-up.
- [Civic draft PR123](https://github.com/adnanwahab/dear_congress/pull/123), revision `0028e961578ca3d906550b07648daa9e4c6c3631`.
- Civic final mandatory suite536tests/106478assertions, typecheck/routes and focused accessibility5/5 passed. Real local cross-app browser receipt journey passed. Both branches remain draft; review, hosted CI and release approval are separate gates.

---

## Earlier independent sprint audit (historical evidence)

The following records the earlier checkout and observations named within it.
Later integration evidence above supersedes its implementation-status statements;
production and acceptance gaps remain explicit. Both source reports are retained.

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
