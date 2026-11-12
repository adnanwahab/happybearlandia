# Continuous coordinator — accepted working increment

Accepted application source: `2c9d973234ea73546d5597b068cda538a5136a2f` on `sprint/one-city-two-futures-20261111`. Later commits update tests, scheduling and evidence only where explicitly recorded. No protected main/release merge, deployment, push or production-data change.

## Delivered behavior

- **U18:** Real WebGPU/WebGL loss now clears native text overlays before Canvas takes over. The seven stale labels reproduced before the fix; actual native/WebGL regression now confirms zero retained native spans, one Canvas and unchanged run/month/metrics/WHY. Integrated `1d0a488`.
- **U02:** Selected Canvas building IDs fit their arm at390/320px and sit above the44px footer. Panning a structure offscreen no longer pulls its ID onto an edge. Native framing, shared camera and recorded state are preserved. Original failing candidate `e30a1c0` retained; authorized repair `a6c84fa` independently accepted on attempt2 as `2c9d973`.
- **R15:** Explicit owner repair allows two total verification attempts, retains failed candidate/check/review evidence and reserves REVIEW/REPAIR paths/interfaces/capacity. Racing resumes and a third attempt are rejected. Integrated-check failures require explicit reconciliation. Integrated `d548153`; exercised on the real U02 failed→repair→verified path.
- **U01:** Real native GPUDevice destruction and trusted WebGL loss-extension proof, rather than fake backend labels. Integrated `345d4c7`; U18 completes the visual fallback acceptance exposed by its screenshots.

Production changes are limited to `world/future-machine/scene/index.js` and `scene/canvas-stage.js`, plus pipeline coordination in `scripts/pipeline-coordinator.mjs`. Dedicated tests/configs, reviewed execution metadata and evidence documentation changed. No City model, seed semantics, recipe, unit/cost contract or model provenance changed. The scenario remains synthetic and uncalibrated.

## Accepted-source verification

| Check | Actual result |
| --- | --- |
| Combined focused/simulation/pipeline suites | 139passed,3browser-gatedskips,0failed;1199assertions20.47s |
| Canonical browser sweep | 13passed,1recording-gatedskip,0failed;2.0min |
| Responsive homepage/keyboard/WHY/reverse0 | 1440/390/320:3passed14.3s |
| Actual native Metal/WebGL loss | 2passed5.2s, same seed42/month16/121frames/metrics |
| Named native recording | 1passed57.2s; actualPlay→complete52.868s |
| Recording artifact validator | 2provenance records at0/120,1playablevideo |
| U02 candidate and integrated gates | 17units +2native/Canvas resize browsers each phase; actual selected-label geometry measured |
| Diff whitespace | passed |

Earlier exact share/missing/corrupt/boundary browser proof:5passed30.1s at1d0a488, before the Canvas-only label placement repair. Sharing/model source did not change. Native desktop/390 pixel proof2passed at that earlier checkpoint; final native real-loss and resize checks also pass. Safari, Firefox and physical phones remain unverified. No lint/typecheck script exists.

The first combined sweep caught an obsolete hardcoded dispatch batch; fixed and clean139-test rerun retained. A contended canonical run caught artifact IO advancing the unpaused presentation before Pause; moved Pause before full-history/screenshot capture after observing the real hold. Both normal/reduced-motion targeted checks and the final clean canonical sweep passed. Failed logs/traces were retained. No demo clock or simulation behavior was changed to make tests pass.

[Exact commands, outputs, commits, event times and81hashed local artifacts](coordinator-final-evidence.json). Artifacts are local files, not bundled. Source SHA and before/after qualifications distinguish negative/candidate/accepted evidence. Screenshots were visually inspected; hashing alone is not interaction proof.

## Queue and utilization snapshot

- Peak confirmed concurrent execution:3/3. Current actualworker: U03,1/3; R13/R14 retained repair reservations occupy the other two scheduling slots. Do not describe reserved failures as running workers.
- READY depth:2, U05/U08. Meaningful approved reliability work only; do not invent features to inflate the pool.
- External review backlog:2, NB-district-candidate/NB-grid-fixture. Neither was integrated.
- Integrated this resume:R15,U01,U18,U02; two observable visual repairs plus verification/coordination infrastructure.
- Accepted-source final tests:0failed. Separate unresolved diagnostic gates:R13 three failed preservation assertions; R14 one failed import/startup assertion.
- Latest-submit→VERIFIED:R15 23.720s,U01 31.797s,U18 17.447s,U02 31.037s. U02 first-submit→verified275.914s includes the retained failure, review and repair. These are this host's event measurements, not throughput forecasts.
- Resource evidence: one live Canvas replaces the lost GPU canvas; lifecycle/object-count measurements remain U03's task. No guessedFPS, memory savings or idle-time estimates.

## Release blockers and next work

**R13 remains retained REPAIR/BLOCKED:** candidate67aed30 independently2pass/3fail. Future Machine stays intact, but HoustonBars catalog/atlas API/source wiring and ten canonical directory entries are not preserved from pinned local main. No failing test was cherry-picked. Resolve through a separate scoped preservation increment, not a release merge.

**R14 remains retained REPAIR/BLOCKED:** candidatea1aa70d independently8unitpass and2browserpass/1fail. Local Play works while optional plan requests are pending or fail. Aborting simulation-observations.js also removes a required renderer/model dependency, preventing startup and its useful disclosure. This is a required-module failure, not isolated optional metadata failure. Reconcile acceptance and independent load-error disclosure without pretending the unavailable model can run. No failing test was integrated.

U03 acquired a real isolated claim at2c9d973. Its browser/resource measurements were intentionally held during final proof jobs; FINAL_GATE_RELEASED was sent after those jobs finished. It must submit evidence for review, not integrate itself. Next integration decision: independently review U03, then resolve release-preservation/disclosure scope; U05/U08 remain READY subject to capacity and backpressure. Existing six chat identities retained; idle/unloaded or repurposed chats were not counted as active workers.

Coordination is on demand through actual claims and worker messages, not a claimed always-running daemon. [Current dispatch snapshot](coordinator-next-dispatch.json).
