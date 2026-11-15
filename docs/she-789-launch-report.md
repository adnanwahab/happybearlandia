# SHE-789 integrated local launch report

Status: substantial local implementation delivered; launch acceptance remains **open**. No merge, deployment or production-data change was performed. Existing unrelated uncommitted changes were preserved. Five work chats divided performance, residents, logs, interface/gameplay and tile/audio work; the coordinating chat integrated and verified the result.

## Current graphics scope

The user's latest instruction adds a **WebGL2 city-only fallback**. This supersedes the earlier WebGPU-only instruction. Normal `/world` entry redirects before loading simulation code when WebGPU is unavailable or initialization fails; `?renderer=webgl2` explicitly requests the viewer. The full playable game retains native WebGPU.

The standalone viewer renders building footprints, parks and roads, with orbit, pan, zoom, city fit, picking and an accessible building inventory. It has no residents, simulation workers, clock or gameplay. Rendering occurs on demand with no idle animation loop. Saved experiments supply base geometry only, explicitly not checkpoint replay; missing saves show an error. Synthetic geometry and illustrative dimensions are labeled. See [the city-view contract and checks](she-789-static-city.md).

## Delivered behavior

| Area | Behavior and limits |
| --- | --- |
| Performance | Bounded minute catch-up, deferred hidden tables, throttled streaming, async shader warmup, exact spatial route searches, bounded derived caches and cooperative route warming. The strict frame target remains unmet. |
| Residents | Distance-driven instanced limb gait and age variation; mapped-road sidewalk routing in Legacy and Population; actual social holds, relationship/need effects and consistent interruption by player commands. Synthetic access/crossing assumptions are documented. |
| Resident play | Actual resident selection and home/work/needs, authoritative click/WASD walk requests, follow camera, grounded four-choice dialogue, observed low-need quests and recovery tracking. These are discrete model commands rather than continuous physics. |
| Context actions | Actual person/building/ground picking, Walk/Talk/Follow/Examine and location-specific building drafts. Right-drag pans without opening menus or doing context picks. |
| Interface | Dark shell, serif titles, pill controls, desktop/mobile navigation, search/Escape, visible separated shortcut/mood-seed/FPS widgets. All 21 initial buttons audited; advanced historical controls are not exhaustively certified. |
| Time and overlays | Pause and 1/2/4 speeds work. Supported flood/commute/wellbeing/journal measures retain their sources. Unsupported rent/jobs/traffic spatial outputs are visibly unavailable. |
| Logs | Off-by-default local consent, allowlisted click/camera/clock/seed/error-category/FPS records, retention limits, scrubber and deletion. No text, raw URLs, names or uploads. Diagnostic trajectory replay rather than exact scene video. |
| Tile view | Same geometry, IDs, clock and residents in eight-metre cells; overlapping lots/persons retained, look and selection. Road/sidewalk rasterization is approximate. 3D submission stops while tiles are open. |
| History and buses | Retained resident events with run/retention context; no reconstructed prehistory or building lifetime history. Buses are continuous illustrative configured fleet symbols, not timetable/ridership simulation. |
| Sound | Optional off-by-default ambient/click/controlled-walking audio; gesture activation and hidden/dispose cleanup. |

## Verification

- Combined Bun regression: **169 passed, 0 failed**, 31 files, 2103 assertions. Latest focused fallback regression: **39 passed**, 7 files.
- Existing City validation: **106/106 replay cases** and fixed Houston housing diagnostic baseline pass. This verifies model contracts, not empirical truth.
- Final combined normal-entry Chromium suite: **20/20 passed**, including mobile widths, resident movement/dialogue/follow, context walking/building, right-drag, pause/speed, consented logs, sound, tiles and automatic city-only fallback.
- WebKit city-only suite: **7/7 passed**, including actual WebGL2 context, no simulation requests/workers/globals, idle drawing unchanged, mobile fit/selection, unavailable-WebGL2 recovery, saved geometry and missing-save failure.
- Native Chrome entry smoke: **1/1 passed**, initialized native graphics consumed once and full game APIs present.
- Six viewport HUD cases: **6/6 passed**, all 12 goldens matched using installed Chrome 157; 21 controls checked for labels/hit targets/bounds. Four widget-layout cases also pass. Cached Chrome 153 produced real WebGPU startup errors; those failures were retained rather than filtered.
- Scrapbook IndexedDB error/abort normalization and rollback: **3 tests pass**, including nullable transaction errors exposed by WebKit.
- Exact route validation: **702 golden comparisons**, cache eviction checks, and a complete **1233-resident, 150-minute checkpoint** match before/after caches and prewarming.
- Browser bundles and `git diff --check` pass. No root lint/typecheck command exists for this JavaScript scope.

