## Local World implementation and measured acceptance

Work is integrated across five chats. No deployment, merge or production-data change was made. World now uses native WebGPU only, per the user's later instruction. Simulation remains JavaScript/workers; tile view shares the same world rather than starting another simulation.

### Performance evidence

Latest quiet native WebGPU Legacy run:120 seconds of idle and panning,7,271 frames, median 16.7 ms,p 9916.8 ms,max 100 ms,12 frames over 50 ms,59.40 rAFHz, **zero main page long tasks and zero JS errors**. All 12 long frame gaps cluster at 118.08–118.98 seconds during the final pan. **The strict goal of zero frames over 50 ms remains unmet.** The residual render/scheduling burst needs separate GPU/compositor/streaming evidence; it is not established as OS-only or GPU-only.

During integration, requested sidewalk routing exposed a 740.8 ms main-thread frame: nearest-sidewalk work 248.1 ms,Dijkstra 343.2 ms,road A* 49.3 ms,nearest-road-node 34 ms. Exact bounded caches and cooperative geometry-only warming remove the measured half-second departure freezes without dropping simulation minutes. All 702 route comparisons and a full state for 1,233 residents over 150 minutes checkpoint comparison preserve identical results. This introduced regression is distinct from the original production priority-pool 400 ms handler report, which was not reproduced locally. The historical WebGL shader-link finding concerns a backend now removed from World.

Median render CPU 5.5 ms; average GPU query 6.74 ms. Main-page JS heap 189.4→279.5 MB, then 100.79 MB after forcedGC; backing storage 40.19 MB. Actual source-tree cache 19.80 MB against 32 MiB **per-network** retention, road cache 0.91 MB against 4 MiB, full-route cache about 4 MiB estimated. Budgets are not a total process/RSS ceiling. Worker heaps and GPU memory are unmeasured. Temporary growth alone does not prove a retained leak. Samples differ in source/backend/workload, so no calibrated production before/after claim is made.

[Measured CPU flame graph from the actual740.8ms frame](https://uploads.linear.app/74182b13-bbaf-40b5-89e3-c59c29528596/b5bf176e-c7ec-4f13-9698-69fc110f86f6/f73fb347-1fc5-4a0d-b87c-d19c0852641f)

### Initial visible primary-control audit

The default initial page has 21 named buttons and two navigation links. The browser audit checks actual responses, labels and clickability. Advanced historical tools remain optional; this is not a claim that all 836 possible DOM controls across every tool were exhaustively activated.

| Button | Actual response |
| --- | --- |
| Get started | Select/follow an actual modeled resident and expose commands |
| World | Open existing World controls |
| People | Live observed-resident list; search and identity-based selection |
| Build | Open existing construction draft/approval tools |
| Laws | Open the actual Choose a law dialog |
| Time | Open supported pause/speed/time tools |
| Activity | Open recorded activity history |
| Quests | Observed low-need requests and same-run tracking |
| Legends | Selected-person retained events, with missing history identified |
| Search | Search actual actions; also Cmd/Ctrl-K |
| Tile view | Same-source map, tile inspection and actual selection |
| Sound off/on | Explicit gesture starts/stops optional audio; default off |
| More tools | Open progressively disclosed advanced tools |
| Pause/resume | Toggle authoritative playback; Space also works |
|1× | Set actual speed 1 and resume |
|2× | Set actual speed 2 and resume |
|4× | Set actual speed 4 and resume |
| Overlay | Cycle supported observed/model outputs; also O |
| FPS | Toggle actual frame readout visibility |
| Start here shortcut | Same working modern resident-start action |
| Activity shortcut | Same actual recorded-history dashboard |

Home navigates to the homepage; Session logs opens `/logs`. Top-right shortcuts, mood/seed and FPS now have separate measured layout rows. Initial-observation loading no longer leaves People permanently empty; search/focus are preserved when data arrives.

### Gameplay and verification

Shared instanced distance-driven gait, mapped sidewalk travel/time, recorded social stops/need effects, continuous illustrative bus symbols, actual resident commands, grounded context/dialogue, low-need hints/objectives, pause/speed, tile look mode, retained-person history and optional sound are integrated through normal entry. `/logs` provides consented bounded browser-local camera/click/clock/seed/error/FPS recording and scrubber playback with deletion; no form text, names, raw URLs or uploads are collected.

**169 regression tests across 31 files and 20 combined native WebGPU browser checks pass.** The browser checks include desktop/mobile navigation, actual commands/dialogue, inspector visibility, asynchronous Living People loading, idempotent Follow, no context picking on right-drag panning, ground walk/build drafts, consent/revocation/replay, audio lifecycle, same-source tile selection, top-right widget layout and explicit unsupported-WebGPU recovery. Existing City validation passes 106 replay cases and its fixed housing diagnostic baseline. Model descriptions/rules manifests and old-checkpoint/future-recipe compatibility were checked alongside code.

Remaining limits are explicit: the strict frame-time goal is still open; physical-phone/old-laptop/Safari acceptance is separate from browser emulation. Rent/jobs/traffic spatial measures remain unavailable when the current authority lacks data. Need objectives are not invented monthly-city rent/flood quests. Legends do not reconstruct missing building/lifetime histories. Session diagnostics are trajectory/timing replay, not exact scene video or deterministic full-state replay. No launch-complete claim is made.
