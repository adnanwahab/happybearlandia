# Decision simulation demo

## Current advanced verification

**Final compact-delivery regression:** all four advanced browser tests passed in
32.7 seconds on a fresh isolated3131 server. The full loop explicitly used
`traceDelivery:on-demand`, included a real approved300-home building, hydrated
121 monthly rows and121 project states on Enter Future, then verified actual
explanation, approved fork prefix, optimization, stress IDs/denominators in the
brief. No full-array trace fallback was used. The original `/world` bridge is
awaiting its owner’s selected-trace loader before its separate final regression.

The recorded1:59.84 video predates compact transport but uses the same housing1.2.0
numeric model; the later32.7-second regression verifies current delivery behavior.

- Actual connected Failure → Fix → Ghost Rerun → Enter Future → Explain →
  approved Fork → Optimize → approved alternative → Stress → Brief browser
  journey passed in Chromium (37.8 seconds, then 38.4 seconds with an additional
  assertion that the brief contains actual stress-cell experiment IDs and denominators).
- Three reliability browser cases passed: actual paired robustness/restore/mobile,
  cancellation/unrun-cell handling, explicit saved fallback/fresh-error separation.
- Chromium is installed and tested. Firefox/WebKit executables are absent; Safari
  and Firefox are **untested**, not passed. No browser install was attempted.
- `/private/tmp/hbl-advanced-stress.png` and
  `/private/tmp/hbl-advanced-decision-brief.png` are actual UI captures. A two-minute
  paced recording of the same real workflow passed and is saved at
  `/private/tmp/hbl-advanced-demo.webm` (actual execution and assertions retained).
- **Host integration still needed:** guided-tour and fallback mounts are available
  but not yet mounted by advanced-studio; matching robustness reports now reach local print/manifest exports via the
  measured report event. Cross-browser share publication still needs a validated
  immutable server attachment. Current matrix
  persistence is browser-local with explicit fingerprint/revision/expiry checks.
  Do not claim a cross-browser shared robustness report until that wiring passes.

## Advanced backlog handoff (active)

- `mountRobustness(container,{getInput,onApplyInput,onProposeEdit})` is ready.
  `update(context)`, `getReport()`, `destroy()`. Uses the existing normal runner,
  sequential preview experiments with same seed/horizon and common explicit criterion.
  Four plans/eight stresses/50 futures per cell, total ≤1,600 and runner budgets.
  Matrix source inputs never mutate; denominators use the shared classifier.
- Actual reports emit bubbling `decision:robustness-report` events and are restored
  from browser storage only for the exact fingerprint/version/revision. Reports
  contain cell experiment IDs, criterion/counts/failed/missing, source seed/version,
  and preview-expiry notice. Expired cell links are visibly marked on re-open.
  **Local brief integration verified:** matching events attach measured cell IDs
  and denominators to print/manifest output. Engine should provide an immutable
  analysis-attachment route if report+share persistence must cross browsers; never
  silently mutate a completed experiment. Existing local persistence alone is not
  a cross-browser share guarantee.
- `mountGuidedTour(container,{getResults,onOpenBrief})` returns update/destroy;
  90-second pacing, pauses for actual results, never applies/approves edits.
- `mountDemoFallback(container,{onLoadSavedResults,onRunPinnedInput})` plus
  `getPinnedDemoInput()` / `getSavedDemoResults()` in demo-fallback.js is ready.
  Lazy-import this 4.35 MB saved actual-model artifact only on explicit fallback
  request. Housing 1.2.0, seed42, 40 actual futures, stored monthly/project states.
  Label is **SAVED MODEL RESULTS · not a fresh experiment**, readOnly:true; fixture
  is never substituted silently after an error. Fresh reproduction uses the
  normal API via host callback. Source build used executeDecisionExperiment.

The fixture and robustness math have focused tests. Remaining new loop/browser
verification is in progress; unavailable browser engines, QR, sound and video will
be marked honestly rather than claimed complete. No deployment or paid calls.


