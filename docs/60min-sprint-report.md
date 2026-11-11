# HappyBearLandia November 10 sprint report

Base `fd43cc739b82b39dfe85a72db713b6d1ddaaf450` includes PR #8. Three isolated feature owners implemented Time Machine, Bakery, and the Causal Inspector while the integration checkout handled the homepage, Living City, and Discoveries. The environment supported four concurrent agents including integration.

Run `bun --no-env-file run server.js` with a temporary database or `HBL_WORLD_DB_PATH=:memory:`. The examples below assume `PORT=3000`.

| Experience | Local URL | Browser interaction |
| --- | --- | --- |
| Universe home | [Home](http://127.0.0.1:3000/) | Choose an adventure card. On narrow screens, use the card before activating a preview. |
| Time Machine | [Time Machine](http://127.0.0.1:3000/world/causal.html) | Record the seeded scenario, play stored months at 1× or 4×, jump to the next event, and read the checkpoint changes. |
| Living City | [Living City](http://127.0.0.1:3000/world/living-city/) | Run the commute intervention and select an exact pair to inspect the scorecard. |
| Riverside Bakery | [Bakery](http://127.0.0.1:3000/world/journeys/bakery.html) | Open the Case File, jump to a recorded event and compare the last-chance intervention. |
| Causal Inspector | [Inspector](http://127.0.0.1:3000/world/causality/inspect.html) | Open from a recorded Time Machine month, focus an event, then follow recorded dependencies or opt in to correlations. |
| Discoveries | [Discoveries Atlas](http://127.0.0.1:3000/world/discoveries/) | Choose a recorded month, inspect the findings, and open a linked checkpoint. |
| Saved Future Journey | [Worldline](http://127.0.0.1:3000/tools/future-journey.html) | Create the guided demo. Enter 3D World, open the exact household, return to Worldline, scrub saved points, and save a paired rain fork. |
| Operations | [Simulation Health](http://127.0.0.1:3000/tools/simulation-health/) | Compare the build identifier with `/api/health` and `/api/ready`. |

The Worldline and House links carry the saved experiment, canonical Population resident, and exact tick. Scrubbing traverses recorded checkpoints in the compatible lineage. Decision Studio’s monthly housing model has a separate entity namespace and clock. An authoritative handoff would require a shared versioned run and entity/time mapping emitted by both models. The Causal Inspector graph displays links present in returned City records.

| Isolated handoff | Revision | Owner verification |
| --- | --- | --- |
| Time Machine | `d15c9dc5ef743633badd59a18d881eb55626dc25` | Six Playwright tests and a browser bundle. |
| Bakery | `bd2d73f8df0153891295b84efcf4f3e0296b17df` | Three Playwright and three Bun tests, plus a browser bundle. |
| Causal Inspector | `f0d3c8dd6cc7ae0b42f2f4e88bdf2b90db3dbfee` | Three Inspector and two Time Machine Playwright tests, 11 Bun tests, plus a browser bundle. |

See [release audit](release-audit.md) for combined verification, outstanding failures and release impact. See [release checklist](release-checklist.md) for the next candidate and deployment gates.
