# Research Coordinator — 25-hour working ledger

User authorization: November 11, 2026; three attached briefs and the request to keep this running for 25 hours. The latest duration supersedes the attached two-hour guideline. Active Codex goal created; chat renamed Research Coordinator. This is an execution window, not evidence that 25 hours of computation have occurred.

- Measured start: 2026-11-11 15:24:50 UTC (09:24:50 Central).
- Window ends: 2026-11-12 16:24:50 UTC (10:24:50 Central).
- Baseline: detached checkout at `95b63be`. Existing dirty pipeline files and backlog changes are preserved; historical worker assignments are not assumed live.
- Constraints: monthly City authority; same versioned run data across views; no invented observations, causal edges or calibration; no deployment, main merge, spending or production mutation.

## First integrated slice

Audit current implementation and evidence before choosing bounded reliability repairs. Preserve delivered D01–D05 behavior and respect the existing feature freeze. The three research tracks are independent read-only investigations: scientific reliability, flagship user journey, and research opportunity feasibility. They share no writable files. Any implementation assignment requires exclusive ownership and, for delegated edits, an isolated worktree or branch.

Prerequisites: product design, implementation plan, frozen Future Machine interfaces, module documentation, actual code/tests and current backlog. Existing pipeline orchestration is unrelated in-progress work and is not used to claim live workers.

Acceptance:

1. Separate confirmed defects, untested risks and intentional limitations using exact code evidence.
2. Compare at least three feasible improvements per investigation and rank a decisive experiment.
3. Select a bounded approved repair only after its investigation; record scope and verification before implementation.
4. Run focused regression tests, then browser checks for browser changes; mark VERIFIED only after integrated evidence.
5. Keep the research ledger and implementation plan current across goal continuations.

Risks: older documentation references absent `/tmp` artifacts and historical worker states; synthetic determinism does not establish empirical validity; uninterrupted execution remains subject to runtime availability. Do not launch duplicate workers or copy historical pass counts into current results.

## Current measured evidence

Initial command: `bun test test/future-machine-data.test.js test/two-futures-evidence.test.js test/two-futures-demo-controller.test.js`.

Result: **8 passed, 0 failed, 57 assertions**, 2.38 seconds. This includes actual local SQLite-backed City creation/reopen, identical original Month 0, deterministic 120-month replay, missing ledger rejection, recorded completion receipt timing and the six-second divergence hold. No browser check has run in this coordinator window yet.

Independent research workers are launched through the internal collaboration tool: `scientific_audit`, `journey_audit`, `research_opportunities`. Their findings are pending; these names are not evidence of completed investigations.

## First investigation findings and repair assignment

All three read-only investigations completed. Scientific checks found deterministic boundary-seed replay and trace-on/off state equivalence; the colon-delimited RNG key encoder has a reproducible tuple-alias weakness, but flagship impact is unconfirmed. Do not change that versioned algorithm without a model-version decision. Research priority after reliability work is a bounded matched seed/intervention sensitivity study, not empirical forecasting.

Journey findings rank: (1) stale Canvas inventory after missing snapshot, (2) live reduced-motion preference handling, (3) selection/camera continuity on graphics loss. U05 numerical semantics already exist; U02 resizing needs a runtime experiment before changes.

RC01 — P0, IN PROGRESS, coordinator-owned: clear graphical Canvas inventory when either matched snapshot becomes unavailable. Files: `world/future-machine/scene/index.js`, new focused scene browser regression/config. Prerequisites: completed source audit; Canvas renderer already accepts null projection. Acceptance: valid recorded scene → missing arm → zero graphical objects, no old labels or selectable inventory, explicit unavailable status → valid scene recovery. Verify through actual browser module entry and existing scene/Canvas suites. This bounded failure-path repair changes no model, API or seed. Subsequent scene repairs are sequential under this ownership.

Broader initial baseline: 62 passed, 1 browser-gated skip, 0 failed, 407 assertions across ten focused files (7.77 seconds). Worker scientific audit separately reports 26 passed / 202 assertions; research audit 14 passed / 118 assertions. These overlapping runs are not summed as unique tests. Initial dependency installation hit a temporary-directory permission error; retry with `TMPDIR=/private/tmp` succeeded without lockfile changes.

### RC01 verification

Implemented clearing of Canvas projection, cached frame/diff, camera transition and labels whenever either snapshot is missing. Focus rejects unavailable entities and the next valid frame restores inventory. Existing scene/Canvas/effects checks: **23 passed, 0 failed, 116 assertions**. Focused Chromium host integration: **1 passed** (943 ms), exercising both missing-arm cases, zero graphical objects, no inventory buttons, rejected stale focus and Month 16 recovery. The fixture is a minimal scene contract, not a new actual City-run acceptance recording. Browser artifacts: `/private/tmp/hbl-research-scene`.

