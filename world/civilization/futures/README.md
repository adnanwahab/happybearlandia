# Future Search

Open `/world/civilization/futures/` and choose two simulation months and direction predicates. This view searches completed saved runs with the current monthly City model and recorded `world-city` manifest. It compares each run against its own starting month. It does not estimate policy effects or pair runs across seeds.

The mean unit rent is the City's mean across all units in modeled USD/month. Mean district-link travel time averages links in minutes and is distinct from residents' commutes. Both points must be exact same-run, city-wide, simulated observations with supported units and model version. Empty housing and zero-mean link placeholders remain unavailable. Missing or ambiguous evidence cannot satisfy a required condition. Observation links open the causal inspector; replay links are shown for compatible exact checkpoints.

The browser reads the first 60 catalog entries, scans up to 24 supported City runs, and bounds each record stream at 4,000 items. It reports truncated catalog coverage and unavailable run evidence. The view is read-only and requires at least one recorded monthly City run to return results.

Run `bun test test/future-search.test.js`.
