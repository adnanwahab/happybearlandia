# One City, Two Futures — implementation and evidence

Local coordinator branch: `sprint/one-city-two-futures-20261111`. Six independently scoped Codex workers delivered commits for simulation correctness, UI, effects, first-run repairs, Canvas2D and browser proof; this chat integrated their work. No release merge, remote push, PR creation, deployment or production-data change was performed.

## Open the delivered application

Review server: <http://localhost:39960/world/future-machine.html>. Click **Play Demo**, or open <http://localhost:39960/> and click the homepage **Play Demo** link. The homepage starts the real comparison without configuration. Manual controls remain available after the 50-second presentation, including pause/resume, split, difference-only, blink, shared month, policy rerun, WHY, share and export.

Force graphical low fidelity with `?renderer=canvas2d` (the earlier `canvas` alias also works). Ordinary World retains its daily model and real paired-week worker at `/world/?demo=1&synthetic=1&people=30&renderer=canvas2d`. It does not borrow monthly City identities or outcomes.

## Reproducible scenario and measured result

Recipe: `future-machine.v1`, City model `city-systems.1.0.0`, seed **42**, 30 initial households, 120 monthly steps, housing in `d1`, 24 proposed homes, 1,000,000 illustrative USD, delay 0, compliance 1. Month 0 in both arms is the same immutable pre-intervention original. Initial SHA-256: `e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`.

| Recorded result | WITHOUT PLAN | WITH PLAN | Difference |
| --- | ---: | ---: | ---: |
| Homes, Month 0 | 36 | 36 | 0 |
| Homes, Month 16 and Month 120 | 36 | 60 | +24 homes |
| Cumulative capital expense, Month 120 | 0 | 1,000,000 | +1,000,000 USD |
| Mean unit rent, Month 120 | 971.5043 | 230.7353 | −740.7690 USD/month |

The first physical divergence is **Month 16 (May 2027)**: one added three-floor structure, `building-project-policy-1-0`. It contains 24 actual City unit records. The UI never presents this as 24 buildings or as sourced real geography. Completion event **`16-0` / `PROJECT_COMPLETE`**, scoped to the plan arm, records project `project-policy-1-0` and 24 units. The recorded project links to `policy-1-0`; the construction model's own `housingProjectBuildingId()` establishes the building relationship. WHY retains the event's actual Month 16 even when inspecting Month 120.

Mean rent includes newly supplied inventory and synthetic vacancy feedback; it is not an incumbent rent reduction or an empirical forecast. The terminal mean-link travel delta is only −0.0002524 minutes/link, so it is retained in evidence rather than promoted as a meaningful commute benefit. Spending is a cost, not a welfare score.

## Verified behavior

| Requirement | Current authoritative evidence |
| --- | --- |
| Matched start, fixed seed, exact horizon, deterministic rerun | Actual City API create/reopen tests and browser independent rerun; 121 frames per arm, exact initial hash, same metrics after refresh |
| Visible physical divergence | Running-app Month 0/120 screenshots and signature Month 16 building selection; recorded units and completion event above |
| Shared camera and time | One actual WebGL camera renders both scissor views; browser drag changes the camera and mode changes preserve its coordinates; Canvas uses one shared orthographic camera |
| Split, difference-only, timeline and policy controls | Browser interaction tests plus the zero-intervention rerun, which produces zero entity and metric deltas |
| Real KPIs and useful WHY | Rendered homes/rent/cost cards consume selected snapshots; direct mesh hit and metric WHY expose seed, run, month, intervention, model and the historical completion receipt |
| Guided demonstration | Real one-click browser recording, 50-second presentation clock with pause/resume; latest measured Play-to-completion sample 51.186 seconds, playable uncut recording 55.760 seconds including explanation interaction |
| No GPU | Both comparison and ordinary World use genuine Canvas2D graphics; ordinary World retains its actual runtime, Activity history and paired-week comparison |
| First-run repairs | Actual Activity open/close/reopen, numeric mood and authority seed, bounded independently started metadata disclosure, visible disabled-control reasons; real Reality worker UI distinguishes 0 passing from 0 execution errors |
| Navigation, counts and mobile | 320px reduced-motion Canvas journey has no horizontal overflow; single foreground World panel retained. Gallery and connected count derive from the same 31-entry registry, preserving the 29 original experiences and registering existing Houston Map plus the flagship |
| Sharing and failure paths | Existing browser suite verifies saved/share refresh, unavailable saved record recomputation, malformed link recovery, missing replay rejection, recipe mismatch and bounded resources |

