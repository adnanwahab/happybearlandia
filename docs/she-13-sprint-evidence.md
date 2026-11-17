# SHE-13 sprint evidence manifest

Version: `hbl-sprint-evidence.v1`, audited November 12, 2026. [Machine-readable manifest](evidence/she-13-sprint-manifest.json) records exact paths, expected/observed SHA-256, byte counts, recipe and all 14 metrics. This is a local evidence publication, not a production release.

## Source and overlap

Issue: [SHE-13 / HBL-W1-008](https://linear.app/shel-bernstein/issue/SHE-13/hbl-w1-008-publish-a-truthful-sprint-evidence-manifest). Owned changes: this report, its JSON snapshot and the implementation-plan status entry. No runtime or shared simulation contract changes.

Audit branch: `mini/SHE-13`, baseline [`b963dd353538294cb0fbf5d34d5283fad6e10e68`](https://github.com/adnanwahab/happybearlandia/commit/b963dd353538294cb0fbf5d34d5283fad6e10e68). PR: missing; none created in this session. The audit baseline is not the capture revision. [Existing manifest](demo-evidence-manifest.json) pins `ad3902c522559b699cf70a1ae848c55b9e01641c` and explicitly qualifies progressive captures. [Later acceptance evidence](coordinator-final-evidence.json) pins application `2c9d973234ea73546d5597b068cda538a5136a2f`, reports 13 canonical browser passes/one recording skip and a separate recording pass. These records are historical and are not relabeled as tests of the audit baseline.

The existing [sprint report](one-city-two-futures-sprint.md), manifest, artifact verifier, recording command and `test/pipeline-evidence-manifest.test.js` already implement most of the requested evidence. This slice consolidates their provenance and current media availability. Prerequisites HBL-W1-001/004/006 are not certified Done by this audit; source overlap suffices to inspect evidence, but does not authorize dispatch or release. No dispatch labels or release gates changed.

## Open and reproduce

Route: `/world/future-machine.html`, then **Play Demo**. Start locally with `bun run server.js` (use the origin printed by the server). The old port 39960 is a historical review URL, not a promised running service.

```sh
bun test test/pipeline-evidence-manifest.test.js
bun scripts/record-one-city-two-futures.mjs --output /tmp/hbl-she13-recording --port 39945
bun scripts/verify-demo-artifacts.mjs --help
```

Only the first command was run in this audit: exit 0, **14 passed, 1 skipped, 0 failed, 195 assertions**. It recomputed both 121-frame histories, initial hash, first physical divergence and every metric, and verified 11 available artifacts. The skip identifies the missing delta screenshot below. Recording is an executable reproduction command, not a claimed fresh recording. Browser behavior did not change, so Playwright was not rerun. The package has no lint/typecheck script.

## Scenario and interpretation

Synthetic Riverside scenario, not empirical city data or a calibrated forecast: `future-machine.v1`, rules/model `city-systems.1.0.0`, seed **42**, 30 households, 120 monthly steps. Intervention: `d1` housing, amount 24, illustrative cost 1,000,000 USD, delay 0, compliance 1. Both arms start at SHA-256 `e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`.

| Month 120 modeled metric | Baseline | Plan | Delta |
| --- | ---: | ---: | ---: |
| Housing units (homes) | 36 | 60 | +24 |
| Cumulative capital spending (USD) | 0 | 1,000,000 | +1,000,000 |
| Mean unit rent (USD/month) | 971.504282807192 | 230.73527356811846 | -740.7690092390735 |

First physical divergence: Month 16, `building-project-policy-1-0`; historical completion receipt `16-0` links 24 units to the housing project. Rent includes synthetic vacancy feedback and newly supplied inventory; it does not estimate incumbent rent savings. Spending is a cost. The tiny travel delta does not support a meaningful commute-benefit claim. Monthly City identities/time are not interchangeable with Population or Decision Studio.

## Browser, screenshots and video

Historical tested browser: Chromium `153.0.8010.12`, Apple Metal WebGPU at 1440/390 widths; Canvas2D reduced-motion evidence at 1440/390/320. Source: [browser proof audit](reviews/demo-proof-audit-20261111.md). This browser version describes that inspected set, not every progressive capture. Safari, Firefox and physical phones remain unverified.

The historical recording manifest reports **56.84 seconds** for the MP4 below; its hash is freshly verified, but playback/duration were not re-inspected. Its audit records run `city_705bdf23e7e64d3b8d6b51f1665d11f6`, months 0/120, seed 42 and WebGPU. Independent screenshot runs retain their own IDs. The later acceptance report separately records **52.868 seconds Play-to-completion** at `2c9d973`; these are different measurements and must not be combined.

| Artifact | Audit status | Local path |
| --- | --- | --- |
| cinematic | verified | `/tmp/hbl-integrated-decisions-proof/two-futures-sprint.e2e.js--0b5a2-rgence-hold-respects-reduce/cinematic-month-16.png` |
| cinematic | verified | `/tmp/hbl-integrated-decisions-proof/two-futures-sprint.e2e.js--2e7e6-hold-respects-no-preference/cinematic-month-16.png` |
| native390 | verified | `/tmp/hbl-native-decisions-integrated/native-presentation-proof.-5e7b7-calized-Month-16-difference/390-month-16-canvas.png` |
| construction15 | verified | `/tmp/hbl-construction-final/construction-recorded-real-0449f-ompletion-and-reverse-scrub/month-15-construction.png` |
| construction15 | verified | `/tmp/hbl-construction-final/construction-recorded-real-110cf-ompletion-and-reverse-scrub/month-15-construction.png` |
| construction16 | verified | `/tmp/hbl-construction-final/construction-recorded-real-0449f-ompletion-and-reverse-scrub/month-16-completed.png` |
| construction16 | verified | `/tmp/hbl-construction-final/construction-recorded-real-110cf-ompletion-and-reverse-scrub/month-16-completed.png` |
| delta320 | missing | `/tmp/outcome-delta-browser-evidence/outcome-delta.e2e.js-actua-75f26-KPIs-including-320px-Canvas/actual-delta-month16-320.png` |
| why16 | verified | `/tmp/hbl-evidence-trail-final/evidence-trail-real.e2e.js-36a4c-oject-and-completion-months/evidence-trail-completion-month16.png` |
| inspectorReverse0 | verified | `/tmp/hbl-evidence-trail-final/evidence-trail-real.e2e.js-36a4c-oject-and-completion-months/evidence-trail-scrub-zero-refreshed.png` |
| recording | verified | `/tmp/hbl-approved-final-recording/one-city-two-futures.mp4` |
| recordingAudit | verified | `/tmp/hbl-approved-final-recording/artifact-audit.json` |

These paths are local links to retained evidence, not durable downloads. Exact checksums are in the JSON snapshot. A fresh checkout can legitimately lack every temporary artifact; absence is missing evidence, never a passing media check. No screenshots were generated because no UI changed.

## Known limits and next action

The 320px delta screenshot is missing. Other files were readable and hash-matched at audit time; that does not prove visual quality, uninterrupted playback or final-source capture. The old manifest remains immutable historical evidence. Later coordinator reports retain R13 catalog-preservation and R14 required-module startup failures as unresolved release risks; this scope does not repair or clear them. Empirical calibration and cross-model equivalence are unverified.

For durable external delivery, the coordinator must retain/upload the actual media with checksums, restore or recapture the missing screenshot, associate any new captures with their exact source/browser, and attach the eventual branch/PR receipt. No merge, deployment, production-data change or release approval occurred here.
