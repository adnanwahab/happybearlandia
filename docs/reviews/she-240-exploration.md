# SHE-240 exploration tournament

Audited 2026-11-12 at `b963dd353538294cb0fbf5d34d5283fad6e10e68`.
Result: a proposed backlog, not implementation authorization. No production
changes, pushes, issue mutations, or deployments. Linear SHE-240 remains Canceled.
Seven investigations ran in batches under the four-agent session limit; seven
simultaneous threads were unavailable. Investigators shared the checkout read-only,
so isolated implementation worktrees were unnecessary. The coordinator owns this
report only.

Read AGENTS.md, product design, relevant implementation-plan sections, existing
demo backlog, module contracts, source and tests. There is no docs/architecture.md;
README and docs/images/architecture-current.svg describe separate monthly City,
Population and housing authorities. Carrying an ID between views does not map them.

## Baseline and ownership

Live Linear readback: SHE-77, SHE-76 and SHE-73 are In Review. Their descriptions
reserve flagship integration, paired histories and first-run paths respectively.
Local docs/demo-backlog.md additionally reserves U03 resource proof (REVIEW),
R13 catalog preservation and R14 startup failure repair. Do not relaunch these.
These observations do not establish current GitHub merge state or an exhaustive
live ownership inventory. Recheck issue, PR and worktree ownership before execution.

Already working: deterministic 121-frame paired histories, immutable Month 0,
seed-matched replay, split/difference views, guided presentation, outcome timeline,
housing construction receipts, WHY trails, share recipes, renderer fallback,
recorded newspaper stories, discoveries, and Playable Life. Do not rebuild them.
Historical plan acceptance is distinguished below from tests actually rerun.

## Ranked opportunity backlog

Ranking is coordinator judgment: demonstrated incorrect results first, then
misleading user behavior, accessibility and reuse, then speculative or larger work.
S means focused change; M requires several integrated behaviors; L crosses contracts.
The first seven are selected. They have disjoint proposed file ownership, but remain
candidates until fresh ownership checks. Items 8–21 are alternatives, not dispatches.

| Rank | Investigation / opportunity | Evidence and reason | Size / disposition |
| --- | --- | --- | --- |
| 1 | Science: finite comparison arithmetic | Finite operands produce Infinity/NaN while marked available | S / T1 |
| 2 | Gameplay: quest capability gating | Noncommute requests retain commute-only proposal/results | S / T2 |
| 3 | Provenance: unique evidence limit | Repeated citation falsely declares complete evidence truncated | S / T3 |
| 4 | Performance: trustworthy benchmark comparison | Workload mismatch and invalid timing can escape regression gate | S / T4 |
| 5 | Visual: keyboard and noncolor SVG hotspots | Click/color-only circles exclude keyboard inspection | S / T5 |
| 6 | Narratives: newspaper for selected saved run | Archive currently always requests fixed demo | M / T6 |
| 7 | First-run: real DOM readiness lifecycle proof | Mutation observer omits child insertion/removal delivery | S / T7, hypothesis |
| 8 | Provenance: readable evidence cards | Inspector primarily presents raw JSON | M / retain raw evidence |
| 9 | Narratives: edition topic/entity filtering | Type-first ordering can overwhelm larger archives | M / measure volume first |
| 10 | Science: justified metamorphic invariants | Replay consistency does not establish model validity | M / reuse seed harness |
| 11 | Visual: compact retained-record tables | Layer record dumps truncate at 6000 characters | M / heterogeneous schemas |
| 12 | First-run: broad control failure matrix | Existing semantics need real startup interaction coverage | M / coordinate SHE-73 |
| 13 | Gameplay: playable school request | Existing school construction and demand rules offer reuse | M / recipe, outcome and council design |
| 14 | Performance: reuse sorted frame samples | Repeated statistics sorts may add overhead | S / profile first |
| 15 | Provenance: request-local node cache | Shared citations trigger repeated reads | S / profile high fan-in |
| 16 | Narratives: household-focused story ranking | Structural-first editorial ranking can obscure burdens | M / frozen story owner |
| 17 | Gameplay: matched Playable Life control | Follow-up is observational, not action effect | L / checkpoint/control design |
| 18 | First-run: required-module startup disclosure | Static import can prevent runtime error initialization | M / existing R14 owner |
| 19 | Science: intervention replay adapter | City historical adapter intentionally rejects inputs | L / producer/version contract |
| 20 | Performance: quick-demo worker optimization | Historical 500-resident run had long compute time | L / fresh profile + identical outputs |
| 21 | Visual: richer construction/traffic animation | Many proposed layers lack recorded routes/footprints | L / defer unsupported imagery |

