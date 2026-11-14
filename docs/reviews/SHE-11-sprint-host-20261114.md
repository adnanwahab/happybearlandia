# SHE-11 actual sprint-baseline host verification — November14,2026

The live HBL Mini Symphony profile targets `sprint/one-city-two-futures-20261111`, not main. A fresh remote read and fetch confirmed `cd3dadbfe92435ea05cb5f736110b6ee0823cc8f`. These measurements execute that exact source in an isolated checkout with only the SHE-11 measurement harness/tests changed. Earlier main-based host measurements do not qualify this live queue baseline.

The existing strict SHE-40 validator is already present in this sprint. It was not ported or changed. The sprint homepage still uses `Play Demo`; no main-specific CTA test adaptation or budget pin was brought here. No source/model/runtime, live tasks/state, Linear status or approval label was changed.

## Baseline result: blocked

| Requested/actual renderer | Ready ms |3Dframe observation ms | Native control ms | Canvas proxy ms | JS heap bytes | Actual error |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| WebGPU/webgpu |436.1|463.1|447.7|unavailable|48277155|night is not defined |
| WebGL/webgl2 |435.9|456.9|449.9|unavailable|36982700|night is not defined |
| Canvas2D/canvas2d |8097.0|unavailable|8099.7|8116.8|4864039|none |

The standalone harness exited1. Numeric milestones from the failed3Dpaths are retained observations and explicitly do **not** qualify acceptance: the actual page ReferenceError stops the renderer loop. Missing Canvas3Dmilestones remain null; its separate frame/readiness proxy is not a3Dmeasurement. See [raw baseline evidence](../evidence/she-11-sprint-host-20261114/baseline/measurement.json) and screenshots.

The actual sprint source calls `sky.setHex(lighting.skyColor).lerp(night, ...)` without defining `night`. Existing PR321 owns restoration of the authored tint plus the requested daylight/provider changes; this package does not duplicate that runtime repair. Parent/coordinator owns its review/integration. Candidate integration proof is recorded below only after execution.

## Harness and focused checks

The measurement-only remedy uses the visible native World controls disclosure after readiness, preserves actual `webgl2` naming, and gives Canvas a separately named initialized-frame proxy. Optional native WebGPU is actually requested and fallback/error states do not count as the requested path. Actual screenshot and Canvas pixel evidence are retained. CLI failures remain nonzero; imported measurement functions do not leak exit status into unrelated tests.

`bun test test/cold-start-report.test.js test/render-performance.test.js`:18passed,91assertions, exit0. No simulation rules changed. Cold measurements are one local sample per path on AppleM4/Chrome, not physical-device certification or comparable statistical renderer rankings. Heap excludes workers/GPU/process memory. Canvas follows its existing independent map path and its roughly8second wait is included.

SHE-11 remains incomplete until the actual sprint renderer error is repaired/integrated and its resulting baseline is reviewed. No Done state, worker launch, PR publication or deployment is claimed.

## Clean existing PR321 candidate — actual separate measurement

The first local merge trial of old PR321 head2ee952dd exposed unrelated inherited queue/state files and a city-renderer conflict. It was aborted without resolving or publishing those changes. Parent cleaned the existing PR onto currentcd3 and preserved both the simulationSource callback and the reviewed daylight setting. No duplicate runtime repair was created here.

The measured clean candidate is exactly `e9afdf40da8fd079bbdd25eda1efd838c5b4dbae`, descended from currentcd3. The same harness ran in that exact candidate checkout with only its two measurement files ported. This source was measured separately from the failing baseline, never presented as already integrated.

| Requested/actual renderer | Ready ms |3Dframe observation ms | Native control ms | Canvas proxy ms | JS heap bytes | Validation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| WebGPU/webgpu |439.8|986.8|452.6|unavailable|41497324|no errors |
| WebGL/webgl2 |459.5|2287.4|471.6|unavailable|171277940|no errors |
| Canvas2D/canvas2d |8090.2|unavailable|8091.9|8114.5|4846780|no errors |

The standalone candidate run exited0. Its focused18tests passed/91assertions. [Raw candidate evidence](../evidence/she-11-sprint-host-20261114/pr321-clean-candidate/measurement.json) preserves selected backends, browser/host, URLs, errors and unsupported nulls. Canvas pixels were144opaque samples/12distinct colors. Actual native WebGPU and WebGL screenshots show rendered city geometry rather than the fatal baseline's frozen first view; all three screenshots were retained. No GPU-duration, display-scanout, full process memory or physical-phone claim is made.

Reproduction, from the chosen exact isolated source checkout:

```sh
PORT=3497 HBL_WORLD_DB_PATH=:memory: bun --no-env-file run server.js
HBL_COLD_START_WEBGPU=1 HBL_COLD_START_SCREENSHOTS=1 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
bun scripts/benchmark-cold-start.mjs http://127.0.0.1:3497 /private/tmp/hbl-pr321-clean-cold-start-proof-20261114.json
bun test test/cold-start-report.test.js test/render-performance.test.js
```

Existing PR321 remains the concrete prerequisite for successful3Drenderer acceptance on the live sprint. Parent owns its review/integration. After that integration, confirm the actual sprint source and rerun/review the harness before changing SHE-11's status. This measurement-only branch contains no PR321 runtime commits, no SHE-40 validator or CTA changes, no budget pin, no queue/approval mutation, and no dispatch. The primary checkout and live runner were untouched; the isolated server was stopped.

## Authorized sprint integration verification

PR321 was merged as `e41b334f492233d50cdc7b9316075fa9a757cdb1` after explicit operator review and the software-renderer FPS exception. The harness branch merged that exact sprint; no runtime differences from that sprint exist outside the measurement script/tests and documentation/evidence. Existing publisher screenshots were retained by normal merges.

The actual integrated application was measured on this host using the command above, with fresh browser/context per path. Standalone CLI exit0;18 focused tests/91 assertions pass. [Raw integrated report](../evidence/she-11-sprint-host-20261114/integrated-sprint/measurement.json) and all three screenshots are retained.

| Requested/actual renderer | Ready ms |3Dframe observation ms | Native control ms | Canvas proxy ms |
| --- | ---: | ---: | ---: | ---: |
| WebGPU/webgpu |487.8|1042.7|503.7|unavailable|
| WebGL/webgl2 |450.6|1210.0|461.8|unavailable|
| Canvas2D/canvas2d |8095.7|unavailable|8098.8|8117.8|

All three paths report no page/request/validation errors. Canvas has144opaque pixel samples/12colors. Screenshot inspection confirms rendered city geometry. These remain single-host observations, not device certification, GPU presentation timings, or total memory. No performance budget was weakened. SHE-11 completion still requires fresh hosted checks and PR322 integration; SHE-40 numeric CI budgets and other issue acceptance gaps remain separate. No live queue, approval, assignment, or production configuration changed.

### Final hosted check diagnosis

At8403062c, replay, storm and model validation passed. Performance run43626508572 completed all six scenes without application errors or load/heap violations; only p95frame1399.9–1616.5ms exceeded unchanged250ms and is covered by explicit operator exception. Core run43626508517 passed11/12canonical cases but WebKit history test counted two Three requests from the independent homepage Bar Atlas iframe (`Referer: /world/bar/scene.js`, childframe0325b1d2c80c52366f25445d4cc99e86). Trace artifact14126379061 retains the evidence.

The test now scopes its no-Three assertion to the main application frame and additionally asserts the actual Canvas backend. It still rejects any main-frame Three request and preserves the full guided/history/WHY/error assertions. No application, model, budget, or security code changed. This is a test-provenance correction, not a performance waiver. Fresh checks remain required before merge.