## Commands and test results

- Focused simulation, presentation, UX, Reality, Activity and registry unit suites: **140 passed, 1 browser-gated skip, 0 failed**, across 24 files. Separate adjacent renderer/playback/needs/City suites: **35 passed, 0 failed** across five files. Browser behavior covered by executable Playwright suites, not the skipped unit-gated component case.
- Integrated sprint suite: **8 passed** before the latest homepage/registry handoff additions. Their targeted acceptance checks passed; the expanded final nine-test suite is recorded in the sprint status file.
- Existing Future Machine browser regression suite: **5 passed** after intentional heading/Plan-label/first-physical-stop selector updates. Zero intervention, invalid link, missing saved record, replay version/input errors, share/refresh and maximum supported recipe resource cleanup all passed.
- Both browser entry builds pass with native Three and `/vendor/*` imports treated as runtime externals. `git diff --check` passed. The package defines no lint or typecheck script.

Reproduce the integrated proof:

```sh
HBL_RECORD_DEMO=1 HBL_TWO_FUTURES_PORT=39943 HBL_TWO_FUTURES_ARTIFACT_DIR=/tmp/hbl-proof bunx playwright test --config test/one-city-two-futures.browser.config.js
bun scripts/record-one-city-two-futures.mjs --output /tmp/hbl-recording --port 39945
HBL_FM_ARTIFACT_DIR=/tmp/hbl-regressions bunx playwright test --config test/future-machine.browser.config.js --grep-invert '40-second'
```

Canonical implementation lives in `test/two-futures-sprint.browser.config.js`; the longer named configuration and recording command are maintained aliases. Tests launch isolated local stores. Do not reuse production data directories.

## Browser artifacts and performance

Delivery directory: `/tmp/hbl-two-futures-delivery/` contains `before-month-0.png`, `after-month-120.png`, `comparison-evidence.json`, `completed-demo.png`, `why-completion-event.png`, `mobile-320-canvas.png`, `world-canvas-activity.png`, and the uncut `one-city-two-futures.webm` plus an MP4 transcode. Detailed per-run traces/scenario/evidence are retained in `/tmp/hbl-two-futures-acceptance/` and the recording output directories. Evidence files include exact recipe, seed, model, starting hash, experiment ID, selected month, first physical divergence, metrics and recorded events; IDs are generated independently per saved experiment.

Observed local Chromium/SwiftShader samples: reopened default recipe ready in **0.649 s**, 120-household supported upper bound ready in **2.289 s**, approximately **109 MB JS heap**, 50,862,264 serialized history bytes and eight scene objects at Month 120; resource disposal verified. These are local samples, not GPU frame-rate or physical-device benchmarks. Full replay is bounded but material in size; no hidden population/horizon reduction is used.

## Audit, ownership and limitations

The later supplied handoff cited missing PR12 modules and unmerged PR11/12. Current local files contain all six modules; live GitHub metadata on November 11 showed both PRs already merged by external action. This coordinator did not merge them. Their stale audit does not override current source or runtime evidence. The local candidate preserves the prior uncommitted World visual-pass integration and completes its remaining repairs.

Worker source commits: simulation `34a9118`, UI `1290a96`, effects `f7f503a`, Canvas `4c5b393`, UX `fd35728` (scoped patch integrated alongside pre-existing edits), browser `689d143`, recording wrappers `b615b59`. Local integration history includes their cherry-picked counterparts.

Changed module groups: `world/future-machine/{main,demo-controller,evidence,scene,ui,INTERFACES}`, ordinary World rendering/onboarding and environment fallback, Reality outcome feedback/studio, canonical experience registry/gallery/homepage, focused tests, recording scripts and implementation/status documentation. Shared City engine and persisted recipe authority are unchanged.

Synthetic schematic geometry and illustrative heights remain explicit. No real parcel is invented for the added structure. No empirical causal proof, full cross-model resident continuity, new bar-scene milestone, real-world forecast or production durability certification is claimed. Safari, Firefox, physical mobile devices and real WebGPU hardware remain unverified; Chromium software WebGL and graphical Canvas were exercised. The broader World–Worldline cross-model housing roadmap remains distinct from this monthly City slice. No release/deployment approval is implied by passing local tests.
