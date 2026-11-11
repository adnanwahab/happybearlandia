# Demo proof audit — 2026-11-11

Author: Codex browser/evidence worker, existing approved demo sprint. Scope: read-only review of the three supplied artifact directories and current integration source; no production changes or new browser runs. Integration source inspected at `a14273e5273263d7c24a48e355cce92fa6639385` in `/Users/wahabma/happybearlandia`. This review does not assert that every artifact was produced by that exact commit: the artifacts do not record a source revision.

## Findings requiring final integration attention

### P1 — Reverse scrub retains a future WHY explanation and trail

Observed evidence: `/tmp/hbl-approved-responsive-integrated/approved-demo-responsive.e-94179-ced-motion-journey-at-320px/320-reverse-0.png` shows Month 0, zero KPI deltas and the original city, while its inspector still says `WHY · housingUnits · Month 16` and retains the completion/housing trail at Month 16, event `16-0`. Its paired JSON correctly records Month 0, zero events and only `building-d0`, `building-d1`, `building-d2`. The model and scene reversed correctly; the displayed inspector did not.

Source evidence: `world/future-machine/main.js` `setMonth` (line 41 at reviewed revision) updates frame, diff, stage, URL and UI/chart, but does not refresh the selected explanation. `showStory` builds the trail with the month selected when that story was created. `story/evidence-trail.js` itself correctly filters snapshots to `s.month <= month`; the stale mounted view bypasses that guarantee on a later scrub.

Suggested correction: coordinator refreshes or clears the active selection/WHY on a selected-month change, using that new month. If retaining a pinned historical explanation is intentional, it needs explicit pinned-time wording; do not present future receipts as the current selected month's evidence.

Affected ownership/interface: coordinator `main.js`, current selection lifecycle and browser regression. No model or shared-record change needed. Acceptance: select Homes WHY at 16, scrub to 0 with either slider, and verify the active explanation/trail no longer presents the Month-16 completion as current; repeat 0→16→120→0 and a trail jump. Expected effort: S. Existing responsive tests check reverse inventory/KPIs but do not assert inspector freshness, so their pass does not close this finding.

### P1 — Final recording is still absent from these evidence sets

The supplied directories contain 21 PNGs, 19 non-hidden JSON files, and **no WebM or demo-timing JSON**. The static Month-16 cinematic hold images cannot prove an uninterrupted 45–60 second journey, pause/resume timing or the final compact presentation. Coordinator has already scheduled the named recording command after the UI delta; retain its completed video, exact timing, evidence JSON and exit status in the final manifest. Do not reuse a pre-integration recording as proof of the final chart/trail/compact UI.

Affected ownership: coordinator recording and delivery manifest. Acceptance: `bun scripts/record-one-city-two-futures.mjs` completes against the final candidate; inspect the playable uncut video and duration, then associate it with its recipe/run and source revision. Effort: S, dependent on final UI integration and inspector correction.

### P2 — New chart and trail interactions need direct browser acceptance

Inspected source wires `createOutcomeTimeline(..., {onMonth: manualMonth})` and renders the actual `buildEvidenceTrail` output with `onJump`. Screenshots show both modules mounted. The inspected canonical/responsive/native tests do not explicitly select a recorded chart point/table row, change the chart metric, or activate an evidence-trail step. Primary-timeline/KPI tests cannot establish that these new entry points synchronize both scenes and inspector time.

Suggested focused acceptance: use the chart's accessible `Outcome month` control or `Select recorded month 16` table button; assert primary timeline, scene month and recorded Homes values agree; switch to capital spending and compare exact recorded values. Click the trail's recorded completion step and assert month 16, the exact building and event `16-0`; then reverse to 0 and check absent/unavailable evidence. Run at 320px Canvas and one native desktop viewport. Affected owner: coordinator browser integration. Effort: S; existing model/module unit checks need not be duplicated.

### P2 — Delivery needs source and artifact identity linkage

The JSON preserves model version, recipe, initial-state hash, run and selected month, but not the renderer/source commit or dirty-source digest. Temporary paths are also not a durable delivery manifest. Record final Git revision, browser/config flags, artifact paths/checksums and test outcomes together after the final UI change. This is an evidence packaging gap, not a reason to modify City data contracts. Effort: S, coordinator R11/R12.

## Verified observations from supplied artifacts