## Selected implementation tasks and acceptance

### T1 — Preserve finite paired comparison results

Own `world/paired-comparison.js` and `test/paired-future-comparison.test.js`.
At lines 9–14 and 45, input validation does not validate derived subtraction,
summation or interpolation. A direct call with baseline `-Number.MAX_VALUE`,
child `Number.MAX_VALUE`, seed 1 returns available with infinite delta/mean and
NaN quantiles; JSON silently turns those values into null.

Acceptance: reject/unavailable overflow with a reason; every available result is
finite after JSON round trip. Preserve representable large means/quantiles,
ordinary signed deltas, seed coverage, units and compatibility. Cover subtraction,
sum and interpolation boundaries, singleton/empty/unmatched samples. Keep the
empirical-range-not-confidence-interval notice. Reuse existing comparison APIs.
Experiment: boundary table plus unchanged ordinary-fixture outputs. Risk: changing
unavailable shape can affect consumers; preserve existing compatible fields.
Verify existing paired comparison, checkpoint replay and seed sweep suites.

### T2 — Gate Living City quests by supported capability

Own `world/living-city/page.js`, `world/living-city/index.html` and new dedicated
quest-capability tests/browser config. `showQuest` at page.js:107 changes request
and visit visibility, while `setProposal` at :125 always uses COMMUTE_OPTIONS.
The experiment action remains the commute ensemble. Existing quests and the
100-seed commute journey are reusable; four other requests are evidence starters.

Acceptance: housing/business/school/utility selection explicitly says evidence
only and presents no transit proposal, executable transit action, or apparently
applicable stale commute result/council verdict. Switching back restores the
commute journey. A pending commute completion cannot repopulate another quest's
visible result. Existing share, resident and seed behavior remains unchanged.
Experiment: select all five quests before and after a real commute run; record
visible actions, requests and model calls, including a switch during pending work.
Risk: hiding previous results may confuse users; retain their commute identity
and reveal them only in the appropriate context. No new interventions or model
changes. Verify living-city quest/recipe/council suites and focused browser flow.

### T3 — Count unique causal evidence at the limit

Own `world/causality/explanation.js` and `test/causality-read.test.js`.
Line 20 tests map size before recognizing a repeated citation. An injected
completed store with target/source nodes, two edges citing a,b then a, and
maxNodes 2 returns both unique evidence records but adds evidence-limit.

Acceptance: repeated citations at the exact limit do not mark truncation;
an omitted third unique citation does. Missing IDs still report missing-evidence.
Test citation orderings and normal API JSON; preserve depth/node/edge limits,
association filtering, deterministic traversal and read-only behavior. Reuse
existing traversal/inspector caveats. Experiment: exact-limit synthetic graph
matrix; do not interpret fixture edges as empirical causation. Risk: accidentally
suppressing real truncation. Run causality-read and causal-graph suites.

### T4 — Fail closed on invalid renderer comparisons

Own `scripts/benchmark-renderer.js`, new
`scripts/lib/renderer-benchmark-comparison.js` and its new focused test file.
Lines 20–25 compare only some metadata and divide unvalidated measurements.
Reuse existing renderer reports and benchmark scenes; leave renderer and U03 alone.

