# Riverside Bakery mystery

Open [/world/journeys/bakery.html](/world/journeys/bakery.html) on the application server. The timeline starts in January 2046. Headline links jump to the months that produced the records. The worker reruns a single direct-road intervention from the selected month. The comparison shows each timeline’s delivery, cost, bakery status, and Luis’s scheduled hours.

The share URL pins the scenario version, fixture seed, and intervention month. Version `bakery-v1` uses fixed inputs without random draws. It reads the real logistics solver’s delivery outputs and applies two declared scenario rules. Luis’s eight-hour shift scales with the share of a 100-unit flour order received, and three consecutive short deliveries permanently close the bakery. These are scenario rules for the guided experience. The earlier synthetic transport fixture and cross-app integration work are described below.

Run `bun test test/bakery-journey.test.js test/bakery-scenario.test.js` for the model and recipe tests. Run `bunx playwright test --config test/time-machine.browser.config.js` for the City and bakery browser journeys.

## Houston transport fixture

`world/journeys/bakery-fixture.js` exports persistent fixture IDs and calculated transport results. Geometry is synthetic, not observed Houston geometry. No fictional narrative is treated as evidence.

Fixed inputs: eight-hour interval; 100 flour units; direct route 20 units/hour, 0.25 hours, 1 currency/unit; detour 5 units/hour, 1 hour, 3 currency/unit. Closing the direct road produces 40 delivered, 60 unserved and 120 currency transport cost; open road delivers 100 at 100 currency. These are solver outputs asserted by tests.

Actual dependency: `tools/flowmap/logistics.js`, version `flowmap-logistics/1`. There is no business or household calculation in this fixture yet. Business employment and household economic adapters must be composed using their supported upstream contracts; shortages must not be translated into invented wage effects.

Verification: `bun test test/bakery-journey.test.js` covers deterministic hashes/replay, immutable input, closure arithmetic and unsupported interventions.

Remaining integration gates: authoritative World snapshot/road mapping, business supply bridge, household mapping, supported 100-future ensemble and selection, checkpoint replay, universal inspector, contextual browser navigation. Worldline currently exposes stored checkpoints only. No flags are enabled for this incomplete journey. Cross-run graph rejection, cycle rejection, iframe forgery, malformed/oversized HTTP requests, durable idempotency and crash recovery require their owners' service integrations before end-to-end assertions are meaningful. Explanation/replay/render budgets have not been measured. No browser journey is claimed as passing.