## Build/Edit provider integration handoff

**Final verification:** coordinator's isolated port-3228 run passed **7/7 browser
journeys** in 1.2 minutes: three Build/Edit/physical-world cases and four retained
Decision journeys, including 2,000 futures, cancellation, import and pilot export.
Coordinator also reports 118 unit/integration tests plus four Dear Congress tests
passing. This workstream's `bun run test:build-world` passed **66 tests / 699
assertions** across all eight feature files. No duplicate test remains running.
The test-managed port-3121 run has ended; user port 3217 is left untouched.
Earlier shared-output trace collisions are superseded by that isolated final run.
Avoid concurrent Playwright runs sharing an output directory.

The initial provider fingerprint bug is fixed: exact input fields reach the
own-server validator; only allowlisted minimal context reaches vendors. Renderer
and bridge now share exact placement polygons/districts/bounds. Entering placement
focuses the suggested valid parcel, then tests wait five animation frames and
click the true canvas center, asserting placed coordinates match the suggestion.
No free-parcel scanning or weakened collision checks remain.

Artifacts: `/private/tmp/hbl-build-world.png` (completed flagship, header/controls),
`/private/tmp/hbl-building-construction.png` (mid-construction), and
`/private/tmp/hbl-existing-world-building.png` (existing town with completed project).
The isolated 3121 Playwright run has ended and its server is managed by Playwright.
No user server on 3217/3218 was stopped, killed, or restarted by this workstream.

`world/ai/provider-api.js` exports `createWorldEditApiHandler({env,fetchImpl,timeoutMs})`.
Server routing/static protection are integrated. GET providers returns capabilities
without keys; POST propose returns independently validated proposals only. All
vendors use structured output and environment-only keys/models. Demo is labeled
deterministic local parsing, not AI. No paid vendor call was made.

## Reliability handoff

**Resolved landscape regression:** the original global stride sampling could drop
Plan A and stress entirely at 2,000 futures. Scenario-stratified sampling now has
focused tests; the retained 500-per-scenario browser journey asserts all four
scenario IDs survive the point budget. Its `data-summary` selector is scoped to
the visualization to avoid the new Edit World diff summary.

Six API integration cases verify create/execute/aggregate/compare, exact manifest
reproduction, stored-run replay, invalid inputs, isolated failures, SSE progress,
persistence through a fresh handler, and 1,000-run cancellation. The latest focused
model/kernel/analysis/visualization/integration suite passed: 52 tests, 2,255
assertions. The prior live components also passed their focused regression run. Frozen
installation passed with no dependency changes.

All five browser cases passed together under real Node in 33.2 seconds, including
the 500-per-scenario customer journey. The final run reused the local test server
left running by an interruption; no production configuration was changed. Regression checks caught ignored stress maps; effective stress inputs now
survive sampling and exact reproduction.

Reliability owns this guide, `test/decision-integration.test.js`,
`test/e2e/decision*.e2e.js`, and `world/decision/diagnostics.js`. Existing live
simulation files and tests are preserved. No deployment or commits are authorized
by this handoff.

**Studio integration:** `import { mountDiagnostics } from './diagnostics.js'`.
`mountDiagnostics(container)` returns `{update(results), destroy()}`. Pass the
same `{experiment,runs,aggregates,comparisons,model}` object used by the other
panels. Optionally include `apiErrors: string[]`; the helper does not intercept
fetch calls. It captures window errors and unhandled rejections from mount until
destroy and shows elapsed time, throughput, failed runs, model version, mean run
duration, and browser heap when available. There is no external telemetry.

**Pilot CTA integration:** `import { mountPilotRequest } from './onboarding.js'`.
`mountPilotRequest(container,{getContext:()=>({decision,modelId})})` returns
`{destroy()}`. It provides **Request a pilot — prepare a brief**, a local form
with organization, decision, alternatives, evidence, and target date. Submission
downloads `hbl-pilot-brief.json`; it never pretends to send a request or invents a
contact address. Studio mounts this once in the product footer.

