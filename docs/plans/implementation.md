# One Living World implementation plan

Source: the user-provided “HappyBearLandia: One Living World, 29 Connected Experiences” proposal (2026-11-10). Reuse the existing HappyBearLandia and Dear Congress projects. This plan records milestones, not a claim that all proposed integrations exist.

## Principles

- Keep existing standalone routes and the app registry. Use versioned shared contracts and explicit adapters; do not create a protocol project.
- Navigation context carries universe, world, scenario, experiment, run, branch, tick and selected entity. Carrying an ID does not establish an authoritative entity mapping or replay capability.
- Keep observed geography, synthetic modeled consequences and fictional narrative distinct.
- Private experiments never silently change another saved world. Reject malformed, foreign and stale iframe messages.
- Enable an integration only when its supported inputs, outputs, provenance and complete user journey are verified.

## P0 milestone 1 — Universe shell and shared navigation

Status: COMPLETE (2026-11-10).

Deliver shared discovery and navigation across the 29 registered experiences, preserving context without loading 29 GPU scenes simultaneously.

- [x] Reuse the 29-app registry, search, evidence labels and one active iframe.
- [x] Reuse strict canonical URL context and validated iframe contracts.
- [x] Mount shared navigation in registered standalone and embedded experiences.
- [x] Preserve context through app links, shell transitions, browser history and refresh.
- [x] Show invalid context without silently replacing it with a different world.
- [x] Verify registered routes and one real-app browser journey, including iframe origin/source rejection.

Acceptance: open a real registered experience from the shell with a complete context; navigate to another experience using its shared chrome; verify the same scope and selection in the shell and child; use Back and refresh; verify a standalone contextual link returns to the shell. Route checks cover all registered experiences. No fixture document substitutes for the real apps in this acceptance journey.

Verification: `bun test test/universe-shell.test.js test/html-navigation.test.js test/local-journeys.test.js` passed 14 tests / 200 assertions. `universe-real-journey.e2e.js` plus `universe-shell.e2e.js` passed 5 browser tests: real Worldline → Quote Carousel → Worldline, Back, refresh, standalone return, invalid context, all 29 HTTP routes, validated iframe selection, and narrow layout. The bootstrap browser bundle also passes. HTML integration covers 26 actual documents shared by 29 experiences. The route check verifies serving and integration, not every experience's simulation behavior or GPU support.

Implementation: `world/universe/app-bootstrap.js`, `html-navigation.js`, `connected-navigation.js`, and narrow HTML response hooks in `server.js`. One active shell iframe is retained. Existing app-specific parameters survive URL context updates. Simulation-state translation and cross-app entity synchronization remain milestone 2 work.

## P0 milestone 2 — Connected core

Status: NOT STARTED as a complete integrated milestone; individual foundations exist.

Compose World, Worldline, House, Decision Studio and Experiments using stored checkpoints and authoritative entity mappings. Reconcile canonical navigation context with existing legacy experiment parameters through explicit adapters. Select a recorded future, enter World, inspect a mapped household and return to the same experiment/run/time. Never represent a single checkpoint as historical replay or a 100-future ensemble.

Acceptance: one saved checkpoint and mapped household survive the entire browser journey, reload and server storage round trip. Unsupported mappings visibly explain their limits.

## P0 milestone 3 — Causal economy and universal inspector

Status: NOT STARTED as a complete integrated milestone; logistics, business, household and inspector foundations exist.

Compose authoritative World road inputs, FlowMap transport outputs, business supply/employment outputs and household economic inputs. Record versioned provenance and expose “Why did this happen?” across supported entities. Extend the existing bakery transport fixture rather than inventing shortage-to-wage effects.

Acceptance: a supported road closure produces recorded transport, business and household consequences; the inspector follows their actual upstream events. Cross-run edges, cycles, invalid inputs and duplicate writes are rejected. See `docs/BAKERY_JOURNEY.md` for current gaps.

## P0 milestone 4 — Branching futures and counterfactual replay

Status: NOT STARTED as a complete integrated milestone.

Provide persisted branches, deterministic replay and supported ensemble generation/selection. Change a transportation assumption, run 100 supported futures, select Future #42, inspect business and household effects, then return to Worldline with the same run and time.

Acceptance: replay matches recorded hashes; private forks preserve the source; assumptions, model versions and limits remain visible; explanation/replay/render budgets are measured.

## P1 milestone 5 — Social civilization

Status: NOT STARTED as a complete integrated milestone.

Connect Living City, Inner Lives, Game, parties and character conversations through stable synthetic people/places and explicit permissions. Distinguish narrative memories from evidence. Validate a shared persistent-character journey before claiming household multiplayer.

## P1 milestone 6 — Research and culture

Status: NOT STARTED as a complete integrated milestone.

Connect remaining experiences as institutions and activities. Scientific outputs affect city state only through justified, versioned regional adapters. Culture can be meaningful without fabricated economic effects.

## Measurement

Track voluntary, local journey counters with existing consent controls: second experience, causal link, completed connected journey, future entry/reopen and saved-world continuation. Do not infer journey completion from page load. Keep performance and security checks attached to each milestone.
