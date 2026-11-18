# World causal adapter

`createWorldCausalAdapter({context, initialState})` owns a detached monthly `CityState.v1`, not the separate minute-based population runtime. Context must match state seed, month and exact city model version. `step()` advances the existing seeded city engine once. `snapshot()` returns the shared validated CausalSnapshot; `getState()` returns full authority for replay. `getEntities()` explicitly maps each retained city local ID to a world-scoped canonical ID. Mappings persist for entities that disappear from later inventory.

Opt-in `createEngine(undefined,{trace:true})` records actual model inputs and committed transitions for policy stages, construction completion, district link availability, job matching, and household relocation. Input/output event pairs and evidence-backed `contributes` edges describe recorded model mechanisms; confidence 1 denotes trace certainty, not empirical causal confidence. Existing city source events are also retained without invented causal links. Numeric city observations use explicit metric units. Imported footprints remain geometry evidence; district links, capacities and all scenario outcomes remain simulated.

Only mapped district `city-policy` interventions with exact allowlisted type, amount and cost are accepted. State/context mismatch and stale requests fail. Intervention calls do not silently fork: callers must create a distinct run/adapter before exploring an alternative future. No wall clock, renderer, external AI narrative, second economy or random draw is added.

## World Time Machine

Open `/world/causal.html` and choose **Record deterministic scenario** once. This explicitly records the seed-2911 fixture through POST `/api/causality/world-scenario`. The endpoint accepts no client payload and rejects foreign origins. The fixed run is idempotent after completion, and later visits load it read-only.

The timeline requests the immutable checkpoint for the selected month and, where available, the previous month. It compares the displayed fields for buildings, households, people, businesses and district links. When the model records a housing project's completion and produces its building, selecting the new building opens the corresponding construction trace. Other entities open their recorded history. The event picker jumps directly to a recorded event. The page preserves unrelated URL parameters and uses `month`, `event` and `inspectEntity` for its own selection.

The Time Machine links to the [Living Newspaper](../newspaper/index.html) and [Surprising Discoveries](../discoveries/index.html). Both read the same stored simulation through the causal API. The newspaper presents selected events in yearly editions. Discoveries scores completed monthly World observations using explicit rules and links to the evidence.

This view covers months 0–20 of the synthetic monthly CityState fixture. The general World map, the minute-based population runtime, arbitrary run selection, and branching from the selected month require additional integration. Checkpoints provide recorded playback; verified recomputation requires independently recorded target digests.


## Fixture grid prototype (NB-U01)

`neighborhood-grid-view.js` exports `createNeighborhoodGridView(container,{onSelect})` with `update(fixture)`, `setMetric(id)`, `focusCell(id)`, `getStats()` and `dispose()`. Hosts must link `neighborhood-grid-view.css`. No production entry point mounts it. `normalizeGridFixture` accepts only `{source:'fixture',metrics:[{id,label,unit,min,max}],cells:[{id,row,column,values:{metricId:{value,reason,source}}}]}`. Bounds:12metrics,256cells,16positions per axis. Cells are schematic fixtures; they are not actual City districts or geographic positions. Null/nonfinite values remain unavailable, numeric zero remains valid; units and sources accompany selections. Canvas2D uses DOM buttons for keyboard accessibility, and absent Canvas contexts retain DOM presentation. No animation loop or model runs are created.

Verify pure checks with `bun test test/neighborhood-grid-view.test.js`. Include the actual Chromium fixture harness with `HBL_GRID_BROWSER=1` (optional `HBL_GRID_TEST_DEPENDENCY_ROOT` resolves an installed Playwright dependency tree). Its320/1440 screenshots are component evidence only. NB-U02 and geographic G02/G03 contracts must be completed and verified before real City data or any production-page integration is enabled.