The combined browser suite uses `bunx playwright test --config test/she-789-local.config.js`. `HBL_LAUNCH_TEST_URL` can select the running local server and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` the installed browser. Browser artifacts are under `artifacts/she-789/`.

## Performance and soak results

The final trace-free native WebGPU Legacy run captured 7271 frames over 120 seconds: median **16.7 ms**, p99 **16.8 ms**, maximum **100 ms**, **12 frames over 50 ms**, 59.398 rAF Hz and zero JavaScript errors/main-page long tasks. All twelve gaps clustered near the final pan; their GPU/compositor/streaming cause is not confirmed. The strict zero-over-50-ms acceptance target **fails**.

CPU median was 5.5 ms; GPU average 6.743 ms. Heap 189.42→279.47 MB fell to 100.79 MB after forced GC; this is not a retained-leak audit and excludes worker/RSS/GPU memory. Derived source caches have a 32 MiB cap per network. See [the performance report](she-789-performance.md) for budgets, raw captures and limitations.

A measured 740.8 ms route frame was an introduced sidewalk integration regression: projection 248.1 ms, Dijkstra 343.2 ms, road A* 49.3 ms and nearest-road 34 ms. Exact bounded caching/search and warming removed that half-second main-thread stall in the final capture. It does not prove the original production priority-pool 400 ms report's cause; that specific handler was not reproduced. Earlier WebGL shader observations are historical. Different source/backend/workload samples do not establish a calibrated production before/after benchmark.

Ten-minute recordings use browser emulations, not physical devices:

- Phone-sized Chromium: 600.281 seconds, 40 actions, zero JavaScript errors or failed actions. 58.696 rAF Hz, p99 16.8 ms, maximum 2149.9 ms, 53 frames over 50 ms. Concurrent recording/host work prevents treating this as a physical phone benchmark.
- Four-times CPU-throttled Chromium: 600.717 seconds, zero JavaScript errors, one retained Playwright action timeout after the resident-play click completed while waiting for scheduled navigation. A subsequent controlled walk succeeded. 31.96 rAF Hz, p99 116.6 ms, maximum 23849 ms, 1649 frames over 50 ms. Qualification **fails**; the timeout is not masked or called a missing handler.
- WebKit city-only: 600.085 seconds, 40 interactions, zero JavaScript errors/failed actions, zero workers and zero simulation-module requests. Passed; 119 on-demand draws, with no continuous FPS claim.

Reports, videos and screenshots live in `artifacts/she-789/soak/{phone,slow-laptop,webkit}/`. Native performance qualification and WebKit city geometry are distinct workloads; an on-demand city viewer has no continuous FPS target.

## Model-description review

Compared `docs/models/{README,population,legacy}.md` and linked contracts against Legacy/Population routing, social scheduling, checkpoints, worker projection, manual walking, relationships and rendering. Resolved stale straight-line descriptions, worker trip/social metadata, command/chat interruption, route commitment, retention and cross-view identity. Versioned rules distinguish fresh behavior from compatible old checkpoints and reject unknown rules before mutation. Sources, seeds, synthetic thresholds, timing and missing observations remain explicit. The static viewer adds no model authority.

## Remaining acceptance

Strict frame-time qualification, physical phone/old-laptop/Safari testing, building/full lifetime histories, unsupported spatial metrics, exact remote session-video replay and exhaustive advanced-control coverage remain incomplete. Continue stable-hardware performance diagnosis and physical-device testing before calling the checklist complete. Review the local diff before merging; deployment requires explicit user authorization.

## Merge integration receipt (November 15)

Task-only changes were reconciled with sprint base79b44aae, retaining newer
picking, gamepad/cinematic controls, crossing rings, model contracts and worker
diagnostics. Newly added floating tools remain accessible under More tools;
search shortcuts have one owner. Automatic fallback handles outgoing native
page-transition cancellation rather than suppressing page errors.

On the integrated source:171/171 original regression tests (2134 assertions),
78/78 focused tests,16 adjacent tests passed with1 optional-DOM skip, and7/7
WebKit fallback checks pass. The final Chromium normal-entry suite passes20/20 in36.0seconds. Earlier measured performance and physical-device limitations still apply.
