# Backlog integration candidate

Baseline: 1b19358. Isolated branch: codex/backlog-integration. Finalized Future Machine commits through 9691d0e retained by fast-forward; original checkout untouched.

Acceptance: integrate each committed track through normal Decision Studio entrypoints, run focused and existing regressions, retain exact model/run/seed/time identities, and report ticket-specific limitations. No paid calls, external submissions, deployment or release merge.

Dependencies: track adapters and tests precede shared mounts; replay requires engine contract review; product workflows require durable local server integration; browser acceptance follows mounts. Shared entrypoints belong to this coordinator.

Initial verification: bun run test:decision and bun run test:advanced passed on the retained candidate. No new backlog ticket is claimed complete from baseline tests.

Track product-workflows stopped before implementation because its managed worktree writes were denied. This is an environment blocker, not delivered functionality. Other tracks remain in progress.

Integrated increments: compatibility 1170eb6 → 4665626; presentation b6e9f46 → 46559a0 (adapter only, unmounted); methodology ba24c78 → a8e4daa; sharing 4d55b57 → 7665c24. Methodology now exposed by existing evaluation panel; appendix by normal printable brief. Focused combined checks: 20 tests / 104 assertions; brief/sharing checks: 14 tests / 86 assertions; provider boundary six tests / 12 assertions. Browser evidence pending. QR, sound and stress presentation remain unimplemented in delivered tracks.

Final integration inventory: all ten delivered track commits retained; product-workflows produced no commit. Mounted search (82), paired schematic comparison (87/117/119), explanations (89/107/108/109), PDP chart (95), methodology evidence (160–164), appendix (174). These are implemented increments, not blanket historical closure. Existing Decision/Advanced suites pass; browser bundle 54 modules passes; combined backlog contracts 53 tests/278 assertions pass.

Remaining: factorial execution controls (96); checkpoint engine hooks, immutable persistence, approved nested routes and promotion contract (113/131); viewport flight host comparison reader and lifecycle wiring (111/112/184); interpolation renderer/playback (183/185); stress presentation/sound (186/187); QR (177); durable workflows (197/198). Live provider validation (63/64), browser engine coverage (191), blind empirical evaluation/calibration (162–164) remain unsupported/pending. No fabricated data or remote side effects.

Integrated real browser regression: `HBL_PLAYWRIGHT_PORT=39821 HBL_PLAYWRIGHT_PARTY_PORT=39822 bun node_modules/@playwright/test/cli.js test test/e2e/advanced-loop.e2e.js --workers=1` passed: 1 connected loop, 35.4 seconds. Exercises actual production route, approved building, 400 compact stored futures, failure/fix/ghost/enter/explain/fork/optimize/stress/brief. This preserves existing workflow; new feature-specific browser assertions remain pending. Node executable unavailable; Bun ran installed Playwright successfully. No new browser engines installed.