Parsed all 19 non-hidden JSON files. Three `.last-run.json` summaries independently say `passed` with no failed test IDs; they do not supply test counts/durations. No browser suite was rerun during this audit.

| Evidence set | Contents inspected | Supported conclusion |
| --- | --- | --- |
| `/tmp/hbl-integrated-decisions-proof` | 4 JSON / 4 PNG; metadata for Month 0/120 and two Month-16 hold captures | Canonical run `city_83381d09692c41a8b21d829112b416ef` has equal full initial states and 36→60 homes by Month 120; hold images are static evidence only. |
| `/tmp/hbl-approved-responsive-integrated` | 9 JSON / 9 PNG; 1440/390/320 matched 0, selected 16, reverse 0 | All three widths record Canvas2D, reduced motion, no horizontal overflow and empty page/console error arrays. Building arrays match at 0/reverse 0 and contain no future added building. The stale reverse inspector is visible despite those correct assertions. |
| `/tmp/hbl-native-decisions-integrated` | 6 JSON / 8 PNG; 1440/390 Month 0/16 plus layout/error records | Actual backend `webgpu`, Apple `metal-3`, Chromium `153.0.8010.12`; both halves contain city inventory and added geometry is visible without the prior mobile edge clip. Navigation overlap arrays and error arrays are empty. |

All 17 run-bearing records agree on seed **42**, model **city-systems.1.0.0**, and initial hash `e62e2cfd67d6f4a48dbeb9bc6a739a1abe1eb8a3e62e8e88241555829bc4d3fe`. Recipe: 30 households, 120 months, district `d1` housing amount 24, illustrative cost 1,000,000 USD, delay 0. Distinct runs retain distinct IDs; they must not be relabeled one shared persisted experiment.

At Month 16 and 120, available measurements agree: **36 without / 60 with / +24 homes**, **0 without / 1,000,000 with / +1,000,000 USD cumulative capital spending**. First physical divergence is Month 16, `building-project-policy-1-0`, a three-floor recorded structure. This is distinct from an earlier policy-record difference. Completion receipt is event `16-0`, simulation month 16, 24 units. Camera records match between 0 and 16 within each responsive/native run.

Native presentation pixel metadata uses normalized 256×192 halves and RGB-sum threshold 54 after cropping the seam and downsampling for AA tolerance:

| Viewport | Month-0 changed pixels / mean channel delta | Month-16 changed pixels | Bright pixels at either outer half edge |
| --- | --- | --- | --- |
| 1440 | 445 / 0.6583 | 3914 | 0 / 0 |
| 390 | 0 / 0.00335 | 2703 | 0 / 0 |

The Month-0 desktop halves are tolerance-matched, not bitwise-identical PNG regions. The city states are exactly equal. Month-16 differences are localized modeled additions/ghosts; these pixel counts are renderer evidence, not a new outcome metric. Native flags are `--enable-unsafe-swiftshader --enable-unsafe-webgpu --use-angle=metal`; adapter metadata, rather than the presence of the SwiftShader flag, establishes the actual Apple backend. No claim about default-driver WebGPU, Firefox, Safari or physical phones follows from these runs.

## Screenshots actually viewed

Visual inspection was limited to these seven images; other supplied PNGs were enumerated but are not claimed as visually inspected:

- Native `390-month-0-canvas.png` and `390-month-16-canvas.png`: both city halves visible; added plan structure/label fits after camera repair.
- Native `1440-month-0-canvas.png` and `1440-month-16-canvas.png`: matched original inventory and visible added plan structure versus baseline ghost.
- Canonical `after-month-120.png`: split city, measured cards, recorded outcome chart and synthetic-model disclosure visible.
- Responsive `320-month-16-why.png`: stacked controls/cards, outcome chart, exact-context WHY and evidence trail visible in the long page.
- Responsive `320-reverse-0.png`: zero city/KPIs and stale Month-16 WHY/trail visible together, supporting the P1 finding.

Full-page mobile images were inspected as long-page overviews; this is not a claim of physical-phone typography/readability testing. Compact-UI changes arriving after these artifacts require fresh captures. Synthetic layout, private capacity 0, utility capacity 200 and annual growth 0 remain disclosed assumptions. No empirical forecast, real-parcel identity or independent stored-checkpoint replay equivalence is established by this audit.