## Local launch

```sh
bun install
bun run demo
```

Open <http://localhost:3000/world/decision.html?demo=1>. This uses the existing
server and repository. `PORT=3001 bun run demo` selects a different port. Demo mode
is a URL setting: the launch script deliberately uses the normal server so the
old lab and game remain available.

The existing lab and home quick links point to the new demo. No existing entry
point is replaced.

## Intended 90-second walkthrough

1. Load the affordable housing example and inspect compiled assumptions.
2. Select 500 runs, then simulate baseline, Plan A, Plan B, and stress scenarios.
3. Inspect distributions and select a future for its yearly replay and events.
4. Inspect unfavorable futures, sensitivity, and stored outcome drivers.
5. Change permitting delay, rerun, and compare the resulting distributions.
6. Review evidence, assumptions, limitations, and the printable decision brief.
7. Share read-only results and export the manifest for reproduction.

Run counts are per scenario: 500 runs across four alternatives means 2,000 stored
futures. Scenario comparisons must use matched seeds, actual successful rows,
metric directions, and explicit failure counts.

## Automated acceptance checks

```sh
bun run test:decision
# Use real Node on PATH for Playwright, especially file downloads:
bun run test:decision:e2e
```

If Node is absent from PATH in this desktop environment, the bundled runtime is:

```sh
/Users/wahabma/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@playwright/test/cli.js test test/e2e/decision
```

The default Playwright config starts the existing server on port 3100; keep that
port free. Browser execution requires permission to bind localhost in restricted
sandboxes. A Bun-run Playwright download transport error was reported in another
workstream; do not waive manifest/download checks—use real Node (verified here
with v24.22.1).

Earlier decision-only benchmark on the local development machine (before building
projects, housing 1.0.0), using the actual numeric housing model:
1,000 matched seeds × four scenarios × ten years = 4,000 stored futures. A real
Node run completed in 1,780 ms wall time (870 ms engine), with concurrent config
requests at maximum 61 ms and browser animation-frame delay at maximum 46 ms.
The full results fetch/parse took 628 ms and produced 51,407,924 JSON bytes.
These are local measurements, not Fly performance guarantees. The revised
performance test also opens the running experiment in Studio, exercising progressive
result rendering. Full results include every yearly metric, driver, event, and
input; the payload size is a material release concern.

The customer journey executes 500 per scenario (2,000 actual futures), checks
replay, 3D projection/filtering, distributions/Pareto, trust/brief print styling,
manifest download, parameter rerun, exact reproduction, and read-only sharing.
Other browser cases check cancellation at 8 × 1,000 × 10 years, CSV preview/mapping,
project save/reopen, scenario duplication/rename, local pilot export, and diagnostics.
The API observation bound is 120,000 yearly rows including year zero; larger
combinations are rejected visibly. The acceptance tests use no mocked run results.

A representative actual completed landscape is saved at
`/private/tmp/hbl-decision-landscape.png` (2,000 completed futures, 3D projection).
It is a local handoff artifact, not a deployed asset.

## Interpretation and evidence

The housing model is an illustrative decision-support model. Simulated runs are
possible futures under explicit assumptions, not empirical observations or
forecasts. Percentile ranges describe ensemble spread, not automatically
confidence intervals. A synthetic demonstration backtest must be labeled synthetic.
Only supplied observations with sources and dates can support a historical
backtest claim. Model calibration is not proof of future predictive accuracy.

## Release readiness

The existing deployment is Fly.io app `happybearlandia`, region `dfw`. `fly.toml`
runs `bun run server.js` on internal port 3000, with one CPU and 1 GiB memory,
automatic start/stop, and no always-on machine. `Dockerfile` uses `oven/bun:1`,
installs with the frozen lockfile, copies the repository, and starts the same
server. No GitHub Actions deployment workflow is present in this checkout.

