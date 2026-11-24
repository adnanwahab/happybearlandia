# Nested Ballot (hierarchical voting map)

## Plan and owned files
- `world/nested-ballot/index.html`: page (deck.gl `H3ClusterLayer` map, ballot panel, journal).
- `world/nested-ballot/model.js`: region hierarchy and example tallies (no DOM, testable).
- `test/nested-ballot.test.js`: model contract tests.

Served by the existing `/world` static route at `/world/nested-ballot/` (trailing slash required). No server, API or shared-plan changes.

## Behavior
Five scales: Global → Country → City → Neighborhood → Block. Each region is a set of H3 cells. Click a region to drill down; breadcrumb, level row and "Up a level" go back. Each scale has its own question (Yes / No / Abstain) and journal; journal entries roll up to every ancestor, tagged with their origin. Named regions: 10 countries, 7 US cities, 8 Houston-area neighborhoods. Elsewhere, children come from H3 parent grouping (`cellToParent` / `cellToChildren`).

## Observations vs. synthetic data
- Other residents' tallies are **synthetic**: deterministic hash of region id + question level (`seededTally`). Not observations.
- Four journal entries are labeled "Example" in the UI.
- The visitor's votes and entries are kept in `localStorage` (`nested-ballot:v1`) only; nothing is sent to the server.

## Acceptance evidence
- `bun test test/nested-ballot.test.js`: 5 pass.
- Local server: `/world/nested-ballot/` 200 text/html, `/world/nested-ballot/model.js` 200 text/javascript.
- Headless Chrome render at Global and Houston levels; no script errors.

## Unresolved
- No persistence or shared tallies; next step is wiring votes and journals to the existing journal / civic APIs.
- deck.gl 9.1.14 and h3-js 4.1.0 load from unpkg; no basemap tiles.
- `/world/nested-ballot` without trailing slash is 404 (existing static-route behavior).
