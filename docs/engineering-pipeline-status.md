# Engineering pipeline status

Authoritative branch: sprint/one-city-two-futures-20261111; last accepted baseline: 2c9d973234ea73546d5597b068cda538a5136a2f.

- READY execution pool: U05, U08
- Dispatchable now (capacity three): None
- Active assignments: U03 (browser-resources-u03)
- Verification queue: NB-district-candidate (backlog-triage), NB-grid-fixture (backlog-triage)
- Blocked/unconfigured: U15, R13, R14
- Independently integrated: U01 (native-reliability-worker), U02 (native-reliability-worker), U10 (receipts-worker), U16 (evidence-worker), R15 (continuous-coordinator), U18 (continuous-coordinator)
- Test failures: R13: candidate check failed: bun test test/pipeline-catalog-preservation.test.js; R14: candidate check failed: bunx playwright test --config test/pipeline-local-play.browser.config.js
- Next executable action: Review blocked tasks

## Accepted evidence

- U01 → 345d4c730ba5926fd526b48eda6790914e3f25cf; 4 independently executed checks; Reviewed exact U01 two-file test/config diff fe0f08d. Native capture wraps GPUCanvasContext.configure without replacing its native result and destroys actual displayed GPUDevice; WebGL loss extension yields trusted event. Source-pinned evidence inspected: Apple metal-3 destroyed/native lost promise, WebGL contextLost true, both fallbackcanvas2d/month16/+24, no page/console errors. Inspected actual fallback PNG; one real Canvas remains, old GPU canvas disconnected. No runtime change.
- U02 → 2c9d973234ea73546d5597b068cda538a5136a2f; 6 independently executed checks; Reviewed bounded second U02 candidate a6c84fa against original base and authorized scope. First failure e30a1c0 and its command logs retained; scope reconciled explicitly under shared lock before worker edits. Canvas labels measured with actual ctx font metrics, fit within each arm and above44px footer. Visibility guard avoids pulling offscreen structures labels onto edges. Existing actual draw-call browser checks preserve frame/seed/metrics/camera and verify normal pan; native unchanged. Coordinator visually inspected320pxCanvas PNG: selected exact ID fits abovefooter. This is the single permitted retry.
- U10 → 779c3600bf67081da88f52b9a635961759a2614d; 2 independently executed checks; Reviewed the one-file diff against U10. Actual monthly City histories test repeated selection and historical receipt labels; no renderer or simulation changes. No new visual behavior claimed.
- U16 → bb277fd4bcfef703c2967395da340fc3e0becc48; 2 independently executed checks; Reviewed the test-only U16 diff: no product/manifest mutation, no generated screenshots. Validates retained actual artifacts and explicitly labels missing local evidence unavailable. Progressive-capture and browser limitations remain qualified.
- R15 → d548153489964c776fef34d28e2b39739c6a4bbd; 2 independently executed checks; Reviewed exact two-file R15 diff. Owner-only explicit repair, two total attempts, immutable failed candidate/check/evidence history, race and capacity tests, REVIEW/REPAIR reservations. Candidate failure repair is bounded; integrated failure blocks replay and dispatch until manual reconciliation. Coordinator independent focused run passed12tests/66assertions before final next-message consistency refinement; final manifest checks rerun both phases. No product behavior changed.
- U18 → 1d0a488a0ddd8936ce53294594723d2f04317bab; 4 independently executed checks; Reviewed exact two-file U18 diff. Dedicated native-overlay marker and labels.replaceChildren during failure transition only; Canvas-owned labels untouched. Strengthened real-loss regression proved both backends fail before fix with7retainedspans and pass after. Coordinator inspected actual after-fix native-loss screenshot: stale spans gone, Canvas24home delta and inventory intact. Candidate browser2pass/units26pass1skip; independently rerun via manifest.

State is durable in the Git common directory under demo-pipeline/interactive.json. The interactive bridge shares the runner lock. Historical backlog VERIFIED is baseline evidence, not a test executed by this run. Tasks lacking reviewed execution metadata stay blocked rather than being dispatched speculatively. No main merge or deployment is implemented.

Current accepted-source full verification and latency/worker metrics: [coordinator-final-status.md](coordinator-final-status.md). No always-running daemon or release authorization is implied.