Before a release, verify the full focused unit/API/browser suite, run the customer
journey at 500 runs per scenario, measure a 1,000-run batch with concurrent API
requests, and check persistence across restart. Confirm that the chosen persistent
data directory has a mounted Fly volume if server-side projects must survive
machine replacement. Run worker modules must be included in the image. Check
memory under full results serialization, because thousands of yearly rows can
cost more than simulation itself. Frozen dependency installation must pass.

No deployment has been performed. Local verification does not clear the durable
volume and hosted memory/load checks below.

There is currently **no volume mount** in `fly.toml`. A release requiring durable
server projects needs a provisioned volume and a matching store path, for example
`[mounts] source = 'decision_data'` with `destination = '/data'`, plus the store's
`DECISION_STORE_DIR=/data/decision-experiments`. Do not apply this fragment
until the volume exists in the app's region and the actual store setting is
confirmed. The store uses `DECISION_STORE_DIR`; its default is OS temporary
storage outside served directories. No volume or infrastructure has been created.

## Feature coverage matrix

The table distinguishes implemented behavior from unsupported scope. Browser
checks cover the customer loop; source-specific historical evaluation and less
common editor modes also have focused component tests.

| Requested capability | Verified implementation / limitation |
| --- | --- |
| Landing, try example, describe decision | Studio entry, housing example and editable decision; demo URL auto-runs |
| Pilot request | Mounted local form exports a real JSON pilot brief; sends nothing automatically; browser checked |
| Compile plan and inspect assumptions | Conservative housing parser with explicit assumptions/warnings; model and browser checked |
| Schema-driven numeric parameter studio | Sliders/numbers in native units; edit changes actual subsequent outputs; checked |
| Fixed, uniform, triangular, normal uncertainty | Contracts/sampling tested; Studio editors present; every distribution editor not separately browser-tested |
| Categorical and correlated variables | Not implemented; numeric model with independent parameter streams |
| Baseline, Plan A, Plan B, composed stress | Matched seeds; seven stress presets; effective inputs and replay regression tested |
| 10/100/500/1000 runs, progress, cancel, failures | Worker execution; real SSE and polling; isolated failure/API cancellation tested; 500/1000 browser exercised |
| Run IDs/seeds/version/inputs/events/timestamps | Persisted real rows; individual retrieval, replay and manifest round trip checked |
| Progressive results and responsive server | Measured real 4,000-future execution plus concurrent API/frame checks |
| Outcome landscape, rotation, hover/filter/select | Actual run scatter, 3D projection, accessible keyboard selection and unfavorable filter; new screenshot regression exposes scenario sampling bias (see blocker above) |
| 100-world view | Implemented paginated buttons; all futures browseable; math/component review, not separately clicked in journey |
| Distributions, percentiles, probabilities | Independent aggregation/comparison math checks; actual distributions visible in browser |
| Scenario comparison and Pareto | Visible actual results; direction-aware Pareto component tests; browser checked |
| Future timeline replay and events | Actual stored yearly rows; year-10 scrub browser checked; event/inputs shown |
| Detailed 3D world synchronization | Building projects now render stored monthly states in both the flagship lightweight 3D town and existing `/world`; general household/physics synchronization remains separate |
| Sensitivity and why | Within-scenario correlations and stored driver/event inspection; unit checked, visible trust panel |
| Failure conditions | Same-seed unfavorable clusters and input quartile associations; tested; no invented causal attribution |
| Assumption/source ledger | Values, units, source, confidence, notes, date and component; visible; source claims remain unverified |
| Evidence attachments and parameter imports | CSV/JSON map/preview/apply; evidence metadata form/import/export; CSV browser journey checked |
| Calibration and historical evaluation | Dated-input adapters and holdout checks tested; synthetic workflow labeled synthetic; not predictive validation |
| Published Houston observation diagnostic | Source-backed overlapping ACS estimates compared with illustrative model; retrospective diagnostic, not blind historical backtest or empirical policy calibration |
| Save/duplicate/reopen projects and scenarios | Browser-local projects plus private disk experiment store; project reopen and scenario duplicate/rename checked; API restart persistence checked |
| Reproduce experiment | Versioned API manifest, exact stored inputs/seeds; API and browser verified |
| Read-only share | Actual results/graphs/trust/report with editing disabled; advertised API share URL browser checked; not an authentication/privacy boundary |
| Decision brief, browser print/PDF | Complete brief opens actual results; download and print CSS browser checked; PDF byte export itself not separately generated |
| Executive/analyst modes | Same results, controls hidden in executive view; mode toggle/data preservation checked |
| Visible model limitations | Trust panel and printable brief; browser checked |
| Diagnostics | Mounted local errors/rejections, elapsed, throughput, failures, model, optional heap; browser checked |
| One-command/URL demo | `bun run demo` plus `?demo=1`; old lab and home link preserved |
| Public release / methodology / flagship case study | Local housing demo and this methodology/handoff exist; no deployment, separate published case study, or customer pilot contact service |