The sandbox could not bind either attempted localhost port; the browser test ran successfully with the approved elevated local-server command. An initial test harness variable-shadowing error was corrected before the passing run. RC01 is verified at the scene host boundary; broader flagship preservation remains the next gate. No commit created; existing pipeline edits remain untouched. Checkpoint time: 2026-11-11 15:27:17 UTC, roughly 2 minutes 27 seconds after the measured start, not 25 hours.

Next: actual flagship preservation smoke, then sequential RC02 live reduced-motion handling with a focused regression. Keep the active goal running through the authorized window while meaningful approved work remains.

## RC02 — live reduced motion

P1, coordinator-owned, IN PROGRESS. Prerequisite: completed journey source audit; RC01 scene repair. Files: scene host and the focused research-scene browser suite/config. One stage-owned media query observes preference changes. Enabling reduced motion finishes an active camera transition immediately and rebuilds effects using static selected/changed styling. Disabling it permits subsequent animations. Disposal removes the listener. Preserve current month, shared camera endpoint, selection and model data. Acceptance: actual WebGL scene, animate focus, toggle preference during transition, assert immediate endpoint and stable camera; toggle back and prove subsequent focus animates. Run effects/scene/Canvas units and focused browser tests; broader flagship smoke is running independently before implementation.

RC02 focused verification: **2 Chromium checks passed** (2.6 seconds), including RC01; **23 scene/Canvas/effects unit tests passed**, 116 assertions. Separate pre-RC02 actual flagship fork/run/scrub/blink/inspect/share/refresh smoke passed (7.8 seconds), actual seed 42 housing delta +24 and eight scene objects. That earlier run proves RC01 preservation; repeat after subsequent scene integration.

## RC03 — graphics-loss context continuity

P1, coordinator-owned, IN PROGRESS; sequential after RC02. Files: scene host, Canvas diagnostics and research-scene browser regression. Preserve selected collection/ID, current recorded month and the native controls' viewed x/z target during WebGL→Canvas fallback; use Canvas fit for orthographic zoom and describe the projection change honestly. Clear obsolete native labels and cancel camera motion. Acceptance: focus a known entity, trigger actual context loss, assert one Canvas, same month/selection and camera target, no old labels or browser errors; controls remain usable. No change to model or native GPU support claims.

### Integrated reliability acceptance

RC01, RC02 and RC03 are VERIFIED for their declared scene-host acceptance. Actual Chromium context loss via `WEBGL_lose_context` retains exact selected ID and native x/z target in the new orthographic Canvas view. Native labels are cleared; one canvas remains; later focus works. Live preference changes finish camera transitions, preserve inventory/month and allow subsequent animations after restoration. Missing-arm clearing and recovery status both pass.

- `TMPDIR=/private/tmp bunx playwright test --config test/research-scene.browser.config.js`: **3 passed**, 2.6 seconds. Contract fixtures; not claimed as City integration scenarios.
- `TMPDIR=/private/tmp HBL_FM_ARTIFACT_DIR=/private/tmp/hbl-research-flagship bunx playwright test --config test/future-machine.browser.config.js --grep-invert '40-second'`: **5 passed**, 25.5 seconds. Actual City API: matched pair, WHY/share/refresh, zero-control/narrow screen/missing saved record, fallback, missing replay/mismatch errors, upper-limit recipe and resource disposal. Default +24 homes; upper history 50,862,264 JSON bytes; eight scene objects at Month 120. Hardware/network generalizations are unsupported.
- Scene/backend/Canvas/effects units: **32 passed, 1 browser-gated skip**, 172 assertions. Actual scene browser checks ran separately as above.

Pending independent read-only diff review from `journey_audit`. Scientific follow-ups are investigating reachable RNG-key aliases and bounded matched sensitivity design without changing the model. No commit, deploy, release merge or production mutation. Next priority is review corrections, then a reproducible sensitivity research artifact and a fresh guided-demo recording against accepted source.

### Actual-run evidence and independent review

Independent journey review found no blocking introduced regression. It correctly distinguished the scene-host fixture from actual City identity preservation; an additional actual-run journey now proves that wider case. A proposed asynchronous shader-preparation/fallback race remains unreproduced and is not classified as a confirmed bug.

The expanded research-scene suite passed **4 Chromium checks** in 5.2 seconds. The actual City test forks seed 42, seeks first physical divergence Month 16, selects `building-project-policy-1-0`, triggers actual WebGL context loss and verifies unchanged experiment ID, initial digest, every metric, current month, selected identity, camera x/z target and WHY event `16-0`. Both screenshots were visually inspected: WebGL has the recorded 24-home addition; Canvas retains its selected outline at the same schematic target. Orthographic projection differs explicitly. Final evidence-writing rerun: **1 passed** in 4.9 seconds.

