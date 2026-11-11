# World visual pass verification

Implemented locally across the seven requested Codex chats, retained in `.world-visual-pass-threads.json`. No additional chats or agents were created by integration. The source is the final response in the supplied pasted attachment, verified by dispatch against the shared chat. The linked 316-line download was unavailable and was not read. The referenced PR10 object `6dd2dd9b8022` was absent; the integrated slice was built on `6c3330f`, preserving Future Machine. During the shared session HEAD advanced externally to `7537cc1`; integration did not create commits, switch checkout, merge, or deploy.

## Delivered journey

Open World → Play quick demo → focus/highlight an actual legacy resident and show their activity/needs → run a detached matched week → switch actual no-plan/plan score overlays → inspect the resident → replay the frozen recipe. The fixed local Balanced recipe avoids waiting on remote packages. It compares implementation year 3 over 7 days with the existing worker's warm-up and baseline. Actual results may be negative; no positive outcome is promised. Counts use the worker's ±5-point threshold, not any nonzero change.

The guide separates configured input, current playback observations, and measured comparison. A position marker can be seen through buildings and explicitly includes indoors; it is a locator, not construction or an outcome marker. Matched resident scores use deterministic legacy buildTown indexes only. They are detached from the current live clock. Population and monthly City retain their own identities, clocks, and authorities.

Stop terminates the dedicated quick worker, invalidates callbacks and cancels guidance. Replay starts a new worker with identical frozen inputs. Worker load errors are visible and retryable. Full civic tour and ten-year worker ownership remain separate. WebGPU startup failure falls back to WebGL2; total graphics failure exposes Retry and Return home (and preserves saved Worldline return links).

The panel manager coordinates guide, legacy inspector/results, activity and Population sheets. Secondary docks are suppressed while a managed panel is active. Controls remain collapsed initially; sheets scroll within safe-area bounds. Escape and dismiss restore accessible focus. Reduced motion frames once without pursuit; normal camera movement stops on pointer/wheel/orbit input. Secondary guide actions are under “More city actions.”

## Changed files

- Integration: `world/render.js`, `world/onboarding/integration.css`, shared `world/onboarding/VISUAL-PASS-INTERFACES.md`, this report and `docs/implementation-plan.md`.
- UI: `world/index.html`, `world/first-run-guide.css`, `world/onboarding/panel-manager.js`.
- Orchestration: `world/onboarding/quick-demo-controller.js`.
- Evidence: `world/first-run-guide.js`, `world/onboarding/feedback-adapter.js`.
- Guidance: `world/onboarding/camera-director.js`, `world/onboarding/spotlight.js`.
- Accessibility: `world/onboarding/accessibility.js`.
- Verification: `test/world-quick-demo-controller.test.js`, `test/world-visual-{panels,feedback,camera,accessibility}.test.js`, `test/e2e/world-visual-pass.e2e.js`, `test/e2e/world-visual-accessibility.e2e.js`, `test/e2e/world-visual-integration.e2e.js`, `test/world-visual-pass.browser.config.js`, `test/world-visual-integration.browser.config.js`, `scripts/benchmark-world-visual-pass.js`.

## Environment and timing definitions

Apple M4, 10 logical CPUs, 16 GiB RAM, macOS Darwin 24.6.0, Bun 1.4.2. Headless Chromium 153.0.8010.12 with software WebGL2/SwiftShader. These are local observations, not Safari, physical-phone, GPU FPS or deployment certification. Some checks ran concurrently, so samples are not controlled hardware benchmarks.

Scene readiness = startup.readyMs − startup.startedAt; detailed geometry continues after readiness. Observation = time from Play to the first actual resident feedback/render opportunity. Worker startup = time to first worker progress, including initial computation; the worker has no distinct ready handshake. Computation = remaining time from first progress to result. Reveal and total are independently measured controller durations. User think time and test-runner/screenshot overhead are excluded from total. Do not add test duration to simulation duration.