## Remaining release and scope limits

- Keep the scenario-stratified landscape regression in the customer-journey
  checks; global stride sampling over round-robin rows is biased.

- Provision and mount durable storage before promising hosted project retention.
  Default OS-temp storage can survive process restart but not machine replacement.
- Load/memory-test the 51 MB full-result payload on the actual one-CPU/1-GiB Fly
  machine. Local response/frame timings do not establish hosted capacity.
- Historical diagnostics use published estimates plus explicit synthetic model
  coefficients; no empirical policy calibration or prospective accuracy is claimed.
- No categorical/correlated inputs, general household/physics replay synchronization, enterprise
  authentication, contact submission service, or separate published case study.
- Read-only sharing disables editing of that displayed experiment. Anyone with
  server access can create a separate experiment; share links are not secrets or
  a substitute for access control.


## Build Something / Edit World acceptance map

Run `bun run test:build-world` for provider, edit, placement, lifecycle and renderer
checks. Run `bun run test:build-world:e2e` with real Node on PATH for both actual
3D surfaces. Provider calls are mocked in unit/API tests; browser tests explicitly
choose the no-key demo parser. They must never use paid vendor calls.

Building acceptance (section 69.14):

| Requirement | Concrete coverage |
| --- | --- |
| Enter Build Mode | `.world-tools` Propose building in flagship and `/world` |
| Place a draft | Real pointer raycast in both canvases |
| Edit before approval | Form fields, rotate/resize hotkeys, draft review |
| No pre-approval effects | Byte-identical input after preview/reject; proposed/cancelled numerical equality |
| Approved scenario JSON | Explicit approve button plus audited `projects` round trip |
| Seeded construction timing | Exact monthly project-state equality on replay/reproduction |
| Capacity consumed | Positive stored project capacity usage, lifecycle conservation tests |
| Housing stock changes | Completed homes enter accounting once; final housing differs |
| Visible construction phases | Stored middle-month floor count plus actual 3D screenshots |
| Replay identical state | Month 120 → 0 → 120 summary equality; identical stored rows |
| With/without comparison | Matched original/approved scenario run metrics |
| Removal exact under CRN | Remove and undo return original metrics, timeline, events, drivers/accounting |

AI acceptance (section 70.17):