Artifacts under `/private/tmp/hbl-research-scene/research-scene.e2e.js-actu-bee22-ction-through-graphics-loss/`: `recorded-month-16-webgl.png`, `recorded-month-16-canvas.png`, `recorded-context-loss-evidence.json`. Actual run `city_61d7cc27bbf5428f8b4be306de3a2aa8`; initial SHA-256 `e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`. These are local test artifacts, not deployed evidence.

Scientific follow-up enumerated actual RNG tuples for both 120-month arms at seeds 0, 42 and 4294967295: zero delimiter aliases. The generic helper accepts ambiguous colon-separated tuples, and custom IDs could reach the weakness; generated flagship IDs did not. No model repair is justified by this evidence. Existing trace tests already cover 20-month invariance and registration ordering; avoid duplicate generic tests.

Next research slice RC04 (P1, READY, coordinator): checked-in bounded seed × intervention-delay sensitivity experiment. Reuse current generator/engine/normalization/diff, seeds 0/1/42/4294967295, delays 0/6/24 and zero control; repeat each intervention and reconcile inventories, rent and cumulative monthly finance. Produce compact JSON with model/generator/source hashes, recipes, monthly measurements, completion event identities and explicit failed/error states. No UI/model changes. Acceptance: all121frames, common originals, exact repeat and zero controls, no future inventory, finite independent reconciliation, transparent synthetic/uncalibrated interpretation. Exploratory worker measurement was 2,400 steps/2,735 ms without intervention repeats; it is not the checked-in artifact or an API/browser performance claim.

RC04 implementation ownership: coordinator exclusively `scripts/research-future-sensitivity.mjs`, `test/research-future-sensitivity.test.js`, `docs/research-sensitivity.md` and its result artifact. IN PROGRESS. CLI defaults to the fixed approved matrix and writes an explicitly selected JSON output file. Tests exercise actual full-horizon experiments and falsify reconciliation using corrupted snapshots rather than mirror implementation internals. Browser behavior is unchanged, so no additional browser run is required for this slice. Risks: source commit alone cannot describe dirty model files; record content hashes too. Do not frame four deliberately selected synthetic seeds as a statistical sample or confidence interval.

RC05 (P1, coordinator-owned, IN PROGRESS): extend existing trace-invariance coverage only where missing: full 120-month default Future Machine intervention at seeds 0 and 4294967295. File `test/research-trace-invariance.test.js`; compare every raw step result after removing only additional causalRecords, including proposals/resolutions/capacities/events/decisions/diagnostics, plus immutable original. Existing world adapter covers 20 months and a different seed; this is targeted flagship/boundary coverage, not a duplicate generic trace test. Acceptance: exact equivalence each month, nonempty traces, no mutation, unchanged production model. Verify the named test and adjacent world-causal-adapter suite. No browser change.

### RC04–RC05 accepted evidence

Both research tasks are VERIFIED. Final independent review recomputed the retained sensitivity digest, checked all ten source byte hashes, four controls, twelve cases, 121 frames per case and source stability. Review found one material reconciliation gap (units added before completion) that was repaired with per-state validation and same-month new-unit gates. Two corruption tests cover future units before their building and unauthorized units on an existing building. Existing state validation changed two expected test messages; assertions were corrected before the final passing run. No engine defect or equation change is claimed.

Retained artifact: `docs/research/future-sensitivity-20261111.json`; digest `0b13121de75f7745777c7a84b4aa973887b4695a8b65823cb02850d2c0b742bb`; 3,840 steps, 6,372.65 ms engine/normalization/check/hash experiment. [Interpretation and reproduction](research-sensitivity.md). All default cases complete with +24 homes/+1,000,000 illustrative USD; delay0/6/24 completes at16/22/40. Noncompletion is separately covered by a120-month-delay test and is not called a crash.

`bun test test/research-trace-invariance.test.js test/world-causal-adapter.test.js test/research-future-sensitivity.test.js`: **9 passed, 0 failed, 1,023 assertions**, 2.15 seconds. Full boundary-seed traces contained418and444records; every non-trace raw step result matched the uninstrumented run.

Fresh named demo recording: **1 browser test passed**,55.2seconds; actual interaction elapsed51,521ms. Playable VP8 video is54.20seconds at1440×1000. Path `/private/tmp/hbl-research-recording/two-futures-sprint.e2e.js--d6b33--second-one-click-Play-Demo/video.webm`. Artifact verifier accepted2actualMonth0/120records and1video; completed screenshot visually inspected with exact24homes, capital and WHY trail. First-divergence screenshots remain separately captured by the actual context-loss journey. This is an uncut automatic guided-demo recording, not narrated audio or a claim of full25-hour execution.

Next: source checkpoint and evidence inventory, then continue eligible reliability/preservation work (resize after focus, resource lifecycle and route preservation investigations) within the remaining window. No release or deployment.
