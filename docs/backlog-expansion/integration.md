# Backlog integration candidate

Baseline: 1b19358. Isolated branch: codex/backlog-integration. Finalized Future Machine commits through 9691d0e retained by fast-forward; original checkout untouched.

Acceptance: integrate each committed track through normal Decision Studio entrypoints, run focused and existing regressions, retain exact model/run/seed/time identities, and report ticket-specific limitations. No paid calls, external submissions, deployment or release merge.

Dependencies: track adapters and tests precede shared mounts; replay requires engine contract review; product workflows require durable local server integration; browser acceptance follows mounts. Shared entrypoints belong to this coordinator.

Initial verification: bun run test:decision and bun run test:advanced passed on the retained candidate. No new backlog ticket is claimed complete from baseline tests.

Track product-workflows stopped before implementation because its managed worktree writes were denied. This is an environment blocker, not delivered functionality. Other tracks remain in progress.

Integrated increments: compatibility 1170eb6 → 4665626; presentation b6e9f46 → 46559a0 (adapter only, unmounted); methodology ba24c78 → a8e4daa; sharing 4d55b57 → 7665c24. Methodology now exposed by existing evaluation panel; appendix by normal printable brief. Focused combined checks: 20 tests / 104 assertions; brief/sharing checks: 14 tests / 86 assertions; provider boundary six tests / 12 assertions. Browser evidence pending. QR, sound and stress presentation remain unimplemented in delivered tracks.