Desktop 1440×1000 / 80 residents: scene 2.178 s, observation 0.081 s, worker-to-first-progress 1.268 s, remaining compute 5.494 s, reveal 0.005 s, total after Play 6.769 s. Scene + demo measured phases sum to 8.947 s. Actual average well-being: no plan 78.5, plan 77.6, difference −0.9; 1 improved and 10 worse by threshold. Exact scores and provenance are in `/tmp/hbl-world-visual-pass/desktop-measurements.json`. Real replay scores were identical; actual worker module failure and subsequent recovery passed.

## Verification status

- `bun test test/world-quick-demo-controller.test.js test/world-visual*.test.js test/future-machine-*.test.js test/simulation-playback.test.js test/person-needs.test.js world/wellbeing.test.js`: 88 pass, 1 browser-gated skip, 0 fail.
- Focused panels/feedback/controller rerun: 19 pass, 0 fail.
- Ten-year/longitudinal/contracts/audit/verification run: 20 pass; one test initially blocked by sandbox writing its temporary neighboring Dear Congress test database. Targeted rerun with access enabled: 1 pass, 0 fail (90 s), verifying the three-package ten-year run leaves entries/answers unchanged.
- Future Machine fork/run/scrub/blink/inspect/share/refresh and WebGL fallback: 2 browser tests pass.
- Touch single-sheet dismissal/reopening and actual full civic tour completion with remote synthesis unavailable: 2 browser tests pass. The tour test advances captions via existing Next controls; computation is real.
- Final viewport and 500-resident measurements completed; see final status and target limitation below.
- `git diff --check`: pass.

Initial browser attempts exposed the original WebGPU-only startup and overlapping legacy docks; both were fixed. Concurrent test processes originally collided in one Playwright output directory; subsequent runs use isolated output directories. Interrupted/contended attempts are not counted as passing acceptance.

## Artifacts and reproduction

Full evidence artifacts are under `/tmp/hbl-world-visual-pass/`: `{desktop,narrow,phone,tablet,landscape}-comparison.png`, matching `-inspector.png` and `-measurements.json` as completed. Automated screenshot inspection includes actual application scenes, not only UI fixtures. Narrow 320×640, phone 390×844, tablet 768×1024, desktop 1440×1000, landscape 844×390. Layout worker also verified an isolated 320×568 fixture; that is separate from runtime acceptance.

Run `HBL_VISUAL_PASS_PORT=39905 HBL_VISUAL_ARTIFACT_DIR=/tmp/hbl-visual-run bunx playwright test --config test/world-visual-integration.browser.config.js`. This integration config corrects the original config's accessibility filename mismatch and adds failure, touch, tour and representative population checks. `bun scripts/benchmark-world-visual-pass.js` runs the original desktop benchmark; use the integration config for complete acceptance. Local route: `/world/?demo=1&synthetic=1&people=80`; 500 residents via `people=500`, explicit fallback via `renderer=webgl`. Finished Future Machine remains `/world/future-machine.html`.

## Limitations and next mission

No calibration, real-resident causal effect, persistent cross-model identity mapping or new construction geometry is claimed. A matched result is conditional on this legacy model and seed. The 80-resident speed target is not a promise for the ordinary 2,000-resident default, and geometry streaming is not complete at scene readiness. Physical mobile devices, Safari and real WebGPU hardware remain unverified. The absent downloadable plan and missing prerequisite commit limit comparison with the proposal's exact intended implementation.

Next milestone: “A Day That Matters” — one resident's verified commute problem, one supported intervention, matched frozen inputs, and an inspectable travel/budget tradeoff. Define the resident identity and time mapping within one authority before connecting other models. No broader roadmap was implemented.

## Completed viewport suite

`HBL_VISUAL_PASS_PORT=39905 HBL_VISUAL_ARTIFACT_DIR=/tmp/hbl-visual-verified-tests bunx playwright test --config test/world-visual-integration.browser.config.js`: **10 passed** (9.1 minutes, including software rendering, screenshots and multiple real recomputations). This includes all five viewport journeys with inspection and replay, stop during computation, real worker failure/recovery and identical scores, reduced-motion/mobile one-panel checks, accessibility smoke, and unusable-graphics recovery. Full tour/touch are additional checks above. Some initial pages preceded the final secondary-action fold; final narrow/desktop screenshots and post-review regressions are recorded separately below.

