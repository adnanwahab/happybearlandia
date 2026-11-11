# First-run repairs (2026-11-11)

Owned slice: `render.js` additions, `onboarding/first-run-repairs.{js,css}`, `reality/outcome-feedback.js`, `reality/studio.js`, and `test/world-first-run-repairs.test.js`. Copied prior visual-pass changes are preserved and excluded from this worker's commit.

- Compact playback output exposes numeric mood / modeled utility and the active seed outside collapsed settings. Legacy seed is the actual `town.seedKey` location key; do not relabel URL seed 42 as this authority's seed. Population config seed is used while Living is active.
- Provenance asset loading has a 10-second deadline and explicit unavailable/reload message; it never advances simulation state.
- Compiler summary explicitly separates zero passing policy tests from execution errors and probabilities. Disabled actions expose prerequisite reasons through native titles and aria-description. Unsupported proposals remain disabled after cancel/completion, and failure repair is disabled while busy.
- Optional stylesheet is loaded by `mountPlaybackFacts`; no shared HTML edit required. It reserves 56px between the explorer dock and bottom connected navigation.
- Activity open failures now expose retry feedback on the existing button. Existing history collection/render/query implementation is preserved.

## Coordinator integration needed

Experience count is outside ownership: `world/universe/shell.js` hardcodes `29 connected experiences`, while its directory status uses `EXPERIENCES.length`. Replace the header count with the registry length (also audit homepage count). Do not change the registry to satisfy a caption.

Total graphics failure hook: `render.js` nested graphics catch immediately before destructuring `graphics`. At that point `origin`, `maxPeople`, `params`, `initialAreaRequest`, `loadedExperiment`, `savedSyntheticHome`, `buildTown`, and `createWorld` are available; `town`, `world`, camera, controls and scene are not initialized. Current branch shows retry/home alert then throws. A standalone Canvas startup must await `initialAreaRequest`, call `buildTown(origin, area, {maxPeople,savedGeometry:savedSyntheticHome})`, restore a saved checkpoint when supplied, then create/restore the same legacy authority. It must explicitly report unsupported Living/saved modes instead of silently replacing them. Render actual `town.buildings[].poly` and `world.people[].x/z`, use `world.step` for playback, `world.getActivitySnapshot/getActivityHistory/subscribeActivity` for the existing dashboard. Wire visible pause/speed, zoom/pan and selection controls in that startup. Returning fake `graphics` is unsafe: normal path needs renderer info/shadowMap, GPU profiling, environment light, instancing, scene raycasting and render performance contracts. No untested Canvas adapter is installed in this slice.

Verification: 40 tests passed / 0 failed / 515 assertions across first-run repairs, Reality compiler/workflow, activity analysis/history. Browser outcome is reported separately in worker final; no model-result or complete-browser claim follows from unit tests.