| Requirement | Concrete coverage |
| --- | --- |
| Flagship entry | Edit world button opens prompt/provider/diff |
| Configured provider selector | Capability endpoint lists all vendors; unavailable vendors disabled; live account configuration not exercised |
| Common world-edit.v1 | Three mocked vendor structured outputs normalized and independently validated |
| Provider never mutates | Byte-identical inputs and no apply import in provider layer |
| Valid operations only | Arbitrary paths/code/evidence and unknown parameter requests rejected |
| Diff before applying | Visible proposed diff while full input remains identical |
| Reject is pure | Browser and integration byte equality |
| Approve revision | SHA-256 proposal hash, immutable history, provider/model/prompt, parent and timestamp |
| Simulation inputs stale | New approved input plus rerun, completed original retained |
| Visual-only metrics unchanged | API visual-revision clone and browser appearance share preserve matched metrics/seeds |
| Building prompt | 300 units / 75 affordable, typed proposal, inferred assumptions labeled |
| Undo | New immutable restore revision, original numerical results restored |
| Share captures revision | API and read-only browser share; visual-only new appearance audited separately |
| Manifest approved edits | Metadata/history and project definitions preserved through export/import |
| Old completed reproducibility | Exact new-project manifest replay plus frozen housing 1.0.0 resolver |

Provider configuration is server-only. Both `*_API_KEY` and `*_MODEL` must be set;
there is no guessed model default. `AI_PROVIDER=demo` makes no outbound call.
The explicit prompt and allowlisted numerical/model/selection fields are sent;
journals, residents, evidence, uploaded documents, notes and repository files are
not forwarded. Responses are limited to 128 KiB and 4,096 output tokens, requests
to 256 KiB and 2,000 prompt characters, with a 20-second default deadline, two
concurrent remote requests, and ten remote requests/minute per client. These are
local safety budgets, not a substitute for hosted access controls.