| Runtime viewport | Scene readiness (s) | Resident observation after Play (s) | First worker progress (s) | Remaining computation (s) | Reveal (s) | Total after Play (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1440×1000 | 2.178 | 0.081 | 1.268 | 5.494 | 0.005 | 6.769 |
| 320×640 | 0.584 | 0.081 | 1.081 | 5.461 | 0.005 | 6.548 |
| 390×844 | 0.658 | 0.037 | 3.009 | 7.212 | 0.006 | 10.228 |
| 768×1024 | 0.862 | 0.032 | 1.375 | 5.379 | 0.005 | 6.760 |
| 844×390 | 0.540 | 0.027 | 1.053 | 5.827 | 0.006 | 6.887 |

All rows use 80 residents and the same seed/recipe. These runs include concurrent local test activity; use them as measured samples, not device benchmarks. Phone viewport is not physical-phone hardware. A 500-resident run crossed a test's original 30-second wait while still computing and then completed before its failure screenshot; that attempt is not counted as a passing pacing check. The measurement test now allows 150 seconds and records the actual duration without asserting the short-demo target.

Policy rules have no declared version in this checkout. Provenance records `rulesVersion: null` plus `world/policy.js`; `modelVersion` is the actual World model declaration. Replay equality is verified within the loaded source, not promised across later source updates.

## Final regression and larger-population result

Post-review regressions: **3 browser tests passed** in `/tmp/hbl-visual-final-regressions` (3.3 min): real quick worker failure/recovery, score-identical replay and A/B/inspect controls; full civic tour completion with remote synthesis unavailable; representative 500-resident pacing. Quick overlay storage is independent of civic-cycle results. Final focused module rerun: **30 pass, 0 fail**. The generated map cache's only changed `fetchedAt` timestamp was restored after verification; no map data change is included.

500 residents, same local Balanced recipe: scene readiness **0.967 s**; first resident feedback **0.078 s** after Play; time to first worker progress **2.531 s**; remaining computation **24.164 s**; reveal **0.007 s**; total after Play **26.705 s**. This exceeds the proposed 10–15 s reel target. The app continues showing actual stage/fraction progress and supports Stop; it does not shorten or fabricate results. Actual no-plan mean **78.3452**, plan mean **78.0675**, delta **−0.2777**, **43 improved / 63 worse**. Evidence: `/tmp/hbl-world-visual-pass/population-500-measurements.json`. The 2,000-resident default remains unbenchmarked; do not extrapolate a guaranteed duration.

The post-review desktop repeat measured **7.486 s** after Play, with **0.091 s** observation, **1.314 s** first-progress latency, **6.163 s** remaining computation, **0.007 s** reveal. It retained identical paired scores and recovered from a real worker module load failure. This repeat overwrote `desktop-measurements.json`; the table above records the earlier viewport batch rather than claiming all sample files are immutable.

Final layout images: `/tmp/hbl-world-visual-pass/narrow-final.png` and `/tmp/hbl-world-visual-pass/desktop-final.png`. The final 320px result state emphasizes Replay/Inspect and exposes the measured result; secondary actions remain expandable. Final focus/replay smoke status is recorded in the completion below.

Local review server, using an isolated in-memory World store: http://localhost:39910/world/?demo=1&synthetic=1&people=80&renderer=webgl . Larger real sample: http://localhost:39910/world/?demo=1&synthetic=1&people=500&renderer=webgl . Future Machine: http://localhost:39910/world/future-machine.html . These are local URLs, not a deployment.

Completion: final actual 320px smoke passed after the last layout/state changes: completed result screenshot, resident inspector, Escape returning focus to `world-guide-button`, reopening the guide and real Replay completion. Final narrow image was visually inspected: measured no-plan/plan values and negative delta are visible in the sheet, with the city retaining the upper viewport. Final `git diff --check` passed. Local server remains available on port 39910 for review. No PR, deployment, production-data mutation or integration-authored commit was performed.
