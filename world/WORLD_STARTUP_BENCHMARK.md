# World startup browser benchmark

`test/e2e/world-progressive-loading.e2e.js` observes real WebGL draw calls, geometry-cache job completions and browser long-task entries. It uses a local 36-building map fixture (the town generator adds a park), an 800 ms map response delay, and 40 ms delay before each geometry job. No external map service or paid API is needed. Geometry completion is distinct from mesh attachment and visibility; the current probe does not claim a completed job is a visible building.

Baseline captured November 2, 2026 in Chromium, 1280×800, WebGL, LOW quality, 20 residents, business_mode=true, isolated Bun server on port 3134:

| Observation | Measured baseline |
|---|---:|
| First actual WebGL draw | 2,527.7 ms |
| First geometry job completion | 989.7 ms |
| Last unique geometry job completion | 2,500.9 ms |
| Unique building IDs completed at first observed draw | 37 of 37 |
| Long tasks observed through sample end | 12 |
| Longest observed long task | 3,715 ms |

This single run establishes ordering, not a statistical performance comparison. Long tasks include post-startup work through the test's sample end; the capture window must be matched before comparing totals. A geometry job may finish before its mesh is attached. After integration, the same fixture produced first draw 109.4 ms, first geometry job 5,667.5 ms, last unique geometry job 10,474.8 ms, with 0 of 37 jobs complete at first draw. The capture contained 41 long tasks, longest 4,489 ms. This improves first visible response but is slower to full geometry in this single run; substantial main-thread work remains. These are single local observations, not a statistical speedup claim.

For the baseline only, set `HBL_STARTUP_BASELINE=1` to collect timings without enforcing progressive ordering. Normal mode requires a first draw before the final geometry job completes, with fewer completed building IDs at that first draw than at completion. The suite also exercises unavailable and aborted map requests and preservation of business_mode=true. Existing tile navigation and building hydration suites remain separate regression checks.

Use an isolated Playwright webServer and unique output/store directories. Do not reuse or stop the user's port-3000 server. Temporary local config: `/private/tmp/hbl-progressive.config.mjs`. Example invocation:

```sh
/Users/wahabma/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@playwright/test/cli.js test --config=/private/tmp/hbl-progressive.config.mjs
```

Latest focused passing run: first frame 179.9 ms; first geometry completion 4,381.2 ms; last geometry completion 6,686.0 ms. Actual attachment samples increased 0, 3, 6, …, 36, 37 on separate animation frames and finished 37/37. There were 12 observed long tasks, longest 3,164 ms. Variability remains high.

The integrated interaction case passed in Chromium (11.5 s): actual car instance click opens the illustrated cabin and decorative-traffic disclosure; keyboard pan respects focused inputs; held arrows trigger neighbor map requests; minimap clicks and three screen-pan button presses preserve the URL and business_mode=true; RAF FPS is positive; retained areas stay at or below nine with unique tile keys and context-only semantics. The interaction fixture adds two local roads so actual traffic exists. It is separate from the timing fixture.

HTTP failure recovered fully in about 60 s with the 517-building procedural fallback. An aborted request exceeded the 60 s full-detail assertion in one run. The diagnostic rerun completed all 517 buildings at 59,109.4 ms: first WebGL draw 96.1 ms; controls ready 1,131.3 ms; 517 successful / 0 failed; inFlight/ready/queued/attaching all zero on completion; peaks 3 in flight and 3 ready; 173 scheduler yields. Final attachment samples climbed 498,501,504,507,510,513,516,517 between 57,738 and 59,201 ms. There were 355 long tasks; final intervals were roughly 94–122 ms. This demonstrates continued work and full drain in that run, rather than a stuck worker. Main-thread/software-rendering cost is a plausible contributor, not a measured CPU attribution.

Normal recovery cases require settled map fallback, startup ready, usable controls, continued real attachment progress (or completed status), and zero failed geometry jobs. They do not claim full-detail completion when work is still running. Set HBL_STARTUP_DIAG=1 to require full completion and capture the detailed diagnostic at the 60 s deadline. Enrichment error handling, back-pan cache reuse, obsolete-job cancellation, and original tile/hydration regression suites still need final verification against the completed integration.

Existing recorded advanced decision demo: `/private/tmp/hbl-advanced-demo.webm`, VP8, 800×450, duration 1:59.84. It records actual execution of the earlier advanced loop, and predates compact trace transport and the later real-building inclusion. Current advanced browser checks passed separately; the recording is not evidence for the new world startup changes.

Final verification: all four cases passed together in 42.9 s. The final suite timing sample was first draw 224.7 ms, first geometry completion 5,193.9 ms, last completion 7,595.6 ms, 37/37 attached across successive frames. This remains a first-response improvement with slower total geometry than the baseline, not a full-startup speedup. A strengthened keyboard-boundary case subsequently passed in 11.6 s: held ArrowRight generated additional requests after keydown and actual attachments in newly visible tile keys. The captured state had 9 retained areas, 216 known context-building records, 3 active geometry jobs, and new tile attachment counts 4/36, 2/36, 2/36, 1/36 while other tiles were still fetching/building. Known records include pending geometry and are not all visible meshes.

Recovery diagnostics in the final suite showed the same 517-building town and same initial completed IDs for HTTP/abort. Both had 15 attached, 3 scheduler jobs in flight, 499 queued, zero ready/attaching/failed, cache pending-worker count 0 at the sample, LOW quality, and no geometry error. HTTP first draw 100.3 ms / startup ready 1,054.2 ms; abort first draw 214.1 ms / startup ready 1,358.3 ms. Recent attachment samples continued 0,3,6,9,12,15. Renderer CPU medians were about 4–4.3 ms, frame medians about 183–200 ms; GPU timings unavailable. These samples do not isolate shader/GPU/driver cost.

Screenshots: `/private/tmp/hbl-world-car-interior.png` and `/private/tmp/hbl-world-keyboard-streaming.png`. The rapid-pan screenshot is taken while new chunks are pending and honestly shows the view-budget warning; it is not evidence that every requested tile finished.

Visual blocker regression (after target-centered streaming and local pan-step fixes): the stronger browser case passed in 14.2 s. It now independently requires the actual orbit target to lie in resident/ready/building tile bounds, a real context mesh to intersect the current camera frustum, and a context-building center to project into the unobscured main viewport. After held ArrowRight: target E786.127/N0, covered by actual tile2:0 bounds, 9 context meshes in frustum / 4 in open viewport. After minimap click and three east screen presses: target E2455.789/N244.622, covered, 6 context meshes in frustum / 3 in open viewport. Local screen width was 719.054 m; the test verifies a button press matches this camera-distance/FOV width within 10%, rather than the far-clipped ground-frustum width. The updated keyboard-streaming screenshot visibly contains new buildings and supersedes the earlier blank-view screenshot. First held-key pan also required new requests after keydown and actual attached geometry in a new tile.
