# Engineering pipeline status

Authoritative branch: sprint/one-city-two-futures-20261111; last accepted baseline: bb277fd4bcfef703c2967395da340fc3e0becc48.

- READY execution pool: U01, U02, U03, U05, U08, R13, R14, R15
- Dispatchable now (capacity three): R13, R14, R15
- Active assignments: None
- Verification queue: NB-district-candidate (backlog-triage), NB-grid-fixture (backlog-triage)
- Blocked/unconfigured: U15
- Independently integrated: U10 (receipts-worker), U16 (evidence-worker)
- Test failures: None recorded
- Next executable action: R13

## Accepted evidence

- U10 → 779c3600bf67081da88f52b9a635961759a2614d; 2 independently executed checks; Reviewed the one-file diff against U10. Actual monthly City histories test repeated selection and historical receipt labels; no renderer or simulation changes. No new visual behavior claimed.
- U16 → bb277fd4bcfef703c2967395da340fc3e0becc48; 2 independently executed checks; Reviewed the test-only U16 diff: no product/manifest mutation, no generated screenshots. Validates retained actual artifacts and explicitly labels missing local evidence unavailable. Progressive-capture and browser limitations remain qualified.

State is durable in the Git common directory under demo-pipeline/interactive.json. The interactive bridge shares the runner lock. Historical backlog VERIFIED is baseline evidence, not a test executed by this run. Tasks lacking reviewed execution metadata stay blocked rather than being dispatched speculatively. No main merge or deployment is implemented.

## Audit and visible behavior

Main missing automation was a durable claim→handoff→independent verification transition shared across worker mechanisms. Fixed atomic claims, scope/capacity guards, cross-runner outstanding-assignment exclusion and external-queue backpressure. Actual attempted dispatch with three queued contributions was refused; U16 integration took priority.

The product's visible behavior is preserved, not rebuilt: same seed42, Month16 added24homes, exact completion receipt, reverse0 nofutureevidence. U10 tests those actual histories; U16 reproduces metrics and verifies12retainedPNG/JSON/video hashes. No browser-facing code changed in this pipeline slice, so no new browser screenshot or visual improvement is claimed. Existing demo screenshots/video remain in demo-evidence-manifest.json.

Next executable dispatch: R13 catalog-preservation regression in a freshisolatedworktree after claim; next integration review: NB-district-candidate then NB-grid-fixture, with their source/contract/unit/browser/screenshots inspected before acceptance. No new codingworker currentlyrunning. EightREADYscopes remain. Externalrunner liveexecution blocked by OSsandbox; internalCodex path demonstrated successfully. Report regenerated with `bun scripts/pipeline-coordinator.mjs report`; runtime state in Gitcommon directory and committed delivery summary in engineering-pipeline-evidence.json.

Final check:45passed/0failed/369assertions across5files (7.30s). Includes18pipelineautomationtests and both actual integratedtasks. Testcommand/loghash are in engineering-pipeline-evidence.json. U17 structuredstatus reconciled to alreadyverifiedsaved-seed behavior; no duplicateimplementation.