Acceptance: compare normalized scene/population, backend, viewport, settings,
features, geometry detail, DPR, browser and adaptive/scripted mode. Ignore host/
port differences. Reject incompatible or insufficient metadata with re-record
guidance. Reject empty samples, page errors and invalid timing values; retain
nullable unsupported GPU timing and explicitly choose valid frame timing when
GPU timing is unavailable. A valid regression above 15% exits nonzero; invalid
data never passes silently. Preserve failed report artifacts.
Experiment: synthetic single-field mutations of a real report, then two
uncontended same-workload browser runs and one changed-workload run. Risk: older
baselines become incompatible; hardware equality may need a later explicit ID.
Run comparison unit tests, render-performance tests and actual benchmark smoke.

### T5 — Make SVG hotspots inspectable without color or pointer

Own SVG presentation in `world/reality/hotspots.js`, a new DOM test and dedicated
browser test. Lines 61–64 render circles with click/title only. Reuse exact anchors,
magnitude, HOTSPOT_COLORS and hotspotExplanation; preserve computation and Three.js.

Acceptance: positive/negative/mixed/neutral have distinct noncolor encoding,
accessible name, visible focus and Enter/Space activation identical to one click.
Hidden/disabled layers leave no focus targets. Missing/zero/unlocated values
never acquire invented markers; inputs and computation outputs remain unchanged.
Experiment: 16-marker fixture, grayscale and narrow viewport; optionally five
readers measure direction recognition and keyboard selection. This playtest is
proposed, not performed. Risk: marker clutter/occlusion; inspect screenshots.
Run reality-hotspots, reality-visual-layers and time-machine-heatmap suites plus
the focused real browser interaction.

### T6 — Reopen the newspaper for a compatible saved run

Own `world/newspaper/{editions.js,page.js,index.html}`,
`test/living-newspaper.test.js` and dedicated newspaper browser tests.
editions.js:56–57 hardcodes DEMO_RUN_ID; page.js:43 calls the default loader.
Reuse six grounded event templates, pagination, exact inspector/month links.

Acceptance: URL runId requests exclusively that compatible monthly run; absent
runId retains demo behavior. Validate model/domain before interpreting ticks as
months. Show run/seed/version and preserve exact event/tick in links. Distinguish
missing, incomplete, unsupported, empty and failed reads, with no silent demo
substitution. Read/retry/reload sends no POST. Two stored runs retain separate
articles and links; render text safely. Experiment: two distinguishable synthetic
stored runs plus unsupported/missing fixtures, measuring requests/count/latency.
Risk: a run context alone does not prove calendar compatibility; fail closed.
Run existing newspaper suite and real reload/evidence-link browser test.

### T7 — Prove readiness updates through actual DOM mutations

Own only new `test/e2e/readiness-dom-lifecycle.e2e.js` and
`test/readiness-dom-lifecycle.browser.config.js`. No runtime ownership transfer from SHE-73 or R14.
`world/onboarding/first-run-repairs.js:50` observes disabled/hidden attributes,
not childList. Existing fake-observer tests cannot prove native event delivery.
This is a source-supported hypothesis, not a browser-reproduced defect.

Acceptance: real DOM exercise inserts an already-disabled control, removes it,
toggles readiness and disposes the observer. Verify visible reasons and restoration
of original/external accessibility attributes without stale status or loops.
Record exact failing behavior if present and return a bounded repair proposal to
the existing runtime owner; do not weaken assertions or edit production under
this test-only task. Existing startup/deadline and control behavior stays covered.
Experiment: compare actual MutationObserver delivery with current manual callback
fixtures. Risk: test proves a defect and ends red; retain that evidence for a
separately owned repair, rather than claiming the product is fixed.

## Seven investigation comparisons

The ranked table includes three alternatives for each investigation. Additional
strengths, tradeoffs and empirical limits:

1. **Visual impact:** actual mapped hotspots, fixed heatmap bins/missing category,
   fallback and reduced motion exist. Choose accessibility over speculative
   animation; raw-record tables require heterogeneous schema design.
