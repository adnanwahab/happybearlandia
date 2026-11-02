# Living City product components and verification

The worker inspector and session UI are integrated into `/world`. These components do not establish completion of the full quarterly roadmap; see `LIVING_CITY_COVERAGE.md` for the consolidated audit.

## Integration APIs

`mountWorkerInspector({container,registry,capabilities={},actions={},getContext})` returns `{update,destroy}`. The registry supplies `getSnapshot()`/`snapshot()` with actual workers, pools and errors, plus optional `subscribe`. The drawer shows live inventory, task details, queues, timestamps over the last60seconds, observed task throughput, errors and JSON diagnostics download/copy. Portable worker heap memory remains unavailable. High-frequency registry updates are coalesced; history is bounded.

Normal mode is read-only. `createWorkerInspectorControls(registry,{analyst:false})` returns explicit capability/action bindings; analyst mode maps pause/resume/drain/count to the registry's own capability checks. Counts are1–12. Individual restart/drain/termination require real host callbacks. Termination has an explicit second confirmation. The inspector emits bubbling `world:worker-show-work` only for actual reported range/spatial ownership, with `{workerId,type,ownership}`. A pool ID alone does not produce a highlight. Full agent-range/chunk visualization remains a host integration limitation.

`createDecisionSession({sessionId='living-city',clientId?,channelFactory?,maxEvents=500})` exports a versioned bounded log and same-origin BroadcastChannel transport. `channelFactory:null` disables transport. Public methods: `record`, `getState`, `subscribe`, `setFollowing`, `publishViewpoint`, `present`, `annotate`, `ask`, `createExperimentTask`, `export`, `import`, `replay`, `destroy`. Unchanged views are deduplicated; changed views are throttled. Retention is at most500events/512KiB; imports at most600KiB and validated atomically. Older-event removal is disclosed.

`mountSessionView({container,session,getViewpoint,onFollowViewpoint,onExperimentTask})` returns `{update,destroy}`. `update({viewpoint:{position:[x,y,z],target:[x,y,z]}})` shares the actual view. Only live presenter viewpoints invoke the follow callback, and only after a participant opts in. Import/replay never applies world edits, runs simulations or grants approval. Questions become proposed tasks requiring review. Session scope is **local same-origin browser tabs**, without authentication or cross-device collaboration. Viewpoints are last-shared observations, not guaranteed live presence. Full automatic proposal/simulation/final-choice capture and executable world-state replay remain incomplete.

## Browser evidence

All tests use isolated local servers; no paid calls or external telemetry. User-facing ports3000/3217 were not stopped by Product.

- The ten-case Living City suite passed in2.2minutes: actual world/model/Studio integration; rent and transit response; stable paired IDs; real worker failure/retry and capability gating; diagnostics export; explicit termination confirmation; local two-tab presenter/annotations/questions; bounded portable replay; real needs/pause/replay; asynchronous benchmark repaint and cancellation.
- Two additional connected playback/population cases passed in2.4minutes: actual world minute, modeled coordinates, needs, displayed human instance matrices and traffic poses freeze while paused; camera can pan; resume does not apply paused wall time. Actual GLB node parts TShirt/Pants/Skin/Hair/Shoes loaded, five materials per renderer,12 deterministic shirt colors; legacy40 and bounded Living500 instance capacities, not10k cloned meshes.
- First population button press activated10,000 modeled people; second20,000. All28canonical numeric parameters had synchronized sliders and inputs. A native rent slider event changed actual model burden and produced paired trajectories;999was rejected. Main pause remained authoritative and resume used bounded minute-based time.
- A separate actual-worker Studio browser case passed in1.6seconds: normal `.fill()` restoration of the already-applied value preserves runtime revision, metrics and the two actual trajectory lines.
- Existing keyboard/minimap/streamed-neighbor regression passed in15.5seconds after Living City integration, requiring target coverage and real meshes in the unobscured current view.

The actual240-person rent fixture preserved person/household IDs and changed mean burden0.3065952659→0.4598928988 for rent multiplier1→1.5; its exported two-scenario trajectories contain numeric differences. The controlled600-person, four-seed, two-day long-distance transit fixture used service0→4, free transit and elevated car cost: baseline bike2555/car985; treatment bike640/bus2620/car27/rail1993. These are deliberately strong synthetic regression inputs, not empirical forecasts. Matching independent futures produced identical metrics/trip counts with requested pool sizes1and8; live shared-state sharding is not claimed.

Legacy actual sleep raised energy20→24.1 over20modeled minutes and pause held values. Living nighttime rest raised energy47.454→59.754; reset/replay reproduced all four needs exactly. Numeric meters matched model values. The new controls preserve a bounded visible sample distinct from modeled population.

## Artifacts

- `/private/tmp/hbl-living-city-daytime-person.png`: actual daytime selected Living person and four needs bars.
- `/private/tmp/hbl-living-city-paired-trajectories.png`: two distinct actual rent-burden trajectories.
- `/private/tmp/hbl-clothed-person-needs.png`: actual outdoor legacy walker, loaded GLB clothing and needs. The model was advanced until an outdoor activity occurred; no indoor fallback person was used. Camera selection is visual QA, not a new behavioral outcome.
- `/private/tmp/hbl-population-sliders-20000.png`: actual20k model controls and paired results.
- `/private/tmp/hbl-living-city-integrated.png`: actual worker inventory.
- `/private/tmp/hbl-living-city-rent-comparison.json`: portable actual comparison output.

Benchmark route `/world/bench/people` serves `world/people-benchmark.html`/`.js`, with `world/bench/people.worker.js`. See `PEOPLE_BENCHMARK.md` for actual measurements and limits. No benchmark starts automatically.
