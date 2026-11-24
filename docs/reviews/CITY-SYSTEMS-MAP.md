# City Systems Map

Source: owner request (2026-11-24) to add the deck.gl city systems map, built with Claude on
2026-11-19, to HappyBearLandia through a pull request. No Linear issue. Base: `main` at `2b5754f`.

## Slice and acceptance criteria

One standalone, registered experience reached through the normal server:

1. `/tools/city-systems-map` serves the page with the shared HBL navigation, and its data loads
   from `/data/city-systems-map/` through the existing `/tools` and `/data` static routes, with no
   new server code.
2. The map loads all 46 data files, renders, and its scenario, overlay and layer controls work.
   Without deck.gl it says so.
3. The data is reproducible: pinned, checksummed sources; fixed seeds; byte-identical rebuilds.
4. Observed, derived and synthetic content are labelled in the page, `meta.json` and
   [docs/city-systems-map.md](../city-systems-map.md).
5. Existing catalog, navigation, gallery and server tests still pass.

## Files

Owned: `tools/city-systems-map.{html,css,js}`, `data/city-systems-map/`, `scripts/city-systems-map/`,
`test/city-systems-map.test.js`, `test/e2e/city-systems-map.e2e.js`, `docs/city-systems-map.md`, this record.

Shared, minimal edits: one appended entry in `world/universe/registry.js`; the hard-coded catalog
size in `test/universe-shell.test.js` and `test/command-palette.test.js`, now 35. Those two
assertions were already stale on `main`: #569 added City Atlas (34 entries) and left them at 33.
`docs/implementation-plan.md` is untouched; the coordinator can record status there.

## Evidence (this branch rebased on `2b5754f`, local)

- `bun test` on `city-systems-map`, `city-atlas`, `universe-shell`, `command-palette`,
  `html-navigation`, `world-user-fixes`, `demo-gallery`, `server`, `local-journeys`,
  `contextual-hints` and `surprise-wonder`: 41 pass, 1 skip, 0 fail. On `main` the
  `universe-shell` and `command-palette` size assertions fail (33 expected, 34 registered).
  `node --test scripts/pr-hygiene.test.cjs` passes.
- `bunx playwright test test/e2e/city-systems-map.e2e.js`: 2 passed. jsDelivr is blocked in the
  build sandbox, so the run served `deck.gl@9.4.1/dist.min.js` from the npm tarball through
  `HBL_DECK_GL_BUNDLE`; the page's SRI check accepted those bytes. The same method reproduces the
  Houston map's existing 9.2.2 SRI hash, which confirms jsDelivr serves the npm file unchanged.
- `test/e2e/universe-shell.config.js`: 5 passed. `test/e2e/contextual-hints.config.js`: 4 passed.
- Homepage journey in `activity-first-run-followup.e2e.js`: card count, count text and kicker
  matched the 35-entry registry before its pre-existing failure on the first card's link target
  (below). `world-user-fixes.test.js` checks every card route against the registry.
- Data: two builds with `PYTHONHASHSEED` 1 and 999 were byte-identical, and the 45 non-meta files
  are byte-identical to the dataset published with the original map.
- Headless Chrome through `server.js` at 1440×900 and 390×844: map, KPIs, legend, storm scenario
  and the injected Search and HBL controls rendered without overlap or page errors.

## Pre-existing failures (same results on unchanged `main` 93b2e67 and 2b5754f)

- `test/research-directory.browser.config.js`: 6 of 6 fail (for example, the no-JavaScript
  fallback expects 24 static cards and finds 0).
- `test/e2e/activity-first-run-followup.e2e.js`: 2 of 3 fail (`canvas2d` renderer attribute;
  gallery links expected to open in a new tab).

## Model review

No social model is added or changed. The map has no agents, state or scheduling: vehicles replay
precomputed paths and the scenario effects are fixed display rules. By the inventory boundary in
`docs/models/README.md` it needs no ODD entry. Reproduction inputs (source checksums, seeds,
package versions, data version) are in `meta.json` and `scripts/city-systems-map/config.py`.

## Unresolved

- The new tests are not in CI's curated `core-journeys` lists; adding them needs a workflow edit.
- The browser journey depends on jsDelivr, as the Houston map does.
- About 5.7 MB of uncompressed JSON per first visit; the server has no compression.