2. **Scientific reliability:** existing 104-seed plus boundary replay harness,
   independently retained digests and manifest checks are valuable. Determinism
   does not establish calibration. Choose the demonstrated arithmetic boundary;
   replay interventions need contract ownership and metamorphic claims need
   justified invariants, not universal welfare monotonicity.
3. **Emergent narratives:** Future Machine already ranks/deduplicates grounded
   story stops (`story/index.js:8–45`); discoveries reject gaps/incompatible units
   (`world/discoveries/engine.js:37–111`); House has seeded story admission.
   Newspaper reuse is less coupled than changing frozen story ranking. Filters
   risk hiding important records; measure archive volume first.
4. **Provenance:** bounded persisted graph reads, source records, retries and
   stale-request cancellation already exist. Readable cards need browser work;
   request-local caching needs measured query costs. Correct the demonstrated
   false completeness warning first, without inventing causal edges.
5. **Interactive gameplay:** five evidence-backed quests and the paired commute
   ensemble already exist; Playable Life has validated actions and resumable
   follow-up. Honest capability gating is smaller than adding a playable school
   scenario or matched autonomous controls. Never label observational follow-up
   as the effect of the player's actions.
6. **Performance:** adaptive-quality hysteresis, batching/culling, nullable GPU
   timings and scripted benchmarks exist. Fix measurement integrity before
   claiming speed gains. Statistics caching needs profiling; historical long
   demo computation needs fresh measurement and deterministic equivalence.
7. **First-run UX:** mood/seed facts, deadlines, prerequisites and local-play
   isolation are substantially implemented. A native DOM lifecycle experiment
   avoids taking over reserved startup repairs. Broader failure matrices must
   distinguish optional metadata failure from required-module failure.

## Actual verification and remaining limits

Focused executions reported by investigators:

| Command (`bun test` paths) | Actual result |
| --- | --- |
| test/reality-hotspots.test.js test/reality-visual-layers.test.js test/time-machine-heatmap.test.js | 9 pass, 0 fail, 38 assertions |
| test/paired-future-comparison.test.js test/checkpoint-replay.test.js test/city-seed-replay-sweep.test.js | 25 pass, 0 fail, 104 assertions |
| test/living-newspaper.test.js test/future-machine-story.test.js | 11 pass, 0 fail, 65 assertions |
| test/causality-read.test.js test/causal-graph.test.js | 7 pass, 0 fail, 100 assertions |
| test/render-performance.test.js | 9 pass, 0 fail, 48 assertions |
| test/living-city-quests.test.js test/challenge-contract.test.js world/house/story-director.test.js | 48 pass, 0 fail, 308 assertions |
| test/world-first-run-repairs.test.js test/world-readiness-regression.test.js | 11 pass, 0 fail, 38 assertions |

Coordinator independently ran `bun test test/future-machine-paired.test.js
test/future-machine-data.test.js test/living-newspaper.test.js
test/first-run-guide.test.js`: 7 pass, 0 fail, 65 assertions, across **two** actual
files. The paired and first-run-guide filenames do not exist here; this command
is not evidence for those filenames. Actual data tests included a real City API
persist/reopen pair (seed-matched 120 months), reporting about 17 MB pair JSON.
`bun test test/world-first-run-repairs.test.js test/universe-shell.test.js`:
9 pass, 0 fail, 43 assertions. Do not sum overlapping executions as unique tests.

No browser, usability experiment, fresh performance benchmark, full suite or
deployment verification was performed for this exploration. Existing tests pass
despite the new boundary findings. No package lint/typecheck script exists.
No production behavior changed, so Playwright is deferred to selected task
implementation. `git diff --check` is the final documentation check.

Next action: refresh ownership against live PRs/worktrees, then propose T1 as the
first integrated slice. T1–T7 share no production files; no task may edit server,
City engine, frozen Future Machine contracts, shared plan or CI independently.
Integrate completed candidates sequentially and run their combined checks.
Exploration produced no implementation patch; later authorized implementations
can be delivered as git-am patches as the issue requests. No push is authorized.