Adapter request shapes were checked against official
[OpenAI structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses),
[Claude structured output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), and
[Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
Configured vendors are tested through mocks; actual account/model availability
and paid production calls are deliberately unverified.

The local parser supports one change per request: a housing building, relative
construction-capacity increase, migration/selected-parameter uncertainty, known
stress (including modeled Year 3 = month 24 scheduling), and known visual settings.
It rejects infrastructure, equations, new metrics, and unsupported prose explicitly.
Buildings use illustrative inferred cost/subsidy/duration/footprint unless edited.
Location is a draft, not proof of a nearby station or zoning approval.

## Numbered backlog audit (198 tickets, not a claim of 198 polished features)

“Implemented” below describes the current connected code. “Partial” identifies a
specific narrower implementation. “Deferred” and “untested” must not be marketed
as shipped capabilities. Unit and browser evidence is recorded above.

| Ticket(s) | Status and practical boundary |
| --- | --- |
| 1–5 | Implemented versioned scenarios/experiments/runs/results, deterministic paired seeds; inherited overrides and explicit outcome rules tested. |
| 6–10 | Implemented one common numerical runner, worker execution, progressive results, cancellation and isolated failures. Worker count/work/memory are bounded, not an elastic worker farm. |
| 11 | Provisional aggregation from actual completed rows; not a separate online quantile-sketch engine. |
| 12–14 | Private disk snapshots, full versioned manifests and reproduce action; hosted durability still needs a mounted volume. |
| 15–25 | Implemented illustrative housing stock-flow registry, events, permit/construction/capacity/finance/demand/adoption and immediate/scheduled stress mechanics. These are model assumptions/proxies, not empirical policy forecasts. |
| 26 | Explicit binary success or success/failure bands; failure precedence and mixed/unclassified states are shared and tested. |
| 27 | Narrow `intervention.v1` envelope and allowlisted edits/forks; arbitrary infrastructure/domain mutation remains deferred. |
| 28–32 | Approved immutable revisions, audit, undo/restore, stale detection and visual/math distinction implemented. |
| 33–48 | Real building drafts/placement/edit/approval, monthly lifecycle, floor/crane rendering, inspector, stock/capacity/cost/delay/overrun/event effects and replay implemented in flagship and existing town. No full zoning or structural-engineering validation. |
| 49–58 | Scenario tabs/schema controls/groups/duplication/rename/delete/reset, stress choices, run counts, decision rules, changed-baseline labels and uncertainty curves implemented; baseline protected. |
| 59–74 | Approved Edit World flow, strict operation schema, three server-only adapters, selection context, ghost/diff/audit and deterministic demo parser implemented. Vendor networks are mocked in tests; actual paid account/model availability unverified. |
| 75–81 | Actual 500+ future landscape, progress, axes, explicit outcome colors, hover/selection and filters implemented; all scenarios preserved under point sampling. |
| 82 | Bounded local metric/event search, not unrestricted natural-language or AI interpretation. |
| 83 | Paginated 100-future grid can browse all stored futures; not 500 detailed city scenes at once. |
| 84 | Bounded density overlay; descriptive, not a confidence region or probability proof. |
| 85–88 | Previous-result ghost cloud, matched deltas, scenario overlay and lasso implemented; ghost rerun browser checked. |
| 89–94 | Within-scenario failure/success rules, lift, support and descriptive sensitivity implemented. Same discovery sample; no statistical-significance/held-out causal claim. |
| 95 | Actual bounded numerical partial-dependence interventions plus separately labeled descriptive bins. |
| 96 | Deferred variance decomposition; UI explicitly says it is unavailable rather than displaying invented shares. |
| 97–101 | Actual rules generate bounded proposed fixes, require approval, rerun with ghost comparison, and show low-confidence review priorities. No guaranteed improvement claim. |
| 102–109 | Registered implemented-dependency graph, equation/event links, version-resolved OAT reruns, top reasons/residual and deterministic evidence/compare query implemented. Not an empirically identified causal network or unconstrained LLM explanation. |
| 110–116 | Enter/return views, selected-run replay, monthly/yearly controls, events and synchronized metrics implemented. Transition is a view/scroll transition; no cinematic camera-flight claim. |
| 117–120 | Building projects/phase/cranes/occupancy/inspection reflect stored actual states; aggregate town representation is illustrative, not a one-to-one reconstruction of every modeled home. |
| 121–122 | Real best/median/worst shortcuts and selected-vs-scenario-median comparison implemented. |
| 123–132 | Explicit reviewed/approved one-level timeline forks, immutable lineage, month-prefix preservation, parameter/building/stress continuation, comparison and proposed promotion implemented. Nested forks are rejected. |
| 133–138 | Known recession, inflation/rates, demand surge, supply shortage and implementation-delay presets modeled. Interest-rate shock is composed within high-inflation stress, not a separately named preset. |
| 139–142 | Actual sequential plan×stress matrix, progress/cancel, explicit criterion/denominator scores and weakest observed case. A selected finite grid, not universal robustness. Reports saved locally with exact source/revision and preview-expiry labels; cross-browser report publication remains a separate integration requirement. |
| 143–145 | Persisted bounded optimization job, lever ranges, objectives and mean constraints implemented. |
| 146–149 | Deterministic candidate generation with exact 100-run screening and 500-run finalists. Budget is 1–6 candidates and 1–2 finalists, not 125 variants. |
| 150–154 | Pareto/candidate-current summaries, reviewed candidate promotion and candidate stress matrix connected. No global optimum claim. |
| 155–159 | Visible assumptions/evidence/confidence, descriptive sensitivity priority and verification ledger implemented; source metadata remains user/unverified unless externally checked. |
| 160–161 | In-app methodology/limitations and repository guide exist; separate published methodology/limitations websites are not claimed. |
| 162–164 | Dated-data adapters, pre-cutoff calibration and held-out evaluation mechanism implemented/tested. Published Houston overlapping-ACS comparison is retrospective, not a blind historical forecasting validation. No empirical policy calibration claim. |
| 165–176 | Exploratory badge, actual-results brief, comparison/ranges/tradeoffs/failures/drivers/verification/limitations/manifests, print CSS and read-only shares implemented. PDF bytes are produced by browser print, not a separate report service. |
| 177 | Deferred QR-code sharing; no fake QR graphic or dead control. |
| 178–179 | Executive/analyst views share actual underlying results. |
| 180 | Ninety-second guide module implemented; never approves or edits and pauses without actual results. Host mounting must be verified before calling it a visible landing feature. |
| 181–182 | Explicit versioned saved fallback from 40 actual housing-1.2.0 runs, replay-tested with seed42 and provenance. Must lazy-load, stay labeled read-only saved results, and disable server-only links until freshly saved/reproduced. |
| 183–186 | Stored monthly floor progression, view transitions, fork plots and sequential stress progress implemented; cinematic fork animation/boss-battle visual effects remain partial. |
| 187 | Sound design deferred; no autoplay audio. |
| 188–190 | Real empty/loading/partial/cancelled/error states, local diagnostics and connected Playwright loop implemented and checked. |
| 191 | Chromium tested. Firefox/WebKit absent; Safari/Firefox untested. |
| 192 | Robustness matrix mobile containment checked at 390px; Viz supplies its own mobile future-grid QA. No blanket all-device claim. |
| 193–195 | Existing landing preserved with usable demo navigation, flagship entry, and local pilot-brief export. No external pilot submission service. |
| 196 | Actual Playwright recording of the real connected flow; two-minute paced version passed and is saved at `/private/tmp/hbl-advanced-demo.webm`. |
| 197–198 | Local-only bounded event metadata and pilot-brief-export event; no prompts, contacts, organization names, external telemetry or fake request submission. Tour panel can export local activity. |

Fresh advanced checks: `bun run test:advanced`; browser checks with real Node on
PATH: `bun run test:advanced:e2e`. `bun run record:demo` records the same passing
workflow with presentation holds through 120 seconds. Holds do not replace model
execution or assertions. Keep the default test port free or use an isolated local
configuration. Never run concurrent suites sharing the same artifact directory.

Final reliability evidence: `bun run test:advanced` most recently passed 42 tests / 564 assertions.
The three component browser cases passed in 4.2 seconds; the full connected
journey passed in 37.8 seconds and again as a two-minute recorded run. All owned
Playwright sessions ended; their isolated port-3131 server was test-managed. No
server on user port3217 was stopped or restarted by this workstream.

The final 38.4-second loop additionally asserts that the brief contains an actual
stress-cell experiment ID and the “Meets criterion” denominator table. The saved
recording duration is 1:59.84 (VP8, 800×450, 25fps), not simulated progress footage.

## Final reliability handoff

Current summary-selected-trace loop: four advanced browser cases passed in32.7s,
including an approved300-home project and full121-month hydration. Studio
independently reconfirmed the connected loop in30.3s after its final hydration
changes. Latest own advanced unit/integration run:42 tests /564 assertions.
All owned test sessions are finished and test-managed3131 is no longer running.
No user3217 server was stopped, killed or refreshed by this workstream. Viz owns
the remaining original-world inspector/tile regression; no result is claimed for
its not-yet-completed latest tile changes.

Artifacts: `/private/tmp/hbl-advanced-demo.webm` (1:59.84, real workflow, prior
full-delivery UI with same1.2.0 numerical model), `/private/tmp/hbl-advanced-stress.png`,
`/private/tmp/hbl-advanced-decision-brief.png`, `/private/tmp/hbl-robustness-mobile.png`.
The video is400 actual futures (100×four scenarios), not a fabricated500-point cloud.
Existing500-per-scenario support is covered separately.

Remaining explicit gaps: guided-tour/fallback helpers still need host mounting
to count as visible landing features; local robustness reports reach print/manifest
but do not automatically travel in cross-browser server share links; QR and sound
are deferred; Firefox/Safari are untested because their test engines are absent;
optimization is deliberately1–6 candidates with1–2 finalists; variance decomposition
is unavailable. The numbered audit above records these limits. No commits,
deployment, paid provider calls or external analytics/pilot transmissions.
