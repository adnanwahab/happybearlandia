# HappyBearLandia implementation plan

## SHE-212 — defining-feature umbrella audit (2026-11-13)

Completed the approved analysis-only slice in [the consolidated acceptance and
gap report](reviews/SHE-212.md), against checkout `5fdb96832cdb6d895b04e9ea95ad4b3aea0318eb`.
Read current child descriptions, SHE-194 prototype comment, six merged PR records,
module contracts, City ODD, executable source and tests. No child implementation
was duplicated. Fresh worktree avoids the prior disk-full checkout attempt.

Acceptance evidence: 72 focused prototype/replay tests passed with 1302 assertions;
22 City/API regressions passed with 134 assertions on Bun 1.4.2. A temporary-store
probe solved all five Detective cases with zero evidence steps using visible home
counts, demonstrating a concrete product gap. Ledger reruns confirm the dominant
−389.241 USD/month residual. Browser attempt failed before launch at server listen
with EADDRINUSE on port 39931; visual/hash acceptance remains unresolved. No root
lint/typecheck script exists; runtime behavior was unchanged. Document whitespace
check passed. No commit/PR reference for this audit yet.

Remaining child work: Detective inference-resistant cases and study; Ledger kill
decision; Builder immutable parent-experiment receipt and pre-fork history/hash
evidence; Clouds observed browser hash/readability study; Life real saved 60-replay
UI/cost validation; integrated Microscope browser journey. Original dependency
gates and user success/kill criteria remain intact. No user-study or 10-second
legibility claim is made. Existing auto-merge workflow safety hold is preserved;
no external messages, merges, deployment or production changes were made.

## Mini Symphony PR to Linear completion sync

The evidence-only workflow `.github/workflows/linear-merged-pr.yml` maps merged,
same-repository `mini/SHE-<number>` and revision branches to the original Linear
issue. It upserts a source attachment; human acceptance review determines issue
completion. The former automatic-close workflow is retired in SHE-182 revision3.
Requires repository Actions secret `LINEAR_API_KEY`; hosted verification remains
operational setup.

## Local Mini Symphony Bun starter

Implemented an opt-in, single-worker task runner in `tools/symphony/mini-bun/`.
It reads JSON tasks, creates per-task Git worktrees, invokes Codex CLI, saves
logs and atomic task state, and marks successful exits `needs_review`. It does
not integrate with or modify the live Linear dispatcher. Manual acceptance:
run against a disposable repository with a fake Codex executable, then inspect
state, log and isolated worktree. Automated runtime exercise remains pending.
## SHE-265 — transparent World plan cards

2026-11-13 follow-up: audited merged PR #285 at `3158450e`; application
implementation retained. Expanded browser checks to all custom levers and every
preset plus the popularity source link. Focused Bun checks passed (7 tests /
280 assertions and 7 tests / 105 assertions); Playwright discovers three cases.
Execution remains blocked before browser launch by server EADDRINUSE on ports
39889 and 41973. Acceptance is still pending browser and assistive-technology
evidence. Full audit and reproducible commands: [SHE-265 review](reviews/SHE-265.md).


Delivered locally on 2026-11-12; browser acceptance remains pending. Audit of
merged HEAD 53090035 found the opaque select in `world/index.html`, dynamic
packages in `world/render.js`, separate Canvas2D presets, and worker year-zero
substitution. This integrated slice reuses the existing policy/change and worker
entry points. Shared staging derives cards and direct custom inputs from the
same policy rules; native radio cards and labeled range controls expose units,
source limitations, unsupported proposals, and additional program boosts.

Acceptance tasks: [x] exact preset/year and custom values; [x] preserve zero year
and explicit no-package runs; [x] custom matched week through the real worker;
[x] deterministic replay and matched baseline; [x] source links and honest local
popularity disclaimer; [x] keyboard/screen-reader semantics in code;
[ ] real desktop/mobile keyboard, layout and assistive-technology acceptance.
Remote packages with the standard names replace their local counterpart cards,
preserving their original remote IDs for synthesis. Custom values are direct
synthetic mechanisms, with other boosts zero; journal-driven follow-up is disabled
for them because there is no reviewed mapping back to proposals. Default year is
three, and explicit year zero is honored. No model rule coefficients changed.

Changed UI: `world/index.html`, `world/plan-choices.{js,css}`,
`world/plan-choices-source.html`, both renderer entries. Worker integration:
`world/cycle.worker.js`. Reviewed these against `world/policy.js`,
`world/sim.js` and `docs/models/legacy.md`; documented the discrepancies that
weekly housing construction and automatic flooding are unsupported. The four
levers are inputs, not fabricated output. Browser checks cover the normal
Canvas2D World route at 1280 and 320px and capture actual worker submissions.

Actual checks: final focused Bun suite passed 18 tests, 163 assertions in 9.87s;
policy-comparison/guide/staging suite passed 9 tests, 251 assertions in 9.05s.
The real worker custom test verifies unchanged levers, identical starting and
no-plan scores, changed transit-arm scores, and exact deterministic rerun.
Playwright setup initially lacked the server cwd (fixed). Final attempts on
39889 and 41973 both failed before launch with Bun server EADDRINUSE. No browser,
layout, screen-reader, screenshot, performance or remote-service observation is
claimed. Browser-target bundling passed for all three entries (369 modules), with the
existing /vendor imports externalized; `git diff --check` passed. No merge or
deployment. Next: run
`bunx --no-install playwright test --config test/plan-choices.browser.config.mjs`
on a host that permits local server binding, then manually check a screen reader.

## SHE-253 — quest-selection director paired experiment

Preparation only; experiment execution remains gated by the issue's explicit
human metric-selection requirement. [Protocol draft](experiments/quest-selection-paired.md)
records current quest/replay infrastructure, proposed definitions, paired analysis,
null check and fixed stop rule. No experiment has run and no results are claimed.
Living City's transit ensemble and monthly City replay evidence do not establish
quest-selection replay. House date quests are a candidate test bed requiring
explicit scope selection; the existing House lab compares designs.

Next independently verifiable slice: obtain and record human test-bed/metric/
horizon approval; commit the finalized protocol before running; then implement
one selector adapter through ordinary quest commands, full event collection,
independent deterministic replay and label-invariance tests. Only after those
gates pass run exactly 100 paired seeds and report effects, intervals, failures
and what was not measured. Main risks: switching runtimes without approval,
bounded event retention, ambiguous first-quest timing and policy-dependent RNG.
Documentation-only preparation is verified with `git diff --check`; no browser
behavior changes, so Playwright is inapplicable. Acceptance remains incomplete
until the human preregistration and actual paired/null results are recorded.

## SHE-182 revision 2 — publication repair (November 12, 2026)

Delivered slice: merged-only, same-repository Mini Symphony branch mapping and
idempotent Linear merge-evidence publication, including `mini/SHE-182-r2` to
`SHE-182`. Remote sprint HEAD matches this checkout; current sprint and main
contain no prior sync helper. Preserve SHE-180 as sole queue/lease owner and
existing dual approval checks. See [the checked audit](reviews/SHE-182-r2.md)
for exact source/test evidence, prior PR195 and remaining acceptance.

Changed interfaces: `.github/scripts/sync-merged-pr.cjs` and
`.github/workflows/linear-merged-pr.yml`; regression entry point is
`node --test test/sync-merged-pr.test.cjs`. The workflow runs trusted base code,
never worker head code with its secret. It links merged evidence without
changing issue status or granting acceptance. Failed/uncertain writes stop;
rerunning safely upserts the same issue/URL attachment.

Actual verification: 222 host tests, 21 ops tests and 5 publication tests passed
(248 total). Node syntax and diff whitespace checks passed. Python YAML parsing
was unavailable because PyYAML is not installed; Ruby YAML parsing passed.
No browser behavior changed; Playwright skipped.
No merge, deployment, production write or runtime activation occurred.

Operational prerequisites/risks: repository `LINEAR_API_KEY` availability could
not be inspected; configure/verify it before hosted synchronization. Hosted sync
requires reviewed default-branch installation and an observed eligible merged PR;
no hosted claim is made. Full issue acceptance still requires trusted-host hard
resource containment and external runtime approval/retry/recovery validation.
Those runtime changes are outside this explicitly scoped publication follow-up.
No commit/PR reference exists for this revision yet.

## SHE-256 concurrency decision gate — 2026-11-12

Delivered documentation increment: [decision gate](symphony-concurrency-gate.md)
with explicit unmeasured 4/6/8/12 table, proposed matched disposable experiment,
pass criteria, evidence requirements and rollback. Scope is a decision ticket;
no dispatch or workflow/approval/label changes. Next slice requires an agreed
compute/cost/PR budget and disposable Linear project/GitHub repo, then observed
occupancy, publication, conflict, check and timing evidence for each candidate.
Risk: configured concurrency and synthetic policy tests do not establish real
capacity. Acceptance remains incomplete; no highest passing candidate exists.
Verification: eight focused throughput-policy tests passed; diff whitespace
check passed. Browser checks skipped because this changes documentation only.

## Customer-discovery preparation — SHE-257

Documentation slice: [interview protocol](customer-discovery-interviews.md).
Prepared a 30-minute neutral guide, explicit opt-in consent script, proposed
recruitment decision record, private notes template, and one-page synthesis
template. The source issue is a decision ticket: no automated dispatch or
outreach. SHE-52 supplies opt-in/minimal-identifier requirements; existing World
feedback presentation is simulation output, not participant research.

Acceptance: commit guide/script before interviews; human approves the exact
recruitment method before outreach; five consented interviews and private note
sets; summary states actual sample size and participant-level theme counts.
Current evidence: 0/5 interviews, no participant notes or findings. Preparation
reviewed against the full SHE-257 and SHE-52 descriptions; Markdown links and
whitespace checked locally. No runtime/browser behavior changed, so application
tests and Playwright are inapplicable. Git metadata is read-only in this
workspace; commit remains an authorized host workflow step, with no commit or
PR reference available. Next: human reviews recruitment and private handling
terms, then conducts interviews after guide/script commit. Small self-selected
sample and reidentification from quotes remain material risks; private notes,
separate quote consent, evidence counts, and explicit limitations address them.

## World Experiment Marketplace — SHE-197

Readiness audit (2026-11-12): pending prerequisites; marketplace implementation
and its acceptance criteria remain incomplete. The full Linear issue explicitly
places this in a later phase and lists SHE-47 and SHE-48 as blockers. Both are
currently Backlog. SHE-184 (Experiment Registry) is also Backlog and defines the
evaluation criteria that this marketplace must reuse. No Experiment Registry
evaluation contract was found in this checkout. Existing challenge rules must
not be described as Registry-equivalent without that integration.

Reusable code and observed limits:

- `world/challenges/contract.js` freezes complete CityState inputs, seed, engine
  version, action menu, reference selection, budget and metric definitions. It
  recomputes both plans and applies a Pareto comparison with explicit guards,
  tolerances and missing-metric handling. These are synthetic city game rules,
  not empirical measurements or a Registry scoring interface.
- `world/challenges/transport.js` round-trips bounded frozen challenge recipes
  through share-link payloads. This provides transport, not public publication,
  ownership, authenticated results or a shared browseable catalog.
- `world/experiment-record.js` and `world/server-experiment-store.js` provide
  civic experiment records and immutable snapshots with lineage. Their presence
  does not establish the Registry's required filtering, deterministic rerun or
  shared evaluation criteria. Population checkpoint persistence under
  `world/experiments/` is a separate model and must not be treated as CityState.

Next end-to-end slice, after prerequisites:

1. Establish SHE-184's versioned evaluation interface and supported replay model.
   Pin evaluation criteria, model/code versions, source inputs and seed in each
   published immutable scenario. Reuse existing replay and persistence paths.
2. Add explicit publication and catalog reads, then open a published scenario
   from the application's normal entry point and replay its pinned inputs.
   Define ownership, write authority, retention and workload limits before
   accepting shared submissions; saved snapshots alone imply no publication.
3. Accept only supported strategy edits for a challenge, recompute results with
   the Registry evaluator and preserve reference/candidate provenance. Display
   measured/synthetic classification on every result and comparison; synthetic
   engine observations remain synthetic even when computed from recorded state.
4. Verify publish → browse → replay → challenge → compare with seed-matched
   evidence, immutable parent checks, unsupported versions, tampered inputs,
   missing observations, equal outcomes, failed sharing and persistence restart.

Material risks: independently inventing marketplace scoring would violate shared
Registry criteria; mixing model clocks/identities would undermine replay;
caller-submitted scores or labels would not establish empirical validity.
No marketplace routes, public writes, deployment or Linear status changes were
made during this audit.

Acceptance evidence: `bun test test/challenge-contract.test.js
test/challenge-ui.test.js test/experiment-record.test.js
test/server-experiment-store.test.js` passed 16 tests (72 assertions). These
verify existing reusable behavior only, not marketplace acceptance. No browser
behavior changed, so Playwright was skipped. Next action: finish the Registry
evaluation contract and verify SHE-47/SHE-48 against source before implementing
the publication slice. No commit or PR was created by this audit.

## Scientific Dataset Portal — SHE-205 (later phase)

Status: deferred, not implemented. [SHE-205](https://linear.app/shel-bernstein/issue/SHE-205/build-the-scientific-dataset-portal)
explicitly places this work in a later phase. Read-only issue inspection on
2026-11-12 confirmed Backlog status and a related issue,
[Scientific Data Export / SHE-193](https://linear.app/shel-bernstein/issue/SHE-193/build-scientific-data-export),
also in Backlog. The export contract is a technical prerequisite; Linear currently
records a related issue, not a formal blocking relation.

Current evidence: `world/future-machine/share/run-receipt.js` and
`scripts/export-run-receipt.js` provide canonical monthly City JSON receipts,
documented in [run-receipt.md](run-receipt.md). These retain model/rules identity,
seed and provenance, with validation and replay limits. They are a reuse candidate,
not the Scientific Data Export package: inspection found no implementation of its
Parquet-or-Arrow, JSON and CSV contract with licensing and a data dictionary.
The receipt documentation identifies the City rules as synthetic and uncalibrated.
Do not publish them as measured results or infer a dataset license from code access.

The next end-to-end slice, once the export contract is available, is a read-only
catalog leading to one documented experiment and downloads of that same versioned
export. Start with one supported model authority; cross-model aggregation needs
explicit identity and time mappings before expansion.

| Status | Task | Prerequisites and acceptance |
| --- | --- | --- |
| Deferred | Integrate Scientific Data Export | Reuse SHE-193's schema, validators and serializers for Parquet or Arrow, JSON and CSV; retain its machine-readable provenance and data dictionary. Do not introduce a portal-specific competing format. |
| Deferred | Define publishable experiment records | Require stable experiment/export identity, model and rules versions, recorded seeds, scenario inputs, source references, source licenses, output license and measured/synthetic classification. Keep published versions immutable; missing required metadata prevents publication. |
| Deferred | Find and read experiments | Add a discoverable application entry point, catalog search and stable experiment/version links. Show model version, seeds, sources, license, uncertainty and limitations on each detail page. Show measured or synthetic labels on every portal page and each catalog result; identify synthetic inputs separately from measured sources. Sourced geography alone does not make modeled outcomes measured. |
| Deferred | Download the documented version | Serve the exact export version described on the page through SHE-193's supported formats. Preserve provenance, licenses, classification and dictionary according to that contract. Missing experiments, unsupported versions and unavailable artifacts need explicit responses without substituting another run. |
| Deferred | Verify the integrated journey | From the normal app entry point, search, open an experiment/version and download each supported format. Validate each artifact against SHE-193, open it in a notebook without cleanup, and compare identity, seeds, sources and classification with the page. Test missing metadata/artifacts, unknown IDs/versions, mixed source provenance and deterministic replay where the model supports it. Run relevant integration checks and a browser smoke test. |

Material decisions still needed before implementation: the supported publication
store and catalog index, which records are authorized for public release, and
the license of each source and derived output. Existing saved experiments are
not automatically public datasets. Preserve each model's state authority and
clock, and distinguish measured observations, synthetic inputs, modeled results
and narrative interpretation throughout the portal.

Acceptance evidence for this planning slice: inspected the product design,
existing implementation plan, server entry point, receipt implementation and
documentation, package dependencies, and both live issue descriptions/statuses.
No runtime behavior changed; application tests and Playwright are inapplicable.
The portal acceptance criteria remain unverified and deferred. Next action:
deliver SHE-193's validated export contract, then select one licensed experiment
for the integrated portal slice. No issue status or relationship was changed.

## Paired invention experiments — SHE-221

Selected first slice: high-priority Experiment 2 Codex correctness audit
(SHE-230), reusing completed SHE-59 seed-sweep infrastructure and existing
SHE-76 paired-history implementation. Scope is report-first; no application
fixes, model changes, push or deployment. The live child inventory marks
Experiment 7 Codex and both Experiment 5 assignments Canceled; do not launch
those from the umbrella's older priority summary.

Acceptance: inspect actual engines and existing tests; reproduce and classify
findings; distinguish observed behavior, proposed fixes and untested risks;
provide smallest fixes and regression criteria. Delivered report:
[correctness audit](reviews/she-221-correctness-audit.md). Focused checks pass
56 tests with 479 assertions. Two defects reproduced at normal experiment
normalization and engine boundaries: unsupported state versions and orphan
worker household references. No implementation change was selected. The full
106-case replay rerun passed with zero mismatches, without overwriting retained
SHE-59 evidence. A separate 72-step ledger/parent-immutability probe also passed.

Next implementation slice, after report review: one owner adds version and
worker membership validation with boundary regressions, preserving valid seeded
outputs. Risks: explicit imported-state compatibility, potential intended
nonresident-worker semantics, and replay/version changes if random-key encoding
is later revised. Missing legacy outcomes and delimiter aliasing remain proposed
investigations. Other child experiments and Claude reinterpretation remain open;
this entry does not mark the umbrella complete. Documentation is delivered with
a local git-am patch; no PR or production change is authorized by this slice.

## SHE-210 review follow-up triage — November 12, 2026

Coordinator audit recorded in [the triage report](reviews/she-210-triage.md).
Read the full parent and six child Linear issues and inspected their current
application paths at `b963dd3`. The referenced original `claude.md` review is
missing; current source confirms the reported integration patterns. Recommended
serial shared-file sequence: SHE-213 URL reliability, SHE-218 data readiness,
SHE-215 director/selection, then SHE-214 anchored WHY. SHE-217 is a separate UI
slice; SHE-216 renderer retention requires U03 resource evidence first. The
report records prerequisites, affected interfaces, risks and child acceptance
gates. D05 remains accepted/deferred; I3 remains with SHE-182.

Actual baseline: 48 focused tests passed, 1 browser-dependent test skipped,
0 failed, 285 assertions across eight files. No application code changed and
Playwright was skipped for this documentation slice. Browser acceptance,
physical iPhone verification and implementation remain pending. No dispatch
labels or live issue statuses changed; this audit does not close the parent or
authorize Symphony execution.

## Civilization and storm CI observation — SHE-242

Scope: add one independent, bounded observation job to core journeys using the
existing Ubuntu 24.04 / Bun / Chromium setup established by browser reliability
work. Run the five `test/storm-*.test.js` files and the unchanged civilization
browser config on every existing pull-request and main-push trigger (including
all `world/` and `test/` changes). Preserve the existing gated job verbatim.
Both new suite steps use `continue-on-error`; gating is a follow-up decision.
No test content, GPU requirement, production behavior or model contract changes.

Acceptance evidence: local storm suite passed 14 tests / 646 assertions across
five files. The exact requested local browser command exited 1 before discovery:
Playwright loaded the config as CommonJS and rejected `import.meta` with
`SyntaxError: Cannot use 'import.meta' outside a module`. No browser tests ran;
fixing that failure is outside this ticket's scope. CI may differ after its
frozen dependency install, so this local result is not a hosted-run result.

The new job records raw step outcomes (including tolerated failures) and a run
URL in the Actions summary and retains browser failure evidence for seven days.
Remaining completion work: publish the workflow PR, link its first hosted run
from that PR, compare hosted and local outcomes, and file a separate ticket for
each observed failure plus the gating decision. Ten-run flake measurement is
pending hosted runs. Hosted execution and PR publication are not established
by local checks.
Local workflow validation passed: YAML parses, triggers and the parsed gated job
match HEAD, both suite steps are non-blocking and bounded, and `git diff --check`
is clean. No repository lint/type-check command applies to this YAML/docs change.

## SHE-234 — causal architecture experiment

Completed isolated architecture investigation; [comparison and migration gates](experiments/she-234-causal-architecture.md).
Audited current deterministic City, checkpoint replay and recorded causal trails;
SHE-76/SHE-90 remain In Review and their production interfaces are untouched.
Owned slice: opt-in `experiments/she-234/`, report and benchmark evidence only.
Acceptance: complete branch suffix/trace equality, immutable parents, pinned
rules/source/seed provenance and honest unsupported graph-execution status.
Nine measured cases passed; checkpoint continuation executes 12 versus 24 steps.
Focused existing and experiment suites: 34 pass, 0 fail, 481 expectations.
No browser behavior changed; Playwright inapplicable. `git diff --check` passed.
Prototype is supplied as `experiments/she-234/prototypes.patch` for `git am`
in a clean baseline checkout; it contains only benchmark and test files.
No push, production behavior change or deployment. Recommendation: checkpoint
authority plus ordered versioned input replay and explanatory edges. Next slice
requires a City intervention-input adapter and independently recorded target
digests; targeted graph execution remains gated on complete dependency coverage
and full-state/trace equivalence under capacity contention and lagged feedback.

## SHE-46 — linkable scenario replay audit

Owned slice on `mini/SHE-46`: new `test/scenario-replay.browser.config.js`,
`test/e2e/scenario-replay-audit.e2e.js`, `test/scenario-replay-audit.test.js`, this plan entry and a focused audit
report. No receipt-export, simulation, application or persistence interfaces change.
SHE-9 prerequisite is recorded Done in the issue. This direct local task does
not dispatch Symphony or change its Backlog/pilot gates.

Existing overlap: `reality-share.test.js` already covers immutable API records,
30-day expiry, manifest consistency and replay-proof rejection;
`reality-share-flow.e2e.js` covers fresh recipients for City and Population.
Future Machine share reliability separately covers saved/recipe replay, missing
record fallback, boundary seeds and incompatible links. Reuse those contracts.

Acceptance: create a two-future City experiment through the homepage, share the
second actual future, reopen in an empty browser context, scrub 0/1/3 and repeat
boundaries with exact source state/input identity. Missing, expired, incompatible
model and altered-proof records must show meaningful failure without an entered
state or enabled scrubber. Keep synthetic disclosure and original record intact.
Lifecycle fixtures modify only disposable SQLite records; workers and replay
remain real. Isolated current-checkout server/data prevent testing another branch.

Verification: share API plus new boundary-seed replay suite passed 10 tests/127
assertions. Dedicated browser run blocked before execution: local Bun server
reported EADDRINUSE on both 39946 and 39947; no listener appeared in lsof.
Browser assertions remain unverified. See [audit report](scenario-replay-audit.md)
for exact commands, coverage and limits. No deployment or production-data changes.

## SHE-39 repeated renderer disposal

Next isolated slice: reuse existing truthful backend selection and stage API;
exercise one warm-up plus 30 same-document create/split/focus/scrub/dispose cycles
for Canvas, WebGL and auto. Own new disposal test/config and evidence report only.
Acceptance: stable live objects/geometries/textures, no listener/observer/RAF
growth after GC, cleared stage nodes, console/loss evidence with versioned replay
provenance. Risk: browser/GPU availability and nonportable heap measurements.

Coverage implemented; 32 focused unit tests pass (one browser-gated skip), three
stress tests discovered, whitespace check passes. Actual browser run is blocked
by local server bind failure; measured growth and GPU results remain unresolved.
SHE-38 backend prerequisite exists in source despite its Backlog metadata. See
[exact commands, overlap and limitations](renderer-disposal-stress.md). No runtime
change, production action or PR. Next action: execute browser stress on a host
with localhost access and inspect its resource/console attachments.

## SHE-12 — homepage value proposition clarity research

November 12, 2026: inspected issue SHE-12, product design, homepage source,
Future Machine documentation and existing compatibility browser tests at
`b963dd353538294cb0fbf5d34d5283fad6e10e68` on `mini/SHE-12`.
The pre-existing untracked [research draft](homepage-value-propositions.md)
already contains exactly three candidates, a common synthetic-data disclaimer,
counterbalanced first-time-reader protocol, response template and decision rule.
Preserve that draft; this turn adds only this plan entry. The homepage Play Demo,
matched comparison and WHY interactions already have implementation and test
coverage in source; those tests were inspected, not executed this turn.

Acceptance remains incomplete: zero supplied participant responses, no measured
clarity winner, and prerequisite SHE-6 / HBL-W1-001 still Backlog on the live
Linear read. A is only the draft's editorial hypothesis. Do not claim a tested
recommendation or conversion lift. Next slice: obtain the completed live baseline
and actual anonymous first-time-reader responses, score the three candidates
using the recorded rubric, then recommend one with supporting quotes or report
inconclusive. Any homepage implementation follows that evaluation and coordinator
ownership/dispatch clearance; neither is implied by this research preparation.

No runtime, simulation, seed, result or homepage edits. No issue mutations,
participant outreach, deployment, merge, commit or PR. Verification:
`git diff --check` and `git diff -- docs/implementation-plan.md`; research
candidate count checked separately. Browser tests, screenshots and runtime
lint/type checks skipped because browser behavior is unchanged.

## SHE-51 — change one thing repeat play (2026-11-12)

Scope/ownership for this local slice: `world/first-run-guide.js`, the quick-demo
integration in `world/render.js`, its interface documentation, focused guide and
repeat-play tests, and this status. Existing uncommitted SHE-51 implementation
and browser test were present on arrival and retained. No agent delegation,
production changes, deployment or main merge.

Baseline/prerequisites: the existing visual-pass slice already supplies the
resident observation, actual paired worker, measured feedback and deterministic
Replay required by the issue's HBL-W1-017 / HBL-W1-033 dependency intent. Their
Linear completion statuses were not independently established. This issue adds
the repeat invitation, not a second comparison engine. Existing prompt edits
already offered a supported policy implementation year; review added regression
coverage and prevented repeated completion updates from resetting a selection.

Acceptance: completed matched comparison → choose a different implementation
year → run the existing fresh paired worker → replay the revised recipe. Keep
origin/geometry/population, local Balanced proposal IDs and seven-day horizon
fixed; retain synthetic-data labels, simulation authority and provenance. No
simulation/model/rules/data versions or outcomes are changed. Implementation
years are policy ramp inputs, not calendar navigation or live continuation.

Verification commands:
`bun test test/repeat-play.test.js test/world-quick-demo-controller.test.js test/world-visual-feedback.test.js test/world-first-run-repairs.test.js`
and `git diff --check`. The real-worker test checks unchanged before/control
scores, different plan scores at year 0 versus 3, and exact revised replay.
Browser command: `HBL_ACTIVITY_FOLLOWUP_PORT=41951 bunx playwright test --config test/repeat-play.browser.config.js`.
Both default port 41924 and override 41951 failed at server startup with
`EADDRINUSE`; no browser journey or new screenshot is claimed. The existing
browser test covers that journey once a local server can bind. No repository
lint/type-check script is defined. Branch: `mini/SHE-51`; no commit/PR created.
Remaining acceptance: run the browser test and inspect its mobile screenshot.

Final focused checks: **21 pass, 0 fail, 113 assertions**, including three real
worker runs (14.44 seconds total suite). `git diff --check` passed. A raw browser
bundle attempt cannot resolve the existing runtime `/vendor/three/three.module.js`
URL; the application serves that dependency separately.
`bun build world/render.js --target browser --external '/vendor/*' --outdir /tmp/she51-build`
passed (347 modules), retaining that established runtime dependency.

## Station crowd inspection — SHE-134

Dispatch readiness audited on 2026-11-12; see the
[source evidence and proposed integrated slice](reviews/she-134-station-dispatch.md).
Feature implementation remains pending: Linear records SHE-145 (Architecture C)
as a Todo blocker, and the current Population model has no station timetable or
microscopic queue history. Reuse existing raw/represented flow semantics, but
require an executed station event producer before implementing the inspector.
The review records overlap with SHE-132/SHE-156 and proposed ownership,
prerequisites, interval/queue invariants and repeatable 1000x scrub acceptance.
No station feature or performance acceptance has been verified. Next action is
coordinator dispatch review and shared event-interface ownership.

## Architecture shootout — SHE-151

Status: preflight implemented; measurements blocked. The isolated worktree is
`workspaces/SHE-151`, branch `mini/SHE-151`, audited base
`b963dd353538294cb0fbf5d34d5283fad6e10e68`. Owned files are the shootout metric
manifest, preflight CLI, focused test, evidence and this documentation entry.
No agents dispatched, merges or deployments performed.

The next end-to-end slice is a common versioned workload implemented by all five
candidate adapters, checked against an independent CPU oracle, then measured at
10k/100k/1M with render OFF/ON. Prerequisites SHE-143–SHE-147 (architectures A–E)
were all Todo in the Linear audit. The current bounded CPU fixture and
independent-future worker benchmark cannot substitute for these adapters.
Acceptance requires actual changed-state and interaction evidence, p50/p95
completed simulation steps, presented-frame FPS, peak memory with explicit scope,
device/browser/version, validation results and retained artifacts for every case.
Risks: cohorts lack persistent individual identity, parallel updates may diverge,
and browser memory instrumentation may not include GPU or whole-device memory.

Delivered: `bun scripts/preflight-architecture-shootout.js` emits all 30 blocked
cases with unavailable metrics as null and exits 2. Raw audit environment and
manifest are in [preflight evidence](evidence/she-151-shootout-preflight.json).
This command performs no simulation; it is not benchmark evidence. Seed 42 is
reserved in the plan; model/rules/adapter versions and workload remain unset
until a common contract exists. No empirical or performance result is claimed.

Verification: `bun test test/architecture-shootout.test.js test/agent-counts.test.js`
passed 10 tests / 403 assertions. Existing CPU tests include independent-oracle,
replay, missing-event and boundary checks; cross-backend tests remain blocked by
missing adapters. Browser behavior is unchanged, so Playwright was skipped.
No package lint/typecheck scripts exist. GitHub CLI PR audit failed to connect to
api.github.com. Connector search for open architecture PRs found
[draft PR #163](https://github.com/adnanwahab/happybearlandia/pull/163) for SHE-146;
its body explicitly says tests and acceptance still require review. That candidate
is absent from this checkout and is pending review/integration, not a verified
backend. The search is not a complete remote code review.
Next: integrate the five prerequisite adapters, agree workload/time/identity and
fidelity semantics, implement measurement instrumentation, and execute the matrix.
SHE-151 acceptance remains unmet until those measurements exist.

## SHE-132 — event-specific map hotspots: dependency audit

Status (2026-11-12): implementation blocked on the event-ledger and map/time
adapter from HBL-1M-018 / SHE-145. No hotspot feature is delivered by this audit.
Exclusive ownership in isolated branch `mini/SHE-132`: this plan entry only;
no scheduler, Population runtime, or upstream Architecture C files are changed.
Checkout audited at `b963dd353538294cb0fbf5d34d5283fad6e10e68`.

Observed prerequisite evidence:

- [SHE-132](https://linear.app/shel-bernstein/issue/SHE-132) explicitly has
  SHE-145 as a blocking relation. SHE-145 remains Todo in Linear.
- [Upstream draft PR #173](https://github.com/adnanwahab/happybearlandia/pull/173),
  head `e26c215063ed2f7b77b32062651bf97eb0a4d906`, is open and unmerged.
  Its actual patch exports aggregate counts and ordering/state hashes from
  `runSpatialEvents`; it retains no event trace or event IDs. Contact-attempt
  counters include rejected attempts; committed energy transfers are counted
  separately. The documented ring-tile positions and integer time have no
  Population geographic/identity/civil-time mapping. This source is absent
  from the current checkout. Benchmark results in that PR were inspected,
  not independently rerun here.
- Backlog overlap audit: GitHub PR search for `hotspot OR SHE-132 OR SHE-145`
  returned #173; GitHub issue search for `hotspot` returned no matches.
  Linear search for `interaction hotspots` identified SHE-161 (occupancy vs
  activity), SHE-134 (station interactions), and SHE-219 (interaction ablation).
  Preserve those scopes; search results are not proof of an exhaustive backlog.
- Existing `world/population/hotspots.js` counts current visitors separately
  from proximity-checked conversation receipts. Receipts contain place, minute,
  participants and text, but no event ID; only the last 120 survive and inspection
  shows five per place. `hotspots-ui.js` already opens place cards from map
  markers via `world-view.js`. These are gathering-place controls, not a complete
  per-slice contact/movement/service ledger. `world/reality/hotspots.js` displays
  matched field deltas, which are also distinct from event counts.

Next independently verifiable tasks, in dependency order:

1. Upstream owner retains committed events with stable run-scoped IDs, event
   kind, participants, time, actual location and causal references. Preserve
   run/model/rules/source versions, seed and scenario inputs. Define retained
   window/coverage and distinguish attempts, committed contacts, movements and
   service completions. Supply explicit map-coordinate and clock mappings;
   ring indices must not be painted onto unrelated real geography.
2. SHE-132 owner adds a read-only aggregation over that same versioned ledger,
   grouped by event kind and location for half-open slices `[start, end)`.
   Count each event once and expose unlocated events and unavailable/expired
   coverage separately. Rendering and inspection must not advance the model.
3. Integrate a clickable layer through the normal map entry point. Selecting a
   hotspot opens the exact contributing event IDs and their provenance, with
   explicit synthetic-model labels and bounded/paginated details. Reuse map
   selection infrastructure after the adapter is established. Changing slice
   or run must clear stale selection and never silently reuse another ledger.
4. Verify counts against an independent direct ledger filter; test boundaries,
   empty slices, rejected attempts, missing locations, duplicate IDs, retention
   gaps and deterministic replay. Verify map-click IDs against retained records
   in a focused browser journey and ensure render decorations add no events.

Acceptance remains unmet until counts and click-through records agree through
the application's normal entry point. Principal risks are conflating occupancy
with interactions, counting attempts as contacts, inventing geographic mappings,
and reporting truncated history as complete. No substitute events, random
markers or competing upstream implementation are introduced. Next action:
complete/review the upstream ledger and mapping contract, then implement tasks
2–4 on an integrated base. This documentation-only audit needs whitespace/diff
review; runtime tests and Playwright do not validate the missing feature and
are inapplicable to this change. No deployment or production changes occurred.

## SHE-156 executed-trip transit ribbons — prerequisite audit

Status (2026-11-12): implementation blocked on a retained, versioned trip
ledger from SHE-145 / HBL-1M-018. No ribbon behavior delivered or acceptance
claimed. This checkout has no `world/spatial-events/` source. Read-only Linear
inspection found SHE-145 still Todo with [draft PR #173](https://github.com/adnanwahab/happybearlandia/pull/173).
Inspection of that PR's actual diff found a synthetic ring-tile CPU spike:
`runSpatialEvents` returns counters, final-state and ordering hashes, but no
retained arrivals, departures, trip identities or tile geography. Its documented
integer clock and IDs have no Population mapping. Merging that PR alone will
therefore not supply this feature's ledger prerequisite.

Existing interfaces were inspected: `world/population/model.js` derives
`odFlows` from agents with positive remaining travel time, explicitly labeled
"current in-progress agent trips". `world/population/renderer.js` draws up to
200 fixed-width origin/destination lines. These are instantaneous occupancy,
not executed-trip counts across a selected interval. The separate
`world/reality/flow-view.js` retains generic resource records and explicitly
disclaims physical routing; it is not a substitute trip ledger. Existing recent
event retention cannot establish complete tile-pair history. No architecture.md
is present. Related transit PR #157 addresses station crowd interactions, not
the missing Architecture C trip export.

Next independently verifiable slice after the prerequisite is available:

1. Define the ledger producer interface with its owner: immutable run identity,
   model/rules versions, source, seed and scenario inputs; stable trip/event IDs;
   ordered tile path or explicitly schematic endpoint anchors; executed arrival
   time and time units; raw counts and any representation weights; retained
   coverage bounds and dropped-record indicators. Keep Population and spatial
   spike identities/clocks separate unless a tested mapping is supplied.
2. Own a new read-only transit ribbon adapter and focused fixtures/tests; wire
   it through the producer's normal run/timespan entry point. Aggregate completed
   trips once by directed tile pair in a declared half-open time interval.
   Preserve reverse flows separately; never treat missing coverage as zero.
3. Derive width from a documented fixed count scale and animate direction along
   supplied paths with deterministic model-time phase. Label endpoint-only
   connections schematic. Provide Canvas2D fallback or explicitly disable the
   ribbon layer with an accessible reason when its renderer is unavailable.
4. Verify exact ledger reconciliation, no duplicate arrival counting, zero vs
   missing coverage, reversed pairs, interval boundaries, invalid anchors,
   retention gaps, deterministic seed replay and checkpoint reload. Capture
   before/after recordings at the normal entry point with the same run/time.

Only this planning entry is changed/reserved in SHE-156; no dependency files,
simulation semantics, existing flow UI, dispatch, merge or deployment changed.
Validation for this documentation-only increment: `git diff --check`. Browser
tests and recordings are deferred with implementation; no graphical acceptance
or replay evidence is asserted. No repository lint/typecheck script is defined.

## SHE-129 — seeded representative resident drill-down

Status (2026-11-12): implementation blocked on SHE-144's cohort authority and
versioned sampling API. [Readiness audit and next integrated slice](cohort-resident-drilldown.md)
records source/backlog overlap, owned documentation paths, acceptance and risks.
SHE-144 is Todo; linked draft PR #169 contains documentation only, with no engine
or sampler. Existing Population income aggregates and visible persistent-person
samples cannot substitute for hierarchical census samples. No functional delivery
or simulation validation is claimed. Next: make reviewed prerequisite source
available, then integrate cohort selection, labeled samples/counts/weights and
nonmutating deterministic revisits through its actual interface. Principal risks
are invented persistent identity, inspection-dependent RNG/state and inconsistent
weight semantics. Documentation-only whitespace verification passed; application
and browser tests were not run because no application behavior changed.

## Opt-in local continuation — SHE-50

Owned slice on `mini/SHE-50`: `world/future-machine/recent.js`, coordinator
`main.js`, UI adapter, matching tests/browser config and interface/plan docs.
No parallel writers or deployment. Prerequisite HBL-W1-033 / SHE-46 remains
Backlog; source already provides strict recipe/identity validation, missing-record
recomputation and share-reliability tests. Reuse those contracts rather than
replace replay. No existing local continuation was found.

Acceptance: no local write before explicit choice; remember only the validated
synthetic recipe, saved experiment ID and month; bare-route reload resumes that
context, while explicit links take precedence. Reset removes the key and revokes
further writes. Invalid/incompatible data and denied storage must be explained;
missing saved records retain the existing visible recomputation disclaimer.
Risks: browser storage can be unavailable or cleared; saved runs can disappear;
model upgrades cannot silently upgrade recipes. Verify privacy allowlist, failure
paths, exact seed/month reload, reset and shared-link precedence through the app.
Delivered: explicit Remember and Clear controls, strict allowlisted local record,
bare-entry resume, explicit-link precedence, and visible storage/version errors.
Simulation authority, recipe versions and synthetic-data disclaimers are unchanged.

Verification: `bun test test/future-machine-recent.test.js
test/future-machine-share.test.js test/future-machine-ui.test.js
test/future-machine-data.test.js` passed 21 tests / 183 assertions; one existing
opt-in Chromium component test skipped. Includes real City API persistence/reopen,
deterministic recipe replay, privacy rejection, invalid versions and storage errors.
`bun /Users/wahabma/happybearlandia/node_modules/@playwright/test/cli.js test
--config test/future-machine-recent.browser.config.js` could not start the local
server on either 39884 or 39950. Bun reported EADDRINUSE; direct Python socket
bind to an ephemeral localhost port returned PermissionError(1), establishing the
sandbox bind restriction. Browser journeys are committed but unexecuted; no
screenshot is claimed. Rerun that config in a host permitting localhost binding
for exact context reload/reset, missing records, explicit links and denied storage.
No package lint/typecheck scripts exist. Final whitespace and syntax checks are
recorded below. Branch `mini/SHE-50`; no commit/PR, merge or deployment performed.
SHE-46 remains Backlog; this local slice does not grant dispatch readiness.

## Ethical first-100-to-1000-player launch preparation — SHE-68

Prepared [launch experiment](launch-experiment.md), protocol `launch-v1`:
one adult city-building audience, one permission-based community thread, an
opt-in invitation, and the existing standalone Riverside Bakery journey.
Owned scope is the brief and this plan entry; no gameplay, homepage, collector,
deployment or production changes. Audit found working versioned comparison and
recipe replay, but no launch funnel collector in the bakery page. Reuse those
contracts and start with consented facilitated observations, explicitly separating
clicks, verified completion, useful feedback, assistance and unknowns.

Acceptance delivered: hypotheses, $0 cash/eight-hour effort ceilings, staged
10/100/250/500/1000 gates, abort rules, privacy/retention procedure, ledger schema,
synthetic rules/version/seed provenance and exact verification commands.
`bun test test/bakery-journey.test.js test/bakery-scenario.test.js`: 6 passed,
0 failed, 26 assertions. `git diff --check` passed. Documentation-only scope;
Playwright/screenshots skipped. Baseline branch `mini/SHE-68` at `b963dd3`;
no commit or PR created here.

Recruitment remains held: November 12 Linear inspection found SHE-12/W1-007
In Progress and SHE-52/W1-039 In Review. Require actual clarity evidence,
integrated consent/submit/error/opt-out verification, a named launch owner,
moderator permission, candidate route/replay/capacity checks and two excluded
rehearsals before invitations. Scaling requires verified measurement capacity
and stage approval; no participant results or launch authorization are claimed.

## Queued simulation cancellation — SHE-81 (2026-11-12)

Delivered a bounded slice on the existing isolated `mini/SHE-81` checkout.
Prerequisites/audit: Worker pool already removes queued tasks and rejects their
promises; Population Studio already queues replacement futures behind active-job
settlement. GitHub cancellation search found PR26 (City replay lifetime), a
different boundary; local branch inventory and Linear SHE81 show an incomplete
historical audit rather than a delivered cancellation PR. No new queue/API/model
was introduced. Ownership: worker pool lifecycle, Studio runner and focused tests.

Acceptance tasks completed: verify immediate admission-capacity release and
drain after queued cancellation; ignore retired-worker errors; invalidate queued
Studio replacements and reject late active results after cancel/supersession.
Saved results remain caller-owned. The runner now rejects superseded active
calls as well as pending replacements; existing generation checks remain intact.
Risks: cancellation is local to these runtime instances, not persisted server
jobs; injected event tests establish race handling, not browser rendering.

Evidence: `bun test test/queued-simulation-cancel.test.js
test/worker-platform.test.js test/population-studio.test.js` passed 27 tests,
147 assertions, 0 failures (8.62s). The new test file is the reproducible run
artifact: real echo worker for bounded admission, injected retired-worker events,
and deferred Studio settlement with seed42 requests and retained-result checks.
Existing real seeded paired simulation/replay tests also passed. No model rules
or stochastic data changed. Focused integration checks cover the browser-facing
runner; full browser rendering remains unverified. No lint/typecheck script is
defined in package.json. Node syntax checks for both changed modules and
`git diff --check` passed. Publication/commit reference remains pending; no merge,
deployment, production mutation or dispatch-label change was performed.

## SHE-240 exploration — November 12, 2026

Completed seven read-only investigations in concurrency-limited batches. The
[ranked report](reviews/she-240-exploration.md) records 21 opportunities, seven
disjoint proposed tasks with acceptance criteria, baseline test results, reproduced
boundary defects and unverified hypotheses. Production implementation is deferred;
SHE-240 remains Canceled and existing SHE-77/76/73, U03 and R13/R14 ownership is
preserved. Next proposed slice is finite paired-comparison arithmetic, after fresh
PR/worktree ownership checks. No production changes, browser run, push or issue
mutation; documentation whitespace check passed. No implementation commit/PR.

## SHE-92 — linked city identity selection audit (2026-11-12)

Status: dependency blocked; feature acceptance is not complete. The supplied
isolated checkout is on `mini/SHE-92` at `b963dd3` and was clean before this
documentation change. Linear's In Review status records an earlier access-blocked
handoff, not an implementation: its workpad explicitly reports no code, tests,
commit or PR. GitHub searches for `"SHE-92" in:title` and `"SHE-34" in:title`
returned no PRs in the repository during this audit; this is search evidence,
not a guarantee that no unpublished implementation exists.

Observed current behavior: `world/causal/heatmap.js` renders three district
aggregates from the selected City checkpoint. Rows retain local district IDs
internally but are not selectable and expose neither IDs nor metric time.
`world/causal/history.js` and `page.js` already select canonical building IDs at
the displayed month. `world/causal/adapter.js` preserves explicit canonical/local
entity mappings. These interfaces must be reused rather than equating a district
aggregate with an individual building or with the separate Population clock.

Prerequisites: the grid lattice, entity mapping, coverage crosswalk and grid view
listed in `docs/reviews/chatgpt-30-neighborhood-proposal.md` (G01–G03, U01–U02)
are absent from this checkout. [SHE-34](https://linear.app/shel-bernstein/issue/SHE-34/hbl-w1-021-define-stable-district-to-grid-entity-mapping)
is In Progress and owns the district/grid identity contract; its issue also
declares HBL-W1-020 as a dependency. No competing mapping or speculative grid API
was added. The design prohibits attributing district-only measurements to cells
without supported coverage.

Next integrated slice, after that contract and an actual grid entry point land:

1. Consume the owned mapping to carry source collection/local ID, canonical ID,
   run/checkpoint identity and recorded month through metric and cell selection.
2. Wire both selection paths to one inspector and expose the same source IDs
   and recorded metric month; distinguish aggregate district context from
   supported building/cell measurements and unavailable coverage.
3. Verify clicks in both views, forward/reverse scrub, run changes, refresh and
   missing checkpoints. Assert no stale timestamp or identity survives a change.

Acceptance remains: either view reveals the same source entity ID and correct
metric timestamp from the same recorded checkpoint. The main risks are conflicting
ownership of the mapping and falsely precise spatial attribution. This audit
does not broaden SHE-92 into implementation of those prerequisite workstreams.

Actual verification: `bun test test/time-machine-heatmap.test.js
test/metric-registry.test.js` passed 6 tests, 11 assertions, 0 failures. These
verify existing aggregation/registry behavior, not SHE-92 acceptance. No browser
behavior changed; Playwright was skipped for this documentation-only audit.
No implementation commit/PR, deployment, issue status or label changes were made.

## SHE-5 — Honey Trail playground challenge

Next integrated slice: add an optional collect-and-replay challenge to `/game/1`
using the existing character position, scene, and animation loop. No new service,
scene schema, or multiplayer authority. Authored synthetic playground rules:
collect eight honey drops, start the timer on first pickup, finish on the last,
and retain a session best across retries. Progress survives lava respawns.

Tasks: implement deterministic collection rules; render visible drops and a
compact progress/instructions/retry panel; integrate with normal physics updates;
test pickup boundaries, duplicate prevention, completion and replay, then run the
existing game browser smoke plus a focused journey when dependencies permit.
Acceptance: reachable markers, visible progress and completion, working replay,
and no challenge on unrelated scenes. Risks: edited scene geometry can move
under authored markers; browser dependencies may be unavailable in this checkout.
Status: implemented. `game/honey-trail.js` owns collection and session-best rules;
`game/honey-trail-view.js` owns nonphysical Three markers and DOM feedback, called
from the existing character physics loop only on scene 1. Scene JSON, inventory,
and multiplayer contracts stay compatible. Design and game README document scope.

Verification: `bun test test/honey-trail.test.js test/scene.test.js
test/game-sounds.test.js` passed 11 tests / 48 assertions, including real Three
scene/view integration through a minimal DOM adapter. `git diff --check` passed.
Browser pickup/restart assertions extend `test/e2e/game.e2e.js`, but the browser
run is unverified: the local Bun package launcher lacked its postinstall binary;
using the installed native Bun resolved that, then server startup reported
EADDRINUSE on both 3100 and 43105. An independent Python bind to an OS-selected
loopback port confirmed `PermissionError: Operation not permitted` in the
sandbox. Do not interpret this as an app regression or browser pass. Next action:
run the focused Playwright game test in a host permitting local server sockets,
and visually check marker reachability and the compact HUD. No deployment or
production data changes performed; no commit/PR created in this source-only slice.

## SHE-93 construction milestone audit — November 12, 2026

Existing implementation satisfies the bounded model contract; no duplicate feature
implementation is needed. `scene/construction-progress.js` reads exact City
observations, and `scene/mapping.js` shares the model-owned project/building slot.
Under City `city-systems.1.0.0`, default recipe seed 42, month 15 records 11/12
project work with no building; month 16 records completion and the building with
24 added homes. Reverse scrubbing restores the prior projection exactly. Visual
effects require recorded changes; new inventory appears at full recorded size.
These are synthetic model results and schematic positions, not observed real
construction or geographic parcel claims.

Fresh local verification: construction-progress, scene and effects suites passed
20 tests / 109 assertions. They cover missing/invalid observations, unsupported
models, immutable inputs, fixed-seed completion, reverse scrubbing, reduced motion
and absence of animation without change evidence. Browser acceptance remains
unverified in this audit: Node Playwright could not load the existing import.meta
config; `bun --bun x playwright` loaded it but server startup failed with
EADDRINUSE on ports 39972 and 40993. No browser pass is claimed.

Linear SHE-93 remains In Review. Related renderer follow-up SHE-216 is already
Done and links https://github.com/adnanwahab/happybearlandia/pull/99; its newer
retained-mesh implementation is not present in this checkout and was not modified.
GitHub search found no PR explicitly naming SHE-93. Next integration action:
verify the recorded 0→15→16→15→0 browser journey on the current integrated renderer
before closing review. No merge, deployment or production data change performed.

## SHE-113 — automated paired scene evidence

Bounded slice: reuse the normal Future Machine Fork City entry, authoritative
monthly history and existing physical comparison rules. Detect the earliest
physical building/link difference rather than assuming Month 16 or using the
presentation clock. Capture Month 0 and that exact month in one matched run.
Prerequisites: complete matched 121-frame history, versioned recipe, local Bun
server and Chromium. Missing or incompatible history fails closed. Unchanged
runs explicitly report no physical divergence and request only Month 0.

Acceptance: manifest records recipe/scenario version, model version, seed,
initial hash, experiment, provenance, actual divergence month and physical
entities. Each capture includes paired state JSON and scene PNG with identical
camera, viewport and backend. Physical scene divergence is distinct from the
first policy or financial change; synthetic modeled results are not observations.
Ownership: capture-evidence.js, focused unit tests, existing browser evidence
suite and this plan only. No model, production storage or deployment changes.

Verification: 6 focused tests passed, including Month 1/37/120,
modified buildings, reordered history, unchanged runs and missing/mismatched
history, removed buildings and nonphysical policy/financial changes. Combined
capture/diff/construction evidence suite: 18 tests passed. Whitespace check passed.
Both browser attempts failed before tests: Bun listen returned EADDRINUSE at
39931 and isolated port 39973. Browser captures remain unverified; no completed
scene screenshot proof is claimed. Reproduce captures on a host allowing listen:
`HBL_TWO_FUTURES_PORT=39973 bunx playwright test --config test/one-city-two-futures.browser.config.js --grep 'automated month zero'`.
Artifacts are written beneath `test-results/two-futures-sprint/` and include
`capture-manifest.json`, `scene-month-*.png` and `capture-month-*.json`.

## SHE-34 — stable district schematic mapping

Owned slice: new `world/city/district-grid.js`, its contract documentation and
`test/district-grid.test.js`, plus this status entry. No shared engine, route,
scene or metric implementation changes. Prerequisite SHE-33/HBL-W1-020 is Done
in Linear with PR133 attached; its catalog is absent from this checkout, so this
slice uses existing `districtHeatmap` records without inventing catalog fields.
Audit overlap: `scene/mapping.js` already provides building/project slots and
reverse-scrub tests; `causal/heatmap.js` already computes district measurements.
Neither supplies a versioned district context tile identity contract.

Delivered `city-district-grid.v1`: exact district IDs scoped by experiment/run,
initial hash, model version and seed; immutable initial layout; stateless exact
checkpoint projection; zero/null/missing/absent distinction and unlocated
unsupported inventory. Acceptance checks real engine paired Month0/16/120 and
reverse scrub, reordered inventory, foreign provenance, duplicate IDs and source
immutability. No real geography or per-cell precision is inferred.

Verification (final): `bun test test/district-grid.test.js test/time-machine-heatmap.test.js test/future-machine-scrub-identity.test.js test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js`
— 30 passed, 0 failed, 449 assertions, 4.28s. `git diff --check` passed.
No root lint/type-check script is configured for these JavaScript modules.
Branch `mini/SHE-34`; no commit/PR created by this slice. Browser behavior is
unchanged, so Playwright/screenshots are not applicable. Follow-on UI wiring and
geographic coverage remain outside this identity-contract issue.

## SHE-72 — Canvas2D interface reconciliation (2026-11-12)

The current sprint already renders Future Machine through scene/canvas-stage.js
and ordinary World through render/renderer/canvas-renderer.js. The original
renderer-entry.js/canvas2d-world.js adoption paths are obsolete; preserve the
integrated renderers rather than duplicate their engines. This slice adds the
assigned fallback/index.js Snapshot-facing factory using the same spatial mapping
and Canvas presenter. It reports supplied metrics with units, labels missing
measurements, rejects mismatched clocks, and clears incomplete pairs instead of
claiming absent inventory. It adds the two originally requested test entry points.

Acceptance evidence: seed42/default recipe, synthetic monthly City, month0 homes
delta0 and month16 delta24 from actual engine snapshots; input evidence unchanged.
`bun test test/canvas2d-world.test.js test/future-machine-fallback.test.js
test/future-machine-canvas.test.js test/world-canvas-renderer.test.js
test/future-machine-backend.test.js`:24pass/0fail/1existing browser-gated skip,
147assertions. `git diff --check` passed. World tests exercise its supplied Three
scene geometry, not monthly City simulation or legacy policy actions.

Browser attempt: `bunx playwright test --config
test/world-canvas-followup.browser.config.js` failed before browser execution:
server listen EADDRINUSE on39891; retry with HBL_WORLD_CANVAS_PORT=41972 failed
identically. No new screenshots, measured browser trace, Activity/policy action
verification or browser acceptance claimed. Existing browser suites retain
desktop/390px, forced Canvas and missing-GPU coverage for host execution.

Integration handoff: coordinator/scene owner must choose whether to route the
existing scene wrapper through createCanvas2DStage; this worker leaves scene/,
main.js, World entry HTML and shared contracts untouched. The new factory is
tested directly but is not yet selected by the normal application entry point.
Re-run browser verification after that integration, including month0/16 captures,
exact selection and startup failure. No merge/deployment or remote mutation.
Branch mini/SHE-72; commit/PR publication remains pending because shared Git
metadata is outside this session's writable roots.

## SHE-14 — homepage Play Demo explanation (2026-11-12)

Baseline audit: the homepage already has one prominent Play Demo link to
`/world/future-machine.html?demo=1`; the functioning guided clock and matched
comparison are covered by `test/e2e/approved-demo-responsive.e2e.js` and
`test/two-futures-demo-controller.test.js`. HBL-W1-001 / SHE-6 is Done in
Linear. This slice reuses that entry and runtime, adding a short explanation
of the guided ten-year housing comparison, pause/exploration, and synthetic
scenario limits. No model, seed, data, recipe or results change.

Local ownership is limited to `index.html`, the existing responsive browser
test, and this plan on branch `mini/SHE-14`; checkout was clean at audit.
No automated dispatch labels/status, release gates, merge or deployment changed.
The work is a small single-owner slice, with no independent implementation
tasks requiring delegation.

Implemented: one existing primary CTA, a Start here heading, descriptive text
associated through `aria-describedby`, and a truthful synthetic-data disclaimer.
Responsive test now checks the single visible CTA, keyboard activation, unchanged
destination, accessible explanation, no horizontal overflow or intro overlap,
and captures homepage screenshots at 1440, 390 and 320px before continuing the
existing real comparison/WHY journey.

Actual verification:
- `bun test test/two-futures-demo-controller.test.js`: 2 passed, 13 assertions.
- `bun test test/server.test.js test/two-futures-demo-controller.test.js`:
  2 passed, 1 failed; server exits before startup on its ephemeral port.
- `/Users/wahabma/happybearlandia/node_modules/.bin/playwright test --config test/approved-demo-responsive.browser.config.js`:
  blocked before browser tests by Bun listen `EADDRINUSE` on 39962.
- Repeated with `HBL_RESPONSIVE_PORT=41873`: same startup blocker.
- `git diff --check`: passed.

Remaining acceptance: run that responsive command in an environment where Bun
can listen, inspect the generated `*-homepage.png` screenshots and verify the
demo journey. No screenshots were generated here; browser layout and activation
remain unverified. No commit or PR created.

## Symphony pilot — SHE-179

Documentation slice: [verification report](symphony-pilot-verification.md).
Target absence, clean isolated issue branch, local sprint base and no Linear
blocking relations were confirmed before editing. This worker owns only that
report and this status entry; the trusted host owns publication interfaces.
Acceptance: distinguish observed execution from offline tests and pending live
publication, pass whitespace checks, and commit locally on `symphony/SHE-179`.
Offline Symphony tests passed 8/8 and the one-worker Linear dry-run exited 0.
No browser behavior changed, so app launch, Playwright and media are inapplicable.
Final commit/check evidence is handed off through `.git/hbl-workpad.json`;
GitHub draft publication and remote-base freshness remain host gates after the
session. On resume, read-only Linear and GitHub checks confirmed the host
published commit `cc9d10afc7c0d543eae6d4f37e8b461d4eba3b57` as open
[draft PR #24](https://github.com/adnanwahab/happybearlandia/pull/24), with
the correct sprint base and issue branch; no comments or review threads
were returned. The report now records that live receipt separately from
the original offline tests, which passed 8/8 again. CI and dispatcher
internals remain unverified; publication of this follow-up is a host gate.

November 12 checkout follow-up: the report already existed and was preserved;
absence-before-creation is historical evidence only. Starting HEAD: `b963dd3`.
Reran the offline pipeline tests (8 passed) and one-worker Linear dry-run
(exit 0); `git diff --check` passed. Creating `symphony/SHE-179` failed because
the shared Git metadata is outside the writable workspace. Branch creation
and the requested local commit remain outstanding; checkout stays on `mini/SHE-179`.
No live service verification or publication was performed in this follow-up.

[Product design](design.md) defines the target experience. [Engineering instructions](../AGENTS.md) describe how to plan, implement, and verify changes. Keep this plan current with task status, dependencies, acceptance evidence, and commit or PR references when available.

## Agent Training Gym — SHE-192 (deferred)

Status: later-phase backlog; excluded from the next release. This entry records scope and acceptance, not a delivered training runtime. [Product requirements](design.md#agent-training-gym--later-phase-she-192).

Checkout evidence: `world/experiment-record.js` records civic experiments and lineage; `world/reproducibility.js` records model, seed, and fingerprints; `world/experiment-store.js` saves browser records. `world/experiments-api.js` runs bounded paired city experiments. These are reuse candidates, but none of these contracts defines a rebuildable training environment, frozen reward declaration, or agent trajectory. The improvement proposal inbox in `ops/improvement/` stores proposed work, not simulation runs, and must remain separate.

The first implementation slice, once scheduled, is one bounded synthetic environment: register its version and reward declaration, rebuild it by registry identity, run a scripted agent, persist its trajectory, replay it, and reopen the evaluation report through an established application entry point. A scripted agent verifies the environment contract before introducing a learning algorithm. Select the authoritative model and entry point during that slice's audit; do not assume City and Population identities or clocks coincide.

| Status | Task | Dependencies and acceptance |
| --- | --- | --- |
| Deferred | Establish the Experiment Registry environment contract | Choose the registry owner and storage interface. Retain immutable environment, model/rules, dependency and source revisions, initial state, scenario inputs, seed, action/observation schemas, and resource limits. Rebuild in a clean process without unrecorded defaults; fail explicitly for missing artifacts or unsupported versions. |
| Deferred | Declare rewards before training | Persist a versioned reward definition with components, units, weights, constraints, terminal rules, and definition digest before accepting a run. Reject absent declarations and changes after start; revisions preserve prior runs. |
| Deferred | Execute and record one bounded episode | Resolve only registered environments and supported actions. Retain agent/policy version, ordered observations/actions, reward components, event dependencies, seed, model ticks, termination and error states. Bound steps, time, and artifact size; handle invalid actions and interrupted runs explicitly. |
| Deferred | Replay and evaluate | Rebuild from registry artifacts and verify recorded transitions and rewards against retained evidence. Use held-out seeds and seed-matched policy comparisons. Test deterministic replay, immutable parents, reward boundaries, missing observations, invalid transitions, and timeout/failure paths. |
| Deferred | Present separate performance reports | Reopen persisted results through the selected normal entry point. Separate training, held-out simulated evaluation, and sourced real-world evaluation. Include sample counts, units, uncertainty, dataset/environment/policy revisions, and limitations; missing real-world evaluation remains unavailable. Verify reload and missing-artifact behavior. |

Material risks: environment drift or missing artifacts can defeat rebuilds; reward changes or evaluation leakage can invalidate comparisons; model success does not establish real-world performance. Registry ownership, artifact retention, model selection, and a real-world evidence protocol remain prerequisites. Do not add a training dispatcher or activate external agents as part of this deferred planning slice.

Acceptance evidence for this change: repository contract inspection and documentation review only. Runtime acceptance criteria above remain unverified. No application code or browser behavior changes; runtime tests and Playwright are inapplicable. Next action: schedule the registry contract and bounded environment slice when later-phase work is authorized.

## SHE-82 — discard superseded Decision Studio responses

Implemented in `world/decision/studio.js`; regression coverage in `test/decision-request-race.test.js`.
Audit found Future Machine already uses AbortController/request identity and has a real-API cancel/restart browser test. Decision Studio guarded new requests but did not invalidate them when seed/policy inputs changed. Its input handler now invalidates create/start/reopen/poll work, detaches the watcher, releases busy state for the next run, and invalidates pending trace selection. Previous displayed results keep their existing prior-input label. Stale reopen failures and watcher errors are ignored. Server records remain immutable and may finish; this does not cancel server computation or change simulation contracts.

Acceptance: controlled deferred responses exercise the actual coordinator functions, with DOM/rendering spies and lifecycle-only network fixtures. A newer seed/policy run retains its results, experiment identity, URL and busy/error state after older responses settle. Six new tests fail against HEAD's original coordinator and pass with the fix. Full evidence and reproduction commands: [SHE-82 verification](evidence/she82-stale-results.md). No commit/PR published in this session; browser verification remains limited by local server startup.

## SHE-91 — Event inspector attribution messaging

Implemented on isolated issue branch `mini/SHE-91`: explicit no-selection and
missing-record states; attribution coverage notices for absent dependencies,
multiple potentially conflicting inputs, and incomplete history. Existing
recorded graphs, provenance, correlation separation, and API contracts remain
in use. No payload-based conflict adjudication or model support registry was
introduced: this generic reader cannot distinguish unsupported dependency
recording from history that was not retained. It states that limitation directly.

Audit: read the Linear issue and local causal reader/component tests; GitHub
searches for SHE-91 PRs, event-inspector issues, and she-91 branches returned no
matches. The existing graph covered missing dependencies and bounded traversal,
but lacked the attribution notices and dedicated missing-record state.

Acceptance evidence: `bun test test/causality-messaging.test.js test/causality-read.test.js`
passed 8 tests (33 assertions), including the real stored World scenario API
integration. Four added component journeys cover no event, conflicting inputs,
incomplete data, and an unrecognized model with no dependencies. Playwright
could not launch its fixture server: Bun reported EADDRINUSE on both 39871 and
an isolated retry on 39879. Browser execution remains unverified; rerun
`bunx playwright test --config test/causality.browser.config.js` on a host able
to bind the fixture port. `git diff --check` passed. No deployment, issue label
change, publication, or main merge performed.

## Playable Life vertical slice

### SHE-243 matched control

Next slice: fork the exact paused pre-action Population checkpoint into an autonomous runtime; advance both arms through the playable day and the selected 30- or 90-day follow-up. Persist matched seed, model version, resident, start/end ticks and outcomes in the existing report. Compare finite needs and savings only for compatible arms; legacy reports remain observational. Prerequisites: existing checkpoint restore, household observation and report persistence. Acceptance: deterministic no-action replay, a measured action difference, visible paired results and provenance after reload, pause/resume and immutable parent. Risk: approximately twice the simulation work; run control on demand and retain it across pauses, destroy it on completion/navigation. This estimates the complete command sequence in one synthetic seeded run, not an individual action or population effect.

Delivered: paired saved outcomes and finite differences, visible seed/model version, observational fallback for older or incompatible reports, control pause/resume and cleanup. `bun test test/playable-life-control.test.js`: 2 passed / 104 assertions (31-day, 60-minute fixed-step fixture). `bun test test/house-integration.test.js`: 8 passed / 73 assertions. Browser entry bundled successfully; `git diff --check` passed. The first 15-minute-step determinism fixture exceeded its 60-second test limit; the passing fixture retains the full 31-day horizon with 60-minute steps.

Example for the PR description: Population/rules 1.3.0, seed 42, 8 synthetic residents, householdSize 4, default remaining inputs, midnight checkpoint, 60-minute fixed steps, 744 ticks. Buying a plant before advancing gave household savings USD 23259.56158416296; the matched no-action control gave USD 23294.56158416296; difference −35 USD. Two no-action outputs matched exactly.

Browser assertions now cover both columns, difference, provenance, saved-arm seed/time matching, reload and legacy observational fallback, but were not executed: the normal Node launcher rejected the existing config’s import.meta; using the Bun launcher passed config loading but the server failed with EADDRINUSE on ports 54388 and 54493. No browser outcome is claimed. GitHub CLI authentication reports an invalid token, so no PR was published. Next action: run the updated Playwright journey on a host that can start the server, then publish the PR with the example above. No deployment or production mutation.

PR #111 integration with SHE-208 (2026-11-12): both the played arm and matched control now use the selected 30- or 90-day horizon, locked at handoff and preserved across pause/resume. Report and progress labels use that horizon. The parameterized browser journey retains both durations, verifies the exact endpoint and matching provenance of both arms, reloads without writes, and exercises legacy observational fallback. Its time budget accounts for the second simulation arm. Focused Bun verification passed 10 tests / 177 assertions across `test/playable-life-control.test.js` and `test/house-integration.test.js`, including identical no-action outcomes and the −35 USD plant difference. The browser entry bundled successfully (172 modules), both edited JavaScript files passed syntax checks, and whitespace validation passed. Current browser verification remains blocked: Chromium aborts on `socket() failed: Operation not permitted` in this environment; no browser result is claimed.



Source is the “15 new features I'd add next” emerging civilization proposal. Start with “Live a Day as Anyone” on the shared Living World and House Simulator Population authority. Use the selected resident's existing identity and keep the current clock. The available work and travel activities are a household chore and the trip home. The follow-up uses 30 modeled days.

| Status | Task | Dependencies and acceptance |
| --- | --- | --- |
| Implemented | Open the selected resident from Living World | Save or resolve the starting Population checkpoint. Open House with the same experiment, household, and resident IDs. Reject a missing or mismatched resident and preserve ordinary House entry points. |
| Implemented | Run a 24-hour playable window | Record starting and ending ticks and show the resident's current state. Route chore, travel home, talk, plant purchase, and rest through existing runtime commands. Verify an unavailable action can be declined and the user can continue the day. |
| Implemented | Hand off to the simulation for 30 modeled days | Close the direct-command window at the exact day boundary. Advance with existing scheduler and household observation behavior. Keep the interface responsive and resume an interrupted advance from the latest committed minute. |
| Implemented | Save and reopen the follow-up | Persist a child checkpoint with resident identity, accepted actions, available events and decision traces, and the start/follow-up observations. Reload the report and open both World checkpoints. Verify the starting checkpoint still represents the original state. |
| Verified | Exercise the integrated journey | Chromium verified the resident inspector entry control, rest and purchase receipts, pause and resume, exact 31-day elapsed time, immutable parent checksum, and read-only report reload using the real population worker and an isolated SQLite store. |

Verification passed with 32 House, checkpoint integration, and movement tests plus the Playable Life browser journey. The browser fixture supplies a selected resident to the World entry control.

The follow-up report is observational. An action-level effect estimate needs a matched autonomous control with a defined outcome and equivalent start state. The SHE-243 slice above adds that comparison for the whole command sequence. Keep broader work and venue actions and the universal causal inspector handoff as follow-on scope. Bound evidence and checkpoint size, and measure follow-up responsiveness against representative Population runs before expanding the time horizon. Verify identity and clock mapping before linking a resident to monthly CityState, Decision Studio, or a different model version.

The emerging civilization roadmap depends on inspectable events and stable entity identity. Start idea diffusion with a recorded social interaction and a seeded adoption rule, then add durable kinship and historical residence records for generational families. Perspective comparisons need a shared event and resident-level exposure evidence. Resident-led experiments need versioned experiment recipes, transparent assumptions, and a way to compare forecasts with recorded outcomes.

### SHE-208 season increment

The existing day journey is the prerequisite. Extend its ordinary House entry
with a choice of 30 autonomous days or a synthetic 90-day season, using the same
Population runtime, resident identity and child-checkpoint persistence. Lock the
horizon at handoff so pause/resume cannot change the target. Save the selected
horizon and exact minute/tick bounds; retain legacy 30-day report rendering.
Acceptance: both horizons reach exact boundaries, preserve the parent, reopen
without writes and retain accepted command evidence. Focused browser integration
covers both journeys. Risk: longer horizons increase runtime and checkpoint size;
this does not establish action-level city causality or a monthly CityState mapping.
Verification: 13 focused House integration, movement and identity-navigation tests
passed (126 assertions); syntax and whitespace checks passed. Browser cases now cover both
horizons, immutable parents, pause/resume and read-only reopening, but could not
run: the dependency-local Bun shim lacks its postinstall; using the installed Bun
then failed server listen on ports 3100 and 3418. The broader checkpoint run
also timed out in its existing worker-restore case (30-second limit) and was
interrupted after subsequent checks completed. This is a working increment toward SHE-208, not completion
of its broader causal-tracing criterion.

## Housing policy vertical slice

The next proposed cross-application milestone is the ten-year housing journey in the product design. The existing Decision Studio housing model and monthly City history are starting points. The checklist records the integration work and its acceptance gates.

| Status | Task | Dependencies and acceptance |
| --- | --- | --- |
| Audited; independent replay pending | Audit housing runs and World render inputs | [SHE-245 audit](housing-world-input-audit.md): 18 metric IDs plus structural/envelope/World inputs; 7 semantic metric mismatches. Housing 1.2.0 remains aggregate/project authority; no Population identity mapping claimed. Recorded seed-42 ten-year output and verifier; 46 focused tests pass. Second-person replay remains the final research validation gate. |
| Pending | Define the run and geography adapters | After the audit, specify stable scenario, checkpoint, time, unit, and entity mappings. Attribute real geometry and label synthetic properties. Expose missing or unsupported mappings explicitly. |
| Pending | Run a housing proposal and matched baseline over ten years | Use the supported housing engine and the agreed run contract. Verify identical inputs and seeds reproduce the same outcomes, and preserve the baseline when an input changes. |
| Pending | Connect the selected future to World and Worldline | Use the same run, date, metrics, and supported entities in both views. Verify deep links and missing checkpoint handling. |
| Pending | Connect a housing outcome to its causal evidence | Link a real modeled outcome to recorded inputs or dependencies, including model and run provenance. |
| Pending | Verify the entire journey | In the app, change an input, compare futures, enter a selected year, inspect evidence, and rerun. Record test commands, results, and the integration commit or PR. |

### Dependencies and open decisions

- The cross-model property and resident mappings need to be established before the views can claim a shared entity. Confirm which World rendering inputs can come from the housing model.
- Durable hosted storage and legacy migration still need deployment verification. The existing focused browser suites use an isolated test store.
- The earlier repository-wide browser run reached its time budget after reproducing existing party-test failures. The historical verification notes below preserve that result.

## Completed work and follow-on features


Source is the user-provided “The next 12 features I'd build for HappyBearLandia” design. The active checkout includes existing in-progress causality, replay, comparison and navigation work. Preserve those changes and reuse their contracts.

## November 10 product review

- [x] Define the bakery mystery before building its UI. The recipe model runs 241 monthly states from 2026 to 2046. It reuses the synthetic logistics solver and adds explicit operating and scheduling rules for Riverside Bakery and Luis.
- [x] Add exact City checkpoint selection by saved run and month. Keep the city model's existing time scale and link newspaper and discovery evidence back to that month. Derive the district heatmap from the selected state.
- [x] Integrate the worker-backed bakery journey, recorded headlines, shareable recipe, and comparison. Verify that a shared URL reproduces the same timeline and that an intervention after closure leaves the bakery closed.
- [x] Configure durable Decision Studio paths and verify local backup and restore. Hosted volume attachment and legacy migration require a deployment check.
- [x] Run the focused integration suites after integrating the City, bakery, and storage changes. The 64 focused Bun tests, 58 Decision Studio tests, and six distinct Time Machine and adjacent browser journeys passed.
- [x] Run the repository-wide Bun suite. It recorded 2,331 passes, nine failures, and one error on the Time Machine integration checkout.
- [ ] Complete the repository-wide browser run. The run hit its 150-second budget after reproducing three party-test failures from the pre-integration run.

The revised journey uses its own versioned recipe, synthetic household and business, and schematic comparison. The original milestones below remain the broader roadmap for the separate City model. A 3D swipe, public leaderboard, cross-app character continuity, and five-person playtest remain follow-on work.

## Living City implementation

- [x] Generate five evidence-backed requests from the synthetic City model. The Riverside commute is the first playable quest.
- [x] Compare 100 paired seeds through the existing monthly City engine. Both arms begin at the same checkpoint and use the same flood schedule. The intervention changes capacity on existing transit links once the modeled project completes.
- [x] Integrate the Living Network and council after the quest model. The network reads measured City links and resource flows and opens on the current checkpoint. Council positions come from explicit rules and the selected pair’s outcomes.
- [x] Revisit the same household in either arm, show an interview based on the recorded commute, and share a versioned recipe that reproduces the selected pair. The combined City and Time Machine checks passed with 87 Bun tests and five browser journeys.

The guided release covers the first commute challenge. The 3D Policy Paintbrush, public Experiment Arena, autonomous council negotiations, and cross-app household travel remain roadmap items. Goods and information are marked unavailable in the monthly City data. The four other requests provide starting evidence for future playable scenarios.

## First release

- [x] Inventory the existing monthly CityState, causal event store, historical API, paired comparison, temporal snapshots and Universe navigation. Keep the existing CityState and run context as the historical authority.
- [x] Add a historical view to the existing World causal demo. Given a completed synthetic run, load the exact checkpoint at the selected month and its previous month. Display additions, removals and changes for modeled buildings, households, people, businesses and district links. A missing checkpoint must surface an error.
- [x] Link recorded events to their month and entity and hand off to the existing causal inspector. Verify that a saved link reopens the same month and record without recording a new run.
- [x] Test empty storage, initial recording, event jumps, slider navigation, reload and error recovery using the application server with an isolated in-memory SQLite database.
- [x] Review delegated newspaper and discovery views and link them from the historical page once their routes and storage behavior are verified.

The first slice uses the current 20-month synthetic World run and a district-based view. The existing OSM building timeline, live population runtime and monthly CityState use different models. Extend the historical model only after mapping identity and time explicitly. Preserve URL context keys owned by the Universe shell.

## Follow-on acceptance criteria and dependencies

| Feature | Checkout evidence | Next work and acceptance |
| --- | --- | --- |
| 1. Universal Time Machine | Monthly replay service and 21 demo checkpoints. Separate building-date timeline. | Verify this release's checkpoint journey, then add a stored-run selector, measured long-history pagination, calendar metadata, and a 2026–2050 World render adapter. |
| 2. Why Did This Happen? | Versioned model traces and shared inspector. | Verify a construction event jump and its recorded input edge. Expand event coverage per model and show an explicit empty state when history is unavailable. |
| 3. Branch Reality | Economic fork engine and Decision Studio forks. The private causal route is disabled by default. | Add versioned intervention replay for the monthly city, an authenticated parent loader and durable child runs. From the selected month create a seeded child and confirm the parent hash and same-seed control remain stable. |
| 4. Future Diff Viewer | Paired comparison API and Worldline UI exist. | Map exact shared entities between supported runs. Select two completed runs and verify highlighted building and road deltas against stored metrics, including missing samples. |
| 5. Follow a Life | Population and social continuity provide separate identity foundations. | Authoritatively map a resident to World and House IDs and verify the same resident and time after navigation and reload. |
| 6. Universal Entity Inspector | Causal events and modeled entity IDs in the demo. | Add supported relationship projections and cross-view adapters, with evidence and explicit empty states. |
| 7. Living Newspaper | Persisted monthly city events. | Delivered for the fixed demo. Illustrated yearly editions link to exact recorded events and show an empty state before recording. |
| 8. Butterfly Effect Explorer | Economic fork domain adapters and recorded causal graph. | After branching and paired comparison, test a supported link intervention over time with matching streams, recorded differences and provenance. Add bridge creation only when the model supports that operation. |
| 9. City Heatmaps | Monthly CityState inventories and metrics. | Add supported entity-level metrics with units and missing-value legend, and verify color bins for a selected month. Avoid treating aggregate observations as building values. |
| 10. Saved Futures Gallery | Immutable experiments and causal run listing. | Add ownership-aware browsing, bookmarks and share links after access contracts exist. Verify open, replay, share permissions and fork behavior independently. |
| 11. Surprising Discovery Engine | Recorded monthly metrics and paired comparison data. | Delivered for completed monthly World recordings. Deterministic rules identify large changes, reversals and outliers with source observation links. |
| 12. Multiplayer Scenario Lab | No shared governance contract established for this design. | After authenticated forks and ownership, define roles and write conflicts. Verify concurrent proposals, voting and revocation with separate accounts. |

The broader guided journey depends on exact replay first, then authorized forks, then cross-run comparison and cross-app identity mapping. Verify reproducibility against independently stored digests before describing any recomputation as verified.

## Verified in this release

- The application server serves the Time Machine and both companion views. The browser journey records a run, scrubs the keyboard-accessible slider, jumps to a construction event, selects the added building, follows its recorded inputs, and restores the selection on reload without writing again. It exercises missing-checkpoint recovery and evidence links from the newspaper and discovery views.
- The focused Bun suite covers the city model, checkpoint replay, causal reads and persistence, fork infrastructure, paired comparison, and both companion views. Reproduce the browser journey with `bunx playwright test --config test/time-machine.browser.config.js`.
- Browser builds for all three entry points pass. The repository package defines no lint or typecheck script.

## Emergent civilizations implementation

The first release connects to the existing Playable Life entry from a selected Population resident. The next experiments use the saved Population contact and family records, the recorded monthly City demo, and the Riverside commute ensemble. These sources have separate clocks and identities.

| Slice | Acceptance |
| --- | --- |
| Playable Life | Restore a saved resident, submit validated commands for one modeled day, and open the saved 30-day follow-up and its checkpoint links. |
| Idea diffusion | Replay retained contacts from a saved Population run with a reproducible seed and expose the evidence behind modeled adoption. |
| Generational families | Read saved Population checkpoints, show recorded kinship, and reopen the exact checkpoint for a selected family member. |
| Rashomon | Compare four perspectives of one recorded City event, with modeled outcomes and interpretations labeled separately. |
| Archaeology | Trace selected City entities across exact stored months and link construction clues to recorded causal evidence. |
| Planner experiment | Compare a declared simplified forecast with 100 matched Riverside City pairs and reopen a comparable pair. |
| Reality Debugger | Audit exact City checkpoints and distinguish integrity failures from modeled scarcity. |
| Future Search | Search completed City runs for exact rent and district-link travel changes, with unavailable measurements excluded. |

The new views read existing sources or run local synthetic experiments. They do not alter saved simulation runs or equate residents across the Population and monthly City models. The remaining emerging-civilization roadmap items require further slices.

## Civilization laboratory implementation

Start with the monthly City engine as the shared authority for the Atlas and World Genome. Scale documented City inputs, hold seeds and horizons fixed when comparing recipes, and identify the outputs as synthetic City model results. Open sampled futures with a versioned recipe and expose the run parameters and model version.

| Slice | Acceptance |
| --- | --- |
| Tipping Point Atlas | Run a bounded grid over construction capacity and population growth, compare the same seeds at each cell, and reopen one selected future. |
| World Genome and Scenario Cookbook | Generate matched City futures from explicit land, energy, transport, construction and population assumptions. Combine supported City shocks in a reproducible recipe. |
| Assumption Jenga | Remove one selected change at a time, hold the other assumptions fixed, and show which measured City outputs move. |
| Feedback Loop Laboratory | Scrub monthly matched outcomes and inspect the housing, development and household growth rules. |
| Constraint Detective | Classify explicit recorded constraints and link each row to its event and checkpoint. |
| Policy Impact Receipt | Show proposal cost, implementation stages, commute outcome coverage and an exact replay link for the selected pair. |

Additional transfer, economic, environmental and uncertainty work depends on shared cross-model identities, resource contracts, and compatible evidence.

## City invention release

Use one versioned City plan contract across search, merge, replay and breakpoints. A plan records the seed, horizon, model version and explicit catalog policies. The Riverside fixture starts in month 2. Compare plans from that same checkpoint and compute commute from recorded simulated trips, with the trip count shown alongside the mean.

| Slice | Acceptance |
| --- | --- |
| Reverse Simulator | Generate compatible affordable proposals, rerun each with the same seed, report the measured frontier and disclose the tested search bounds. |
| Worldline Merge Studio | Reject mismatched starts or competing policy choices, merge compatible inputs, and rerun the baseline, both sources and the combined plan. |
| Reality Breakpoints | Stop advancing at the first supported metric match, show that month’s inputs and system events, and open its exact replay. |
| City Plan Replay | Recompute a supported recipe, inspect monthly policy stages and district outcomes, and hand the same recipe to the other tools. |

The first release runs synthetic local scenarios. The catalog covers transit, public housing and upzoning. The existing City model has no road expansion policy, and the receipt covers proposed cost and the measured commute sample.

### Local verification

- The homepage serves the deck.gl Houston map through its existing preview carousel. The standalone map reads the cached OpenStreetMap geometry, labels illustrative elevations, and handles an unavailable library.
- The focused browser configuration runs with in-memory World persistence. Nine journeys passed, including the search-to-merge-to-breakpoint round trip, the Atlas and Genome recipe replays, both map states, and the saved Playable Life follow-up. Run `bunx playwright test --config test/civilization.browser.config.js`.
- The extended Atlas benchmark completed 2,023 simulations across 289 cells with a 12-month horizon and 30 starting households. The full Reverse Simulator benchmark evaluated all 2,556 compatible bundles for seed 2911, a 12-month horizon, a 25% commute reduction target, and a proposed budget of 200 million modeled USD.
- The focused Bun suite passed 49 tests across 18 files. The separate Population worker checkpoint continuation test timed out at its 30-second limit. The browser Playable Life checkpoint and follow-up journey passed.

## Hidden Systems release

Run the existing monthly City engine from a shared synthetic housing shortage. Compare baseline staffing and materials with an edited capacity plan over up to 60 months. Project identity and the selected household stay in this model across views.

- Queue City measures permit submissions, grants, and outstanding projects from the engine. Construction uses the same project transitions and capacity ledger. Verify that arrivals, departures, and queue stocks reconcile for every simulated month.
- Construction Theater renders the model's recorded progress and completion of the selected project in schematic 3D. Its timeline, stage events, and occupancy all refer to the same monthly snapshot.
- The household panel follows housing, rent, commute observations, and savings in the two same-seed futures. The demo should show the effect of relieving the initial materials constraint.
- Keep seed, capacity assumptions, model version, and month in the replay link. The demo uses local synthetic scenarios and makes no changes to saved World runs.

## Learning Civilization release

Use the versioned Riverside City model for a local observatory, vote, and prediction round. Players collect incomplete district evidence under a sensor budget, select a proposal under a separate capital budget, and submit a scored prediction before revealing the adjusted future.

- Observatory readings carry the measurement month, district identity, type, unit, and declared measurement resolution. Unmeasured quantities remain unavailable.
- The assembly uses published fictional rules and evidence available to the selected sensors. A player vote and modeled resident votes decide whether an affordable proposal proceeds.
- Store observations, locked predictions, and outcomes separately in browser storage. Resolve a prediction only against the approved seed, horizon, and policy set. Keep a bounded score history across rounds and link the result to exact City plan replay.
- Verify the round from sensor placement through the vote and score, including reload before and after the reveal. Shared accounts, multiplayer voting, and unsupported City measurements remain follow-on work.

## Sculpt a Storm release

The first crisis scenario uses a versioned synthetic neighborhood and closed-boundary heightfield. Match rainfall and starting terrain across branches. Keep simulated depth, infrastructure exposure, and access consequences as separately declared model steps.

- Use a CPU reference and WebGPU compute for rainfall, drainage, and local transfer. Verify conservation, finite depths, and bounded CPU/GPU parity.
- Let visitors place drainage, add detention, and raise a modeled road cell. Show depth on a 3D terrain timeline and keep a keyboard-accessible view when graphics are unavailable.
- Derive road closures, building inundation, and depot access from declared rules. Compare matching storms across 100 seeded rainfall intensities and record the assumptions with each result.
- Save local scenario branches and encode a versioned replay link. This release uses synthetic geometry and illustrative costs. Regional treaties, emergency staffing, and validated site hydrology require further slices.

### Local verification of the three releases

- Hidden Systems queue flows reconciled in both 60-month futures. The demo family entered a completed building at month 28 with baseline capacity and month 16 with the adjusted capacity. The browser test reopened the exact edited project and month.
- Learning Civilization passed its browser round from incomplete evidence through approval, a locked prediction, scoring, and exact replay. Reloads preserved the lock and result. Five district metrics are supported, and observations, votes, predictions, and scores are local to this browser.
- The Low Crossing demo went from one closed road link to zero and from five flood-exposed buildings to four. The matched 100-storm ensemble, saved branch, and downloadable versioned event record passed browser checks. CPU and Chrome WebGPU depth frames matched in three solver parity cases.
- The combined focused Bun suite passed 36 tests. Chrome passed the 11 existing and new City journeys plus two storm-specific journeys, including the active WebGPU path and forced CPU fallback. Run the browser checks with `bunx playwright test --config test/civilization.browser.config.js`.

## Storm recovery and mutual aid

Continue the same storm branch at its final exposure snapshot. Compare a passive control with an ordered repair and shelter plan. Route access controls where crews can work and which households can reach shelter. Model mutual aid as a budgeted agreement with a neighboring municipality, and keep the borrowed crews and payment in the same response ledger. Record simulated shifts and replay the exact scenario and dispatch order.

The recovery demo can reopen the Depot Spur, restore the Riverside Clinic, and shelter 12 households. One borrowed crew allows shelter dispatch to start in parallel with road clearance. All 14 storm model tests and the three Chrome storm journeys passed, including exact response-shift replay.

## Interconnected lives release

Timeline Braids reads saved Living World descendants and verifies population continuity before comparing one resident. The first view supports up to ten saved branches. Draw actual checkpoint edges and report the first difference only across samples from the same modeled minute. Link each visible point to its exact saved World checkpoint and supported House entry.

Civilization Zoom uses a single saved model and clock for drill-down and supported replay links. Collective Mind is a separate seeded lightweight agent model. Verify its deterministic updates and label the rules and visualization backend.

The Connected Lives hub is linked from the homepage. Timeline Braids preserves the selected saved checkpoint in its URL and opens that resident in Civilization Zoom or Playable Life. Zoom keeps one checkpoint through six in-page levels, including residents with unrecorded building anchors. Collective Mind runs 1,000 deterministic agents for 60 rounds and replays a selected round from a versioned URL. JavaScript advances the agents and WebGPU or Canvas renders their network.

Seven focused Bun tests and three Chrome journeys passed. The browser checks used real sibling saves in isolated World storage, verified the Braids-to-Zoom handoff, and exercised both Collective Mind renderers.

### November 10 release integration and UI sprint

- The guided saved Population future connects Worldline, 3D World, and House Simulator through an immutable World experiment and an explicit resident-to-household lookup inside its checkpoint. Scrubbing uses saved lineage points. The rain comparison restores two copies and advances each by one fixed step. The edited checkpoint records the parent and comparison evidence.
- The Decision Studio handoff depends on a model-owned mapping for versioned entities and time. Keep monthly City causal records and Population checkpoints separate until that mapping exists and is tested.
- The sprint report records the six UI entry points and their exercised interactions. The release audit and checklist record broader failures, storage compatibility, backup rehearsal, and deployment gates.

## Release integration and verification

- [x] Surface the guided saved future from the homepage and Universe shortcuts. Worldline, 3D World and House use the same saved Population checkpoint and resident. The saved synthetic footprint renders through WebGL2 when WebGPU is unavailable.
- [x] Verify a repeatable one-step rain fork, its saved parent lineage, the unchanged parent checksum, the saved timeline after refresh, and missing or invalid checkpoint errors.
- [x] Add release health, readiness and database preflight checks. Rehearse the read-only deployment smoke on file-backed local storage.
- [ ] Establish a versioned mapping from Decision Studio housing runs into Population before enabling an authoritative handoff.
- [ ] Reconcile the broad suite failures and unrun browser tests. Confirm the exact candidate image, restore a verified production backup on staging, and rehearse rollback before an authorized deployment.

See [the release audit](release-audit.md) for verification results and [the release checklist](release-checklist.md) for local URLs and Fly operations.

## Future Machine — November 11 integrated slice

Implemented and locally verified: monthly City authority, one persisted baseline/plan experiment with matching seed, model and original state; 120 steps and Month 0/120. Frozen interfaces: `world/future-machine/INTERFACES.md`. Six isolated feature chats own data, diff, scene, UI, story, share; integration owns composition, route, durability configuration and acceptance.

Acceptance gates: fork/run/scrub/blink/inspect/share through `/world/future-machine.html`; deterministic zero and nonzero comparisons, missing snapshots, refresh and invalid recipe handling; attributed synthetic layout without inferred real geometry; disposable bounded scene/history resources; measured browser journey and local export/restart durability. Production volume attachment, backup operations and deployment remain explicit release gates. Do not deploy.

Risks: replay recomputes detailed states (must label); full 121-state histories can grow; model construction can correctly record no completed physical change. Observe actual results before selecting demo narration. Cross-model resident identity and causal attribution are unsupported.


Completed acceptance: all six feature commits integrated on `codex/future-machine-integration` in `/Users/wahabma/happybearlandia`. `HBL_FM_BROWSER=1 bun test test/future-machine-*.test.js test/city-systems.test.js test/project-unblock.test.js test/server-civic-api.test.js test/reality-share.test.js` passed 74 tests / 442 assertions, no skips. Final Chromium run passed all six checks in 57.4 seconds, including the 40-second tour; final camera-unlocated disclosure also passed a focused journey rerun. No lint/typecheck scripts exist. Diff checks passed.

Verified behavior: common immutable Month 0, both Month 120 endpoints, deterministic zero/nonzero differences, 24 completed additional homes, 1,000,000 modeled USD cumulative capital spending, synchronized split/blink/ghost view, director and exact-ID household/event inspection, share/refresh, explicit absent saved-record recomputation, mismatch/missing-replay errors, 390px layout, no-WebGL fallback, upper-limit recipe, navigation and disposal. Director deduplicates repeated policy differences and prioritizes recorded physical additions. The base fixture required a declared versioned demo assumption: utilities 200 per district/network, no private parcel capacity and zero annual growth.

Default saved-pair replay reached ready in approximately 0.65 seconds locally; upper limit 120 households approximately 2.0–2.1 seconds. Serialized histories measured 17.1 MB / 50.9 MB respectively; default replay transfer is about 18.3 MB. Eight scene objects at Month 120; repeated scrub stays within ten and disposal clears them. These are Chromium/local measurements, not public-network or device guarantees. Final artifacts: `/private/tmp/future-machine-final-20261111` (2036 screenshot, thumbnail, evidence JSON and silent 43.96-second WebM). Normal entry remains `/world/future-machine.html`; isolated server is running on port 39885.

Durability evidence: local server restart preserved the completed pair and replayed 120 steps ending Month 120; isolated SQLite tests passed export integrity and restored City/share backups. `fly.toml` now declares durable City/share paths, with no deployment performed. Hosted volume/free-space/migration, off-host backup/restore rehearsal, public capacity/access controls and hardware/network validation remain release blockers. Replay remains labeled manifest recomputation; no independent checkpoint or unsupported causal/cross-model identity claim is made.

Commit lineage: data `039a657`, diff `6d3c37f`, scene `c5dd746`, UI `6520c0e`, story `e2751b1`, share `77b7993`; composition/tests `a3191f9`. Full worker SHAs, files, artifacts and limits: [Future Machine handoff](future-machine.md). No PR published; no additional chats/agents or outbound chat communications.

## World visual pass (2026-11-11)

Implemented and verified from 6c3330f with seven explicitly requested Codex chats and strict file ownership. The proposed PR10 commit is absent locally; first-run guide files are absent. Build an equivalent integrated slice on current entry points, retaining finished Future Machine. The shared response is available as pasted text; its linked 316-line download is unavailable and has not been read.

Next slice: Open World → quick demo → focus a real resident and label current observation → fresh matched legacy week → measured results → inspect → replay. Dependencies and exports are frozen in world/onboarding/VISUAL-PASS-INTERFACES.md. Independent UI/controller/feedback/camera/browser/accessibility work integrates through render.js only. Acceptance: real worker computation, stale cancellation isolation, error recovery, one responsive sheet, keyboard/touch/reduced-motion/WebGL fallback, preserved civic tour/ten-year/Future Machine, viewport screenshots and honest startup/computation/reveal/total timing. Risks: real computation may exceed 10–15 seconds; model clocks/identities remain distinct; unavailable prerequisite must not lead to fabricated mappings or results.

Visual pass integration status: delivered the end-to-end slice with a dedicated cancellable legacy paired worker, frozen local Balanced recipe, current resident observations, actual result overlays, inspect/replay and error retry. WebGPU-only startup was found in the checkout and now falls back to WebGL2. Guide, inspector/results/activity/Population sheets use one manager; legacy docks are suppressed during managed sheets; secondary actions fold into More city actions. No Population/monthly City identity mapping or construction effects were added.

Acceptance evidence so far: 88 Bun tests pass, one browser-gated test skipped; 20 ten-year/longitudinal tests pass plus the external temporary-database three-package regression passed on targeted rerun. Future Machine full journey and WebGL fallback pass (2 browser tests). Touch dismissal/reopening and full civic tour with unavailable remote synthesis pass (2 browser tests). Real worker error/retry and score-identical replay pass. Five viewport screenshots and measured timings are in /tmp/hbl-world-visual-pass. Desktop 80 residents: 2.178 s scene readiness, 81 ms observation after Play, 1.268 s to first worker progress, 5.494 s remaining compute, 5 ms reveal, 6.769 s total after Play. Larger population pacing remains under verification; no default-2,000 speed claim. Final evidence and limitations are recorded in docs/world-visual-pass-report.md. No commit was created by integration; shared HEAD advanced externally to 7537cc1 during work.

Final acceptance: combined viewport/failure suite 10 browser tests passed; post-review quick-result ownership/error/replay, full civic tour, and 500-resident pacing suite 3 passed; Future Machine integration/fallback 2 passed; separate touch/full-tour suite 2 passed. Final focused modules 30 passed. At 500 residents actual after-Play time was 26.705 s (78 ms initial resident feedback), exceeding the 10–15 s target while reporting real progress. Default 2,000 timing, physical phones, Safari and actual WebGPU hardware remain unverified. Keep future optimization focused on worker computation rather than captions. The completed slice and evidence live in docs/world-visual-pass-report.md; no deployment or PR was performed.

Final 320px post-layout smoke passed: actual completed comparison, visible measured result, resident inspection, Escape focus return to Start here, reopening and actual replay. Screenshot visually inspected; final diff whitespace check passed. Review locally on port 39910. Next recommended slice is one authority-scoped resident commute mission with matched travel/budget consequences; it is not implemented in this pass.

## One City, Two Futures flagship sprint

### SHE-20 current-checkout acceptance audit — November 12, 2026

The Linear issue still reports Todo and references missing skeleton modules, but
the clean `mini/SHE-20` checkout at `b963dd353538294cb0fbf5d34d5283fad6e10e68`
already contains the integrated slice below. Preserve that implementation rather
than redispatching its completed workers. This audit owns documentation only;
no integration ref, shared interface, runtime or release configuration changed.

Fresh verification: `bun test test/future-machine-*.test.js
test/two-futures-*.test.js test/paired-future-comparison.test.js` passed 109 tests,
with 3 browser-only skips, 0 failures and 984 assertions across 19 files.
Actual engine/API tests verified common initial state, deterministic replay,
zero control, missing-data/error handling, exact recorded WHY relationships,
reverse scrubbing, and Month 16 construction of one building containing 24 homes.
`git diff --check` passed. No package lint/typecheck commands are defined.

Fresh browser acceptance remains blocked: the recording-enabled canonical
Playwright suite could not start its isolated server on ports 39973 or 41827.
Bun reported EADDRINUSE; an independent Python loopback bind to port 0 returned
`PermissionError: [Errno 1] Operation not permitted`, confirming this session
cannot open a listener. No browser test or new recording completed. Existing
`/tmp/hbl-two-futures-delivery/` screenshots, JSON, WebM and MP4 are present but
are historical evidence, not a fresh current-head browser pass. Next action:
rerun the evidence report's canonical recording-enabled suite in a host session
that permits local listeners, then reconcile issue completion against that
result. Main merge, Fly deployment and production database changes still
require user approval; none was performed during this audit.

The next integrated slice is delivered on `sprint/one-city-two-futures-20261111`: homepage Play Demo → immutable matched Month 0 → recorded monthly divergence → first physical building at Month 16 → measured KPIs → exact project/policy completion receipt → pause/resume/manual exploration/share/replay. Six isolated Codex worker worktrees plus the coordinator supplied the slice; current ownership and commits are in `docs/one-city-two-futures-workers.json`.

Acceptance: seed 42, model `city-systems.1.0.0`, 30 starting households, exactly 120 steps per arm. At Month 16 and 120, homes are 36 without versus 60 with the housing plan; cumulative capital spending differs by 1,000,000 illustrative USD. One three-floor structure contains the 24 units. Both scene halves use one camera and time; no geographic parcel or cross-model resident mapping is invented. Mean unit rent is labeled as including new inventory, not incumbent savings. Physical structure selection and KPI WHY show event `16-0`, recorded project and policy, selected month, model, seed and run; missing causal edges remain explicit.

Status: homepage/default cinematic demo, split/difference/blink, camera fit over the full history, real unit-count labels, three measured cards, historical WHY receipts, recipe refresh and zero-control paths implemented. Graphical Canvas2D now works in the comparison and ordinary World; metadata definitions load before GPU startup, and renderer initialization is bounded. Activity, numeric mood/authority seed, disabled explanations, Reality nonpassing-vs-error wording, mobile panel handling, and registry-derived gallery/connected counts are repaired. Original 29 catalog entries plus existing Houston Map and flagship are explicitly retained as 31 unique registered experiences; no bar-scene stretch feature was added.

Verification: 140 focused tests plus 35 adjacent tests passed, one browser-gated skip; existing comparison browser suite 5 passed; expanded integrated suite 9 passed, with before/after images, actual API metrics and a 55.760-second playable recording. Additional bounded-GPU-failure and exact recording-command checks are recorded in the live sprint status. Two native browser-entry bundles and whitespace checks passed. Scope is frozen for final verification/reporting; no release merge, PR creation, push, deployment or production mutation performed. A later GitHub audit found PR11/12 externally merged; stale handoff statuses are not treated as current facts.

Full acceptance mapping, scenario measurements, commands, artifacts, limits and follow-on release gates: [sprint evidence report](one-city-two-futures-sprint.md). Current review route: `http://localhost:39960/world/future-machine.html`. Safari, Firefox, physical phones and actual WebGPU hardware remain unverified. The separate World–Worldline cross-model housing roadmap remains pending; this slice intentionally retains monthly City authority.

### Approved D01–D05 follow-up (2026-11-11)

Continue the functioning flagship. Coordinator owns director/shared camera integration; existing isolated workers own recorded charts, construction progress and evidence-chain modules under the contracts in demo-backlog.md. R04/R10 prerequisites verified before polish. D01 six-second actual first-divergence hold is implemented: clock2tests/13assertions and actual native timed browser normal/reducedmotion2passed32s. Screenshot/evidence `/tmp/hbl-cinematic-hold-proof/`. Mobile native framing and Activity authority-seed export are active observed regressions; new modules pending integration. Main divergence50/26 requires overlap review before any release proposal. No release merge/deployment.

D01–D05 accepted follow-up: integrated code `1b19358`, compact delta `52f565d`, exactconstruction proof `53ae405`, WHY jump/reverse0 regression `a2db60a`, mobileFPS `13a554d`. Actual recordeddelta1browserpass, construction2pass, trail1pass; responsive/native and test caveats in status/manifest. Named native recording59.5s test passed,56.84s playable video. Stale inspector corrected; Activity exportedseedverified. Main branch preservation risks audited without merge. Next verification is U09 visible recomputationdisclosure; no new feature scope.

## Bounded local Codex pipeline

In progress: build a dependency-aware, persisted dispatcher for approved `demo-backlog.md` tasks. Acceptance: atomic repository-wide claims, three-worker default with exclusive file/interface reservations, sandboxed workers/checks, commit/evidence gates, serialized local integration, deadline/freeze, interruption recovery, dry-run and focused scheduler/lifecycle tests. Backlog remains authoritative; explicit execution metadata supplies ownership and commands without adding product scope. Existing external assignments are not adopted automatically. No push, deployment, main merge or production writes. Risk: nested OS sandbox or unavailable CLI authentication can block the live demonstration; report actual execution only.

Delivered: `scripts/demo-pipeline.mjs`, reviewed U10 execution metadata, operational README, Markdown/JSON status and lifecycle tests. Actual checks: dispatcher 11 passed / 53 assertions; existing story/data regression 14 passed / 82 assertions; dry-run selected only U10; conflict fixture selected one of two overlapping tasks without launching workers. Real temporary Git tests verified isolated commits, ordered integration, one repair retry, preserved branches and interrupted-lease recovery. No browser behavior changed; Playwright skipped. Local live sandbox probe exited 71 (`sandbox-exec: sandbox_apply: Operation not permitted`); shared Git directory writes are also outside this chat's sandbox. Consequently no live coding worker or full sprint was launched, and no two-hour execution is claimed. Next: run from a host with working Codex OS sandbox and Git worktree write permission using the README's exact 120-minute command. Other approved objectives require explicit file/interface ownership and reviewed check argv before dispatch; narrative-only assignments remain blocked rather than silently approved.

## Engineering pipeline working slice

Audit found manual chat assignments, historicalstatus contradictions and a separately implemented CLIrunner whose native sandboxpreflight is unavailable on thishost. Reused dispatcher95b63be; added interactiveCodexbridge d99e112 with repository-wideatomicclaims, exactfile/interfacemutexes, capacitythree, >2verificationbackpressure, immutablehandoff, independentcandidate/integratedtests and retainedREPAIRstate. Pipeline tests17pass/76assertions. ActualapprovedU10 dispatched tooneisolatedinternalworker, reviewed and integrated779c360; both phases12pass/89assertions usingrealCityseed42. No browserbehaviorchanged, so no new visualclaim or unnecessaryPlaywright. Existingflagshipproof remains in demo-evidence-manifest.json. Current pipeline report: engineering-pipeline-status.md. Eight further approvedreliabilityscopes plus boundedrepairautomation are planned; NBcandidate remains separately queued, notclaimedintegrated. No mainmerge/deployment.

Pipeline acceptance follow-up: existingexternalNBcandidates are now in verificationqueue and count towardbackpressure; real thirdpendingcontribution blockednewdispatch. U16 nexttask independentlyintegratedbb277fd, candidate15pass/200assertions thenintegrated15pass/200assertions. Actual12artifacthashes and modelmetrics reproduced. EightREADYtaskpool maintained; twoNBcandidates remainunverified. No browser-facing sourcechanges in pipelineincrement. Runtime is on-demand internalCodex, not a falselyclaimed daemon or workingexternalCLI sandbox. Final evidence engineering-pipeline-evidence.json.


### Continuous coordinator audit — November 11, baseline 1de9fd8

Current worktree is clean detached source matching the requested sprint tip; do not change the branch checked out in another worktree. R01/R04/R06/R11/R12 already delivered: resume reliability queue rather than duplicate implementation. Next isolated dispatch contracts: [coordinator-next-dispatch.json](coordinator-next-dispatch.json). R13 catalog preservation precedes release reconciliation; R14 verifies optional-loading failures; R15 adds bounded repair. Eight READY scopes, zero confirmed running original sprint workers, two external NB candidates in REVIEW. Keep NB source changes outside the frozen flagship reliability increment.

Acceptance for this audit: rerun deterministic/boundary and pipeline tests, canonical actual-browser journeys, responsive 390/320 checks, native Metal pixel proof, named recording and artifact validation. Record exact results and current source hashes in coordinator-audit-20261111.md and coordinator-audit-evidence.json. No release merge or deployment. Existing historical evidence remains separately identified.


### Reliability queue resumed — R13/R14/R15

All three tasks acquired actual repository-wide claims at baseline1de9fd8 in separate managed worktrees. Existing catalog/first-run chat owns R13, existing browser-proof chat owns R14, coordinator isolated agent owns R15. Dependencies R11, R04/R09 and U10 already verified. Exclusive paths remain scripts/pipeline/tasks.json scopes; shared runtime source remains coordinator-owned. Acceptance: R13 names concrete main preservation failures without runtime edits; R14 injects actual optional-loading failures and records browser outcome; R15 permits one explicit owned repair after failed verification, preserves failed evidence, rejects third total attempt/racing resume. Failed integrated checks must require explicit reconciliation. Candidate and integrated checks required before VERIFIED. No browser rerun for pipeline-only changes; R14 requires actual normal-route browser proof. No main/release merge or deployment.


R15 accepted atd548153: candidate/integrated12pass each, combined37pass. R13/R14 independently failed and remain retained repair candidates; no production changes from them entered the sprint. R13 needs bounded catalog/directory/atlas preservation. R14 acceptance must distinguish optional metadata failure from missing required simulation module; preserve useful independent disclosure during renderer import failure without pretending an unavailable simulation can run. Exact evidence and timing: coordinator-resume-evidence.json. Next compatible U01 continuation requested after verification drain, subject to normal durable ownership/capacity.


Observed follow-up U18: actual U01 screenshots expose stale native label spans above the Canvas fallback, despite the old canvas being removed. Next bounded slice clears the native overlay at fallback transition and adds a live-loss regression assertion. Acceptance requires real native/WebGL loss with one Canvas, no retained native labels, identical recorded month/seed/KPIs, working WHY/scrub and screenshot inspection. Own scene/index.js and existing device-loss browser test only. Shared City data is unchanged.


U02 actual resize proof exposed Canvas ID-label right overflow and44px footer overlap at390/320 after focus. Native resize passes and both preserve actual frame/seed/metrics. Authorize one bounded repair by the current U02 owner in canvas-stage.js only, plus existing assigned test/config. Preserve first candidatee30a1c0 and independent failing gate under the same claim; record scope reconciliation under shared lock before owner repair resume. Require text bounds within arm/abovefooter and unchanged recorded state across desktop→390→320→desktop.


Final verification at1d0a488: clean combined139unitpass/3browser-gatedskips/1199assertions after correcting stale hardcoded dispatcher batch expectation. Native2pass, responsive3pass, share/missing/corrupt/boundary5pass, namednative recordingpass (actualPlay→complete54.289s), artifactverifier2records/1video. Concurrent canonical sweep12pass/1recordingskip/1hold-testfailure: full-history/screenshot capture consumed the unpaused hold, then Pause observedmonth77. Retain trace; move Pause before heavy artifact IO after observing the actual hold, then rerun focused and canonical checks. This test correction preserves clock assertions and does not change demo timing. U02 mobilelabelrepair still pending; earlier recordings are pre-U02-repair source evidence.


Accepted working increment complete at application2c9d973: U18 and bounded U02 visible repairs verified in candidate/integrated browser paths, R15 repair infrastructure exercised on actual failed U02. Final combined139units/3skips, canonical13browsers/1recordingskip, responsive3, actualdevice-loss2 and namedrecordingpass52.868sPlay→completion; exact evidence in coordinator-final-status.md/coordinator-final-evidence.json. R13/R14 diagnostic failures remain unintegrated and block release readiness. U03 claimed and released for uncontented resource measurements; U05/U08 READY. No release/main merge/deployment. Scope reconciliation for U02 was committed before owner resume and applied under shared lock before worker edits; original failed SHA/base/attempt1 retained.

## Local Symphony pilot repair (2026-11-11)

Slice: opt-in Linear issue -> independent clone -> required tests -> GitHub draft
PR against `sprint/one-city-two-futures-20261111` -> human review. One worker.
Prerequisites: authenticated Codex/Linear/GitHub, reachable sprint branch, one
operator-audited symphony-pilot issue with completed blockers and explicit file
and interface ownership. Existing shared worktrees are preserved, not migrated.

Tasks: back up workflow/hook; configure a separate clone root and per-attempt
isolation check; enable existing label filter; gate initial and retry dispatch on
resolved dependencies; supply real missing-skill procedures; require validated
draft PR before In Review; park blockers by removing the pilot label.

Acceptance: local Git fixture verifies isolated clone/fetch/merge/commit and
rejects shared metadata. Runner tests verify dependency and label eligibility.
Workflow rendering verifies blocker and draft-only instructions. Actual results
and pilot commands are recorded in tools/symphony/local/README.md.

Risks: independent full clones cost disk/time. Ownership and PR/Linear handoff
remain agent instructions, not server-enforced transactions. Required test,
media, credential and dependency failures remain blockers. No live pilot, remote
state changes, merge or deployment are authorized by this repair.

Read-only backlog evidence: SHE-81 is In Review without PR attachment and its
preserved workpad states implementation/ownership audit incomplete. SHE-170's
prose depends on HBL-1M-014 (SHE-141), but blockedBy is empty; SHE-141 is still
In Review. Structured dispatch gating cannot infer prose dependencies. Pilot
readiness requires explicit operator audit and ownership assignment, documented
in the local runbook. No tracker corrections or requeue were performed.

## Repository README and architecture illustrations (2026-11-11)

Updated the existing root `readme.md` with the flagship journey, local startup, actual
experience routes, code map, focused verification commands, and design/release
references. Added `docs/images/architecture-current.svg` and
`docs/images/architecture-target-2027-02.svg` as editable, accessible diagrams.
The February 11, 2027 architecture is a proposed three-month direction, not a
shipped integration or delivery commitment. It preserves independent model
state authorities and makes identity/time/metric mapping a prerequisite.

Preserved the earlier README sketches and references in `docs/original-readme-notes.md`.

Acceptance: local documentation links resolve; both SVGs parse and were rendered
in Chromium and visually inspected without clipping. README commands and routes
were checked against package scripts and existing module/entry documentation.
`git diff --check` passed. Documentation-only change; no application behavior,
deployment, or new end-to-end test run. Operational and cross-model goals remain
future work under their existing acceptance gates.


Status: local repair implemented and verified. Final build, format, specs/Credo,
coverage (301 tests, 0 failures, 6 opt-in live tests skipped; configured coverage
100%) and Dialyzer (0 errors) passed. Offline Git fixture and installed Codex
sandbox Git fixture passed, as did hook syntax and tracked diff whitespace checks.
No browser test required for this orchestration-only change. Existing dependency
advisories were reported by Hex; dependencies were not upgraded. The live pilot,
remote auth/media/PR integration, backlog ownership approval and SHE-81 recovery
remain intentionally unexecuted. No commit/PR reference: no staging, commit or
remote writes performed. See the local runbook for the exact authored manifest.


## Symphony trusted host GitHub publication repair (2026-11-11)

Implemented the smallest local-commit-to-draft-PR slice in
`tools/symphony/local/publish.py`, invoked through the existing host after_run
hook. Prerequisites are host gh Keychain authentication, host Linear access,
one approved SHE issue with a persistent workpad, and an independent clone.
Codex retains workspace-write; GitHub token environment inheritance is removed
and standard plaintext credential files fail preflight. Existing workspaces
and symphony-pilot dispatch filtering are preserved.

Acceptance: exact issue/path/branch/base/repository/SHA validation; clean index
and worktree; current sprint-base ancestry; explicit non-force issue-ref push;
verified open draft PR; persistent workpad link; parked successful dispatch;
host lock and idempotent reconciliation across push/create/link retries. No
agent-side GitHub auth, merge, deployment or real publication was performed.
The host never executes workspace Git hooks/configuration during publication.

Verification: 13 offline publisher tests and the existing isolation fixture pass;
Python compilation, hook syntax and tracked whitespace checks pass. Live host
GitHub/Linear writes remain intentionally unexecuted. See local README for exact
pilot/retry instructions and credential storage assumptions. Full Symphony suite rerun: 301 tests, 0 failures, 6 opt-in live tests skipped.
The initial run found a fixed workflow wording assertion and a retry-timing
failure that passed on rerun. No commit or PR created by this repair.


## Symphony host workpad bootstrap repair (2026-11-11)

Slice: trusted before_run creates/reuses the single workpad before Codex starts;
after_run consumes a bounded local JSON status/evidence update before trusted
GitHub publication. Reuse publisher transport and host lock, stable creation UUID,
complete comment pagination and in-place updates. Prerequisites: approved active
pilot issue, isolated clone and host-only Linear key. Preserve never approval,
workspace sandbox, label filtering and publisher validation. No agents or remote
mutations authorized during repair.

Acceptance: new/existing/ambiguous comments avoid duplicate creates; multiple
workpads fail closed; transport retries redact errors; failed updates retain the
request; blocked updates park dispatch and prevent publication. Local runbook
includes SHE-179 operator-only recovery. Risks: remote API/auth not exercised,
one dispatcher required, external comment writers require manual reconciliation.
Validation: offline local suite 21 tests passed, including seven new lifecycle
tests; isolation fixture passed; full Elixir suite 301 tests, 0 failures, six
opt-in live skips. Python compilation and diff whitespace checks passed. No browser change.
No commit, push, merge, deployment or remote tracker update performed.


## Persistent UUIDv4 host workpad identity (2026-11-11)

Repair scope: `tools/symphony/local/workpad.py` and the existing host Linear
transport in `publish.py`; preserve sandbox/workflow configuration, pilot
filtering, publisher validation and existing workspaces. Prerequisite is trusted
host-private state, not workspace-provided identity or configuration.

Acceptance: persist a single UUIDv4 per immutable issue ID atomically before
creation; re-read existing workpads before writes; serialize concurrent local
bootstraps; reconcile ambiguous responses and fail closed on duplicates or
invalid/interrupted state. Report sanitized HTTP/GraphQL validation failures
without credentials, headers or arbitrary remote body text. Test only offline
with mocked Linear and temporary private state; no live mutations or agents.

Implementation delivered and verified: `HBL_TEST_CODEX_SANDBOX=0
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/symphony/local
-p 'test_*.py' -v` passes **49 tests**. Includes UUID version and private modes,
actual fresh-Python-process identity reuse, concurrent bootstrap serialization,
interruption before/after atomic rename, duplicate and ambiguous-create
reconciliation, sanitized GraphQL validation/HTTP errors, existing publisher
contracts and offline isolated Git fixtures. Syntax and whitespace checks pass.
Browser checks skipped because no browser behavior changed. No live mutation,
agent launch, push, repository merge, deployment or workspace migration ran.

Remote eventual visibility and independent external
writers remain a service boundary: one trusted host receipt/lock prevents local
duplicate creates; multiple live workpads always require manual reconciliation.


## Continuous coordinator resumption (2026-11-11, ec408d0)

Audited original six assignments, actual worktrees and durable queue. Existing
R01/R04/R06/R11/R12 delivered; U03 is REVIEW, not historical RUNNING. Independent
candidate gates: Canvas lifecycle8pass, actual Canvas/WebGL/MetalGPU resources3pass;
current-source combined121pass/3skip/947assertions. No product edits or integration.
Next slice: integrate existing scoped U03 through normal candidate/integrated gates
once unrelated dirty checkout changes are reconciled by their owners; then claim
U05 KPI semantics test for the existing UI worker. Review depth3 and retained
R13/R14 reservations prevent new dispatch; do not steal assignments or expand
failed scopes implicitly. R13/R14 release failures retained, no release approval.
Acceptance, owned paths, prerequisites and actual evidence recorded in
coordinator-next-dispatch.json and coordinator-resumption-status.md. No worker,
remote mutation, push, merge or deployment performed. Browser results recorded
in the resumption evidence after completion; earlier recording stays historical.

Resumption final checks: current-source canonical13pass/1recordingskip,
responsive1440/390/320 threepass, saved-share/missing/corrupt/boundary fivepass;
zero failures. Hashed fresh artifacts and source-qualified U03 candidate proof
in coordinator-resumption-evidence.json. Integration remains held, not claimed.

## SHE-180 safe host backlog coordinator (implementation slice)

Build a separately invoked host coordinator: paginated read-only Linear/GitHub
inventory, conservative native/prose dependency and duplicate/ownership holds,
host-reviewed readiness evidence pinned to issue content/base SHA, durable
approval leases under one host lock, and opt-in additive pilot-label approval.
Default dry-run performs no remote mutations or lease writes. Cap three approval
leases initially; existing dispatcher remains concurrency one and unchanged.
Reuse local publish.py Linear transport/private-state conventions; do not reuse
legacy bulk intake or turn review labels into dispatch labels. SHE-126 workpad
confirms no delivered checklist; SHE-127 has no delivered report. Record this
reconciliation in the coordinator runbook rather than claiming those tasks done.

Acceptance: all project issues/connections/PR files paginated, missing evidence
holds; exact scope/tests/acceptance/base/operator review required; existing PRs
and active ownership block overlap; persist-before-write and reconcile ambiguous
label mutations; no running-task interruption/automatic expiry/reapproval;
restart/concurrency/retry and controlled three-issue offline pilot tests. Live
three-issue pilot remains unauthorized under the ticket's planning-only status.
Risks: prose cannot be proven semantically complete by regex, so require explicit
human dependency audit and map aliases; independently operated hosts/label writers
are outside flock. API snapshots cannot make multi-service reads transactional.
No workers, live approvals, push, merges or deployments during implementation.


## Symphony verified-throughput mission (2026-11-12 UTC)

Window: initial runtime audit approximately03:00 UTC through06:00 UTC. Restore
Linear → sandboxed Codex → trusted host publisher → draft sprint PR, then only
replenish independently verified eligible tasks. Never merge/deploy or modify
production data. Preserve frozen One City Two Futures interfaces and old clones.

Observed root cause: live PID35041 loads tools/symphony/elixir/WORKFLOW.md and
requires symphony-pilot, absent from all175 project issues. Applied concurrency1
by supported workflow reload and explicit single-issue approval; retain the
pilot gate rather than switch to separate PR20 dispatcher. Local49 offline
Python pipeline tests pass. Codex/GitHub Keychain auth and push permission pass.
Swap28.7GiB/29.7GiB prevents scaling until resource recovery is demonstrated.

First integrated slice: SHE27 isolated clone synchronized losslessly to f1174eb;
CI file ownership reserved; historical branch instruction explicitly reconciled
to symphony/SHE-27 for host publisher. Actual app-server sandbox verified
workspaceWrite/never. Commit be4c17c pushed by host; verified draft PR25 targets
sprint/one-city-two-futures-20261111, exact SHA matches host receipt.81 local
unit tests, YAML semantic comparison and diff check pass; all workflow commands
retained. Ubuntu24.04 Chromium install passed in real PR run43146084856; browser
suites still running. No claim of completed acceptance until remote checks read.

Prerequisites for next three-task batch: complete pilot check verification,
disjoint file ownership, no unresolved dependencies or duplicate implementation.
SHE79/SHE115 have clean committed implementations on existing local integration
branch b66a394; preserve rather than dispatch duplicates. SHE141 is a prospective
metric-contract owner pending historical claim reconciliation; SHE60/SHE61 are
prospective genuine operations/dependency audit tasks outside frozen app files.
No additional pilot labels applied. Full read-only eligibility report and live
worker/publication/resource evidence: tools/symphony/local/dispatch-report.md.

Risks: old review states lack linked PR attachments and require per-issue proof;
description-only blockers remain human audit; external CI/DNS/auth may block.
All incomplete work remains active/parked, not falsely moved to review or Done.

SHE-180 continuation: reuse the partial local coordinator and fixtures. Complete
immutable retained ownership, conservative release/retry reconciliation, complete
paginated inventory tests, private CLI audit/error output and the operator
evidence/runbook. Acceptance includes a repeatable offline three-issue pilot,
restart and concurrent-process tests and publisher/workpad regression coverage.
No change to live Symphony configuration, publisher or bootstrap; no live label
approvals or pilot launches. SHE-126 remains In Review with a workpad explicitly
reporting no implementation; SHE-127 remains Todo with no delivered comments or
attachments. Their existing contracts inform this implementation; neither ticket
is declared delivered or silently reassigned. Separate ops-branch artifacts must
be reconciled before enabling the host approval job.

## Release and backlog coordination — SHE-60 / SHE-61 / SHE-43 (2026-11-11)

Next end-to-end slice: three independently owned audit/procedure changes from
remote sprint f1174eb, each with targeted validation and a draft sprint PR. One
worker per issue; no live Symphony approval or concurrency change. SHE-60 owns
release-operations.md and new issue-specific dry-run tooling/evidence; SHE-61 owns
new dependency-browser-risk-audit report/tool/test/evidence; SHE-43 owns new
static-asset-caching-audit report/tool/test/local evidence. Coordinator owns this
plan and shared files. Existing U13/R01/R06/Worker6 browser/renderer and SHE-27
repair claims are retained; canonical suites, CI, server.js and release-checklist
are read-only to these workers. Open PR inventories and retained U03/R13/R14
pipeline reservations were checked and do not overlap the new paths.

Acceptance: actual Fly conventions and schema-safe recovery gates, reproducible
non-destructive procedure checks; dependency advisories separated from confirmed
exploitability and source-qualified browser evidence; measured localhost caching
inventory without unsupported immutable caching claims. GitHub environments are
empty and no approved HBL Fly staging target is established; SHE-43 staging
measurement remains blocked. No production commands/rollback/deploy or merge.
Implementation/status evidence: docs/release-backlog-coordination-20261111.md.


SHE-180 implementation status: local coordinator delivered in
`tools/symphony/local/backlog_coordinator.py`; operator runbook
`COORDINATOR.md`, disabled evidence template, README link and 31 focused tests.
Reuses host publisher Linear transport/private-state helpers. Keeps current
workflow byte-for-byte outside this implementation's scope: pilot gate,
concurrency1, never approval, workspace-write, workpad/bootstrap and publisher.
Native duplicate relations, archived issues, all connection pages, conservative
prose/alias audit, PR/source evidence, scope/interface mutexes and trusted review
freshness fail closed. Pending leases pin the complete review and survive API
ambiguity; released approval capacity retains file ownership for open drafts.
Two real coordinator processes sharing an offline service fixture prove three
claims/no duplicates, restart reconciliation and fourth-issue replenishment.

Actual final verification: 80 local Symphony tests passed, including 31 new
coordinator tests; CLI dry-run report path exercised with fake services; Python
AST parsing, disabled JSON parsing and tracked whitespace checks passed. Captured
source hashes were unchanged during the final suite. Concurrent local safety
edits were reviewed/preserved; a duplicate GraphQL argument and sanitized symlink
error mismatch were corrected before the passing final run. No browser test
required for this host-only change. Full Elixir suite was not rerun because no
Elixir/workflow source changed.

Remaining acceptance: controlled live three-issue pilot and remote schema/auth/
service-consistency proof require separate operator activation, per SHE-180's
explicit planning/implementation-only status and SHE-126/127 overlap gate. No
live approvals, scheduler installation, agent launches, tracker writes, push,
commit, merge or deployment. Source/base and clean-clone/test readiness use fresh
explicit human evidence; the coordinator does not claim to execute ticket tests
or semantically understand arbitrary prose. Exact checks/hashes and authored
paths: docs/she-180-coordinator-evidence.json. Next: operator reviews the disabled
runbook/config and authorizes the controlled live pilot only after overlap and
ownership reconciliation.

Verified implementation status: all three independently tested increments now
have draft sprint PRs: SHE-60 #27 (3727248), SHE-61 #28 (ec91298), SHE-43 #29
(ef70736). Latest source base f794ba2 incorporated losslessly after a freshness
guard; original implementation commits retained. Current-base combined checks:
34 pass/0 fail/1 existing skip/313 assertions; SHE-61 also2 Chromium passes,
SHE-43 has32 successful local GET/HEAD measurements. Exact scopes, individual
commands/results and pending hosted/staging gates are recorded in
release-backlog-coordination-20261111.md. No pilot labels or live dispatch;
SHE-43 remains blocked on approved staging acceptance, not marked In Review.

Final hosted verification passed on all three published heads (runs43148260243,
43148330528,43148403705). An external action subsequently marked the drafts ready
and merged #27/#28/#29 using adnanwahab; this task made no ready/merge call.
Do not claim they remain drafts awaiting review. External integration also marked
all three Done; SHE-43 was restored to In Progress because approved staging
HTTP/edge verification remains unmet. Full merge SHAs/timestamps and operator
actions are in release-backlog-coordination-20261111.md. No deployment, production
request, production-data mutation or source revert performed here.


### Symphony post-pilot batch03:37 UTC

Pilot PR25 is verified green(run43149012069) and separately merged into sprint
870c0ca; SHE27 Done. Explicit user-owned bounded World/browser repair preserves
exact saved navigation, Canvas/fatal fallbacks, all registry entries and frozen
model interfaces. Combined149unit/13release-browser checks pass; independent
ops additions17unit checks pass. Full remote checks pass.

Next integrated slices approved exactly SHE59/SHE141/SHE121, serial worker1:
100seed real City replay digest/mismatch harness (SHE9 canonical dependency
verified Done); executable six-count/evidence/rate contract with bounded measured
CPU fixture; honest merged-and-deployed-evidence-only Tools changelog, initially
empty because no deployed-version evidence is invented. Disjoint new paths and
acceptance recorded on issues; workers retain workpads/feature docs and leave
shared plan/CI/frozen interfaces to coordinator. Independent clean clones include
current merged baseline; no existing work discarded. Only SHE59 currently runs.

Live new-workpad bootstrap proves UUIDv4 and private0600/0700 host state. Next:
verify actual commits, draft sprint PRs, check outcomes and Linear links; then
replenish only audited unblocked ownership scopes. No main merge/deployment.

## Oversized host workpad retry-loop regression

Bounded repair: host workpad sync and offline tests only; no workflow, scheduler,
SHE-141 workspace/source/handoff or live publication edits. A valid status with
notes above40000chars currently remains pending, fails after_run, and then fails
before_run on every retry without removing dispatch approval.

Acceptance: preserve exact rejected JSON bytes durably in host-private state and
leave the original pending file/publisher request untouched; park only the pilot
label through the trusted host; append a bounded truthful rejection receipt while
preserving existing workpad history; return nonzero to prevent publisher handoff.
Both before/after phases must recover this case; retries reuse the same archive
and receipt. Archive/API failures must not claim success or lose input. Detect a
concurrent input replacement before parking. Test40000/40001 boundaries, original
42212-character regression, Unicode, retry, failures and normal successful updates.


## Symphony receipt-example subset recovery — November 11, 2026

Recovered SHE-89's six untracked receipt-example files on isolated local branch
`codex/merge-complete-symphony-20261111`, based on remote sprint `f1174eb9`.
The existing monthly City engine regenerates both pinned synthetic receipts.
Integrated receipt/data/diff/share checks: 25 tests passed, 218 assertions;
explicit fixture regeneration check passed. Browser behavior is unchanged.
SHE-179 documentation was already merged remotely as PR #24; incomplete and
untested workspace work was deferred. No source workspaces retired, remote
push, release/main merge or deployment. Details, source hashes and limitations:
[workspace recovery audit](symphony-workspace-integration-2026-11-11.md).

Linear-first follow-up: all 59 In Review issues were matched to workspace and
workpad evidence; none supplies an additional complete contribution to merge.
SHE-89 remains In Progress: the recovered existing Future Machine examples are
a useful tested subset, not completion of its canonical receipt/validator scope.
SHE-179 is already Done and merged. No tracker status or original workspace
was changed. Detailed issue-by-issue findings are in the workspace recovery audit.

## Unblock audited Symphony tasks — November 11, 2026

User authorized parallel unblocking after the Linear-first audit. Complete the
following small integrated slice before widening the 59-task review queue:

| Owner / slice | Prerequisites and acceptance | Status |
| --- | --- | --- |
| SHE-79 manifest load boundary | Preserve existing paired recipe/manifests; reject unsupported IDs, versions, missing seeds and invalid optional display names with actionable diagnostics before replay; valid saved fixtures load unchanged. Own data module and focused tests. | Locally integrated and independently verified |
| SHE-115 bounded worker lifecycle | Recover old WIP without changing its workspace; verify timeout, abort before/during work, cleanup/termination, single settlement and isolated successful work through current API. Own City worker helper/API and focused tests. | Locally integrated and independently verified |
| Shared operational blockers | Check actual current isolated-clone policy and manual procedures, run disposable real Git sandbox proof and offline host tests; preserve current dispatcher, workspaces and credentials. | Existing repair verified; no host changes required |
| Coordinator integration | Independently review commits, combine nonoverlapping slices on this local branch, run relevant regressions, retain source provenance and report exact remaining external gates. | 68 combined tests / 629 assertions and two browser checks passed |

Risks: the older receipt/validator chain remains a distinct contract decision;
SHE-79 is not a general receipt import implementation. Active host repair sources
are uncommitted in the primary checkout and will not be swept into this branch.
No task is marked Done or bulk relabeled based on stale workpad claims. No main
merge, deployment, production data change or unrestricted sandbox is authorized.

Delivered increment on local `codex/merge-complete-symphony-20261111`:
SHE-115 worker commit `060c26e` integrated as `8c40ed6`; SHE-79 worker commit
`01bf424` integrated as `81690ca`. The latter validates the existing completed
Future Machine manifest boundary, not a new server-wide scenario catalog.
Coordinator reviewed both diffs, ran the combined 68-test backend/data/receipt
suite (629 assertions) and two real normal-entry browser checks (7.7 seconds).
Valid seed-42 month-16 replay/WHY still shows +24 homes; deliberately malformed
display metadata produces a visible safe error before any replay request.

Operational verification: 49 offline host tests, 55 cached workspace/config
ExUnit tests, and one real OS-sandbox Git fixture passed. Fresh independent
clones contain their Git metadata and use the existing stable manual procedures.
Old linked workspaces remain preserved and are not automatically reusable.
SHE-79 and SHE-115 were moved from blocked-review handoffs to In Progress during
implementation; no ready/pilot dispatch labels or Done states were applied.
They await publication/review of this local branch. SHE-83/SHE-84 canonical
receipt work, other task-specific prerequisites, participant evidence and media
access remain separate scope. No bulk requeue, dispatcher restart, push, main
merge or deployment was performed.

## Publication gate for the unblock slice — November 11, 2026

User authorized publication/review for Symphony consumption. Published branch
`codex/merge-complete-symphony-20261111` as PR #26 against the sprint branch;
independent review found no actionable runtime issues (19 focused tests / 264
assertions). CI now runs the 68-test unblock regression and two normal-entry
browser checks and retains browser artifacts.

First hosted run `43146419857` passed existing unit contracts, all new unblock
regressions and Chromium installation, then failed three older release-browser
expectations: catalog count 29 versus registered 31, saved navigation inside
collapsed World controls, and an error expectation superseded by working Canvas
fallback. Required gates remain enabled. Targeted harness repairs preserve all
registered IDs and exact saved checkpoint/House/fork/replay assertions while
exercising the actual controls and renderer fallback. Full hosted verification
must pass before merge; current publication/merge status is authoritative at
https://github.com/adnanwahab/happybearlandia/pull/26.

## Symphony recovery prerequisite slice — November 11, 2026

Recovery mission: prove operational prerequisites before the first new dispatch.
Own new `ops/symphony/workspace_preflight.py` and its focused tests plus the
recovery note; preserve active peer ownership of installed hooks/coordinator and
throughput work. Acceptance: contained disposable clone, real sandbox local
commit, approved sprint fetch, locked dependencies/imports, sanitized auth/error
checks and cleanup. No label, merge, deployment or scheduler side effects.

Eleven focused regression tests and19 total ops tests pass, including shared metadata, alternates,
symlinks, disk, permission denial, secret sanitization, credential-file refusal
and timeout descendant cleanup. Initial real host probe passed all checks at
sprint870c0ca. Two further full clones hit180second timeouts; the copied-object
cache path passed all9 real checks against0d115ec in5.9seconds, including the
corrected credential guard, remote fetch and actual sandbox commit/imports.
Browser behavior is unchanged. Hook installation and continuous queue proof are
separate operational gates, not implied by preflight success. See
[recovery evidence and candidate ownership](symphony-recovery-preflight.md).


## SHE-180 safe backlog coordinator package and activation

Package the standalone coordinator and minimal extracted host adapter without
changing the existing Symphony workflow, sandbox, publisher or unrelated source.
Original installed-host80-test evidence is retained separately from the clean
package test run. Requirements/gaps for SHE-126/127 are explicitly mapped in
docs/symphony-coordinator-reconciliation.md; neither issue is marked Done.

Actual live read-only audit succeeded on175issues/17PRs. It found30reserved active
issues and incomplete ownership; no safe three-issue batch is approved by this
snapshot. Do not weaken these gates, bulk-reset statuses or infer stopped claims
from an idle dispatcher. User-authorized live pilot remains conditional on real
candidate readiness. Publish this working package as draft only; no merge/deploy.
Acceptance and exact test/audit evidence: docs/she-180-coordinator-evidence.json.

## Symphony throughput increment — 2026-11-11

Measured next slice: reduce PR30 coordinator's per-issue API fanout, run bounded
recurring reconciliation of explicitly reviewed tasks, persist redacted throughput
events/resource samples, and extend the installed Symphony dashboard with those
metrics. User authorized profiling, implementation, safe empirical experiments
and draft sprint PRs; no main merge/deploy/production-data changes. Preserve all
approval/ownership gates and original workspaces. No automatic backlog approval.

Baseline: live concurrency1, zero running/retrying, 10s poll; about28GiB swap and
35GiB free disk in two five-second resource samples. PR30 scan evidence recorded
877Linear reads for175issues. PRs27–29 were coordinator-delegated tasks, not
Symphony dispatches, so they cannot prove eligible-to-claim/reasoning latency.

Ownership: scan worker owns backlog_coordinator.py and its tests; scheduler worker
owns throughput_policy.py, throughput_scheduler.py and tests; metrics worker owns
throughput_metrics.py and tests. Coordinator owns shared interfaces, integration,
native dashboard overlay/install, live verification and report. All workers use
independent clones; no remote credentials or autonomous production actions.

Acceptance: unchanged fail-closed schema/pagination/ownership semantics; measured
complete scan reduction; restart-safe single-host leases and no duplicate grant;
resource pressure holds new grants without killing work; ranked fast/feature/
research lanes preserve trusted approvals; real loop records events and serves
real utilization in existing dashboard. Focused tests, full package integration
checks, native dashboard compile/tests and browser smoke before reviewable PR.

Risks: live unknown ownership and28GiB swap may block actual useful-ticket scaling.
Report that honestly; no claims of4/6/8/12 live capacity from synthetic tests. Keep
one active Symphony worker until accepted changes/worker-hour and resource health
justify gradual scaling. Rollback backs up installed files/config and retains
leases/events; do not destroy state or reset active workers.

Implemented increment: complete batched scan, durable weighted lanes, guarded
recurring scheduler, private SQLite events/resources and native dashboard overlay.
Live175-issue scan:18logicalLinearreads/24GitHubcommands/0GitHubretries/21.196s;
prior logical count877. No end-to-end throughput improvement claimed. Quality
rates without event history remain unavailable. Host cap restored1; additive
pressure-release filter holds dispatch. Read-only observer installed; no approvals
or workers launched. Test evidence and operational limits are in
`docs/symphony-throughput.md`; pressure config/test patch is reviewable alongside
the installer. Native formatter/lint/build/305tests(0failures,6skips)/100%coverage/
Dialyzer passed; installed-host164tests passed; package102tests passed; actual
Playwright dashboard smoke passed without page errors. Retain current approval
hold, review ownership individually, then measure nonduplicate useful tickets at
concurrency1 before considering4/6/8/12. Human review required before merging.


### Symphony mission external hold04:03 UTC

Verified original draft pipeline produced merged PR25/SHE27, PR32/SHE59 and
PR34/SHE141 with green hosted checks. Independent seed report106/106 zero
mismatches/source hashes match,5targeted tests pass; metric contract33tests pass.
SHE121 clean committed/host-validated (6unit/7browser checks) but unpublished;
normal handoff preserved. SHE126 clone ready, no implementation; its approval
parked. Existing user-assigned runtime owner retains pressure gate; do not
bypass extra symphony-pressure-release requirement or resume model workers.
Dashboard and APIs healthy, read-only observer running,0active/0retrying, worker
cap1. Whole backlog not complete; end-to-end sustained three-hour throughput
not established. Resume requires operator resource/readiness clearance and
current-base verification, then existing SHE121 publication and scoped SHE126/
newly unblocked CPU-oracle work. Full live evidence: tools/symphony/local/dispatch-report.md.

Oversize regression delivered as draft PR #37, commit0ecb464, from an existing
filtered clean checkout (no extra clone/worker). Standalone92tests, focused35 and
latest installed-host164passed; earlier external guard/assertion failure retained.
Exact source/hashes and logs in private readback /private/tmp/hbl-workpad-oversize-repair/
and committed evidence. Publisher is versioned unchanged as the existing runtime
dependency; no workflow/scheduler, live issue metadata or publication recovery
actions performed here. Live SHE-121/SHE-141 recovery and SHE-126 allocation remain
other threads' responsibility; this task has no competing writer for those paths.


## Independent agent-count review repair — November 11, 2026

PR34's bounded synthetic metric interface can accept a positive finite duration
whose derived throughput overflows. JSON then changes Infinity into null,
contradicting the zero-duration unavailable contract. Repair only the metric
rate calculation, focused tests and its contract documentation; preserve models,
counts, provenance and operational ownership. Acceptance: reject overflow for
both pair and tick rates; retain finite extremes, empty runs and zero-duration
semantics. No browser behavior change or deployment. Actual focused/integration
verification:34tests passed,530assertions,10.37seconds using30second per-test
limit; whitespace clean. Default5second baseline timing failure remains recorded
in recovery evidence; assertions were not removed or weakened.

Published draft PR #30, first package commit f4072a0. Actual CLI dry-run exit0,
175issues/21PRs/28reserved/0selected; no lease file. Standalone44pass and post-extraction
installed-host93pass. SHE-126/127/180 reconciliation comments link the draft and
retain incomplete status. Live pilot and recurring scheduler remain held by
specific readiness reservations, not silently enabled. Full JSON reports are
atomically written mode600; publication excludes raw issue comments/descriptions.


## Trusted-host Git publication slice — November 11, 2026

User authorizes isolated clones and a source-only worker contract: no sandbox Git metadata writes, unrestricted sandbox, main merge or deploy. Audit finds existing clones but instructions still require worker commits and `.git` handoffs; publisher lacks trusted scope enforcement. Next slice moves handoffs to `.hbl-handoff/`, stages a bounded exact-file snapshot into host-private Git storage without repository config/hooks/filters, commits/pushes/drafts/links through the existing publisher. Trusted per-issue assignment authorizes paths and baseline; model input cannot expand it. Preserve legacy workspaces/handoffs and all ignored state; fail closed on stale base, ambiguity, auth/scope/secret/symlink/race failures.

Acceptance: real source edits allowed while native `.git` writes stay denied; preflight covers shared metadata, failed fetch/commit, absent auth, duplicate publication and retry after partial publication. Test real Git with controlled remote fixtures; run one explicitly reviewed approved issue to a real draft sprint PR and Linear URL with no competing worker. Runtime concurrency/filter/resource holds remain unchanged. Ownership here: local publisher/workpad/isolation/worker procedures and focused tests only; scanner/scheduler/dashboard remain with their existing owner.

Delivered source slice: `host_git.py`, `handoff.py`, `prepare.py`, trusted publisher/workpad and independent-clone hooks implement exact-file assignments, source hash/mode checks, private deterministic commits and recovery receipts. Procedures and workflow tell workers to edit/test/handoff without Git writes. All previous workspace roots remain intact. Host installation made private before/after hash backups; never replaced unrelated runtime fields.

Acceptance evidence (2026-11-12 UTC): current checkout `/usr/bin/python3 -m unittest discover -s tools/symphony/local -p 'test_*.py'`:132passed/8.610s. Native `codex sandbox -P :workspace` source probe: sourceEdit=true, gitMetadataWriteDenied=true without metadata exception. SHE-121 resumed the original approved worker's retained real implementation in an independent clone pinned173f9530752b0e476583ad3ee7433b57a857b6bd;6unit tests/27assertions in native workspace-write,7trusted-host browser tests/3.0s. Trusted publisher created commit4845c3dadc1cc32c6d6e42b64cf6583410884b79 and draft https://github.com/adnanwahab/happybearlandia/pull/40 against the requested sprint, exactly10assigned paths, verified uploaded screenshot, real Linear attachment, pilot label removed. All pre-existing worker `.git` files including index/HEAD/refs retain hashes; host added only its legacy-compatible workpad snapshot. Original workspace/ignored state retained.

Limits: this is a recovered real-worker pilot; no fresh model was dispatched under memory pressure. Native runtime owner separately removes an implicit `.git` grant, verifies actual app-server policy and pins workflow against concurrent external edits. Installed combined190-test run had189pass and an unrelated Python3.9 scheduler HTTPError-close regression reported to that owner; the132-test publication package passes. No merge/deploy or bulk approval. Final retry/runtime evidence is recorded in `docs/symphony-host-git-evidence.md`.

Final coordinated gates: installed213Python tests now pass after runtime owner's scheduler fix; native310tests/0failure/6skipped plus all static/build gates. Pinned runtime cap1/max_turns20/source-only/dualfilter verified; live API0running/0retrying/0blocked. Actual app-server policy source-root-only. Live publisher repeat remains blocked by coordinating chat's automatic approval review citing earlier no-push restriction; its explicit approval request remains pending. No workaround, duplicate model, merge or deployment. Repair draft https://github.com/adnanwahab/happybearlandia/pull/42 (initial9611a46), pilotdraft40 and source evidence preserved.

Follow-up: one newly approved live repeat failed generically. Fixed actual-CLI module duplication that hid safe PublicationError reasons; genuine subprocess regression fails before/passes after, full133tests pass. Installed with backup/issue lock. No further live retry without separate approval; original PR40/receipt unchanged, underlying historical failure unrecoverable from redacted result. See evidence update.
## Host workpad oversized-update retry-loop repair

Observed42,212-character handoff against40,000-character contract could fail both
host phases repeatedly without parking. The repair durably preserves exact raw
JSON, keeps original pending/publisher/history/implementation untouched, removes
only pilot approval, appends a bounded truthful rejection receipt and returns
nonzero before publication. A concurrent replacement guard avoids acting on a
superseded request; retries reuse archive/receipt. No workflow/scheduler, issue
source, live handoff or publisher-policy edit. Existing publisher runtime is
versioned unchanged solely as the workpad dependency missing from the repository.

Focused35tests and installed-host106tests passed, including fresh-process shell
short-circuit, exact40000/40001 boundary,42,212 Unicode/format-preservation,
API/write/interruption/retry, pressure-label preservation and no lost history.
Earlier unrelated exact-label assertion failure retained and resolved separately
by runtime owner. No live issue mutation, recovery command or agent launch here.
Acceptance/evidence and operator recovery: docs/symphony-workpad-oversize-repair.md.

Fresh clean-package gate:92tests passed; latest installed-host164passed
(other owners expanded the suite after the earlier106-test pass). Private readback
`/private/tmp/hbl-workpad-oversize-repair/`; no live hook invocation/issue mutation.

### Open PR browser and explicit isolated revision previews

Implement `/github` open-only pagination (25/page), detail and explicit SHA-checked
preview admission. Metadata GETs never provision. A durable SQLite queue feeds a
separate trusted runner, one preparation/two runtimes, with immutable identities,
restart reconciliation, bounded retention and authenticated same-origin creation.
Local Docker guests receive no host source/data/credentials and no outbound network;
Fly uses a separately activated secretless provider, never production builds/data.
Acceptance: exact SHA backend/frontend, real local application browser rendering,
concurrent/restart deduplication and failure/security tests. No Symphony edits.
Risks: Docker/network/dependency availability and Fly isolation/budget activation.
Fly live verification remains explicitly pending operator activation. Use current
verified sprint baseline173f953; open one draft PR, no merge/deployment.

Implemented slice: open-only paginated metadata/detail UI, explicit SHA conflict
check, capability/origin gates, SQLite durable queue and OS-locked separate runner,
network-none local provider/HTTP-WS relay, Fly adapter/trusted build/firewall recipe.
Existing authenticated gh read transport returned8openPRs. ActualPR40 data-only
preparation succeeded; real local Docker/browser rendering is BLOCKED by host
pressure/headroom guard. Fly live activation is PENDING budget/isolation review.
Focused tests and390px Chromium UI smoke passed; see docs/github-preview-evidence.md.
Do not call fixture providers or source preparation a completed rendering milestone.
## Improvement services: first shared slice — November 11, 2026

Audit actual sprint33e84c3, active worktrees, host workflow, CI and Linear before
implementation. Reuse merged SHE180 PR30/31/37, existing replay/benchmark artifacts
and current one-worker, dual-label resource hold. SHE7 is absent; SHE52/SHE120
are incomplete and overlap. Simulation feedback presentation is not consented
player collection. Existing research worktrees contain experiments, not an
OpenAlex/Crossref acquisition service. Preserve all of these owners and stores.

Central owner: this branch alone owns new ops/improvement core schema, private
SQLite proposal inbox, atomic receipts/cursors/budgets, CLI and read-only adapter
to existing coordinator reports. It stores proposed work, not simulation runs.
The default dry-run must not create state or contact services; --record writes
only the local inbox. Neither mode executes proposed test argv or grants labels.

Three separately owned follow-ons were created under existing product issues:
SHE246 (parent185), research metadata/cache in ops/improvement/research/;
SHE247 (parent189), evidence normalization in evaluation/;
SHE248 (parent196), consented aggregate triage in feedback/. Each owns its module,
fixtures and tests only, can test with an injected sink, and waits for the shared
contract before integrated handoff. No execution approval or live activation.

Acceptance for this slice: strict versioned source/hypothesis/acceptance/test/
dependency/dedup validation; transactional proposal + cursor ingestion; replay
and conflicting-revision behavior; durable restart and intake limits; no lost
cursor on failure; private state; dry-run zero filesystem/remote mutations;
existing-issue/PR/dependency hold projection from fresh complete coordinator
reports. Source references are structurally checked, not factual verification.
Paper retrieval, CI execution, feedback collection and live services are later
phases. Delivered core has 26 passing focused tests (independently rerun) and
150 passing existing coordinator regressions. A dedicated CI job runs the new
contracts. Real SHE180 dry-run scanned 178 issues with no selections. Actual CLI
default dry-run created no state; local record stored one proposal/checkpoint;
restart replay produced zero new proposals; final dry-run left DB bytes/mtime
unchanged. Existing SHE141 delivery was held rather than duplicated. Source
hashes and sanitized observations: docs/evidence/improvement-intake-smoke.json.
Independent review's corrupt-receipt finding was fixed and regression-tested.
No browser behavior changed; local Playwright is not applicable. Published
[draft PR #41](https://github.com/adnanwahab/happybearlandia/pull/41); hosted CI is
pending final-head verification. Next tasks are SHE-246, SHE-247 and SHE-248,
each linked to that contract PR. No execution labels or persistent service
activation were applied. User explicitly requested keeping the PR draft;
the separate merge/cleanup owner was notified to exclude it.
## Continuous Symphony backlog slice — November 11, 2026

Requested result: safely drain explicitly reviewed work through existing single
Symphony dispatcher, preserve source-only host publisher ownership, and test20
continuation turns without repeating completed implementations. Runtime owner
owns native lifecycle/parking, workflow agent limits, observer/cache/metrics;
separate host-Git owner owns hooks, publisher, workpads and SHE-121 recovery;
readiness coordinator exclusively audits/approves SHE-83 and SHE-142. No shared
issue-file claim or duplicate implementation is created by this slice.

Observed prerequisites: PR36 and PR37 merged; observer19cycles/0grants/0ready;
actual runtime externally restarted asPID97590, file cap2 vs observer1 untilreload.
Both required pilot+pressure-release labels remain. Approvals disabled, reviews
empty and no leases. Kernelmemorypressure2(warn),16GiBRAM,~19.3GiBswap means
no resource clearance; restore cap1 and retainhold. SHE79/141 Done does not prove
SHE83/142 absent or their file ownership approved. Source-only host hooks are
not installed yet and current workspace/publisher roots disagree.

Acceptance: terminal local handoff/blocked ends same-thread continuation atturn1;
incomplete work retains same thread/workspace up to20; after_runonce and failures
park with useful host-recovery reason rather than retry implementation; pending
publication cannot restart on next poll. Add strict local-only native overlay,
backup/restore and fullnativegates. Cached read-only inventory must carry age and
never satisfy an authoritative apply scan. No producer/dispatcher duplication,
blanketapprovals, skippedtests, merge, deployment or production mutation.

Verification plan: focused native realOTP/fakeappserver lifecycle+parking tests,
cache/privacy/freshapply regressions, integrated Python suite, required native
format/lint/coverage/Dialyzer/build only after idle-stop, real dashboard smoke.
If physical resource pressure persists, prove source-only publication with
retained tested SHE121 output through hostowner; do not claim an actual running
worker or end-to-end useful throughput absent observation. Pending independent
readiness/user capacity prerequisites remain explicit in final report.


Continuous-slice actual checkpoint: native makeall310/0fail/6skip and100%configured
coverage;173standalonePython3.9tests;214installed-hosttests. Actualruntimepolicy
nowonlycanonicalworkspace writableRoots, no implicit.gitexception. Between-turn
terminalhandoff+hookfailurepark tested; maxturns20 installed withcap1/dualfilter.
Unknownterminalinterferenceconfirmedbyuser: privatepinnedworkflow/runtimev2 now
ownsdispatch. Cachedobserveravoided2of3fullscans, keepsfreshapplyauthority. Real
retainedSHE121outputpublishedasdraft40viahostafter_run; oneexplicitlyapproved
idempotentretryfailedexit1 andwasnotrepeated; newCLIdiagnosticfixinhostownerPR42.
SHE83/142 pilotlabels exist butnoclaims/newmodeltokens; resource/cleanclone/25active
ownership/reviewholdsremain. Source-onlyassignments/readinessstagedinactive.
No live implementation occupancy or delivery-throughput improvement claimed.

Finaluserhandoff: keepotherterminalruntime; stopthiscoordinator'scompetingrestarts/configwrites. ObservedPID32399/sharedWORKFLOWcap1/20/dualfilter/0workers; privatev2preservedinactive. Read-onlyobserver33294/v5 usesactualworkflow. PR43draftrecordsfinalownership; productiveexecutionstillblocked,notclaimedcomplete.
Continuous Symphony repair actual checkpoint: native310/0fail/6skip,173standalonePython3.9 and214installed-host tests. Pinnedruntime26040/lifecycle-v2 cap1/20/dualfilter/workspace-onlyroots; source-onlyhostpublicationPR40observed, oneapprovedidempotentretryfailed1 (notrepeated). Boundedcachedobserver26942/v4verified3cycles/2cachehits/no grants. Resource/readiness/ownershipholdremains; see docs/symphony-continuation-replenishment.md.

Final user choice: keep the other terminal runtime; this chat stopped config writes/restarts. Observed32399/shared workflow cap1/20/dual filter0workers; read-onlyobserver33294/v5. Private pinnedv2 inactive/preserved. PR43 head updated to reflect handoff; native310+package173+installed214 pass.


### Milestone 1 audit: one authorized SHE-83 delivery

Prioritize one worker and recovery before scaling. Reuse the existing operator-
reviewed assignment and active admission/publication repair owners; no duplicate
implementation. Independent installed host regression verification:58tests pass.
Live API at November11 23:26:32 America/Chicago:0running/0retrying/0tokens,cap1,
turns20,bothlabels. Resource hold still active. End-to-end milestone is NOT
verified; live restart requires a fresh state check and explicit approval.
Detailed protocol, actual approval provenance and remaining evidence:
`docs/symphony-milestone-one.md`. No deployment or merge authorized.


### November12 SHE-83 live recovery delivered

One actual Symphony worker delivered draftPR49, commitfa51becfaf1fcac1cea9305e4d307be5ae10fcd5,
against approved173f953 sprint. Independent18tests0fail207assertions andCLI
success/failure passed; four approved source hashes match handoff. One draft
linked in the unique Linear workpad; slot0running/0retry/0blocked afterward.
Actualpressurev2+missinggate-label+boundedhostreview-window repairs are recorded
in docs/symphony-recovery-20261112.md. No restart proof, merge, deployment or
concurrency increase; keep Milestone2 held. Observerfreshnessfix is tested/staged,
not falsely reported as an activated authenticated observer replacement.

## Mini Symphony remaining-queue recovery — November 12, 2026

Next integrated slice: reconcile a fresh, complete Linear project snapshot with
GitHub PR evidence and existing local task state; import full issue descriptions,
hold review/externally assigned work, and expose explicit retry decisions rather
than re-running merged implementations. Repair publication recovery after commit,
push, or PR creation and cover those boundaries with disposable Git tests.
Acceptance: no duplicate PR/model attempts for existing delivery, no completion
claim from exit zero/no_changes, no lost existing task/state, dry-run by default.
Live inventory: 30 Backlog, 4 In Review; local 220 pr_created, 28 no_changes;
GitHub inventory 262 merged, 5 closed, no open PRs. SHE-11 and SHE-165 have merged
mini branches despite Backlog status. Preserve all unrelated dirty checkout work.

Recovery slice delivered: `mini-bun/publication.ts` and `reconcile.ts`, integrated
runner recovery/filter/logging fixes and updated operator instructions. Six Bun
regression tests pass (real disposable Git interrupted-publication cases); Bun
bundle passes. Full 34-issue snapshot privately reconciled; existing live runner
lock prevented queue replacement, and its concurrent SHE14 work was preserved.
Verified PR25 + successful hosted check, then closed stale SHE70 in Linear.
Other merged PRs need acceptance review: PR53/SHE165 is readiness documentation,
not feature delivery. Remaining review issues need human evidence or actual
implementation. No bulk closure/worker restart performed. Details and next
operator steps: docs/symphony-mini-remaining-queue.md.

## Mini Symphony idle/publication diagnosis — November 12, 2026

Observed SHE253 remote comparison: ahead0/behind319, despite local stale-base
comparison showing inherited documentation differences. Worker made no edits
and correctly stopped at human metric selection. Next slice fetches the actual
publication base before checking ahead/diff; no-change becomes terminal local
review state rather than repeating a doomed PR on every startup. Idle diagnostics
must distinguish enabled from runnable, prior attempts, terminal and disabled.
Acceptance: regression with remote base advanced while local ref stays stale;
existing recovery tests pass; actual queue summary verified without dispatch.

Diagnosis slice delivered: publication fetches current remote base before ahead/
diff checks; shared queue selection and idle summary distinguish actual runnable
work. Eight tests/29 assertions pass, including remote-advanced/stale-local-base
regression and explicit-retry/terminal/disabled selection. Bun bundle and diff
whitespace checks pass. Actual queue:0runnable/10disabled/17terminal/231prior
attempts/0running. No task activation, state overwrite or live PR retry performed.
SHE253 remains human-metric-gated; next startup classifies its empty branch as
no_changes after successful fetch rather than attempting an empty PR. New work
requires enabling the imported tasks; prior results are preserved.

## Mini Symphony actionable queue activation — November 12, 2026

User requests a working remaining queue after repeated idle messages. Fresh
Linear project has35unfinished issues. Activate ten previously imported, never
attempted PLAY tasks259–268, priority259then263; preserve all prior results and
external human gates. Refresh local status metadata from complete project scan.
New worktrees must fetch and pin the current remote PR base rather than old local
HEAD(b963dd3). Acceptance: ten runnable/zero disabled after update, current-base
worktree regression, existing recovery suite/build. No reset/rebase of existing
worktrees, forced retries of merged PRs, merge or deployment.

Activation delivered: refreshed all258task status fields from current Linear,
full ten PLAY prompts fetched/checked for blockers and enabled in priority order.
Verified queue10runnable/0disabled/223terminal/25prior/0running, nextSHE259.
Existing live runner reappeared during preparation; used its supported atomic
hot task-file update rather than restarting it or overwriting state. Private
queue backup retained. `workspace.ts` now fetches/pins current remote base only
for new worktrees, preserving existing worktrees and source HEAD. Nine Bun tests/
33assertions pass, including stale source HEAD/current-remote worktree test;
runner bundle passes. Actual completed PLAY delivery remains unverified until
worker publication and acceptance. Other25unfinished issues retain prior results
or external gates; no automatic reimplementation/closure implied.
Live follow-up: existing runner claimed SHE259 and its actual Codex log shows
repository/document investigation. Observed state running; no PR completion yet.

## Mini Symphony remaining-work authorization — November 12, 2026

User deleted externally blocked issues and authorizes remaining labels/dispatch
repairs. Fresh inventory29unfinished;3PLAYPRs open,1worker active. Preserve those.
Prerequisites with formal blockedBy are Done except44->63; retain that relationship.
Fresh approved follow-up task IDs use SHE-N-r2 (increment if occupied), preserving
old state/worktrees/merged PRs and starting current sprint. Full issue IDs/URLs
remain attached. Reports write owned repo files rather than disappearing in
no_changes logs. Update Linear descriptions to supersede stale coordinator/tool
assignment gates, set ready labels, exclude deleted tasks locally. Keep single
worker, no external-service load, no fabricated measurements or completion.
Acceptance: idempotent queue generation, deleted exclusion, open-PR/active-worker
protection, follow-up branch-to-Linear mapping, existing regression/build gates.

Authorization slice delivered:29Linear issues updated with ready+coordinator
approval+queue labels; stale review-before-dispatch removed. Three existing open
PLAY PRs retained InReview, newly delivered SHE261 also moved InReview; active
SHE260 retained. Remaining Todo descriptions explicitly supersede historical
ownership/Claude/frozen-sprint gates; scope45uses bounded loopback staging,
analysis tasks persist reports,192bounded local vertical slice,212child audit.
Real blockedBy44->63 retained, completed dependencies not treated as new work.

Applied approved queue atomically:19fresh r2follow-ups,5existing never-attempted
PLAY tasks enabled,4open PRs preserved,1worker active.24runnable/248historical-or-
deleted disabled/5prior-or-active/1running observed. All old state/branches remain;
no state.json writes, no redispatch of deleted external tasks. Snapshot/backup/
activation receipts are private in .hbl-private/mini-recovery/. Twelve focused Bun
tests/54assertions pass, runner build and Node syntax check pass. Follow-up
branch-to-Linear helper mapping is tested locally; SHE182explicitly owns publishing
it to hosted workflow (not claimed active). No issue marked Done, merge, deployment,
production load or performance claim. Real acceptance remains each worker's task.

## Mini Symphony Dear Congress project profile — November 13, 2026

User requests Civic Synthesis board24f935081b94 and Dear Congress repo. Audit:
board36b11054-5397-473e-9e3b-2092a100de5e has252Done,251Backlog(existing open
DearCongressPR1),249Backlog(empty description). Target origin adnanwahab/
dear_congress,main. Local Dear Congress checkout heavily dirty; do not snapshot,
commit, reset or copy its local app/data/env changes. Isolated per-project runner
profile binds repo origin, Linear project and state directory; preserve legacy
HBL CLI. Seed full249+251with existing PR receipt; one worker default. Add explicit
board refresh CLI, dry-run and runtime check; no duplicate251, live merge/deploy
or voting-policy activation. Acceptance: cross-project mismatch rejected, scoped
paginated Linear import, remote-base existing recovery suite, disposable target
normal-entry smoke, install isolated runtime with preserved Dear package edits.

Dear Congress slice delivered:project-bound profile support and --check in shared
runner; full-description paginated Linear refresh with repo/project validation,
existing-PR dedup, dependency/terminal holds and concurrent-state protection.
Bundled-runner locks now respect any live owner PID. Project worker environment
filters application DB/bot/tracker keys while preserving required CLI auth.
Legacy HBL positional invocation and task/state remain untouched; real HBL --check
passes.17Bun tests/85assertions pass, including real disposable Git normal-entry
publication+source-dirty preservation+second-runner lock, project isolation,
pagination/API failures and environment filtering. Both bundles build.

Installed .mini-symphony runtime/profile/queue/state in DearCongress; added only
three package scripts, ignore rule and docs/mini-symphony.md while preserving all
existing dirty package/app/data changes. Installed package-command check passes
against real origin adnanwahab/dear_congress,base main,correct Linear project,
cap1. No worker launched. Actual existingPR1 covers251and249baseline; linked both
issues and moved them to InReview, imported real PR receipts and disabled duplicate
dispatch.252Done is retained disabled. Zero runnable is expected for current board.
Live Linear import used connector full issues; direct API refresh is unit-tested,
requires LINEAR_API_KEY and has not been claimed live-tested without that key.
No merge/deploy/live voting policy changes or copied application env/data. Runtime
bundles are local generated installs; shared source remains under HBL tooling.

## Dear Congress board refresh repair — November 13, 2026

User observes stale3-task snapshot despite new launch issues. Fresh scan15items:
8Todo,2InReview,4Duplicate,1Done. Import six implementation children270/271/276/
279/272/278; retain existingPR1 links; hold269umbrella and280production deploy.
Fix duplicate terminal handling and add configured periodic read-only board sync
with available Linear API key; preserve live worker state and explicit task holds.
Acceptance: actual project API dry-run, duplicates never runnable, held issues stay
held, periodic sync preserves live claims and refuses concurrent edits, regression
suite + installed queue counts. No production deploy/reset or duplicate parent.

Refresh repair delivered and live-verified: actual GraphQL100x100query hit
HTTP400QueryTooComplex; reduced nested page sizes20x20 and real project dry-run
now succeeds15issues/6enabled. Duplicate status is terminal; heldIssues protects
269umbrella/280production deploy. Runner refreshes every60seconds between tasks
when configured+LINEAR_API_KEY available, logs missing credentials/failures,
keeps manual edits/current active state intact, uses existing publication dedup.
18focused Bun tests/94assertions pass, both bundles build. Installed new bundles
and profile; atomically hot-refreshed only Dear tasks.json, no state replacement.
Observed actual existing runnerSHE270running+5runnable+9disabled; sixqueueIDs
270/271/276/279/272/278. Existing PR1,4duplicates,Done252 and2holds retained.
Current process loaded old bundle: periodic-refresh code activates on next start;
do not interrupt current implementation just to reload it. No deploy/production
reset/bulk closure. Remaining real implementation/acceptance belongs to workers.

## Mini Symphony 25-hour measurement dashboard — November 13, 2026

Requested integrated slice: /mini-symphony in existing Bun app, session-level
human-readable logs + machine events, project comparison and explainable25h
endurance/output metrics. Record a new UUID per coordinator start, heartbeats,
working/publishing/waiting/syncing phases, task outcomes, new-vs-reused PR receipts,
queue exhaustion, sync errors and stop/interruption causes. Preserve old task logs
but label historical state as uninstrumented; cannot backfill continuous sessions.
25h observed runtime is distinct from25h actual working time and from accepted
code. Unknown heartbeat gaps are uncredited; restarts never stitched together.

Parallel dependencies: coordinator owns telemetry writer/runner hooks/API/server
routes+integration; isolated metrics owner owns pure session reducer+tests;
isolated UI owner owns dashboard HTML/JS/CSS against fixed read-only API contract.
No merge/deploy, increased concurrency, blanket retry or external messaging.
Acceptance: exact25h boundary/idle/gaps/restarts, real temp Git runner telemetry,
secrets/prompt exclusion and bounded reads, loopback-only API with fixed configured
sources, dashboard empty/error/live/mobile/text-log smoke. Install new Dear bundle
without replacing state or interrupting running work; no historical25h claim.

Measurement slice delivered: version1append-only session JSONL+curated text,
15sheartbeats/60sgap threshold, phase/task/queue/sync/PR/stop events, explicit
new-vs-reused PR receipts, external interruption/edit notices and redaction.
Monotonic metrics separate continuous observed runtime from coding, publishing,
waiting and unknown time; no restart stitching, imported-history credit or
acceptance inference. Timeout SIGTERM-exit0 bug fixed; ignored termination gets
bounded process-group escalation. Graceful multiworker failure waits for closure.
HBL command no longer hot-reloads long experiments. Existing raw logs retained.

Integrated /mini-symphony+loopback/same-origin read-only API and curated text
download. Fixed allowlisted source roots register HBL+Dear locally; bounded reads,
path checks, no raw prompts/transcripts/credentials in API. Dashboard has primary
25hgoal, breakdown/output/queue/activity/history/project selectors and definitions.
Installed updated Dear runner bundle without changing state/tasks or interrupting
PID98134's active worker; telemetry begins on its next start. Old records remain
unmeasured. Local HBL server88591 reloaded to expose the requested port3000route;
no production deploy or merge. Local-only Sites skill workflow used.

Evidence so far: focused34Bun tests/213assertions passed with real localserver
smoke and temp-Git runner success+stubborn-timeout telemetry;2Chromium tests pass
for actual route/local sources, project switch,390px/no overflow and synthetic
25h-idle/error truthfulness. Desktop/mobile PNGs inspected. An initial broad test
filter matched retained workspaces and socket startup was sandbox-blocked; explicit
./paths+loopback permission resolved verification, not skipped assertions.
Documentation: docs/mini-symphony-observability.md. Actual25h trial has NOT run;
current earlier processes cannot be backfilled. Synchronous network commands can
still create unobserved heartbeat gaps; logger failure degrades evidence rather
than stopping coding. Direct visible-browser host was unavailable; actual browser
checks used isolated repo Playwright Chromium instead. Final focused rerun pending.

Final acceptance: bun run test:mini-symphony passes34tests/213assertions; standalone
Playwright config self-starts an isolated app and passes2tests, also independently
passed against actual localhost3000route. Browser screenshots inspected at desktop
and390px. Added both gates to existing core-journeys CI; hosted CI not yet run.
Ignored generated root telemetry; docs explain log locations, interpretation and
25h proof limits. Final source/bundles pass syntax/whitespace gates. Operator API
and UI work through normal app entry points; no new dependency/lint/typecheck
configuration required. Current Dear worker preserved; updated bundle ready for
next start, no claim it retroactively instruments that process. Actual25h field
trial and acceptance of generated PRs remain future observations, not passed gates.

## Dear Congress dependency pagination recovery — November 13, 2026

Observed live runner rejects the entire board when one inverseRelations page has
more than20entries. Installed24-task snapshot therefore remains all disabled as
board grows. Next slice fully paginates issue dependencies separately from bounded
project pages; guards cursor cycles/source mismatches; isolates incomplete per-issue
checks as holds rather than losing unrelated work. Restore sync-owned dependency
holds when blockers clear, preserve explicit operator disables and prior attempts.
Acceptance: active blocker on page2never dispatched, closed blocker releases hold,
repeated cursors/missing issue/API failure safe, actual project refresh and installed
bundle/queue checked. Preserve history, no blanket retry/merge/deploy or production
changes. Existing coding must not be interrupted; idle old runner may be reloaded.

Acceptance completed: 43 tests/253 assertions pass, including nine importer
regressions. Both Bun bundles rebuilt and installed in Dear Congress; installed
--check validates repository/profile and the 54-issue queue. State file was not
replaced; original config/tasks/bundles backed up. Current source prerequisite
SHE-281 remains Todo: 32 feature tasks held pending deployed source recovery,
19 terminal, two project holds, one operator-disabled. Explicit profile prerequisite
prevents new feature workers running against the known incomplete GitHub baseline.
No Linear state or production changes. Old process must restart to load bundles.
Browser checks skipped: this repair changes importer/coordinator behavior only.

## SHE-281 source recovery — November 13, 2026

Prepared isolated /private/tmp/dear-congress-source-recovery from Dear Congress
local f53852e plus uncommitted application source; integrated origin/main 47659fa.
Published draft PR https://github.com/adnanwahab/dear_congress/pull/18, current
revision a00d3c4. Restores product shell, map, workflow/docs and source fixtures;
retains newer privacy/moderation/public-write security and release-only deployment
gates. Original dirty checkout, runtime databases and runner history preserved.
224 local tests/99,104 assertions, typecheck and production route smoke passed.
Hosted CI exposed macOS-specific tmp path; corrected to os.tmpdir, focused test
passes; final hosted rerun passes all three required checks on a00d3c4.
Reopened SHE-270/271/278/279; SHE-281 In Progress
with evidence link. No merge/deploy/current-live tag claimed: newly discovered
Dear Congress AGENTS.md explicitly requires human review/merge on launch day.
Source prerequisite retained pending recovered main and live release provenance.

## Dear Congress PR batch merge — November 13

User explicitly authorized all open PR merges, overriding repository launch-day
merge restriction for this batch. Merged all 30 PRs #19–48. Twenty-four are
review documents only: restored their pre-merge Linear Todo/Backlog states after
integration auto-closed them. Six implementation heads integrated through PR48
with merge ancestry preserved; resolved workflow conflicts retaining provenance,
empty/retry states, consistent navigation and explicit advisory vote actions.
Added four-stage provenance regression to the suite. Final 236tests/99,333assertions,
typecheck, production-route smoke and all three hosted CI checks pass. Main
0268a4c matches the tested d4c6a26 tree exactly. No open PRs remain. No release
published or production deployment; original dirty Dear Congress checkout intact.

## Explicit unfinished-work follow-ups — November 13

Queue idle because merged PR receipts are terminal attempts. Prepare new r2 IDs
for 24 report-only unfinished issues and four reopened launch issues, preserving
all prior state/workspaces. Skip In Review work and project holds. Importer must
refresh latest family member, supersede old task and retain implementation-only
follow-up instruction across polling; regression covers blocker and terminal
updates. Install bundle and restart only idle runner; verify actual dispatch.

Follow-up acceptance: 28 new r2 tasks installed; state file not replaced.
Old idle process stopped and updated runner restarted, PID55571, console log
Dear Congress .mini-symphony/coordinator.log. Session2416aea1 was superseded
while idle; current session observed28runnable and SHE-270-r2 running.
Priority sorting exposed array-order selection bug; importer now selects highest
numeric revision, regression includes r10/r2/original in reverse order and two
refreshes. Added follow-up.test.ts to the standard source test command.
Live refresh tests use temporary files and prove scan failures preserve queue
and state ownership. Production and coordination holds remain; no new merge or
deploy authorized by this queue activation.

## Optional port-conflict auto-debug — November 13

Add --auto-debug (default off) through normal Bun runner entry. Detect explicit
port errors in worker output; one repair worker in the same worktree with original
time budget, separate result, preserved transcript and curated telemetry. Require
structured worker-reported successful checks before publication. No process killing
or automatic arbitrary command replay: safer initial slice uses PORT=0/readiness/
finally cleanup repairs. Failure, timeout, stop and malformed results hold publication.
Acceptance: default behavior unchanged, enabled failure recovers once, repeated
errors never loop, bad result cannot publish, original result retained.

Acceptance completed: 55 source tests/409 assertions pass, including real normal
entry fixtures for disabled/default, recovery after exit-zero port error, blocked
repair and stubborn repair timeout. Both passes share deadline; exactly two
worker invocations maximum and original result retained. New result is session
unique to prevent stale success receipts. Built and installed Dear Congress
bundle atomically (backup retained); --auto-debug --check confirms true without
launch. No runner started, browser tests skipped for coordinator-only changes.
Limit: checks are worker-reported, not independently rerun by coordinator;
process killing deliberately excluded. Raw output can include already-resolved
port errors and trigger one conservative extra validation pass.

### PR45 conflict resolution — November 12, 2026

Resolved the append-only implementation-plan conflict by retaining both the
preview feature record and the sprint's newer implementation/evidence sections.
No preview runtime behavior changed during resolution. Combined-head validation:
35 focused preview/provider/navigation tests passed (294 assertions); Chromium
390px UI smoke passed with mocked metadata, XSS checks and one explicit preview
POST. Live Docker/Fly rendering remains unverified and providers remain subject
to their documented activation gates. User explicitly authorized PR45 merge.

### SHE-84 receipt import slice — November 12, 2026

Implement manually in isolated codex/she-84-receipt-import after verifying no
SHE-84 PR and no live Symphony worker. Symphony admission remains held; no claim
of Symphony execution. Own share/import.{html,js,css}, share/import-receipt.js,
UI footer link, focused import tests/browser smoke and docs/run-receipt-import.md.
Reuse canonical receipt and saved replay APIs read-only. Prerequisite SHE-83 is
merged. Acceptance: bounded paste/file input, actionable errors, valid persisted
receipt verifies selected/terminal hashes and opens matching saved month; malformed,
oversized, unsupported and missing-record cases never claim success. Verify real
City-store integration, existing UI/share tests and normal-server browser smoke.
No new backend endpoint, model contract, deployment or merge is required.

SHE-84 delivered: added linked paste/upload import page, UTF-8 size checks before
parse/file read, canonical validator and saved replay integration, cancellation
and stale-success clearing. Existing receipt/data/model contracts unchanged.
Validation:19 pass/0 fail/1 optional component-browser skip,213 assertions across
import, canonical receipt, share and UI tests. Dedicated390px Chromium normal-server
journey passed with real persisted City pair (seed0,month16), paste/file equality,
malformed/oversized errors, stale link clearing and entry-link navigation. Inspected
mobile screenshot /private/tmp/hbl-she84-import-mobile.png. No lint/typecheck scripts
are defined; git diff --check passed. Direct manual delivery, not Symphony dispatch.
Canonical receipts require the saved experiment on this server; evidence-only and
unsaved exports cannot reopen. Review/merge/deployment remain separate actions.

## SHE-30 — supported first policy choice

Audit: prerequisite HBL-W1-004 (SHE-9) is Done in Linear. Existing Future
Machine already supplies real City paired runs, seed controls, housing construction,
null-intervention comparison, share/reopen, and provenance. The missing slice is
choice: its selector previously offered only the supplied housing input and control.
No engine, generator, model version, API, or persistence contract change is needed.

Owned slice on `mini/SHE-30`: `world/future-machine/ui/index.js`, new
`ui/policies.js`, UI README, new `test/future-machine-policies.test.js`, the existing
Future Machine browser suite, and this plan. Single worker; no delegation or
changes to dispatch/release gates. Acceptance: two bounded housing proposals
(24 homes/1,000,000 illustrative USD and 12 homes/500,000 illustrative USD), plus
unchanged matched control; visible source, cost and constraints; actual model
completion evidence; matching initial state/seed; exact share/reopen. Loaded
nonpreset interventions retain their exact inputs and a separate loaded label.
Risk: a policy edit must configure the next run without relabeling displayed results;
existing dirty-configuration handling is preserved. These are two parameter choices
in the existing housing model, not two independently calibrated policy models.

Initial verification: `bun test test/future-machine-policies.test.js
 test/future-machine-ui.test.js test/future-machine-data.test.js
 test/future-machine-share.test.js` — 20 passed, 1 optional browser test skipped,
0 failed, 195 assertions. New tests execute the real 120-month engine: +12/+24
homes, 500,000/1,000,000 cumulative capital USD, identical control, deterministic
replay, unchanged parent hash, recorded completion/model version and share recipes.
Browser verification pending below. No commit/PR or deployment created here.

Final local verification: `bun test test/future-machine-policies.test.js
 test/future-machine-ui.test.js test/future-machine-data.test.js
 test/future-machine-share.test.js test/future-machine-manifest-validation.test.js
 test/future-machine-diff.test.js test/city-systems.test.js` — 50 passed,
1 optional browser test skipped, 0 failed, 521 assertions. `git diff --check`
passed. No standalone lint/typecheck script exists in package.json.

Browser attempts: `bunx playwright test --config
 test/future-machine.browser.config.js -g 'first policy choices'` failed before
running tests: Bun server listen EADDRINUSE on 39884. A temporary isolated-port
config and `HBL_FM_TEST_PORT=39930` retry failed identically; config was restored.
`HBL_FM_BROWSER=1 bun test test/future-machine-ui.test.js` produced 6 passes and
1 failure before Chromium launch: even Bun.serve port 0 returned EADDRINUSE.
Local listen/setup is blocked; UI screenshots and browser acceptance remain
unverified. The added normal-route browser test checks all three policy selections,
actual persisted matched comparisons, smaller-plan share/reload and captures
`first-policy-small.png` when run successfully. Next action: rerun that exact
Playwright command in an environment permitting the local server. No browser
results or screenshot are fabricated; no commit/PR is available for this local slice.

## SHE-29 first-impression playtest — preparation, 2026-11-12

Prepared [the moderator packet](research/SHE-29-first-impression-playtest.md),
including a no-instruction homepage minute, five blank participant records,
provenance fields, and evidence-based follow-up ranking. Existing Play Demo,
recorded-divergence effects, versioned sharing and responsive browser coverage
were inspected; no application feature was reimplemented. Owned preparation
files are that packet and this entry. Coordinator session/build ownership is
pending. Live Linear prerequisites: SHE-15 Backlog; SHE-19 In Review, with SHE-18
In Review. No dispatch/readiness gate changed.

Acceptance remains **incomplete: 0/5 human sessions conducted**. No participant
findings or bugs invented. Local focused verification:
`bun test test/two-futures-demo-controller.test.js test/future-machine-effects.test.js test/future-machine-share.test.js`
passed 15 tests / 136 assertions, zero failures. Documentation-only change;
Playwright skipped. Branch `mini/SHE-29`, audited baseline `b963dd3`; no PR.
Next: coordinator confirms dependencies and pinned build, then an observer runs
five new-player sessions and records observations, synthesis and ranked bugs.

## SHE-127 — read-only queue duplicate report

Next integrated slice: reuse the existing SHE-180 host scanner, readiness
classifier and dry-run CLI; add complete repository GitHub issue inventory and
explicit matching evidence without a new dispatcher. Owned files: coordinator
scanner/classifier/render, dedicated queue tests, coordinator documentation and
this status entry. Existing worktree `mini/SHE-127` is isolated and initially
clean. No independent implementation task warrants another agent/shared interface.

Prerequisites: host read credentials and trusted readiness evidence for a live
scan; SHE-126 dependency stays a readiness hold, not an implementation waiver.
Acceptance: each held item retains reasons; open/closed GitHub matches carry
number/state/URL/signal; dry-run leaves remote issues, source and lease state
unchanged and never calls approval. Incomplete inventory fails closed. Risks:
conservative prose matches and cross-repository/fuzzy aliases require operator
audit; older caches lack the additive issue inventory until refreshed.

Delivered: additive scanner/report fields and conservative match holds using
Linear identifier, exact title or attached URL. Reuses all existing dependency,
PR and ownership checks. Synthetic regression tests exercise no-state/no-approval
behavior with approvals enabled, identifier boundary, closed issue and alias
matches, PR exclusion and incomplete pagination failure. No browser behavior
changed; Playwright is inapplicable. Live CLI GitHub audit was blocked by network
connectivity; connector search did not supply usable PR evidence, so no live
source/PR duplicate clearance or dispatch readiness is claimed. No labels,
issues, runtime configuration, merge or production data changed.

Acceptance evidence (2026-11-12): `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest
discover -s tools/symphony/local -p 'test_*.py'` passed 217 tests in 10.269s;
`git diff --check` passed. Diff review confirms additive report fields and only
read endpoints added; existing default/apply boundary is unchanged. Reproducible
synthetic evidence is in `test_queue_report.py`; live host scan remains the next
operator step when connectivity and SHE-126 readiness evidence are available.

## SHE-214 — anchored WHY navigation

Bounded slice: separate the evidence anchor (exact collection, ID and recorded
month) from the viewed frame. Reuse the rendered trail during evidence jumps
and playback; timeline and outcome-chart scrubbing explicitly re-anchor the
selected entity. Selection and new experiments replace the anchor. No City
records, provenance, clock mapping or causal joins change.

Acceptance: from the added building at Month 120, visit policy Month 1 and
project Month 3 without reselection, mark the exact node current, and Return to
120 with identical node IDs. Reverse scrub to 0 must hide future completion and
units. Read-only build diagnostics must remain unchanged during playback.
Risk: stale future receipts after manual scrubbing; retain the existing missing
building disclosure and verify both Canvas and inventory fallback paths.
Implemented in main.js and the trail view; story documentation and regression
coverage updated. Verification: 20 focused Bun tests pass, 1 existing browser-only
unit test skips, 0 failures; git diff --check passes. The direct DOM test verifies
exact policy/project callbacks, current markers, Return and stable node objects
across 121 viewed months. The revised real browser journey checks uninterrupted
navigation, identical node IDs, zero additional trail builds during playback,
and reverse-scrub honesty. Playwright could not start its isolated server:
EADDRINUSE on ports 39927 and 39929; browser acceptance remains unverified.
Next action: run test/evidence-trail-real.browser.config.js in an environment
where the local server can bind. No deployment or production data changes.

## SHE-42 — bounded simulation admission

Audit: Decision API already limits two active experiments and replay weight;
optimization limits one worker. Civic RunJobManager has only per-job fanout;
paired experiments serialize but queue without limit and evict active records.
This slice owns world/run-job-manager.js, world/experiments-api.js, their tests,
and this plan. No separate coordinator assignment exists in this checkout.
Implement FIFO civic admission (2 active, 8 waiting, at most 8 adapter calls per
job) and paired admission (1 active/preparing, 8 waiting). Reject overflow with
429 and Retry-After before creating a job. Preserve dedup, seeds, output order,
cache writes, disclaimers and active paired records. Acceptance: held-run burst
tests prove bounds, useful overload, readable status, recovery and exactly-once
results. Limits are per process, not distributed; histories/caches and individual
request sizes remain existing limitations. No model, deployment or merge changes.

Delivered on `mini/SHE-42`: FIFO civic job queue, 429 JSON budget/retry header,
per-job fanout clamp, dedup before admission, and slot release only after failed
adapter siblings settle. Paired admission reserves capacity before asynchronous
plan preparation; validation releases reservations and retention evicts only
terminal jobs. Existing per-handler worker/replay guards remain intact.
Synthetic held-run load: 10 civic jobs accepted, overflow rejected, peak <=16
adapter calls, exactly250 calls/cache entries; paired burst30 accepts9/rejects21,
all accepted IDs readable, exactly9 executions including one injected failure.
These are deterministic concurrency tests, not a production capacity benchmark.
Defaults are conservative policy choices, not empirically tuned CPU/RSS limits.
Verification: `bun test test/run-job-manager.test.js world/experiments-api.test.js
 test/server-civic-api.test.js test/simulation-adapter.test.js
 test/reproducibility.test.js` passed22tests/79assertions (854ms). `git diff
 --check` passed. No lint/typecheck script is defined. `bun test
 test/server.test.js` failed at server startup; direct isolated launch reproduced
Bun listen EADDRINUSE at port0, so socket/browser smoke remains unverified.
Playwright skipped: no browser behavior changed. No PR/commit or deploy created.
Limits: process-local queues, existing unbounded civic history/cache, and civic
body parsing/world generation before job admission remain outside this slice.

## SHE-223 — Butterfly Ledger prototype

Slice: open the default recipe's selected metric/month from WHY, run four
single-input ablation pairs sequentially through the existing City API, rank
full-minus-ablated contrasts, and link each to its persisted replay with seed,
model and canonical recipe hash. No engine, API or frozen contracts change.
Acceptance: matched original/control and recipe identities; exact reconciliation
in integer thousandths at displayed precision; missing measurements fail;
explicit model attribution and residual-dominance warning; cancel on inspector
replacement. Residual includes interactions, reference/omitted effects and
rounding, so it is not a pure interaction estimate. The four contrasts are not
Shapley values. Separate pairs repeat baseline computation to reuse the validated
existing adapter and replay/share contract. Research source cited in the issue
is absent here; full Linear acceptance is the scope authority. User research and
kill-criterion decision remain pending actual use.

Delivered: `butterfly-ledger.js`, WHY composition and bounded receipt layout,
focused model/API tests and a browser acceptance journey. Actual seed-42
Month-120 mean-rent results (USD/month): amount −148.575, compliance −148.575,
delay −54.378, cost 0.000, residual −389.241; sum −740.769. Residual exceeds
every individual contribution and 50% of the observed delta, so the prototype
explicitly warns that it may not identify a useful dominant input. This is
modeled evidence relevant to the kill criterion, not a user-success claim.
Verification: 26 Bun tests / 245 assertions passed across ledger, data, diff and
share, including real persisted City API execution of all ablations and replay.
Playwright attempted on ports 39931 and 39947; both test server launches failed
with EADDRINUSE before browser execution. Browser behavior remains unverified.
Run `bunx playwright test --config test/butterfly-ledger.browser.config.js` when
local server binding is available. No deployment or production data changes.
Next: assess whether the large residual warrants abandoning this attribution
method before expanding beyond the default recipe or conducting user testing.
Additional regression gate: UI measurements, persisted boundary seeds,
cancellation/stale responses and reverse scrub identity passed 13 tests /
264 assertions; one existing Chromium placeholder test skipped. Whitespace
check passed. Method and entry instructions: [Butterfly Ledger](../world/future-machine/BUTTERFLY-LEDGER.md).

## SHE-254 — bounded local idea sharing v0

Slice: one drainage-policy idea on an explicit synthetic spatial peer graph,
parent-linked hop evidence, deterministic replay and a matched no-sharing
ablation via a normal Bun command. Reused Population's seeded draw function;
kept the existing saved-conversation overlay and agent-count adapter unchanged.
Dependencies: resident positions and origin are explicit inputs; no cross-model
identity or clock mapping is claimed. Tick means one synchronous contact round.
Acceptance tasks completed: bounded validated inputs and radius graph; immutable
origin/hop records; paired curves; CLI report and regression verification.
Risks/limits: static synthetic positions, assumed 0.65 adoption probability,
canonical-ID tie breaking, quadratic peer construction; no live Population
integration, browser changes, empirical calibration or million-resident claim.

Verification: 13 tests passed, 311 assertions across local-ideas,
idea-diffusion and agent-counts suites. CLI seed42/25residents/12rounds produced
25 informed versus 1 in control (24 additional), saturating at round9.
Full replayable paired evidence: `docs/evidence/local-ideas-v0.json`.
Browser smoke/Playwright inapplicable: this slice changes only headless behavior.
No lint/typecheck scripts exist. No deployment or production writes performed.

## Living City Engine — SHE-195

Next integrated slice: extend the monthly City Laboratory authority, not the
separate minute-based Population engine. Existing demand, employment, housing,
construction and policy rules remain authoritative. Add durable resident identity
(one modeled adult per worker), monthly routine/need proxies, social ties, goals
and event-linked memories; preserve departed residents. Attach versioned assumed
rule references to events and log every building inventory mutation with its
construction causes. Bump the model version to prevent silent old-run replay.

Acceptance: twelve-month identity and memory continuity, JSON checkpoint resume
matches uninterrupted execution, demand-driven openings/closures, building logs,
seed-matched lasting policy effects, and explicit assumption references. These
are coarse monthly proxies, not daily routines or calibrated human behavior.
No cross-model identity mapping is claimed. Existing saved experiment replay
exposes the added state/events without a new persistence authority. Verification
and remaining limitations are recorded below after checks.

Delivered: `world/city/residents.js`, engine/system integration, resident validation,
model 1.1.0 and regression tests. Every system event carries its assumed rule;
building additions carry exact completion-event dependencies. Six focused tests
cover annual state, serialized resume, business demand, paired lasting housing
policy, flood effects, departure, malformed input and uncaused building mutation.
Future Machine now validates replay states at their actual month instead of
rewriting the clock to zero; initial input retains its 1 MB bound, while replay
state allows 10 MB for accumulated memories (same entity/horizon bounds).

Actual verification: city/API/project-unblock/seed-replay suite 30 passed;
Future Machine data/boundaries/manifest, worker lifecycle and resident suite
33 passed; final resident-only suite 6 passed. `git diff --check` passed.
Playwright city-lab smoke was attempted twice but server startup failed with
EADDRINUSE on ports 3100 and 3195; browser behavior remains unverified. Existing
API tests exercise real disposable workers, SQLite persistence and deterministic
replay. No deployment, production changes, commit or PR publication performed.

Limitations: residents are synthetic monthly adult proxies, with a simple social
tie rule and observational needs; daily activities and playable control remain
with Population. Context event links are explicitly not causal proof. Persisted
experiments regenerate resident detail by versioned replay, rather than storing
every full resident checkpoint in SQLite. Existing City event views expose the
new records; dedicated resident navigation and cross-model mapping remain future
work. Old 1.0.0 replay requires its original interpreter, which is not supplied.
Final API acceptance was strengthened to a complete twelve-month saved experiment:
12 city-system tests passed, including replayed resident memories and month-12
resident events from real worker/SQLite integration. This supersedes the earlier
three-month API fixture. Final whitespace check passed.

## Event-referenced resident dialogue — SHE-258

Next slice: use the existing House resident type and its retained Story event log
from the Population checkpoint. Add scripted recollections in the normal household
Activity drawer. Require a unique nonempty event ID, an actual participant who is
still in the inspected household, and a record at or before the displayed minute.
Clicking a line opens that exact record. No new events or generated dialogue.
Acceptance: render seed-42 real completed-action records, reject missing/unknown
or ambiguous IDs, and compare fresh runs plus checkpoint restore. This is the
Population/House clock only; no monthly City or drainage identity mapping.
Risk: retained logs are bounded, so expired records must suppress their lines.

Delivered: `world/house/event-dialogue.js` and Activity drawer integration;
contract in `world/house/story-contract.md`, focused regression and browser test.
48 focused Bun tests passed (262 assertions), including real seed-42 completed
rest actions, independent rerun, checkpoint restore and fail-closed citations.
Browser execution remains unverified: configured servers failed to bind on both
3100 and isolated 39158; a server-free Playwright attempt also failed because
macOS sandbox denied Chromium MachPortRendezvous bootstrap registration. The
committed browser test covers displayed IDs, source click, refresh and missing-ID
suppression and must run on a browser-capable host. A recording-DOM integration
test also verified the production renderer attaches exact retained IDs and removes
uncited records. No deployment or data change.

## Save format migration — SHE-200

Delivered slice: monthly City experiment saves, the authority exercised by SHE-59
and Future Machine. Format v1 is separate from model/rules VERSION. The sole
historical format (unversioned v0) migrates on read by adding metadata on a clone;
SQLite originals and recorded run outcomes remain unchanged. Unknown formats
fail closed. New manifests persist the format version in both existing copies.
Migration receipts disclose from/to, outcomeChanged:false and verification limits.

Acceptance: test each supported migration, idempotence, input preservation,
unsupported formats, real API save/reopen/replay, and a deliberately changed
recorded outcome returning HTTP409 without overwriting evidence. Replay compares
all stored final metrics with recomputation, including missing/extra keys;
unavailable evidence also returns409. Model version unavailability retains the
existing explicit error. No fallback overwrites a saved outcome.

Limits: verification does not cover intermediate events or full-state equality;
legacy summary saves never stored that evidence. This slice does not migrate
Population/House, Decision Studio, or independent Reality share formats. Future
format changes require another ordered migration and regression test; changed
simulation equations still require a model VERSION bump. No deployment or
production data mutation. Verification results recorded after execution below.

Actual verification: 14/14 tests passed across save migration, Future Machine
storage/data and SHE-59 sweep suites (117 assertions); 29/29 passed across
migration, City systems, manifest validation, boundaries and scrub identity
(497 assertions). The migration suite appears in both runs. `git diff --check`
passed. No configured lint/type-check scripts. Focused real-worker/SQLite API
integration covers the changed server path; no browser rendering changed and
Playwright was not run. Remaining expansion: inventory and migrate other engines'
independent save contracts before claiming application-wide format coverage.

## AI Player Testing Lab — SHE-187

Next integrated slice: reuse the public Riverside Bakery first-play browser journey
with scripted policies for early intervention, last chance, too-late intervention,
and malformed shared recipes. Prerequisites: Bun, Playwright Chromium, local app.
Acceptance: browser journeys record ordered steps, observed final state, policy seed,
fixed model seed/version and source revision; replay compares independently recorded
observations. Failed runs produce Linear Triage issues only via explicit operator
submission, without assignment or dispatch labels. Tests cover policies, replay and
triage failure paths. Risks: scripted players cannot assess confusion or fun; bakery
is synthetic and has no model randomness; browser/server availability may block live
verification. SHE-29 and SHE-62 remain human acceptance gates.

Implemented this slice in `tools/player-lab/`: four bounded public-control policies,
JSON observations and Playwright traces, source-fingerprinted replay, explicit
Linear preview/submission with Triage-only state resolution and exclusive local
submission receipts. Repository commands: `player-lab`, `player-lab:triage`,
`test:player-lab`. Transport tests verify no assignment/labels and refusal when
Triage is absent; action-failure tests retain provenance and final observations.

Verification: `bun test test/player-lab.test.js test/bakery-journey.test.js
test/bakery-scenario.test.js` passed 11 tests / 67 assertions; `git diff --check`
passed. Frozen dependency install succeeded with `TMPDIR=/private/tmp`. Attempts
to start the normal server on ports 3100 and 39879 reported EADDRINUSE. Direct
lab launch reached installed Chromium but macOS rejected its MachPortRendezvous
bootstrap registration (Permission denied). Thus browser completion, actual
browser replay equivalence and live Linear submission remain unverified. No real
finding or synthetic test issue was published. Next action: run the documented
suite and replay on a host that permits Chromium and local listening; inspect
actual failures and submit only reproducible findings to Triage. Broader quest
coverage and human judgments of confusion/fun remain outside this bounded slice.
The package shortcut also passed with `bun run --bun test:player-lab` (11/11).
Without `--bun`, this checkout resolves an uninitialized local `node_modules/bun`
shim and fails before tests; direct Bun and the `--bun` form are verified.

## Emergent quests and shared worlds — SHE-209

Next slice: derive requests from monthly CityState rather than fixed entity IDs,
track objectives on every engine step, and expose recorded completions in Living
City replay. Prerequisites: existing City engine, immutable checkpoints and paired
commute recipe. Acceptance: source entity/metric/time/version/seed citations,
state-driven completion receipts, deterministic replay, missing-data handling,
and a scenario contract allowing multiple named players with revision conflicts
rejected. Tasks: implement discovery/lifecycle; integrate worker replay and UI;
verify real engine transitions and local multi-player commands.

Shared play is a later phase: this slice supplies a local authoritative scenario
contract, not hosted synchronization, authentication or cross-browser sessions.
Rules are explicit synthetic objectives, not causal attribution to a player.
Existing commute recipes and their engine inputs remain unchanged.
Status: local quest slice implemented. Discovery scans current entities; replay
checks each monthly state and records first completion evidence. The request
panel shows selected-future status. A pure multi-player scenario authority
supports named participants, command attribution and optimistic revision checks;
remote play remains pending. Interface: [quest contract](../world/living-city/quests-contract.md).
Verification: focused quest, replay, council, network, recipe and City-system
suites passed: 27 tests, 257 assertions, zero failures; `git diff --check` passed. Browser suite attempted on ports 3100 and
3819; both local server launches failed with EADDRINUSE, so browser rendering
and interaction remain unverified. No deployment or production changes.

## SHE-224 — Probability clouds

Slice: reuse the completed paired ensemble at its shared clock, map every located
modeled structure's presence count to opacity, and retain run/seed provenance.
The core already visits all modeled buildings/locations; loaded geography outside
the model remains unavailable. No invented presence is assigned to it.
Acceptance: exact count/denominator alpha, zero omitted, full presence opaque,
visible seed/count legend, repeatable rendering. WebGL keeps two batches using
RGBA vertex colors; SVG fallback uses exact count buckets (at most 100), replacing
the previous eight color buckets. A Canvas adapter uses the same count ratios.
Risks: overlapping strokes composite; alpha describes individual strokes, not
combined pixel brightness. Cross-device raster hashes are not guaranteed.
Verification and usability status recorded below after checks.

Delivered: existing WebGL and SVG entry points now show exact frequency alpha;
legend shows seeds, arm, denominator and endpoint explanation. Added Canvas
adapter, endpoint/fraction tests and browser replay/hash/legend regression.
Actual verification: `bun test test/reality-ensemble-view.test.js
world/reality/ensemble.test.js` passed 12 tests / 99 assertions. Playwright could
not start its server on either 3184 or 41983 (Bun listen EADDRINUSE); no browser
assertions or image hashes were observed. The added browser test is pending a
host with working server binding. Five-person comprehension and city-scale
readability/kill-criterion evaluation remain unperformed. No deployment.

## SHE-196 — feature voting and feedback

Extend the existing `/vote-on-patch` ballot and private patch-vote store rather
than duplicating it or simulation feedback presentation. Own ops/patch-voting,
world/patch-voting and focused tests. Prerequisites: existing signing secret and
private database. Next slice: explicit per-session opt-in, private typed reports
with optional manually supplied replay seed, and local-only triage/duplicate
merge. Acceptance: no cookie on read; no collection without consent; reports
never public; atomic duplicate merge; submit/error/opt-out browser checks.
Risks: browser identity is best effort, seed alone is not a complete replay
recipe, no production activation or automated improvement-service handoff.

Delivered: extended existing ballot/API; no cookie on reads or rejected writes;
consent required for every vote/report; typed private feedback and optional seed;
local triage lists advisory tallies and reports; atomic idea merge preserves
source text and target reference. Existing suggestions migrate as ideas. No
simulation state, execution service, public report endpoint or production change.
Operator contract: ops/patch-voting/README.md. No new backend or parallel store.

Verification: `bun test test/patch-voting.test.js test/patch-feedback-ui.test.js`
passed 7 tests / 39 assertions. Covers collection rejection, private report,
seed absence/presence, duplicate/cycle rejection, legacy migration/reopen,
submit, network error, and opt-out using the actual controller with DOM doubles.
`git diff --check` passed. Production entry integration command
`bun test test/patch-voting-server.test.js` blocked before startup: Bun listen
EADDRINUSE even at PORT=0 in this environment. Playwright dependency absent;
no browser screenshots or visual validation claimed. Next verification: install
locked dependencies and run the production test and browser smoke at
/vote-on-patch in an environment allowing local listen. No commit/PR/deploy.

## SHE-201 — performance tooling and budgets

Slice: extend the existing city benchmark harness across its six permanent routes
and the WebGL2/WebGPU backend matrix. Reuse the fixed scripted camera and 500-person
synthetic benchmark. World streaming remains SHE-158. SHE-40 has no measured
hardware baseline in its issue; provisional guardrails must be calibrated rather
than represented as certified mobile/laptop targets.

Acceptance implemented: explicit per-route/backend limits for load-to-render time,
frame p95 and sampled peak JS heap; missing/nonfinite/negative measurements fail;
backend fallback fails; profiles, traces and JSON reports retained after errors;
PR CI runs all six routes on Chromium WebGL2 and always uploads artifacts.
Default local command includes both backends. Hardware WebGPU and additional
application surfaces (House, Decision Studio, etc.) remain outside this first
city-renderer slice; these require their own route/readiness adapters and baselines.

Verification: `bun test test/performance-budgets.test.js test/render-performance.test.js`
passed 10 tests / 290 assertions. `git diff --check` passed. Dependencies installed
with `TMPDIR=/private/tmp bun install --frozen-lockfile`. Browser measurement blocked:
server listen failed with EADDRINUSE on both 3198 and 39127 in this environment.
No measured performance pass or WebGPU hardware coverage claimed. CI and actual
hardware runs remain required before treating provisional limits as calibrated.
See `docs/performance-budgets.md` for commands, metric scope and artifacts.

## SHE-188 — Uncertainty Explorer

Next integrated slice: extend Experiment Lab's recorded seeded batch with per-outcome
empirical distributions and Pearson sensitivity rankings, and an assumption Research
Library backed by the existing evidence records. Report verification, validation,
and uncertainty separately; preserve snapshot replay and export the same analysis.
Acceptance: seed/value provenance, missing and constant outcomes, outcome selection,
confidence/source navigation, deterministic analysis, and normal-route browser smoke.
Risk: correlated scenario inputs make association non-causal; finite samples do not
bound structural uncertainty. Missing sources must remain explicitly unsourced.

Implemented locally: `world/uncertainty-explorer.js` computes a versioned empirical
seed distribution for score and every declared/returned metric, including missing
counts, percentile interpolation, constant bins, seed/run provenance and per-metric
Pearson rankings. The Lab mounts outcome selection and a Research Library from
existing variable evidence; assumption links expose confidence and external sources
when recorded. The scientific report separates uncertainty, verification and the
absence of empirical validation. Records and portable bundles retain the same
analysis; old snapshots regenerate it from their stored batch. No new model or
cross-model identity mapping was introduced. Null/absent sensitivity values no
longer become zero. Correlation is screening, not intervention effect attribution.

Acceptance evidence: 48 tests across 14 focused/regression files passed (459
assertions), including the real civic adapter → seeded batch → record → bundle
journey and exact replay, missing/nonfinite/constant/insufficient samples, opposite
metric sensitivities and safe source attribution. Browser entry bundle built with
Bun (38 modules); `git diff --check` passed. Added normal-route Playwright coverage
for loading, running, outcome selection, source navigation, snapshot reload and
self-check. Execution is unverified: local Bun server startup returned EADDRINUSE
on ports 31918 and 41888 before any browser test ran. Next action is rerun
`bunx playwright test --config test/uncertainty-explorer.browser.config.js` on a
host permitting the local server. No deployment or production mutation performed.

## Full-game accessibility — SHE-199

First integrated increment: `/game/:sceneId` conversations and workbench controls.
Prerequisites audited: World has its own nonmodal accessibility helper; it does
not cover the React game overlay or other simulation surfaces. No shared full-game
accessibility contract currently exists. Native dialog owns conversation focus,
background isolation and restoration; existing conversation events and choices
remain unchanged. Text editing must not trigger choice or scene shortcuts.

Implemented: named native conversation modal, explicit dismissal at every node,
labels for question/rules/raise inputs, visible keyboard focus and CSS reduced
motion for the game overlay. Acceptance browser test uses runtime scene and
interaction events to exercise typing, focus containment and Escape. Existing
startup smoke remains part of verification. Dependency install passed with
`TMPDIR=/private/tmp bun install --frozen-lockfile`. Both focused Playwright
attempts stopped before server startup: local `node_modules` Bun shim reports
its postinstall script was not run. Browser behavior is therefore unverified.
Bun's JSX build and whitespace validation are recorded below after execution.

Remaining: inventory and verify every World/House/Business/Decision/FlowMap/
Council and companion system; replace pointer-only canvas picking with semantic
entity/action navigation; test switch input; audit rendered contrast at WCAG AA
(4.5:1 normal text, 3:1 large text and control boundaries); connect reduced motion
to camera, particles, flashing and other renderer animation paths; real screen
reader checks. CSS suppression alone does not reduce canvas animation. SHE-199
remains incomplete; no full-game compliance or release readiness is claimed.

Actual static verification: `bun build game/main.jsx --target browser --external
'/game/index.js' --external react --external react-dom/client --external
react-router --outfile /private/tmp/she199-game.js` passed; `git diff --check`
passed. No deployment or production writes performed.

## SHE-40 — first-interaction performance budgets

Next slice: measure homepage → Play Demo → Month 16 under declared mobile/laptop
emulation; derive budgets from three cold samples with a documented 25% allowance.
Owned files are the dedicated performance harness/config/JSON, calibration module,
unit test, CI workflow, and [performance report](first-interaction-performance.md).
No runtime interfaces or simulation contracts change. SHE-11 cold-start evidence
remains a prerequisite for broader renderer/device claims and is still Backlog.

Implemented: reproducible CI reports with host/browser/profile/commit and simulation
provenance, budget proposal generation, and fail-closed uncalibrated enforcement.
Acceptance pending: successful baseline CI, reviewed numeric limits and a fixed-limit
browser run. Local unit checks pass (2 tests, 10 assertions); browser execution is
blocked by sandbox socket EPERM. Memory measures sampled main-page JS heap only;
total peak memory and physical devices remain unsupported. Branch `mini/SHE-40`;
no PR, merge or deployment. See the report for exact reproduction commands and
limitations. Do not mark the issue complete based on calibration infrastructure.

## ODD social model descriptions — SHE-190

Slice: inventory independent individual-based social mechanisms and shared
submodels, read executable rules and existing contracts, write seven-element
ODD descriptions with local assumptions and reproduction boundaries, and require
code-to-description review through AGENTS.md and the PR template. Prerequisites:
existing product design, Population model card, City and subsystem contracts.
Acceptance: every inventoried ABM has an ODD, linked source/verification entry
points, explicit assumptions and a documented reviewer evidence requirement.
Risk: a file called model is not necessarily an ABM; classify aggregate engines
and read-only views explicitly rather than claiming new simulation authorities.

Delivered nine descriptions under docs/models, including Population/House, City,
legacy World, civic prototype, idea diffusion, Collective Mind, two social games
and the bounded transfer fixture. No runtime equations, schemas or versions
changed. Existing module documents remain detailed contracts linked by the ODD.
Verification results are recorded below after local checks. Browser behavior is
unchanged; Playwright is inapplicable. Actual reviewer/branch-protection enforcement
is a repository hosting responsibility; this change establishes the review rule
and evidence fields, not proof of a future human approval.

Actual local evidence (2026-11-12): nine seven-section ODD files and all their
local Markdown links validated; git diff --check passed. Focused civic/diffusion/
Collective Mind/bar/count suites: 45 passed. Population/culture/weather/playback/
City/unblock/API suites: 57 passed (13.33s); House: 21 passed. Party: 19 passed,
one WebSocket test failed to bind a local listener (EADDRINUSE). The initial
combined run reached four passing checkpoint checks but its worker continuation
test timed out at 30 seconds and the process stopped progressing; interrupted
that process and completed the other suites separately. No claim that the worker
checkpoint integration or local WebSocket integration passed. No runtime changes
were made to address those environment/test limitations. Review performed against
source included fixed civic-agent aggregates, synchronous opinion updates, exact
idea adoption/fading, City dependency ordering and Population/legacy clock
boundaries; corrected legacy step wording to its whole-minute validation contract.

## SHE-220 — E6 consumer-device soak

Next slice: versioned manual capture contract and CLI evidence checker, using the
issue's full E6 protocol because `docs/research/million-agent-architectures.md`
is absent in this checkout. Existing renderer and bounded synthetic CPU fixtures
cannot establish a sustained million-resident worker claim. No additional agents
are needed for this sequential contract/documentation slice.

Acceptance: require twenty minute records for each render mode, preserve device,
model/rules/seed/scenario provenance, distinguish unavailable measurements, and
report provisional T2 retention and mobile OOM outcomes without treating missing
observations as passing. Verify boundary/failure cases and CLI input/output.
Physical T1–T4 runs, a population-specific worker capture adapter, and SHE-177
threshold ratification remain prerequisites to completing E6. No deployment.

Delivered this slice: `scripts/soak-evidence.js`, focused contract/CLI tests and
[device capture protocol](research/consumer-hardware-soak.md). Actual verification:
5 Bun tests passed, 33 assertions; no browser behavior changed so Playwright is
inapplicable. Checker validates both twenty-minute modes and reports proposed
per-mode gates; explicit unavailable metrics remain human-review limitations.
No device soak, battery, thermal, worker-scale, fallback or million-population
result is claimed. Physical matrix and capture adapter remain pending; E6 is
incomplete. No Linear state change, commit, PR or deployment performed.

## SHE-207 research-to-code contract slice — November 12, 2026

Reuse the existing weighted research lane and source-only Symphony lifecycle.
Own ops/research_pipeline, research worker template guidance and this plan entry.
Prerequisites: existing trusted coordinator readiness/ownership/resource reviews;
research brief authoring before dispatch. Implement brief validation, reproducible
versioned model manifests, independent engineering/scientific review bindings and
read-only CLI. Acceptance: neither gate substitutes for the other; changed model
or brief invalidates review; intended use explicitly gameplay/experiments;
malformed inputs fail closed; no command execution or remote mutations.

Implemented local slice and documented operator handoff. Synthetic example is
NOT_EVALUATED; no scientific model or live dispatch is claimed. Structural checks
cannot authenticate reviewer identities or substantiate evidence. Live host
installation, protected review enforcement and a real research pilot remain
follow-up; existing pilot/pressure filters were preserved.

Verification: 5 research contract tests and 19 existing Symphony tests pass;
`git diff --check` passes. No browser behavior changed; Playwright inapplicable.
The Linear workflow template now requires both existing dispatch labels.

## Reality Gap Explorer — SHE-204

Next integrated slice: a research-hub entry to a versioned historical comparison
import, shared-axis chart with observed/model intervals, per-date errors and a
persistent browser-local human triage queue. Dependencies: existing static World
routing and backtest scoring conventions. One owner implements the contract
before its dependent UI and tests; no independent implementation delegation.
Acceptance: strict identity/unit/date alignment; explicit missing observations;
finite errors and zero-observation percentage handling; run/source/seed/input
provenance; deterministic duplicate-safe triage drafts; reload and export; focused
unit and browser integration checks. No external issue creation or automatic
execution. Risks: imported provenance is asserted by the user, intervals do not
establish causality, and local storage is device-specific. No default empirical
or illustrative rent data. Actual verification and remaining limits follow below.

Delivered: `world/reality-gap/{model.js,page.js,index.html,README.md}` and research
hub link. The strict importer aligns one declared metric/geography/unit basis,
plots actual calendar dates and supplied observed/model bounds, reports signed,
absolute and percentage errors, marks missing/initialization points unscored,
and drafts threshold crossings into persistent local triage. Drafts retain the
full versioned inputs and evidence, require human review, deduplicate replay and
reject conflicting evidence under a reused identity. Export supports handoff.
No strategy-document rent figures or default observations were used.

Verification: `bun test test/reality-gap.test.js test/decision-intelligence.test.js`
passed 16 tests / 87 assertions; `git diff --check` passed. Added browser journey
covers the actual research hub link, import, chart, missing data, idempotent
drafting, reload, JSON export and invalid import. Playwright execution is blocked
before browser startup: app server bind reports EADDRINUSE on default 3100 and
isolated 3194/48193; no browser pass claimed. No lint/type scripts exist in the
package manifest. Review confirmed no server routing change is necessary: World
static routing already serves the new directory.

Limits/next action: browser smoke remains to run where app binding is available.
This delivered slice scores imported historical runs; upstream calibration and
pre-cutoff input provenance are user-supplied, not independently verified here.
Drafts are local research issues, not remotely published Linear issues. A shared
triage backend/explicit publication workflow and automated improved-model reruns
remain follow-on integrations. No deployment or production data changes.

Final combined regression check including existing historical backtest leakage,
housing adapter and source-owned diagnostic tests:
`bun test test/decision-analysis.test.js test/reality-gap.test.js test/research-institutions.test.js test/decision-intelligence.test.js`
passed 32 tests / 225 assertions. Final whitespace check passed.

## Animation, audio and cinematics — SHE-198

Next integrated slice: shared bounded binary acquisition for the existing game bear
GLB and collision sound; live reduced-motion and persisted volume controls; explicit
skip/replay for the existing recorded-divergence cinematic. Existing model, audio,
Three loader and cinematic clock are prerequisites. No simulation authority changes.
Acceptance: measured per-kind and aggregate byte caps (including concurrent loads),
retryable failures, teardown, normal game entry integration, preference changes,
and deterministic cinematic play/pause/skip/replay. Engineering budgets are limits,
not device performance measurements. External GLTF resources must be rejected to
prevent bypassing the acquisition budget. Browser smoke plus focused unit checks.

Delivered: `shared/media` owns the versioned streaming byte/cache boundary,
embedded GLB and animation-work checks, shared motion/volume preferences and
controls. Game bear/collision and household cue/fallback acquisition now use it.
The comparison scene observes live OS motion changes and the persisted override;
its existing director now exposes Skip and Replay with a 60-second ceiling.
Simulation events, run identity and six-second divergence hold stay authoritative.
Interface, budgets and scope are documented in `shared/media/README.md` and
`game/README.md`. Existing standalone Soundboard and static scenery are outside
this animation/sound playback slice. No authored content or causal graph invented.

Acceptance evidence (2026-11-12): focused command in the media README passed
33 tests, 164 assertions, 0 failures; 1 existing opt-in Chromium test skipped.
The production bear parsed through Three GLTFLoader: 2 clips, 10 tracks, 44 keys.
Browser-target builds of game, Future Machine and household sound entrypoints
passed; Bun-target server build passed; `git diff --check` passed.
`bun install --frozen-lockfile` required `TMPDIR=/private/tmp` and then succeeded.
Playwright game smoke could not start: repository launcher first hit a local Bun
postinstall shim, then an absolute-Bun temporary configuration reached server
startup but listen failed EADDRINUSE on both 3100 and 39878. No browser playback,
screenshot, visual/codec or device-performance result is claimed. Added focused
normal-route browser cases for preferences and skip/replay; next action is run
those plus the game smoke where server binding is available. No deploy or merge.

## Simulation Benchmark Arena — SHE-191

Next integrated slice: a versioned monthly City standard suite, adapter contract,
sequential execution/replay, immutable score files and CLI side-by-side comparison.
Prerequisites: existing City state validation, deterministic seed rules and hashing.
One owner implements the shared runner/adapter/CLI together; independent agent
work would compete on these interfaces. Acceptance: baseline, housing, flood and
minimum-population cases across fixed boundary seeds; retain per-case failures,
counts, digests, resource measurements, observed-history alignment and seed bands;
compare only identical suite/history hashes. Tests cover real engine replay,
missing evidence, invalid metrics, failures and incompatible comparisons.
Risks: no empirical historical dataset or historical executable versions exist in
this checkout; accuracy must be unavailable without supplied evidence. RSS samples
are process measurements, not peak model memory. No production or browser changes.

Delivered: `world/benchmark/{arena,city}.js`, executable
`scripts/benchmark-arena.js`, contract/limitations in `docs/benchmark-arena.md`
and focused regression tests. CLI archive/restart/comparison test runs the real
20-case standard suite twice. Actual standalone measurement:20/20cases,
0failures/0replaymismatches; accuracy unavailable, as intended without observed
history. Initial measured execution sum480.33ms and max sampled RSS102465536bytes
are local noisy observations, not capacity guarantees. Focused6tests/47assertions
passed, and preceding integrated replay/count check18tests/349assertions passed.
No lint/type-check command is configured. No browser behavior changed, so
Playwright is inapplicable. Historical executable adapters, an independently
aligned observed dataset, calibrated uncertainty and hard process timeout/crash
isolation remain explicit limits; the arena does not invent those prerequisites.
Final combined gate:19tests passed,356assertions,11.43s; `git diff --check`
passed. Includes CLI durable archive/restart comparison and unchanged existing
agent-count and independent seed-replay regression suites.

## Scientific Data Export — SHE-193

Slice: export the existing validated Future Machine canonical receipt through a
local CLI into a new dataset directory. Prerequisites: supported synthetic v1
provenance and receipt checksums; Python/PyArrow for Parquet. Acceptance: typed
paired metric rows, JSON/CSV/Parquet, manifest/source/license classification,
full machine-readable provenance, schema and dictionary; deterministic text
files; reject malformed input and existing destinations. Keep other model
adapters out of this slice. Risks: no source dataset license is declared;
report NOASSERTION rather than invent permission. Source units may be unknown.

Implemented `shared/scientific-export/` and `scripts/export-scientific-data.js`
with explicit JSON/CSV-only mode and default Parquet encoding/readback. Source
receipt remains unchanged and retained in full. Tests exercise actual City
receipts, uint32 seed, paired zero results, invalid values/checksum, publication,
overwrite protection and independent Python JSON/CSV/checksum reads. Parquet
schema/round-trip integration is conditional on PyArrow availability.

Verification on this sandbox: new JSON/CSV tests pass; PyArrow is absent and pip
cannot resolve pypi.org, so Parquet/notebook PyArrow validation remains pending.
Existing receipt tests: three pass; CLI server test cannot bind local port 0
(EADDRINUSE). No browser behavior changed, so Playwright is not applicable.
No deployment, production writes, commit or PR. Next gate: install the recorded
PyArrow dependency and run the Parquet integration test in a network-enabled
Python environment. Coverage is selected-month Future Machine metrics only;
other simulation authorities and public FAIR catalog hosting remain future work.
Final focused gate: 5 passed, 1 PyArrow skip, 0 failures, 81 assertions
(includes three receipt regressions; excludes the separately observed socket-bound
CLI case). Python encoder compiles and `git diff --check` passes.

## Research Library and Evidence Graph — SHE-185

Next integrated slice: a browser-safe versioned library, housing parameter/equation/
metric inventory derived from existing registries, civic experiment projection,
and a discoverable read-only browser with assumptions, evidence gaps and JSON
import/export. No simulation values change. Shared library snapshots are the read
contract for future calibration, validation and scientific export consumers.
Acceptance: every inventoried rule is sourced or explicitly an assumption; source
license/retrieval metadata and support links validated; unresolved/dangling links
and empirical gaps remain visible; filters and export preserve the same graph.
Prerequisites: existing housing schema/causal registry and civic evidence layer.
Risks: there is no complete cross-engine rule inventory or verified paper corpus;
implementation references are not empirical validation. Other engines and future
consumer integrations must remain explicit gaps rather than claimed coverage.

Delivered working increment: `/world/research-library.html`, linked from `/routes`
and Decision Studio; 52 housing records (model1.2.0), two local implementation
references, assumption/search filters, visible empirical/license/dangling-link
gaps, validated session JSON import and lossless export. Civic evidence attachment
preserves source license/retrieval metadata and includes the versioned read
snapshot. No invented paper, observation, retrieval date or license permission.
Interface and limits: `world/research-library/README.md`.

Verification:35tests passed/0failed/2326assertions across research-library,
evidence-registry, civic-experiment, housing-model, experiment-verification and
metric-registry suites. Browser-target bundle passed (5modules); diff whitespace
check passed. An initial search expectation omitted equations containing the
queried parameter; corrected to include both valid matches. Browser smoke remains
unverified: Playwright dependencies absent and isolated server binds on31885 and
32851 both returned EADDRINUSE in this sandbox. No deployment or Git publication.

SHE-185 remains partial: next inventory Population/City/Business rule registries,
retrieve/review real papers and datasets with confirmed license provenance, and
wire the calibration lab, model validation and scientific export workflows to the
shared snapshot. NOASSERTION is deliberately a visible license-review gap, not
completion of the verified-license requirement. No complete cross-model evidence
coverage or implemented future consumer is claimed.

## SHE-206 — draft-only AI research role

Next slice: add an operator entry point and injectable research-agent role using
supplied, versioned Research Library records and simulation rules. Reuse the
existing improvement inbox for durable triage; preserve its frozen v1 contract
and all execution holds. No provider provisioning or acquisition service is
required. Tasks: build bounded context/prompt and evidence-gap inventory; validate
structured agent output; adapt drafts into research proposals; verify persisted
replay and rejection paths. Acceptance: four research activities, explicit
hypothesis/data sources/acceptance for experiments, each claim resolved to a
library entry or labeled unsupported, all saved output draft-only. Risk: source
links establish provenance, not scientific support; metadata-only citations must
remain unsupported. Full structured drafts must fit the existing 2,000-character
hypothesis field; oversize output is rejected rather than truncated.

SHE-206 delivered: `ops/research_agents/` adds prompt/context preparation, per-rule
evidence-gap inventory, four typed research activities, injectable model callback,
strict claim/experiment validation, and CLI prepare/dry-run/record/read-triage.
Normalized drafts retain source links, unsupported status, context hash and role
version inside the existing inbox contract. No dispatcher, external issue writer
or provider credentials were added. Changed output shares a stable topic key for
review; replay does not duplicate drafts. Seven focused tests pass, including
real CLI prepare/intake/triage, persistence/replay, citation and required-field
rejection, and proof that proposed argv is never executed. All 26 existing
improvement inbox tests pass; `git diff --check` passes. Browser behavior is
unchanged, so Playwright is not applicable. Limits: operator supplies library
snapshot and model response (or injected generator); citations are not factual
verification; compact normalized drafts must fit the frozen 2,000-character
hypothesis field. Provider integration and library acquisition remain separate
work; this slice requires no live service activation.

## Emergence feasibility audit — SHE-238

Completed a source/test audit at `b963dd353538294cb0fbf5d34d5283fad6e10e68`:
[report](emergence-feasibility-audit.md). Covers actual Population/House agent
state, relationships, employment, movement, local business activity, events and
persistence; supplies ten deterministic scenario specifications, each with exact
implementation points, gaps, measures, UI exposure, regressions and complexity.
Distinguishes authored initial conditions, existing helper/worker tests, synthetic
model results and proposed end-to-end scenarios. No gameplay changes or ten-run
scenario artifact suite are claimed.

Acceptance evidence: focused Bun run passed 81 tests across 10 files, 527
assertions, 14.38s, including worker continuation and SQLite persistence;
`git diff --check` passed. Browser checks skipped for documentation-only scope.
No commit/PR published by this audit.

Recommended next integrated slice: save/reopen a genuine cooking/shared-dinner
receipt through World → House, reusing authoritative action/payment records and
checkpoints. Prerequisites: explicit versioned save/report validation, bounded
cited-evidence retention, exact identity/time links and revision handling.
Acceptance: one ingredient charge, elapsed preparation/attendance, immutable
parent, deterministic mid-action continuation and normal-entry browser report
reload, including rejection/missing-evidence paths. Main risks: event eviction,
checkpoint size and fabricated causal interpretation. Follow with an explained
employer cash-exhaustion → job loss → actual settlement slice, then a saved park
encounter after an existing hotspot improvement. These three slices are proposed,
not implemented; full scope and acceptance criteria are in the report.

## SHE-241 — known production build release gate

Slice: explicitly validate both live health build IDs in the production smoke,
independently of the browser journey, while retaining expected-commit equality
and readiness checks. Preserve liveness/readiness response contracts: production
without a valid build argument continues to report `unknown`; the release gate
rejects that report. Prerequisites: Bun and installed Playwright dependencies.
Acceptance: valid local production build passes the API smoke; omitted build ID
fails; production normalization tests cover invalid and valid IDs. Risk: releases
without the build argument are blocked until rebuilt with the candidate commit.

Read-only production discovery: `fly releases -a happybearlandia --json` was
blocked attempting to create a permissions file under `~/.fly`; the public
readiness URL was inaccessible through the web tool. Current image build args
remain unconfirmed. The issue records `unknown` on 2026-11-11; this is historical
evidence, not a fresh observation. No deployment or configuration change made.
Validation: `bun test test/release-health.test.js` passed 18 tests (56
assertions). `git diff --check` passed. The local production-server smoke attempt
was blocked: Bun could not bind port 31841 (`EADDRINUSE`) and localhost HTTP was
denied with `Operation not permitted`. Neither known-ID pass nor missing-ID
failure is claimed as end-to-end verified. Rerun both API smoke cases on an
unrestricted host using `--grep "known build ID"`; run the full smoke there for
browser coverage. Local expected observations are `abcdef123` with the argument
and `unknown` without it; these are covered by handler/unit tests, not fresh live
observations. The checklist retains the exact build/deploy command and clarifies
that the expected SHA must come from the reviewed candidate. No PR published;
production provenance discovery and host smoke verification remain outstanding.

## Prediction skill against no-change — SHE-244

Slice: add baseline-relative skill to newly resolved Learning Civilization predictions and display it in results/history. Reuse the committed City plan, paired results, units and browser journal. Acceptance: all five metrics, no-change skill 0, perfect skill 1, negative skill, explicit zero-denominator and missing-data handling, and old saved records without rewriting.

Decision: `noChangeError = abs(actual)` because the forecast target is the adjusted-minus-control delta, so no change predicts zero. `skill = 1 - absoluteError / noChangeError` is unclamped; negative means worse than no-change. When `noChangeError` is zero, skill is `null` even for a perfect prediction because relative skill is undefined. Missing observations yield both new fields as `null`. Accuracy tolerances and the existing score remain unchanged. Additive fields retain `city-prediction.v1`; old records show unavailable skill and are never rescored. Results describe this synthetic model comparison, not real-world predictive validity.

Delivered in `world/learning/prediction.js`, `test/prediction-league.test.js`, and `test/e2e/learning-civilization.e2e.js`. Focused scoring/journal suite: 6 passed, 79 assertions. Browser regression now checks persisted skill and a legacy record whose fields are absent, including unchanged storage bytes. Browser execution remains unverified: default Node runner cannot parse the existing config's `import.meta`; Bun runner gets EADDRINUSE on both the configured port 54388 and isolated port 54489. No production or deployment changes. No PR created in this source-only workspace.

Example synthetic resolved record (seed 2911, 12-month transit plan, fabricated unemployment observations 18% and 15%; this is a scoring fixture, not a simulation run):

```json
{"version":"city-prediction.v1","metric":"unemploymentRate","month":14,"unit":"percentage points","expected":-3,"baseline":18,"adjusted":15,"tolerance":10,"state":"scored","actual":-3,"absoluteError":0,"noChangeError":3,"skill":1,"score":100}
```

The example omits `planKey` for readability; real records retain the exact committed recipe key. Skill coverage and distribution can be computed from stored outcomes; this slice adds no telemetry, and these descriptive metrics do not demonstrate game effectiveness.

## Fun Analytics reporting contract — SHE-186

Delivered a bounded homepage reporting slice: five metric definitions with
explicit numerator/denominator and missing-data states, separate named player
and engineering panels. Reuses the universe shell and preserves existing opt-in
local counters. No new collector or identity store; SHE-8 event instrumentation,
SHE-66 dashboard and reviewed SHE-124 cohorts remain prerequisites. SHE-56 is
Todo, so privacy approval and live collection are not complete. See
[definitions, eligibility and privacy handoff](fun-analytics.md).

Acceptance evidence: 9 focused unit/regression tests pass; browser bundle and
`git diff --check` pass. Added homepage Playwright coverage but execution was
blocked by server EADDRINUSE on both default3197 and isolated3296; no browser
verification claimed. Test config accepts an explicit isolated port. Next:
integrate the existing event/cohort contracts when available, define retention
with SHE-56, obtain audit sign-off, then connect actual aggregates. SHE-186 remains
incomplete; no deploy, production mutation, issue completion or audit approval.

## SHE-225 — Detective of Futures

Next slice: a server-owned five-case synthetic Month-120 mystery, entered from
Future Machine. Prerequisites: existing monthly City generator, matched seeds,
anchored recorded evidence, canonical recipe hashing. Acceptance: four shuffled
choices, ID-only saved puzzle links, allowlisted evidence without recipe leakage,
server-counted distinct evidence steps, immutable scored reveal with matched-run
receipt. Verify persistence, replay determinism, invalid requests and browser flow.
Risks: this is an exploratory model, not empirical causal inference; completion
metrics describe attempts, not authenticated unique people. No production rollout.

Implemented: [server/API and storage contract](../ops/detective/README.md),
`ops/detective/api.js`, `world/detective.{html,js}`, normal server route and
Future Machine entry. Five versioned seed/recipe cases, four per-attempt shuffled
choices, allowlisted outcome/evidence responses, canonical SHA-256 answer checks,
immutable reveal/receipt, distinct-step scoring, persisted ID-only attempt URLs,
and aggregate completion/zero-evidence counters are integrated. Evidence trail
summaries reuse SHE-214's builder; raw records stay server-side until reveal.
The saved puzzle is separate from the ordinary City manifest API by design.

Verification: `bun test test/detective.test.js
 test/future-machine-evidence-trail.test.js test/future-machine-data.test.js`
passed 10 tests / 184 assertions, covering all five cases, reveal hashes,
restart durability, invalid steps/answers/IDs, incorrect scores, frozen evidence
counts, deterministic matched replay and existing anchored evidence regressions.
`git diff --check` passed. No lint/typecheck script exists. The focused
`test/detective.browser.config.js` browser journey was attempted twice but the
normal app server failed to bind on ports 39889 and 41927 (EADDRINUSE); browser
behavior remains unverified. No deployment or production changes. Next action:
run that browser test in a host that permits server binding, then conduct player
sessions to measure the 60% success signal and zero-evidence kill criterion.
Single-process file storage and anonymous attempt counts limit public scale.

## Operations Observatory — SHE-202

Next integrated slice: read-only `/tools/operations-observatory/` and
`/api/operations-observatory`, linked from the homepage. Reuse the SHE-180
coordinator report as queue authority and `/api/ready` as the local storage
probe. Optional operator-supplied, sanitized evidence covers Symphony, CI,
verified-feature costs, release gates and player outcomes. No dispatcher,
credentials, remote polling or production changes belong to this slice.

Acceptance: separate engineering and product panels; each links to an issue or
run; timestamps and stale/missing states; actual blocked reasons; failed CI
links; unique verified-feature denominator with explicit USD scope; readiness
never inferred from ticket closure or storage alone. Verify projection/privacy,
missing/malformed inputs, stale evidence, zero denominator and browser normal
route/refresh/mobile/fetch failure. Risk: private host reports contain sensitive
fields; project only documented public fields and never expose raw reports.

Delivered local increment: `ops/operations-observatory.js` projects the existing
coordinator report plus versioned optional evidence at a no-store read-only API;
`tools/operations-observatory/` renders six source-linked panels and live local
storage readiness, with separate product outcomes, minute refresh and explicit
stale/unavailable states. Homepage and Simulation Health link to the normal route.
`docs/operations-observatory.md` documents safe feed configuration, public fields,
USD receipt scope, evidence semantics and remaining host integration ownership.
No live feed is installed; absent reports remain unavailable. No deployment.

Acceptance evidence: 15 focused/API and existing release-health tests pass;
JavaScript syntax and `git diff --check` pass. Playwright suite was implemented
for real normal-server routing, fixture-backed API, source links, refresh failure,
build mismatch/stale gates and 320px layout. Execution is blocked before tests:
Bun cannot bind local ports 54419 or 55382 (`EADDRINUSE` on each); browser layout
and journeys remain unverified. No browser screenshot or live service claim.
Next: run the browser suite on a host permitting the local server, then have the
existing observer owner provide reviewed sanitized coordinator/evidence paths.

## SHE-181 — Reality Calibration Lab

Next integrated slice: browser-accessible housing calibration lab, linked from
Research and Decision Studio. Reuse housing v1.2.0 and evidence.v1 records.
A versioned JSON recipe declares geography, constant-dollar basis, historical
origins with dated input vintages, tuning/validation split and Research Library
citations. Tune only explicitly requested evidence-backed rent_response values;
freeze the selected value before evaluating held-out origins. No live state writes.
Acceptance: errors by metric/year horizon, missing outcomes and failure counts,
measured/synthetic labels, citation anchors, verification/validation/uncertainty
answers, exportable replay recipe/seeds and deterministic regression tests.
Risks: supplied metadata cannot prove historical authenticity; fit does not
identify a causal coefficient. Synthetic fixtures must never imply real accuracy.

Delivered: `world/calibration/` implements the versioned bounded housing lab,
recipe-local Research Library, per-metric/per-horizon errors, seed-matched
baseline/fitted results, missing-value states and full recipe/report downloads.
Research institutions and Decision Studio link to the normal static route.
Only evidence-linked rent_response grid candidates can be proposed, only on
strict tuning improvement; selection freezes before any validation scoring.
Per-seed resolved input/output records retain replay provenance. Other housing
coefficients remain synthetic defaults. No real historical accuracy is claimed.

Verification: 49 tests passed / 0 failed across calibration, historical fitting,
housing invariants/history, evidence registry, decision analysis and full Decision
API integration (2,875 assertions). Deterministic replay and holdout-poisoning
regressions pass. `git diff --check` passed. No repository lint/typecheck script
is configured. Focused Playwright tests were added for Research navigation,
actual model execution, evidence anchors, export, mobile overflow and bad imports;
execution is blocked before browser startup by server bind `EADDRINUSE` on both
3181 and 43981. Browser results remain unverified; rerun
`bunx playwright test --config test/calibration-browser.config.mjs` on a host
that can bind its test server. No deployment, production mutation or remote
publication. Citation authenticity, measurement uncertainty and coefficient
identification still require independent evidence review; this feature does not
supply an empirically validated real-city parameter pack.

## Release Experiment System — SHE-203

Next integrated slice: private operator CLI and server-side routing between two
existing same-origin application paths. Prerequisites: fixed candidate/control
revision references, explicit selected pseudonymous roster, consent evidence or
selection rationale, written success-rate regression threshold and sample floor,
and SHE-67 go/no-go evidence reference. No second SQLite writer or image canary.

Acceptance: stable bounded treatment/control assignment; consent exclusion;
observations tied to assigned participants and evidence; threshold breach creates
an immutable rollback proposal; only an explicit human decision can disable the
candidate or promote everyone. Verify replay, missing samples, invalid decisions,
restart persistence and HTTP routing. Risk: operator evidence is an assertion,
not independently authenticated approval; private filesystem access is the trust
boundary. This slice gates navigation, not direct access to candidate paths or
image deployment. Existing incident/recovery gates remain authoritative.

Delivered: `ops/release-experiments/{system.js,cli.js,README.md}`, opt-in
`server.js` routing, and `test/release-experiments.test.js`. Versioned deterministic
assignment caps treatment at 10% of declared population, excludes missing consent,
records one evidence-linked outcome per participant, and compares observed success
rates with explicit missing counts. Regression produces a retained proposal;
human-recorded approval switches navigation to control. Promotion requires a
closed window, sufficient observations, no proposal and current go/no-go evidence.
Consent requirements continue after promotion. Private signed cookies bind identity
to experiment; no public enrollment or telemetry collection UI is included.

Verification: `bun test test/release-experiments.test.js test/release-health.test.js
test/release-operations-dry-run.test.js`: 18 passed, 1 opt-in HTTP test skipped,
0 failed. `git diff --check` passed. Attempted actual server HTTP smoke failed at
Bun's listener (`EADDRINUSE` on port 0) before requests could run. Re-run with
`HBL_RELEASE_HTTP_TEST=1 bun test test/release-experiments.test.js` on a host that
permits listening. Request-handler routing and persistence/replay are verified;
actual browser/server journey remains unverified, so Playwright was skipped.
No project lint/typecheck command is defined. No deployment or production changes.
Remaining operational gates: trusted cookie enrollment, real consent/outcome
sources, human approval evidence and SHE-60/SHE-67 release review. Navigation gate
does not prevent direct candidate URLs or replace authorization for protected data.

## Automatic model validation — SHE-189

Slice: connect existing calibration/backtest contracts and SHE-59's full replay
seed matrix to a read-only CI job, with a reviewed housing diagnostic error
baseline, named failures and retained reports. Prerequisites: Bun 1.4.2 and
existing City/housing APIs. Acceptance: simulator changes always trigger the job;
accuracy regressions and invariant violations fail with rule diagnostics; no
merge/deploy automation; invariant catalog in model documentation.

Implemented workflow, numerical runner, pinned diagnostic fixture, failure-path
tests and model catalogs. SHE-111 is in review and its proposed hash fixtures
are absent locally; reuse the landed SHE-59 matrix now. Risk: Houston overlapping
ACS vintages are descriptive, not independent forward validation. Baseline
updates require human review; branch protection remains repository-admin scope.
Verification: targeted CI test command passed 64 tests / 2,741 assertions on Bun
1.4.2. Full numerical acceptance passed: Houston error matched the pinned baseline and
106/106 replay cases passed with zero mismatches (50,880 monthly steps).
`git diff --check` passed; the two failure-path tests also passed after report
metadata/progress additions. Local JSON evidence is in the ignored
`test-results/model-validation/report.json`.
No browser behavior changed, so Playwright is inapplicable. No lint/type-check
script exists. CI execution on GitHub remains unverified until publication.

## SHE-194 — World Builder + Time Travel

Next integrated slice: extend `/world/living-city/` with a bounded transit
infrastructure proposal from the currently displayed monthly City checkpoint.
Reuse City construction/governance and network/home inspection; do not map this
state to the separate Population or housing model. One owner implements the
shared model, worker dispatch, panel and tests sequentially.

Acceptance: immutable parent; same seed and scheduled shocks in both arms;
side-by-side recorded outcomes at a common month; enter either arm and branch
again from that displayed state; evidence-backed model records distinguished
from synthetic cost/rule assumptions and unsupported effects. Verify deterministic
replay, invalid/missing inputs and the browser journey. Risks: uncalibrated city
rules, unavailable commutes, construction delays, and session-only history.

Delivered: exact-checkpoint branching in `living-city/builder.js`, worker action,
side-by-side monthly records and event inspection, entry into both arms through
the shared network/home view, and subsequent branching from the entered state.
Original quest comparisons and share recipes retain their existing contracts.
Presets deliberately cover transit infrastructure only; arbitrary buildings and
unsupported physical effects remain outside this slice. Branch retention is
session-only and disclosed next to results.

Verification: 14 focused Bun tests passed (186 assertions), covering deterministic
replay, immutable parent, equal clocks/seeds/shocks, construction completion,
chained branching, invalid input and existing quest/network/council/recipe paths.
An initial new assertion incorrectly checked only the last month's event list;
it now checks the recorded timeline for the completion event. Browser test added
for both entry controls, month scrub, rebranching and invalid horizon. Playwright
could not start the local server: listen returned EADDRINUSE on both 3100 and
3194; browser execution remains unverified in this environment. No lint or type
check script exists in package.json. No deployment or production mutation.
Final integration gate: 26 tests passed, 270 assertions across City systems and
all focused Builder/Living City modules, including SQLite API replay. Browser
entry bundle built successfully (12 modules); `git diff --check` passed.

## SHE-226 — One Life, Many Worlds prototype

Implemented in City Lab → Enter future. Select one shared-initial-state household
in a completed two-arm, Month 0 → 120 experiment with at least 30 runs. Replay
indices 0–29 sequentially, verify endpoint seed/time and household/home identity,
and render endpoint fans plus exact home, savings and burden rows. Selection
changes abort the old collection; cancellation and API errors discard partial
results. No cross-model or cross-city joins, new storage or model changes.

Acceptance evidence: `bun test test/city-life.test.js test/city-worker-call.test.js`
passed 13 tests / 93 assertions, covering sequential collection, paired seeds,
uint32 wraparound, identity/time failures, departures and variance decomposition,
plus real replay-worker/API regressions. Added browser fixture flow in
`test/e2e/city-life.e2e.js`; Playwright setup blocked by server EADDRINUSE on both
3100 and alternate 3416, so browser rendering remains unverified. Fixture browser
test uses synthetic replay responses; a real 60-replay performance/user study is
still needed. No claim that policy beats luck or the success signal is achieved.

Descriptive population variance splits balanced complete pairs into variance of
the two arm means (policy) and mean within-arm variance (luck); show mean paired
change separately. Missing/departed outcomes and undefined burdens are explicit
and excluded with complete-pair N. Informative departure may bias this subset.
The default lab horizon/run count is unchanged; use summary retention, 30 runs
and 120 months for this prototype. Existing workload and two-job server limits
remain authoritative. Next: real saved-run browser/performance validation and
user assessment of whether this endpoint view yields a stable resident story.

Additional integration gate: 24 tests / 134 assertions passed across city-life,
city-systems, project-unblock and server-civic-api; includes SQLite persistence
and real create/poll/query/export/replay API journey. `git diff --check` passed.

## Experiment Registry — SHE-184

Implemented Civic batch slice: extend the Civic Experiment Lab's saved records and existing
reproducibility manifest, rather than introducing another simulation runner.
Prerequisites are the versioned civic model, deterministic world generator,
IndexedDB records and immutable server snapshot store already in this checkout.

Tasks: capture research metadata and source inputs; expose hypothesis/model/
intervention filters in the Lab and persistence API; rerun saved built-in civic
batches against their stored hashes; label result provenance in registry,
inspection and exports. Acceptance includes durable round-trip replay, changed
results and unsupported versions failing explicitly, combined filters, and a
browser save/filter/reopen/replay journey. Legacy snapshots remain readable and
missing provenance is explicitly unknown. External adapters and other simulation
clocks require their own replay adapters; a recorded snapshot alone is not a
verified recomputation. Code release identifiers are retained alongside an
optional supplied Git revision; unavailable revisions must stay explicit.

Implemented: Civic Lab batch auto-recording, editable research metadata,
composed local/API filters, inspection and stored-result replay, labeled
registry/lineage/export projections, and JSON-stable reproducibility hashing.
Records now include content in their identity so changed metadata or results
cannot silently reuse the same ID. See [registry contract](experiment-registry.md).

Acceptance evidence: 34 focused Bun tests passed across registry, records,
reproducibility, persistence/API wiring, adapters, contract, verification, audit
and Pensieve handoff suites. Browser bundle builds (38 modules); `git diff
--check` passes. The focused Playwright journey is included as source but its
execution is blocked here: Bun cannot bind even an ephemeral loopback port
(`EADDRINUSE`), so browser save/reload rendering remains unverified. No package
lint or typecheck command exists. No deployment or production changes performed.

Remaining scope: other engines and live-slider previews are not automatically
registered by this Civic batch slice. External or historical adapter execution
needs a version-specific adapter. Measured imports retain declared provenance,
but observation ingestion/validation is not supplied by this slice. Next action:
run the retained browser journey in a host that permits local listeners before
extending automatic registration to additional simulation authorities.


## Server and research PR integration — November 12, 2026

Integrated original PR heads #70, #79, #87, #88, #89, #97, #108, #110 and #116
with merge commits on `integrate/server-research-prs`, starting from `f5cb05a`.
Both sides of independent documentation additions are retained. GitHub previews,
Detective, Operations Observatory and opt-in release experiments keep their
separate server handlers. Research navigation retains both Reality Gap and
Calibration entries. Performance scripts coexist with model validation.
Registry imports and projections coexist with Uncertainty Explorer outputs.

The shared Living City `advance` helper remains exported and accepts existing
quest history. Builder steps carry that history across months and subsequent
branches, preserving recorded completion evidence. A real seeded regression
checks completed quest records through both continuations. The City worker API
test fixture now supplies independently computed recorded outcome metrics to the
new saved-outcome store contract; strict runtime verification is unchanged.

Verification on Bun 1.4.4: Detective plus evidence/data checks pass after rerunning
its multi-case test with an explicit 60-second timeout (the first run exceeded
the default five seconds). Observatory/release-health: 26 passed. Calibration:
8 passed. Release-experiment/health/dry-run: 30 passed, including actual normal
server HTTP routing. Model-validation/calibration/housing/analysis: 35 passed.
Causal benchmark: 1 passed. Living City/Builder: 15 distinct tests passed,
including the added quest-history regression. City-life/worker: 13 passed.
Registry/records/replay/persistence/audit/handoff/uncertainty/research: 35 passed.
These counts include overlapping suites and are not an aggregate unique count.
The original `experiments/she-234/prototypes.patch` bytes are preserved; its
format-patch signature whitespace is excluded from source whitespace checks.

Playwright attempted the Registry journey and all three Operations Observatory
journeys using the normal local server. Both servers started, but Chromium
failed before page creation: process singleton `socket()` returned Operation not
permitted, with a further ptrace denial. Browser rendering and those four UI
journeys remain unverified in this environment. No deployment or production
mutation was performed by this integration worktree.

## SHE-47 / HBL-W1-034 — truthful comparison image

Branch: `mini/SHE-47`. Scope owned in this slice: new
`world/future-machine/share/card.js`, additive card callback in `main.js` and
`ui/index.js`, focused card tests/config, and sharing documentation. No engine,
API, deployment, production data, or shared record contract changes.

Baseline audit: HBL-W1-033's required sharing infrastructure is present in
`share/index.js` and `main.js`: pinned recipe links, selected-month reopening,
saved identity checks, visible recipe fallback and evidence JSON. These are
reused rather than reimplemented. Existing share tests pass. The missing image
export is now exposed as **Download share card**, enabled with a completed run.

Delivered slice: build detached card data from the selected paired snapshots;
validate evidence identity/completeness and state month/seed/model; render a
self-contained SVG and download a 1200×900 PNG. Include exact recorded housing,
whole-stock rent, link travel and cumulative spending values with units, deltas,
month/calendar, seed, model, synthetic generator version, run and input digest.
No-change and unavailable measurements remain explicit. The card labels synthetic
uncalibrated results, single-seed uncertainty limits and manifest recomputation;
missing-record fallback remains disclosed. It captures the month before async
image decoding. No simulation rerun or scene capture supplies card values.

Acceptance evidence (2026-11-12):
- `bun test test/future-machine-share-card.test.js test/future-machine-share.test.js test/future-machine-ui.test.js`: **15 passed, 1 optional browser test skipped**, 172 assertions. Real monthly engine pairs verify exact Month 0/16/120 values, no-change, missing metrics, mismatched seed/month, escaping and immutable source records.
- `git diff --check`: passed.
- `bunx playwright test --config test/future-machine-share-card.browser.config.js`: blocked before tests by local server `EADDRINUSE` (canonical port 39884 and isolated retry 39947). No listener was returned by `lsof` for 39947.
- Server-free Chromium launch also blocked: macOS MachPort rendezvous bootstrap permission denied. Browser download, PNG repeated-output comparison, screenshot inspection and app smoke remain **unverified**. Committed browser test performs those downloads against real API history and checks unchanged control when run in an environment permitting server/browser startup. No screenshots, PR or commit receipt are claimed.

Next action: run the focused browser config in an unrestricted development
session, inspect paired/no-change PNGs and the full-page control screenshot,
and resolve any rendering findings before marking browser acceptance complete.

## SHE-48 — accessible copy and browser sharing

Audit: existing Future Machine codec, saved identity validation, selected-month
URLs, missing-record disclosure and replay tests already implement the underlying
sharing contract. Reused them; no model, data, seed or provenance changes.
HBL-W1-033 is SHE-46 and remains Backlog in Linear; existing source/test overlap
does not mark that broader audit complete. This direct local implementation does
not promote issues or activate dispatch. Branch: `mini/SHE-48`; no PR/deployment.

Bounded slice owns main.js sharing callbacks, UI controls/styles/docs, matching
Future Machine tests, a dedicated copy browser suite/config and this plan entry.
Acceptance: one keyboard-accessible copy action, supported native share,
announced success/cancel/failure, selectable URL and retry on clipboard denial,
exact saved scenario/month reopen in a fresh browser context. Pending operations
disable both actions; late completion cannot overwrite feedback for another URL.
Existing synthetic model disclosures and URL validation are retained.

Verification: `bun test test/future-machine-share.test.js test/future-machine-ui.test.js`
passed 13 tests / 123 assertions, with the pre-existing browser-gated test skipped.
`bunx playwright test --config test/future-machine-copy.browser.config.js` could
not start its server: Bun reports EADDRINUSE for ports 39884 and 39948, and an
independent `Bun.serve({port:0,...})` probe also fails. Browser success, screenshots,
and actual clipboard/reopen acceptance are therefore pending host verification.
The new suite tests clipboard denial, keyboard selection/retry, fresh-context
reopen, native success, cancellation and failure using controlled browser APIs.
Native OS share-sheet integration is not established by those mocks. No lint or
typecheck scripts are configured. Next: run this suite on a host that permits
local server binding and review its `copy-fallback.png` screenshot before release.

Final local regression command:
`bun test test/future-machine-share.test.js test/future-machine-ui.test.js test/future-machine-boundaries.test.js test/future-machine-manifest-validation.test.js`
passed 25 tests / 331 assertions, 1 browser-gated skip, 0 failures.
`bunx playwright test --config test/future-machine-copy.browser.config.js --list`
discovers both new journeys successfully; `git diff --check` passes.

## SHE-213 — WebKit-safe flagship demo

Slice: preserve monthly City replay while moving address-bar writes to manual
seek, pause/stop, completion, initial load and share. Share computes the current
recipe/month on demand; history failures must not interrupt inspector refresh.
Explicit Canvas selection must bypass Three and OrbitControls imports.
Acceptance: homepage → Play Demo → divergence → timeline → outcomes → WHY in
Chromium, Firefox and WebKit; full demo and 0→120 playback under a synthetic
100-history-writes/30-second limit, paused URL/month agreement, no Three requests
in Canvas. Existing simulation records, seeds and clocks remain unchanged.
Prerequisites: installed Playwright browsers and local Bun server. Physical iPhone
verification is a separate outstanding gate; desktop engines do not prove mobile
support. No deployment or production data changes are authorized by this slice.

Implemented: boundary-only history writes with identical-URL suppression and
nonfatal address-bar failure; fresh share URL generation; Canvas import bypass;
dedicated three-engine Playwright config and canonical CI lane. Chromium journeys
emulate a combined pushState/replaceState rolling limit. Browser assertions cover
full 50-second demo, full 200ms/month timelapse, pause agreement, fresh WHY and
absence of Three requests; existing responsive canonical journey runs per engine.

Actual local verification: 18 tests / 117 assertions passed across
two-futures-demo-controller, future-machine-scene and future-machine-share.
Playwright --list discovers 12 checks in all three engines; git diff --check passes.
Execution attempted twice with an explicit installed Bun binary: local server
binding failed with EADDRINUSE on ports 54419 and 57831 before browser launch.
The default local package Bun shim also fails its missing-postinstall check;
HBL_BUN_EXECUTABLE supports choosing the working binary without changing CI.
No browser pass or physical-device evidence is claimed. Next: run
bunx playwright test --config test/flagship-browser.config.js on a host with
local server access, then record a physical iPhone run before mobile support claims.

## SHE-215 — shared first divergence and calm demo updates

Implemented one `diff/first-divergence.js` rule for the demo, story's first
physical stop and browser evidence helpers: earliest paired mapped building
change, exact ID tie break. Later story stops retain significance ranking;
without a renderable building, other changes remain inspectable as significant
changes. No model, recipe or simulation clock changes.
Director notifications now require a changed caption/status/pause state or whole
second. Coordinator UI updates coalesce per animation frame; unchanged household
options are retained. Seconds sit outside the caption live region, whose text is
written only on caption changes. Visibility pauses elapsed presentation time and
preserves manual pause. Selection invalidates a pending demo and its inspector
survives graphics readiness.

Acceptance evidence: focused model/diff/story/effects/UI/director tests pass,
including seed42 Month16/building-project-policy-1-0, exact-ID ties, hidden at9s /
shown at30s then resumption in the Month16 hold, and bounded state emissions.
Browser MutationObserver regression added for unchanged-month household options
and caption text. Playwright startup blocked: server bind returned EADDRINUSE on
both3100 and3215; browser mutation counts and pending-readiness click remain
unverified in this environment. Source review `docs/reviews/claude.md` is absent
in this checkout; the complete Linear SHE-215 description supplied requirements.
Next: run the focused browser regression and delayed-readiness selection journey
when local server startup is available. No deployment or production mutation.
Final checks: focused suite37passed/1skipped; expanded Future Machine suite
101passed/3skipped across17files,964assertions. Playwright --list successfully
parsed all17selected browser tests. `git diff --check` passed. The skipped unit
entries require browser execution; no browser-pass claim is made.

## SHE-217 — D02 outcome timeline

Implemented a single integrated slice: retain the coordinator's shared month slider, use static recorded series with one moving cursor/highlight, route chart/table selections through manual month selection, and announce manual selections only. Axis labels round to four significant digits while exact data and missing-month gaps are preserved. No simulation contracts or provenance changed. The review source `docs/reviews/claude.md` is absent in this checkout; the full Linear issue supplies the requirements.

Acceptance coverage added to the component browser test: no extra slider, stable path identity and zero path/live-summary mutations through months 0–120, one summary mutation on manual selection, missing observations, metric/mode changes, exact values, table selection, disposal and 320px layout. Integrated outcome-delta test uses chart coordinates and checks shared slider count, scene/KPI synchronization and WHY at the clicked month.

Verification: focused outcome/UI unit tests passed (8 tests, 52 assertions; 2 browser tests skipped by default). `git diff --check` passed. Explicit browser attempts were blocked: the integrated app server fails to bind port 39917 (`EADDRINUSE`); the component test now uses intercepted module requests without a server, but Chromium launch fails with MachPortRendezvousServer permission denied. Browser acceptance remains unverified and should be rerun in a browser-capable environment using `HBL_FM_BROWSER=1 bun test test/future-machine-outcome-timeline.test.js` and `playwright test --config test/outcome-delta.browser.config.js`. No deployment or production data changes.

## SHE-216 — retained Future Machine renderer

Renderer-only slice implements the issue's D03 target without changing City,
construction progress, or layout v2. The cited `docs/reviews/claude.md` is absent
in this checkout; the full Linear issue and existing scene interfaces supply the
acceptance contract. Historical U03 resource measurements exist in this plan;
new device measurements remain a separate gate.

Tasks: retain native meshes by arm/collection/id/ghost, update recorded geometry
and materials in place, retain effects and progress gauges, remove disappeared
inventory synchronously, diff native labels, and use LAYOUT_VERSION in Canvas.
Acceptance: same geometry count after two complete scrubs; idle native draw count
stops within one second; month16→15 removes the completed building immediately,
15→16 shows all three recorded floors; an existing building's changed recorded
height tweens on the same mesh; Canvas reports the mapping's layout version.

Implemented with focused effect disposal/reapplication and Canvas-version
regressions plus a normal-route browser regression covering those acceptance
conditions and label reuse. Effects request a final settled draw, and unchanged
rows do not restart pulses. Height/footprint changes replace only the affected
geometry/edges; no intermediate construction floors are inferred. Missing
snapshots also clear the Canvas fallback. Risks: actual GPU memory, browser
integration, and native WebGPU behavior require live browser verification.

Verification: all Future Machine unit suites passed:97passed/3skipped,948
assertions across16files; final focused29passed/168assertions (including recorded
construction boundary tests). Playwright test discovery passes. Playwright could not start the local server:
Bun returned EADDRINUSE for ports39884,39916,48763. No browser acceptance or
hardware performance claim is made. Browser config now accepts HBL_FM_PORT for
an isolated retry. No commit, PR, deployment or production-data changes.

## SHE-218 — Progressive comparison readiness

Slice: expose the paired recorded inventory, timeline, KPIs, WHY, playback and
sharing as soon as replay/validation/diff/story preparation completes. Graphics
settle independently; the guided demo waits for the bounded graphics/fallback
result. Preserve month, exact entity selection and history-wide camera fit when
attaching the renderer. Three imports have a 10-second deadline; late imports
cannot replace Canvas/inventory fallback or disposed stages. No model/data
contracts change. Risks: deferred callbacks after cancellation/replacement and
selection before a camera exists; guard stage/request identity and replay focus.

Implementation complete in main.js and scene/index.js. Acceptance regressions
added to the normal-route Playwright suite for 3-second and 30-second delayed
Three, plus blocked Three with every canvas context unavailable. Unit/regression
verification: `bun test test/future-machine-*.test.js` — 96 pass, 3 browser-gated
skips, 942 assertions. Normal-route browser verification remains blocked: server
startup reports EADDRINUSE on ports 39884, 39892 and 42719. The existing browser-gated UI harness also failed at Bun.serve({port:0})
(6 pure checks passed, 1 browser check failed before browser launch). No browser
acceptance claim is made until that suite runs. No lint/typecheck commands are configured.
Next action: run focused progressive-readiness/blocked-Three Playwright tests in
an environment that can start the isolated server, then the full journey suite.

## SHE-222 — Mechanism Microscope

Bounded product follow-on to the frozen sprint: rent WHY consumes the same selected
monthly City snapshots and recorded mean-rent delta. No model or replay contract
changes. The exact shift-share identity separates existing-stock rent change from
plan-only housing-project inventory composition using `housingProjectBuildingId`.
All unit records, including vacancies, remain in the cityMetrics denominator.
Acceptance: reconcile within 1e-6 at every month; Month 0 zero; show 36 existing,
24 new, denominator 60 at seed 42 Month 120; preserve month navigation and existing
WHY evidence. Missing snapshots, displaced/unmatched stock, unknown new inventory,
and inconsistent metrics must show unavailable rather than fabricate attribution.
Delivered the calculation, accessible signed stacked bar, counts, denominator,
formula, missing-data state and month-following inspector. Added deterministic
all-month seed42/7 checks, matched control, malformed/missing data, nonmutation and
DOM rendering checks. Integration command: `bun test test/rent-decomposition.test.js
test/future-machine-story.test.js test/two-futures-evidence.test.js
test/future-machine-diff.test.js test/future-machine-data.test.js` — 30 passed.
Browser entry bundle and `git diff --check` pass. No lint/typecheck script exists.
Added Playwright normal-entry/mobile/month-refresh coverage; execution blocked
before browser launch by local server EADDRINUSE on both39931 and39982. Actual
browser layout/navigation remain unverified here. Next action: run the focused
`rent microscope` browser test when a local test server can bind. Referenced
research source is absent in this checkout; full Linear acceptance and sprint
model documentation supplied the method. No model change, deployment or issue
status mutation.

## Cinematic Game Director — SHE-183

Next slice: read-only deterministic selection over Future Machine's existing City
history, separate narrative presentation, and an accessible moment library with
skip, replay and exact source inspection. Prerequisite: recorded monthly events
and decisions; no simulator hooks or changes to House's active Story Director.
Selection uses versioned editorial rules, stable arm/month/source identities,
explicit dependencies only for chains, and authored interpretations for goal
tradeoffs. Missing sources/dependencies remain unavailable. Acceptance: frozen
input and seed replay tests, arm-scoped provenance, no fabricated chains, UI
skip/replay/source controls and existing story regressions. Coordinator owns this
small dependent slice; no independent implementation work warrants delegation.
Risks: City workers are not Population characters; City decisions have no event
IDs, so they retain exact decision record references instead. Goal tradeoffs are
narrative interpretation, not newly modeled player goals or causal conclusions.

Delivered increment: versioned read-only selector and separate narrative renderer
are integrated into `/world/future-machine.html`. Optional text cutscene cards,
observation quests, skip/replay and exact source inspection use the shared
recorded month navigation. Tests verify frozen input, real seed-matched replay,
scoped IDs, selection bounds, missing/cyclic/future dependency rejection, empty
history, DOM controls and listener cleanup. Actual integration gate:
`bun test test/game-director.test.js test/future-machine-*.test.js` — 100 passed,
3 existing browser-dependent skips, 0 failures (970 assertions). Playwright
attempts on 3100 and alternate 34183 both failed server startup with EADDRINUSE;
no actual browser pass is claimed. Focused browser regression is retained in
`test/e2e/game-director.e2e.js`; rerun it when local server binding is available.
No lint/typecheck script exists in package.json. No deployment or production
mutation. Remaining model limitations: no City dependency edges for real chain
moments, no player-goal registry, and job decisions lack event IDs. These are
explicit in the UI and module README; completing those broader semantics needs
producer contracts rather than invented evidence. This is an integrated City
presentation slice, not full cross-simulator cinematic coverage.

## Future Machine PR integration — November 12, 2026

Integrated PRs #76, #80, #93, #96, #98, #99, #100, #102 and #115 with merge
commits retaining each original head. Share cards, receipt import, copy/native
sharing and skip/replay controls coexist. The shared first-divergence selector,
hidden-tab clock, boundary-only address-bar writes and quiet chart playback are
preserved. Ordinary data controls become ready before graphics; guided playback
waits for graphics or the bounded inventory fallback. Retained meshes keep live
media preferences and recorded targets. Rent and Butterfly Ledger inspectors
coexist with anchored evidence trails and the optional cinematic moment library.

Integration review caught two cross-feature regressions and repaired them:
selection/diff flag changes during a retained-mesh height transition now preserve
the recorded target origin, and explicit jumps, saved-link load, pause and
completion synchronize chart summary values while automated frames stay silent.
The effects suite covers selection and clearing a diff midway through a tween;
the existing reload browser journey now asserts the selected-month chart summary.

Verification: the integrated Future Machine/controller/rent/director Bun suite
passed 116 tests with 1,719 assertions, with 3 browser-gated skips and no failures.
After the two repairs, the effects/controller/chart rerun passed 16 tests with
100 assertions, 1 browser-gated skip and no failures. All 38 changed JavaScript
files parsed; the browser entry bundled successfully (39 modules). Five focused
Playwright configurations discovered 33 tests. These discovery checks do not
establish browser behavior: actual Chromium launch in this shared execution
context was blocked by socket EPERM. Hosted graphics, screenshots and physical
mobile validation remain unverified. No remote write or deployment was performed
by this integration worker.


## Authorized merge batch — PRs #52–#116, November 12, 2026

The repository owner explicitly requested merging all 65 PRs in this batch into
their existing target, `sprint/one-city-two-futures-20261111`. Nine merged directly
on GitHub; the other 56 were combined with their original heads preserved as
ancestors. Independent appended implementation-plan sections were retained in
full. Source overlaps were reconciled in isolated worktrees, including server
handlers, Registry/Uncertainty integration, Future Machine controls and rendering,
and both Playable Life follow-up horizons with matched controls.

Integration review fixed quest-history loss while branching World Builder,
retained-mesh positioning during selection, and stale accessible chart summaries
after explicit month changes. The City worker fixture now supplies independently
computed saved outcomes; runtime validation was not relaxed. The original
`experiments/she-234/prototypes.patch` bytes remain unchanged; its format-patch
signature is excluded from source whitespace checks.

Final combined verification at local integration commit
`9f0e355ae55aec92ac330e19bc4fa4a408c4945a`: 247 Bun tests passed, 0 failed,
4 optional checks skipped, 3,945 assertions across 52 files in 153 seconds.
The skips cover opt-in HTTP/browser checks and PyArrow round-trip validation.
The research-agents, research-pipeline and queue-report Python suites separately
passed 15 tests. Focused workstream verification and browser bundle/syntax checks
are recorded in the preceding integration notes. Every original PR head is an
ancestor of the combined result. Source whitespace checks pass.

Actual Chromium journeys were attempted but failed before page creation because
the execution environment denied its socket operation. Browser discovery and
bundle checks are not reported as browser passes. Newly opened PRs after the
original 65-PR snapshot are outside this one-time batch. Existing target branches
and deployment configuration are retained.

## SHE-13 — truthful sprint evidence manifest (November 12, 2026)

Delivered bounded documentation slice: [versioned report](she-13-sprint-evidence.md)
and [availability/checksum snapshot](evidence/she-13-sprint-manifest.json).
Exclusive ownership for this slice: those two new paths and this status entry;
no runtime, dispatcher or simulation-contract edits. Reused existing demo
manifest, deterministic metric tests and executable recording/verifier commands.
Prerequisites HBL-W1-001/004/006 are not certified complete; inspection of
existing work does not grant dispatch or release authorization.

Acceptance: consolidate route, audit branch/SHA, historical capture provenance,
seed/model/hash, all metrics, screenshots/video, browser attribution, commands
and limitations. Audit baseline b963dd353538294cb0fbf5d34d5283fad6e10e68 on
mini/SHE-13; no PR receipt yet. Actual `bun test test/pipeline-evidence-manifest.test.js` exited 0:
14 passed, 1 missing-artifact skip, 0 failed, 195 assertions; both histories and
all metrics reproduced, 11 artifact hashes matched. Missing 320px delta image
is explicit. Browser code unchanged; no new Playwright or visual acceptance
claim. `git diff --check` passed. Remaining external delivery: durable media
hosting, missing-image recovery and eventual PR linkage. Historical R13/R14
release risks remain open; no main merge or production deployment.

## SHE-64 final guided recording receipt — November 12, 2026

Owned slice: `docs/evidence/she64/**` and this status entry only; no app changes.
Audited the existing canonical recording command/test and prior integrated
manifest rather than rebuilding working behavior. Recipe and source prerequisites
exist: seed42, city-systems.1.0.0, Month16 building divergence and exact WHY.
Retained the earlier actual browser WebM/MP4, screenshots, snapshots, timing and
hash receipt in [the SHE-64 evidence directory](evidence/she64/README.md).
Both videos fully decode, each56.84s; MP4 matches the historical manifest SHA.
Inspected video frames at14s/55s showing Month16 and WHY event16-0/model/seed/run
and synthetic limitations. Current focused12tests/91assertions pass; artifact
verifier2records/1video passes. No feature or simulation contract changed.

Fresh recording attempts on ports39964 and41864 both failed before browser launch;
direct ephemeral localhost bind returns EPERM under this sandbox. Historical
capture commit is not independently established; it must not be represented as
current HEAD proof. Current-source final recording acceptance remains blocked
until a server-capable host runs the documented command and verifies the video.
No PR/push/merge/deploy or Linear dispatch change. Baseline b963dd3, mini/SHE-64.

## SHE-33 — neighborhood metric source audit (2026-11-12)

Delivered a metadata-only `neighborhood-metrics.v1` catalog and lookup for the
12 provisional district metrics. Prerequisite SHE-9 is Done in Linear. Source
inspection found existing city-wide summaries, three heatmap layers and a
separate plan-domain registry; these are retained. Owned files are the new
`world/city/neighborhood-metrics.js`, `test/neighborhood-metrics.test.js`,
`docs/neighborhood-metric-audit.md` and this appended status entry.

Acceptance: stable unique IDs, exact source paths/units/reducers/denominators,
model and schema versions, monthly time scope, synthetic evidence, missing-data
policy, and null/not_modeled for unaudited labels. The registry exposes no
fabricated measurements. Tests verify fields on seed-33 initial and next-month
engine states and preserve the input. Material limitation: source support is
metadata, not per-snapshot availability or aggregation. Screenshot labels are
still unverified. NB-M02/M04/M05 remain downstream work. No UI change,
Playwright requirement, model/version change, deployment or release action.

Verification: `bun test --timeout 15000 test/neighborhood-metrics.test.js test/city-systems.test.js test/time-machine-heatmap.test.js test/metric-registry.test.js` passed 22 tests / 781 assertions, zero failures (latest independent rerun: 3.30s, Bun 1.4.2). This includes existing SQLite/API replay integration. `git diff --check` passed. No lint/type-check script is configured. The four draft files were already local changes when this verification resumed; source review confirmed their mapping against the archived proposal, seed, systems, contracts, existing summaries and heatmaps. SHE-9 was independently rechecked as Done.
Branch `mini/SHE-33`; no commit/PR published. Full overlap and caveats:
[neighborhood metric audit](neighborhood-metric-audit.md).

## One-minute city challenge — SHE-140

Next slice: extend the existing Living City commute entry point with Begin,
policy/run, recorded-event inspection and successful receipt-copy milestones.
SHE-141 is Done (PR34); use its honest bounded-model semantics. Linear overlap
SHE-131/SHE-118 covers broader allocation/cards. GitHub issue search returned
no matches; PR search found earlier guided journeys in PR4 and Living City
entry-point/smoke coverage in PR8. Extend that existing journey rather than
introducing another simulation. Reuse living-city-commute.v1 recipes and City engine unchanged.
Exclusive scope: Living City page/markup, focused browser test, this plan.
Acceptance: one-click begin, no click-only run completion, actual event evidence,
fresh browser replay of identical version/seed/policy/pair and event. Changing
policy or pair invalidates later milestones. No million-agent or calibrated
forecast claims. Risk: clipboard denial must leave a usable manual-copy path
without falsely claiming completion. Browser timing is a target, not a deadline.

Implemented increment: Begin focuses the policy control; successful worker replay,
opening a real recorded event, and successful receipt copy advance the guide.
Policy/pair changes clear later evidence; failed clipboard writes expose the
manual-copy link without claiming completion. Event evidence includes scenario
and model versions, scenario and pair seeds, horizon, start month and arm.
The existing versioned recipe remains the replay authority, with no model changes.

Verification (2026-11-12): `bun test test/living-city-*.test.js` passed 11 tests,
101 assertions, including 100-pair exact model replay. JavaScript syntax checks
and `git diff --check` passed. Focused Playwright coverage was added for guided
completion, fresh-context identical event/measurements, pair/policy invalidation,
clipboard denial, and comparison failure/retry. It remains unexecuted: the normal
runner hit an uninitialized local Bun package; a temporary config using installed
Bun then failed server listen with EADDRINUSE, including a separate PORT=0 probe.
Temporary config removed. Next: run the two focused Living City browser suites
in an environment allowing server listen, then dispatch review. No merge or
deployment performed; one-minute usability timing has not been measured.

## SHE-177 — verified million-resident release gate

Status: review candidate. Owned slice on isolated issue branch `mini/SHE-177`:
versioned evidence policy, executable fail-closed checker, focused regression
suite, core-journeys CI wiring and release-checklist entry. No engine or browser
behavior changes. The smallest end-to-end slice is a submitted receipt producing
an explicit PASS/HOLD report and a failing CLI exit on absent evidence.

Prerequisites for an actual claim: SHE-141 count semantics, SHE-151 architecture
measurements, SHE-171 benchmark runner, SHE-173 readback work, SHE-175 compatibility
matrix and SHE-220 device soak evidence. No supplied million-scale receipt exists.
The bounded count fixture is not scale evidence. GitHub live PR audit was attempted
but CLI network access failed; local CI and code were inspected. No delegation
was needed because this slice shares a single policy/interface owner.

Acceptance evidence: `bun test test/million-release.test.js test/agent-counts.test.js`
passed 13 tests / 306 assertions, including policy boundaries, each failed gate,
malformed/missing evidence, distinct count units and nonzero CLI failure. Tests
use synthetic receipts only. Browser tests are inapplicable; no browser behavior
changed. No repository-wide lint/type script is configured. The policy's proposed
1M interactions/s, 80% full-device RAM, 20-minute soak and 10-second p95 first-play
budgets require independent product/reviewer approval and measured feasibility.
The checker validates submitted attestations; humans must authenticate artifacts,
verify full matrix coverage, causal evidence and approval identity. Neither CI
nor a passing synthetic receipt authorizes a public claim or deployment.

Next: independent review of policy and code, then collect exact-candidate device
measurements and authenticated approvals. Live hosted CI/PR audit remains pending.
See [policy and receipt contract](million-resident-release-gate.md).

## SHE-41 — paired-run responsiveness

Owned slice: `world/experiment.js`, `world/paired.js`, `world/paired.test.js`,
and focused responsiveness evidence/tests. Existing quick-demo worker and
Population worker pool already isolate their computation; preserve them.
Legacy paired API jobs yield only after two complete representative weeks,
so asynchronous function signatures alone do not keep the event loop responsive.
Use cooperative yields inside the existing whole-minute stepping boundary,
with cancellation checks in both arms. Keep seed order, storm timing, observation
boundaries, data contracts and synthetic disclaimers unchanged.
Acceptance: compare all fixed-seed outputs (excluding elapsed time) against the
unchunked path, and process a timer cancellation before first pair completion.
Risk: world creation and one modeled minute remain synchronous; this is not a
hard frame-time guarantee. No dispatcher labels, deployment or merge changes.

Verification on branch `mini/SHE-41` (2026-11-12):
`bun test world/paired.test.js` passed 9/9 tests (28 assertions, 39.92s).
The `responsive-pairs` synthetic fixture uses 40 residents, two seeds and
checkpoints 0 and 6 with bus/drainage proposals. Complete result JSON excluding
only elapsed time matches the unchunked model path, SHA-256
`aad2e1f7b7a3d7fdde6150a591ad1c64744754a1f52a9f67b1f6778a9a966d98`.
A separate annual sample compares end state, people, journals and observation
provenance. A requested 500-resident/100-seed stress run is cancelled by a real
timer before the first pair completes; treatment-arm cancellation also publishes
no partial pair. These are synthetic model checks, not measured production UI
latencies. Existing renderer quick-demo/ten-year Workers and Population runtime
remain unchanged; the API continues to call the existing paired runner.

`bunx playwright test test/e2e/paired-responsiveness.e2e.js` could not start
the application server (`EADDRINUSE` on 3100); retry with
`HBL_PLAYWRIGHT_PORT=3189 HBL_PLAYWRIGHT_PARTY_PORT=3289` also failed on 3189.
The focused browser test uses isolated pause/navigation controls with the actual
model module; it has not passed here and is not a normal application UI test.
No screenshots or browser latency claims are available. No production deployment,
main merge, issue dispatch change or PR publication was performed.

Regression command:
`bun test --timeout 60000 world/experiment.test.js world/experiment-longitudinal.test.js world/experiments-api.test.js test/world-quick-demo-controller.test.js`
passed 27/27 tests (120 assertions, 117.33s), including the real runner through
the existing API, replay fallback, state threading and quick-demo cancellation.
The optional external Dear Congress test returned early because its sibling
checkout was absent; its production integration was not exercised.
`git diff --check` passed. No repository-wide lint/type-check script is defined
in the root package. Remaining verification: run the focused browser smoke test
and normal application pause/navigation checks on a host that can start servers.

## SHE-87 — scenario parameter diff inspector

Slice: add a read-only baseline/selected-scenario table to Decision Studio using
resolved scenario inputs and the active model schema. Show every default, unit,
uncertainty distribution, seed, horizon, and non-parameter scenario setting.
Preserve input maps; never copy an alternative's assumptions into the baseline.
Verify sparse defaults, uncertainty-only changes, stress settings, live edits,
and seed-matched deterministic replay. Risk: configured inputs are not sampled
run values; label that boundary explicitly. Existing per-control deltas are
partial coverage, not a complete inspector. GitHub CLI audit is network-blocked.

Delivered: `world/decision/parameter-diff.js` reads resolved inheritance without
mutating scenarios; Decision Studio refreshes the accessible table on selection,
edit, import, and run-control changes. Every schema default and uncertainty is
shown, plus non-parameter settings (including stress/fork/project changes).
Configured values are explicitly distinguished from sampled/stress-adjusted
run values; selected-future seed overrides are disclosed. No runner/data contract
changes. Reproducible synthetic recipe and full diff:
`docs/evidence/she-87-parameter-diff.json`.

Verification: 20 focused tests (136 assertions) and 12 API/continuity integration
tests (510 assertions) passed. `git diff --check` passed. Focused Playwright
was attempted on ports 3100 and 3187; both server starts failed with EADDRINUSE,
so live browser behavior remains unverified. Browser regression is retained in
`test/e2e/parameter-diff.e2e.js`. GitHub connector search found no parameter-diff
PR; CLI remote audit was network-blocked. Local issue branch `mini/SHE-87` was
clean before this slice. No commit/PR publication or production changes.

## SHE-97 — neighborhood impact summary

Slice: aggregate the existing paired Population neighborhood comparison receipt,
then expose metric-specific ordered neighborhood rows in its normal What if panel.
Use stable starting district IDs (retain labels for older receipts), matched finite
resident observations, and mean per-resident B−A deltas. Rank absolute magnitude,
then district ID; never combine unlike units into a welfare score. Include zero
rows and explicit missing/excluded counts. This is a fixed starting cohort, not
current district composition or the monthly City canonical receipt authority.
Prerequisites: existing deterministic paired-day model and worker contract.
Acceptance: identical receipts and reordered residents yield identical ordered
rows; missing/nonfinite measurements cannot become zero or enter the ranking;
verify real model integration and panel rendering. Risk: commute covers only
residents with observed work departures in both arms; burden is resident-weighted
here, unlike the household-weighted headline. No cross-model identity mapping.
Status: implementation and verification in progress.

Delivered: pure receipt projection in `world/what-if/impact.js`, additive starting
district/model version provenance in the existing model receipt, and selected
metric table plus explicit excluded-neighborhood text in the What if panel.
Module contract and limits are in `world/what-if/README.md`.
Verification: 8 focused tests passed (107 assertions), including two real paired
runs and JSON receipt projection. Updated existing browser journey assertions;
execution blocked at server startup with EADDRINUSE on both 3100 and 4197, so
browser rendering remains unverified. No configured lint/typecheck scripts.
Audit: clean initial issue worktree `mini/SHE-97`; no open GitHub issue/PR matching
SHE-97 was returned, no existing summary implementation found. No publication,
Linear status/label mutation, or production changes performed.

## SHE-66 — first-play dashboard

Audit: no first-play instrumentation/export consumer exists in this checkout;
SHE-8 remains Backlog. SHE-124 is In Review and owns retention instrumentation;
GitHub issue search for SHE-124 returned no linked work (CLI network unavailable).
Do not duplicate simulation analytics, activity dashboard, or retention collection.
Owned slice: `tools/first-play/`, focused tests, and this plan entry. No shared
server edits: existing `/tools` static route serves the dashboard. The proposed
versioned read-only export adapter aggregates actual supplied events, deduplicates
IDs, excludes known bot sessions, orders funnel transitions, and groups UTC
landing session cohorts. Acceptance: fixture counts, missing data, bot/duplicate
handling, unavailable retention and browser upload/error paths. Risk: producer
contract is not yet integrated; live conversion and cross-session retention
remain blocked on SHE-8/SHE-124. No deployment or production data changes.

Verification on branch `mini/SHE-66`: `bun test test/first-play-dashboard.test.js`
passed 4 tests / 17 assertions; `node --check tools/first-play/aggregate.js`,
`node --check tools/first-play/page.js` and `git diff --check` passed.
`bunx playwright test test/e2e/first-play-dashboard.e2e.js` failed before tests
because Bun could not bind port3100 (`EADDRINUSE`); retry with
`HBL_PLAYWRIGHT_PORT=3466 HBL_PLAYWRIGHT_PARTY_PORT=3467` failed identically on3466.
No browser result or screenshot is claimed. Focused browser test is retained for
an environment where the application server can bind. No lint/type scripts are
configured. No commit/PR created. Remaining acceptance: agree producer contract
with SHE-8, wire its real recorded export, coordinate retention with SHE-124,
and run the browser check. This working read-only increment is not a completed
live first-play measurement system.

## Selected entity investigation links — SHE-99

Next slice: extend the existing monthly City Time Machine URL contract with a
copy action and district selection. Reuse stored run/checkpoint authority and
canonical entity IDs; no new replay recipe or population identity mapping.
Acceptance: copy a selected building with construction event or a district,
reopen in a clean browser context at the same month, and preserve unrelated URL
context. Missing entities clear selection with a visible notice while retaining
the stored month; clipboard denial exposes a selectable link. Copy stays disabled
while checkpoints load or fail. Verify with focused browser and causal tests.
Risks: links require the same server's retained run; unavailable runs continue to
use the existing explicit error/retry state. Ownership is limited to Time Machine
page, inventory, markup, documentation and focused browser coverage.

Delivered locally: copy/status/manual-copy controls, selectable canonical district
inventory, and stale-entity cleanup at the loaded checkpoint (including legacy
URL alias cleanup). Removed rows remain selectable at their transition month.
Focused verification: 14 Bun tests / 300 assertions passed across investigation
selection, checkpoints, heatmaps, causal adapter and read API. Added browser
coverage for building/event and district copy, clean-context reopening without
writes, stale IDs, clipboard denial and failed checkpoint disabling. Browser
execution remains unverified: both standard and alternate ports failed to start;
a direct ephemeral loopback socket probe returned EPERM, confirming sandbox bind
restriction rather than an application failure. Run
`bunx playwright test --config test/time-machine.browser.config.js world-time-machine.browser.js`
on a host permitting local servers. No dedicated lint/typecheck scripts exist.
Audit: clean isolated `mini/SHE-99` checkout, full Linear issue read, related issue
search and GitHub SHE-99 PR search (no matches); CLI open-PR inventory was blocked
by network access, so unrelated active branch ownership was not fully audited.
No commit/PR or production changes were made in this source-only workspace.

## SHE-54 — public simulation input audit and legacy endpoint slice

Branch: `mini/SHE-54`. Follow-up audit found this slice already present as
uncommitted work and preserved it. This slice owns only
`world/experiment-input.js`, `world/experiments-api.js`,
`test/public-experiment-input.test.js`, and this plan entry. No parallel writers
were introduced, and no dispatch labels, production data or release gates changed.

Audit overlap: Decision Studio already has strict uint32 seed, run/horizon,
parameter/distribution, imported manifest version and aggregate workload validation
in `world/decision/contracts.js`, plus bounded streaming request reads in its API.
Existing kernel/housing/integration tests exercise those contracts and replay.
City experiments already bound runs/months and aggregate household work in
`world/city/api.js`. Reality shares verify frozen manifest and selected-run identity.
No simulation rules, output records, random streams or synthetic-data notices changed.

Delivered independently verifiable slice: `/api/world/experiments` now reads at
most 64 KiB, requires a JSON object, and rejects numeric strings, nulls,
booleans and nonfinite values instead of coercing them. Existing finite numeric
floor/default/upper-clamp behavior remains: seeds default8/max32, years default5/
max10, people default120/max300; values below1 use the existing default. Missing
optional fields retain defaults. Seed text must be nonblank and at most64 characters
instead of silently truncating it. Explicit coordinates, checkpoints and procedural
flags receive field-specific errors. Checkpoints retain the existing0–10 range.
Imported plans and provider packages permit at most100 actions/IDs, proposal IDs
up to96 characters, supported PlanSpec version1, integer adoption years0–10 and
finite nonnegative illustrative costB up to1,000,000 (a transport safety ceiling,
not a calibrated policy estimate). Unsupported proposal IDs remain inspectable.
Errors are400, or413 for oversized bodies, before a job is created. Source policy
mapping remains exclusively in the existing compiler.

Acceptance evidence: `bun test test/public-experiment-input.test.js
world/experiments-api.test.js test/decision-kernel.test.js
test/housing-model.test.js test/decision-integration.test.js` passed47 tests,
2968 assertions, zero failures. Includes malformed-value matrix, direct NaN/Infinity,
streamed oversize body without Content-Length, unchanged clamps/defaults, real tiny-town
simulation and Decision manifest reproduction. No UI change; Playwright/screenshots
are inapplicable. No lint/typecheck scripts exist in package.json.

Remaining audit gap: the separate civic `/api/runs` resolver in
`world/server-civic-api.js` still coerces numeric inputs and accepts inline civic
experiments/world batches through a different contract. This slice does not claim
repository-wide validation completion. Next work must define and test that contract
(including imported batch shape, adapter options and aggregate resource budgets)
before expanding ownership to its resolver/store/generator. Queue admission/rate
limits and browser worker entry points also remain outside this transport slice.
No commit/PR was created in this source-only workspace.

Follow-up review (2026-11-12): fixed imported PlanSpec validation to inspect the
same proposal ID and cost fields the compiler consumes; nested proposal metadata
can no longer mask malformed top-level values. Added explicit object/array shape
errors and bounded action labels/titles. Validation does not change policy rule
mapping or trust imported `rule`/`simulated` claims. Added provider-import rejection
and a numeric boundary matrix covering negatives, fractions and finite extremes.
Reran the exact five-file command above: 49 passed, 0 failed, 3038 assertions,
1.387 seconds; `git diff --check` passed. Real runner integration and seeded
Decision manifest reproduction passed. No browser-facing changes, so Playwright
was skipped. The civic resolver, queue admission and browser worker gaps above
remain unresolved; SHE-54 is a working increment, not complete across all public
entry points. Existing source-only ownership is retained pending coordinator
agreement for a separate civic resolver slice.

## SHE-44 — mobile Canvas fallback benchmark

Owned slice: new `test/e2e/low-end-fallback.e2e.js`, dedicated
`test/low-end-fallback.browser.config.js`, and `docs/low-end-fallback-benchmark.md`.
Reuse existing Future Machine Canvas, retry and recorded City interfaces; no
renderer or simulation changes. Existing fallback/device-loss/resize tests cover
correctness but do not report throttled mobile interaction latency/cadence.
SHE-40 (HBL-W1-027) is still In Progress: collect baseline observations without
inventing budgets or claiming that dependency complete. Acceptance: 320/390px,
explicit Canvas and suppressed GPU APIs, scrub/selection/pan/zoom/retry, unchanged
history, measured backend, reproducible environment and honest timing limits.
Verification: 19 focused tests passed (one existing opt-in browser smoke skipped;
289 assertions), all four benchmark cases discover successfully, diff check passes.
Local browser execution is blocked before launch: Bun cannot bind even port 0
(EADDRINUSE). No timing or interaction-pass claim; full details and reproduction
are in [the benchmark report](low-end-fallback-benchmark.md). Added separate RAF
cadence and instrumented Canvas draw-call rate; displayed FPS remains unknown.
No production deployment, merge or dispatch-label change.

## Architecture D adaptive fidelity spike — SHE-146 (2026-11-12)

Prerequisite audit recorded in [adaptive-fidelity-spike.md](adaptive-fidelity-spike.md).
Owned isolated worktree `workspaces/SHE-146`, branch `mini/SHE-146`, base b963dd3;
this slice owns only that report and this plan entry. SHE-142 is Done with PR50
but its scalar oracle is absent locally; structured blocker SHE-171 remains
Todo. Connector PR search returned no matching Architecture D/runner PR; live
merge state is unverified. Do not substitute the bounded energy-transfer
fixture for the movement/contact oracle or duplicate another ticket's runner.

Next end-to-end slice: reviewed upstream oracle + runner contracts, then bounded
policy/ownership transfers with CPU-oracle/GPU comparison, atomic failure/retry,
ID conservation and replay tests. Follow with measured 10k/100k/1M switches and
small matched all-high-fidelity divergence. Report actual CPU/GPU completions,
cohort weight separately, versions/seed/adapter limits/machine and transfer costs.
Risks and independently verifiable acceptance tasks are in the report.

Actual local check: existing agent-count contract 8pass/0fail/266assertions.
Documentation only; no browser run needed. Implementation, GPU comparison and
scale measurements remain blocked by unavailable prerequisites, not verified.
No dispatch, merge, deployment or production data change performed.

## SHE-45 — safe small-user backend load test

Scope/ownership: `ops/backend-load-test.mjs`, `test/backend-load-test.test.js`,
`docs/backend-load-test.md` and this entry, on `mini/SHE-45`. Retained the initial
untracked runner/tests and reused the working City/server civic APIs. Dependency
SHE-42 is Done in Linear; source inspection confirms two active City jobs and 429
rejection. Actual staging deployment verification is a prerequisite to execution.

Delivered slice: network-free default plan; explicit staging configuration and
readiness/build-SHA gate; two users/four seeded scenario journeys through homepage,
static asset, create, bounded polling and same-ID replay. No retries, redirects,
cookies or cleanup mutations. Bounded requests/body/time; failure stops new work;
receipt retains created IDs, model/recipe and per-kind latency/error/overload
statistics. Server saturation is unavailable until operator monitoring supplies it.

Acceptance: real server handler/worker/temporary SQLite integration plus refusal,
overload, malformed response, size and metric tests. Exact run commands and
operator staging/cleanup procedure: [runbook](backend-load-test.md). No browser
behavior change; no Playwright needed. No production/staging execution, deploy,
merge or dispatcher approval performed. Remaining: approved isolated staging
origin/build and measured server resources; record actual p50/p95/errors and
saturation there before claiming capacity. No PR/commit created in this session.

Final verification: the three-file Bun command above passed 22 tests, zero failures,
177 assertions in 4.19 seconds. `git diff --check` passed. No package lint/typecheck
script is configured. Live staging metrics remain pending as described above.

## SHE-144 — Architecture B cohort spike (readiness audit, 2026-11-12)

Status: implementation pending prerequisite source and runner availability.
[Audit and next slice](hierarchical-cohort-spike.md) records the isolated
`mini/SHE-144` worktree, source/PR evidence, scope and acceptance contract.
SHE-142 is Done in Linear and links PR #50, but its scalar oracle is absent from
this checkout; structured blocker SHE-171 remains Todo. The existing SHE-141
energy fixture cannot substitute for movement/household/policy equivalence.
No replacement rules or million-agent performance claims were introduced.

Next tasks: synchronize reviewed prerequisite source, resolve runner dependency,
implement weighted hierarchy and seeded inspection adapter, compare distribution
moments against the actual CPU oracle, and measure mass conservation and zoom
reversibility. Principal risks are loss of compression under exact contact rules,
approximation error, double-counted parent/child mass and inspection-dependent
state. Acceptance evidence remains outstanding. Existing metric tests passed
8/8 (266 assertions); no browser behavior changed. No commit/PR, dispatch,
merge or deployment performed for this audit.

## SHE-147 — Architecture E progressive shard spike

Delivered bounded synthetic ring tiles on real local module Workers, tick barriers,
progress callbacks, scalar comparison before commit, failure cleanup and a normal
benchmark CLI. Scope/ownership, prerequisites and privacy gates are recorded in
[spike report](progressive-shard-spike.md); machine-readable measurements in
[evidence](evidence/she-147-shards.json). Acceptance evidence: 11 focused tests,
298 assertions; all 1/2/4/8-worker and 5 ms emulation runs match hash cfb82fbc,
zero dropped dependencies and equal task assignment. Timings are single Bun cold
microbenchmarks, not browser or production scaling evidence. Existing Population
and City authorities remain separate. SHE-142 is Done but oracle source is absent
here: next slice needs that source and an explicit adapter, browser measurement,
imbalance and remote trust/consent validation. No remote/peer compute, deployment
or production data changes. This is an implemented mechanics spike with remaining
production/browser acceptance work, not completed distributed-city integration.

## SHE-145 Architecture C spatial event spike

Delivered standalone synthetic end-to-end slice: per-tile queues, deterministic
head coordinator, adjacent atomic handoff, local energy contacts, executable CLI,
independent scalar oracle tests and recorded 10k/100k/1M distributed/hot evidence.
Owned source: world/spatial-events/, scripts/benchmark-spatial-events.js,
test/spatial-events.test.js and docs/spatial-events.md plus its evidence JSON.
Prerequisites: SHE141 metric contract present; SHE142 marked Done remotely but
scalar source absent in this checkout; SHE171 shared runner still Todo. Existing
isolated mini/SHE-145 branch used. GitHub PR audit blocked by network access.
Acceptance: scheduled/processed contacts, queue depths, late events and event
ordering hash exported; six measured runs assert zero duplicate/lost/teleported
agents, conserved bounded resources and no late events. Focused independent
oracle, scheduler comparison, deterministic evidence replay and invalid CLI path
verify the slice. No browser behavior changed; Playwright inapplicable.
Limits/decisions: synthetic ring/time/contacts, single-threaded coordinator,
32-bit regression hashes and no retained event trace; no production model or
shared-runner integration. Evidence and reproducible commands are in
[spatial spike report](spatial-events.md). Next: integrate actual prerequisites
and causal trace before scientific/production or architecture-ranking claims.
Actual verification: Bun1.4.2 focused suite12pass/0fail/379assertions in4.57s;
invalid-count CLI exited1; git diff --check passed. AppleM4 1M runs measured
2299.77ms distributed/1764.45ms hot including setup and invariant scans. No
repository lint/typecheck command is defined for this JavaScript research slice.

## SHE-143 Architecture A spike (2026-11-12)

Owned isolated workspace: `workspaces/SHE-143`, branch `mini/SHE-143`.
Slice: standalone synthetic integer SoA state-transition compute, immutable CSR
spatial index, CPU reference, browser benchmark export at 10k/100k/1M.
Tasks: implement deterministic bounded contacts; verify replay/boundaries; measure
GPU/CPU parity and feasibility; document commands, source, limits and results.
Acceptance: per-tick updated rows, directed contacts, timestamp GPU duration (or
explicitly unavailable), allocated GPU bytes (not physical VRAM), 10k mismatches,
adapter/machine/seed/version, and observed scale outcomes. No render instances.
Risks: scalar prerequisite is Done in Linear but absent in this base; this spike
uses a distinct oracle and does not claim SHE-142 equivalence. Fixed positions
exclude movement/index rebuild costs; dense-cell truncation limits fidelity.
No dispatch, merge or deployment. Existing metric fixture remains read-only.

SHE-143 actual status: working research increment implemented in
`world/microagents/`, with CPU tests and CLI/browser benchmark runners.
11 tests / 477 assertions passed (including metric regressions); diff whitespace
check passed. Bounded 10k CPU record: all rows changed, 79,912 directed contacts
per tick across three ticks. GPU/browser verification blocked by denied HTTP bind
and Chrome SIGABRT; acceptance remains open for GPU parity, pass timing, adapter
limits and 100k/1M feasibility. Strict state-changing pairwise-event evidence is
not implemented; contact evaluations are explicitly distinguished. See
[spike report](architecture-a-spike.md) for methods, limitations and commands.
No PR, commit, dispatch, merge or deployment performed.

## SHE-153 — falsifiable resident evidence card

Local slice on isolated `mini/SHE-153` worktree: own new evidence-card module,
page, receipt exporter and focused tests; add discovery from the existing people
benchmark. Audit found SHE-141's bounded CPU contract present (PRs 34/35), while
SHE-151 is Todo with no shootout receipt. No matching implementation PR found.
Do not extend frozen City receipts or conflate Population and CPU fixture IDs.
Acceptance: replay source-backed receipt events, derive all six counts and prose
from the same receipt, expose machine/version/seed/limits and measured outcome,
reject malformed evidence, and clearly mark million-scale and human review as
unverified. Missing receipts remain unavailable. Receipt timings are reported
measurements, not independently attested. Human claim review and the architecture
shootout remain prerequisites for a verified million-resident demonstration.

SHE-153 status: local bounded increment implemented; see
[contract and measured evidence](demo-evidence-card.md). 13 focused tests / 294
assertions passed; measured 4096-record receipt replayed successfully. Diff
whitespace check passed. Browser script retained but sandbox denies Chromium
launch; normal-route UI verification remains open. No configured lint/typecheck.
No commit/PR/publication. Full acceptance still needs SHE-151 measured receipts,
a compatible production adapter, browser verification and human claim review.

## SHE-28 — failed HTTP simulation fetch recovery

Local implementation on `mini/SHE-28`. Audit: Experiment Lab already assigns a
new batch only after all simulations resolve and re-enables Run worlds on error;
its prior results, seed/model metadata, analysis and synthetic disclaimers remain.
The HTTP civic bridge lacked timeout/retry and accepted a null score as
zero. Existing cycle-worker retry and saved Decision demo fallback are separate
flows and were left intact. No architecture.md or more specific module AGENTS.md
exists in this checkout. Initial working tree was clean; this slice owns only
`world/hbl-simulator-bridge.js`, the simulation-run catch in
`world/experiment-lab.js`, `test/hbl-simulator-bridge.test.js`,
`test/e2e/simulation-fetch-recovery.e2e.js`, and this plan entry. No dispatcher,
release gate, production data, or remote issue state changes are included.

Implemented: at most two identical HTTP simulation requests, 250ms retry delay,
10s deadline per attempt including JSON body consumption, and abort on timeout.
Network/timeout/5xx/408/429 failures retry once; other HTTP errors, malformed JSON
and invalid results fail explicitly. Successful results keep their original
model, seed and disclaimer. No replacement simulation is manufactured. The Lab
failure message identifies retained completed results (or their absence) and
instructs the user to check the connection and select Run worlds again. The
registered in-process simulator and built-in model behavior are unchanged.
The bridge POST is an evaluation of the same immutable input; this policy must
not be reused for mutation endpoints. A timed-out server may continue work even
when the client aborts; the client still has a strict two-attempt bound.

Acceptance evidence: `bun test test/hbl-simulator-bridge.test.js
test/simulation-adapter.test.js test/live-simulation.test.js
test/experiment-verification.test.js test/run-job-manager.test.js` — 22 tests
passed, including injected offline/500/request-timeout/body-timeout recovery,
persistent failure bounds, exact serialized input reuse and missing data errors.
`bunx --no-install playwright test test/e2e/simulation-fetch-recovery.e2e.js
--list` discovers three browser scenarios. Actual browser execution is blocked:
that command without `--list` failed starting Bun with EADDRINUSE on port3100;
repeat with HBL_PLAYWRIGHT_PORT=38128 HBL_PLAYWRIGHT_PARTY_PORT=38129 failed
likewise on38128. Thus UI recovery, retained DOM results and screenshots are not
yet browser-verified. The focused browser tests exercise the normal Lab entry,
retain an actual completed batch across persistent offline/500/timeout failures,
and retry via Run worlds. Next action: run these in a server-capable environment
and inspect generated screenshots before publication. No PR/commit created.

## SHE-160 hazard field inspection

Owned slice: `world/storm/hazard-field.js`, storm page integration and focused
hazard-field tests. Reuse storm frames and compiled drain capacities, without
changing solvers or shared scene rendering. Dependency SHE-150 is a broader
invariant audit, not evidence that these synthetic results are calibrated.
Acceptance: deterministic source-value colours, sampled/unknown/uncertain
patterns, selected-cell provenance, same arm/step as the existing scene, and
Canvas2D operation without WebGL. Missing data must never become zero depth.
Risk: no calibrated uncertainty intervals or geographic flood probability exist;
label this structural model uncertainty rather than inventing estimates.

Delivered: source-only `hazard-field.js` adapter, normal storm-page integration,
fixed field legend, tile selection shared with terrain, and provenance reading.
The inspector remains Canvas2D regardless of WebGL/WebGPU availability; if 2D
itself is unavailable, selected-cell text remains. Current runs do not supply
sampled spatial estimates; the adapter tests the explicit sampled state without
inventing samples. Uncertainty means unquantified model structure, not an interval.
Verification: 14 tests / 637 assertions pass across hazard fields, storm scenario,
physics, impacts and recovery; `git diff --check` passes. Browser integration test
added with before/after drainage screenshots and video recording configured.
Both actual Playwright attempts failed before tests at server listen (3100 and
3196 report EADDRINUSE); an independent loopback ephemeral-port Bun probe also
fails with EADDRINUSE. No browser pass, screenshots or recordings claimed.
Next action: run hazard-field and sculpt-a-storm E2E tests in a bind-capable
host, inspect recorded frames, and review before dispatch/publication.
Read-only related-PR search found open PR106/SHE242 owning storm/core CI;
this slice does not modify its workflow files. SHE150/HBL-1M-023 was read as
the planning dependency and remains separate from this rendering adapter.

## SHE-162 — stable population zoom

Owned slice: `world/population/zoom.js`, City Deck integration, focused unit and
browser tests. Existing Population snapshots are the authority; no cohort engine,
worker changes or shared identity contract changes. SHE-144 (Architecture B) is
still Todo with linked PR169; SHE-129 owns census disaggregation. This independent
slice uses existing persistent synthetic IDs and never materializes cohort lives.

Acceptance: City Deck opens a frozen Canvas2D snapshot with city/district/resident
counts, bounded-sample deterministic ID selection, reversible continuous projection,
reduced motion and text fallback if Canvas2D is absent. Inspect opens the existing
resident inspector. Freeze time/seed/model provenance and distinguish represented
weight from actually simulated residents. Tests cover ordering, missing evidence,
projection continuity/reversibility, snapshot immutability and browser controls.
Risk: the bounded worker sample depends on view/time; determinism is for identical
snapshot input, not a universal representative resident. District circles are
aggregate diagram marks, not inferred density or individual positions. WebGPU host
entry remains disabled on unsupported hardware; this panel itself needs no GPU.

Delivered local slice: integrated City Deck details panel with 900ms eased
projection transitions and a continuous scale slider, frozen evidence, real
resident inspection handoff, explicit unavailable values, reduced-motion handling
and text-only Canvas-unavailable path. Provenance includes model, seed, run, tick
and minute. No simulation state or history is created by the adapter.

Verification: `bun test test/population-zoom.test.js test/population-world-view.test.js`
passed 15 tests / 86 assertions. `git diff --check` passed. Focused Playwright test
was authored using real worker snapshots and City Deck, including fallback and
inspector lookup. Execution blocked before browser launch: Bun server listen
reported EADDRINUSE on ports 3100 and 36162. Therefore before/after screenshots,
video and browser behavior remain unverified; test requests both screenshots in
`/private/tmp/she-162-{before,after}.png` and Playwright video when rerun.
No project lint/typecheck scripts are defined. Review found no worker/model edits.
This is an aggregate Canvas projection, not a main 3D camera flight or Architecture
B implementation. Next: run the focused browser test in a host permitting local
server binding, visually review its recordings, then adapt to verified cohort
records once SHE-144 lands. No merge or deployment performed.

## GPU conflict reproducibility — SHE-148

Owned slice in isolated checkout `SHE-148`, branch `mini/SHE-148`: new
`world/gpu-reproducibility.js`, browser research harness, focused tests and report.
No production simulation authority changes. Prerequisites HBL-1M-015/016 remain
planning dependencies; current Population runtime is single-worker, not GPU.
Acceptance: seeded integer resource counts, demand sums and minimum-contact IDs;
CPU oracle versus atomic, two-phase and stable sort-by-key GPU implementations;
100 independent reset runs per seed/backend, exact arrays and hashes, adapter
metadata and end-to-end overhead. Integer-only scope excludes floating reductions.
Risk: hardware/browser availability can block adapter measurements; unavailable
backends must remain unverified. No multi-adapter claim without recorded runs.

Delivered research harness and [scope/evidence report](gpu-reproducibility.md).
Verification: 8 focused tests / 25 assertions pass; 100 CPU repeats per each of
three seeds have exact hashes; benchmark bundles successfully; whitespace check
passes. Browser benchmark exits 1 on local server bind failure (`EADDRINUSE`,
port 0); evidence explicitly records no adapters. GPU shader execution, CPU/GPU
parity, GPU overhead and distinct-adapter coverage remain unverified. Next action:
run the supplied browser benchmark on eligible adapters and record measurements.
No deployment, publication or Linear status change was performed.

## SHE-135 — bounded resident social network

Next slice: project only persisted `social.ties` through the existing resident
social inspector and panel; no second graph authority or generated backstory.
Own `world/relationships/network.js`, its UI, model/panel integration and focused
tests/docs on isolated branch `mini/SHE-135`. No independent implementation tasks
justify delegation. Acceptance: depth 0–3, finite node/edge limits, stable IDs,
synthetic labels, cycle/isolate handling, deterministic restore, worker/UI proof.
Risks: existing relationship lists include inferred seeded ties, so they must
never be traversed. Ledger presence proves saved modeled state, not a historical
encounter or real-world relationship. No cross-model identity is assumed.

Prerequisite audit: Linear SHE-142 is Done and links PR #50; its scalar oracle
files are absent here and its contract explicitly lacks production mapping.
Use the existing Population/legacy social ledger without claiming oracle parity.
Linear relationship-network and GitHub social-network searches found related
Playable Life/social features but no bounded ledger projection to duplicate.
Verification and final status follow below.

Delivered locally: ledger-only projection and shared resident panel integration,
0–3 depth control, schematic plus accessible lists, synthetic labels and original
IDs, snapshot provenance and explicit 80-node/160-edge truncation. Contract and
limits: `world/relationships/NETWORK.md`. No scalar-oracle mapping or new state.
Final focused gate: 49 tests pass, 0 fail, 605 assertions (Bun 1.4.2); covers
cycles, isolates, boundaries, dense budgets, alias rejection, no name/memory
copying, immutable projection and seed-matched Population save/restore. Existing
House/social/promise/tradition regressions pass. `git diff --check` passes.
No package lint/type-check commands exist. Browser checks attempted twice but
server startup is blocked by sandbox loopback EPERM (Bun reports EADDRINUSE);
no browser assertions ran. New `test/e2e/social-network.e2e.js` awaits a socket-
capable environment. Next action: run the documented focused browser gate and
review the local diff. No merge, deployment or production change performed.

## SHE-152 — bounded seed/parameter sensitivity

Owned isolated worktree: `workspaces/SHE-152`, branch `mini/SHE-152`, base b963dd3.
Own new population ensemble module, CLI, focused tests and evidence/report only,
plus this plan entry. Existing population/rules/contracts remain read-only.
Audit: no matching open SHE-152 PR found through connected GitHub search; shell
GitHub network unavailable. SHE-142 is Done in Linear but oracle files are absent
from this checkout; SHE-151 architecture shootout is Todo. Do not claim those
prerequisites, cross-backend parity or million-agent evidence are satisfied.

Next integrated slice: run the production CPU Population entry points over six
paired seeds, baseline/rent/transit levers and five explicit/represented sizes.
Separate size changes (100/100, 200/200, 400/400) from resolution changes
(100/400, 200/400, 400/400); compare display samples with full person-weighted
housing burden. Publish raw rows, empirical central 90% seed intervals, paired
deltas, counts, scenario/model/rules source hashes, machine and limits.
Acceptance: deterministic rerun, population/membership/trip-flow/clock invariants,
missing travel denominator explicit, independent arithmetic oracle for summaries,
invalid input rejection, actual CLI measurement and focused model regressions.
Risks: shared capacities and generator quotas depend on resolution; matched seeds
across sizes are scenario matches, not verified resident identity mappings.
Intervals cover only tested synthetic seeds; systematic sampling error is not
an estimate of empirical population bias. No UI/production changes or deployment.

Delivered bounded increment: `world/population/seed-ensemble.js`, normal CLI
`scripts/run-seed-ensemble.js`, focused tests and published local report
[population-seed-sensitivity.md](population-seed-sensitivity.md) with raw
[evidence](evidence/population-seed-ensemble.json). Actual study:90 futures and
90 verification reruns; six seeds, five sizes/resolutions, three arms, one day.
All population/membership/trip-flow/finite-burden/clock checks pass. Exact
retained-observation replay digest matches;156 source hashes independently
checked against current files. Final focused+existing regressions:24pass,
0fail,318assertions,8.22s. Invalid one-seed CLI exits1 with diagnostic.
`git diff --check` passes; no browser behavior changed, so Playwright skipped.
No repository lint/type-check script exists for this JavaScript slice.

Material result: display samples have measurable selection error; rent/transit
levers affect modeled outcomes; baseline size/resolution difference intervals
cross zero in this bounded study. Source versions, denominators, seed intervals,
machine and timing are recorded. No full-state or cross-backend parity claimed.
SHE-142 oracle integration and SHE-151 shootout remain prerequisites for the
large-scale extension; issue-wide architecture acceptance remains incomplete.
No commit, PR, merge, deployment or external publication performed in this slice.

## SHE-130 — Follow a household across a simulated week

Next slice: open a saved Living World household from the resident inspector,
advance exactly 10,080 minutes on its existing Population clock, retain matching
worker events and daily state/decision observations, and save a read-only replay
with an immutable parent checkpoint. Own the new household-week model/UI/tests
and narrow House entry routing changes in this issue workspace. No engine rules
or cross-model identity adapters change; this integrated slice needs one owner.

Prerequisite audit (2026-11-12): Linear SHE-142 Done and GitHub PR50 merged
(`8f7b3be6`), though its files are absent from this older checkout. Its 32 abstract
ticks cannot represent days. Reuse the existing Population authority, household
membership and fixed-minute observation API rather than inventing that mapping.
No SHE-130 PR found. Existing Playable Life covers a resident's commanded day
and 30-day follow-up; SHE-226/PR110 covers cross-seed futures and SHE-139 owns
side-by-side timelines. This slice adds only a single-run household week.

Acceptance: stable exact household/member/run/model/seed identity; exact clock
boundaries; chronological full event records with retained causal fields; explicit
sampling/retention/no-event gaps; daily home/activity/needs/decision evidence;
no unsupported action controls; persisted replay reload without recomputation.
Verify collector filtering, ordering, bounds, missing data and resume, House
regressions and browser journey where setup permits. Risks: worker event buffers
are bounded and decision traces are sampled, so completeness is never claimed;
large populations may exceed the existing observation work budget.
Status: implementation in progress; no publication or deployment requested.

Delivered: `world/house/household-week.js` records bounded full-fidelity events
and daily state/decision samples; `household-week-ui.js` provides observation,
pause/resume, save retry and read-only replay. Narrow `bridge.js`/`app.js` changes
connect the existing World inspector and exact saved House route. Contract and
limits: [household-week.md](household-week.md). Same-minute events preserve source
order; no alternate engine, synthetic event narrative or rule change was added.

Acceptance evidence: focused worker/collector/UI/bridge/roundtrip suite passed
11 tests /105 assertions, including independent authoritative event comparison,
seed-matched checkpoint replay, exact seven-day boundary, missing observations,
retention, committed pause/resume, failed-save retry without further simulation,
parent immutability and read-only rendering. Existing House integration/lifecycle
suite passed10 tests /81 assertions. JavaScript syntax and `git diff --check`
passed. No lint/typecheck script exists. Playwright test was added but both normal
server launch attempts failed before tests with Bun `EADDRINUSE` (3190,41930).
Browser layout and full route journey therefore remain unverified; rerun the
command in the feature documentation where local server binding is available.
Interrupted in-page observation resumes; reload before saving restarts at the
parent checkpoint. No commit/PR, merge, deploy or production mutation performed.
Final combined gate after review: all five listed unit/integration files passed
21tests /186 assertions in11.75s on Bun1.4.2; syntax and whitespace checks clean.
Implementation complete locally; browser acceptance remains pending the server
binding prerequisite above.

## SHE-172 — allocation recovery (review candidate)

Slice: catch reported Population allocation failures in the existing worker/runtime
and offer an explicit half-population reset from Living City. Prerequisites audited:
Population runtime/worker, count contract, model card and core-journeys CI; related
GitHub memory search returned orchestration work, not a Population recovery PR.
This isolated issue checkout is `mini/SHE-172`. No architecture.md exists.

Acceptance: allocation-specific errors pause advancement; ordinary failures do not
trigger degradation; a deliberate retry resets with fewer synthetic individuals,
records before/after populations, seed and source run/tick, and labels changed
identity/trajectory fidelity. Recovery provenance travels with snapshots and
checkpoint runtime metadata. Population size is not the independently active
changed-state count defined by SHE-141; neither active counts nor cohort precision
are fabricated. There is no cohort backend offered by this slice.

Risks/limits: browser/OS process termination cannot be caught; this handles errors
reported to JavaScript. No real exhaustion stress test or scale/performance claim.
Verification evidence will be recorded below. No deployment or production changes.

Delivered: runtime pause/advance guard, explicit retry with failed-worker disposal,
Living City recovery control and fidelity receipt, source configuration/run/seed/
model provenance retained through checkpoint restore, and focused CI coverage.

Actual verification on 2026-11-12, Darwin arm64, Bun 1.4.2, synthetic seed 42:
- `bun test test/population-memory-pressure.test.js test/population-studio.test.js test/agent-counts.test.js test/population-world-view.test.js world/population/fresh-start.test.js`: 40 passed, 0 failed, 438 assertions on the final integrated run.
- Final focused memory tests: 4 passed, 0 failed, 32 assertions. Injected allocation
  errors, real worker recovery from 80 to 40, seed-matched direct-run equivalence,
  advance failure, repeated failure at one, and checkpoint provenance round trip.
- Initial model/world-view/fresh-start regression run: 30 passed, 281 assertions.
- Broader checkpoint run: 8 passed, 1 timeout across checkpoint and memory tests.
  The same `worker checkpoints restore full state and continue identically at 10
  and 30 minutes` test timed out at 30 seconds against untouched HEAD runtime in
  a temporary baseline copy (removed afterward). Existing failure remains unresolved.
- Browser bundle: `bun build world/population/world-view.js --target browser --external three --outdir /private/tmp/she172-build` passed; `git diff --check` passed.
- Playwright attempted with the added `population-memory-pressure.e2e.js`, but
  server listen failed with EADDRINUSE at 39772 and no visible listener. Browser
  journey remains unverified; no browser/device exhaustion or performance result
  is claimed. Next action: run this focused browser case in an environment that
  permits the application server, then review this candidate before publication.

## SHE-55 — anonymous simulation traffic

Owned slice: `ops/security/simulation-admission.js`, server admission wiring,
`test/simulation-admission.test.js`, `docs/simulation-admission.md`, and this plan
entry. No delegated work or changes to deployment/release gates. Baseline:
existing per-job bounds, City worker lifecycle and paired-job serialization are
reused. Add shared socket-client and process submission budgets before expensive
handlers; preserve read/cancel paths and all simulation contracts.

Acceptance: bounded live identities, cross-route limits, untrusted-header
resistance, predictable no-store 429/retry guidance, small-use success and exact
window recovery. Main risks: process-local/resetting state, shared proxy/NAT
addresses, fixed-window bursts, variable per-job cost. Contract documents these
limits; distributed quotas and staging tuning require operational follow-up.

Delivered local slice: six submissions/client/minute, sixty/process/minute;
4096 live identity cap fails closed. Unit and loopback HTTP load verification plus
existing civic/worker regression command in the contract passed 16 tests with
zero failures and one opt-in HTTP test skipped. The explicit HTTP attempt failed
because loopback listen was blocked (EADDRINUSE at port 0); no HTTP load result
is claimed. Unit checks verify window recovery with an injected clock. No UI behavior changed; Playwright is inapplicable.
Staging load, dependency deployment readiness (HBL-W1-041/HBL-W1-029), and
multi-replica enforcement remain unverified. No production deployment, main merge,
or Linear dispatch-label changes. Source remains reviewable in this workspace.

## Launch landing page — SHE-53 / HBL-W1-040

Local review slice on `mini/SHE-53`: owned files are `index.html`,
`data/launch/{two-futures.png,provenance.json}`, the dedicated launch browser
config/test, and this plan entry. No simulation, sharing, routing, or shell
interfaces changed. Audit: `/` serves `index.html`; the existing Play Demo
already targets `/world/future-machine.html?demo=1`. Reuse that route and the
versioned paired City model rather than reimplementing gameplay. Existing
carousel and connected-world navigation remain available.

Prerequisites inspected in Linear: HBL-W1-007 (SHE-12) is Backlog;
HBL-W1-034 (SHE-47) is In Progress. Copy is therefore provisional, not
claimed user-tested; optional sharing is omitted pending the share-card work.
This is a local implementation requested directly by the user, not a Symphony
dispatch; no ready label, release gate, main merge, or deployment changed.

Delivered: one prominent Play link, housing what-if promise, three concrete
steps, visible synthetic/uncalibrated-model limits, and an actual retained
Month-120 demo capture. Original screenshot pixels are preserved, displayed
through a CSS crop; provenance records source artifact, hash, seed 42,
model/data versions, recipe, run identity, and immutable starting hash. This
capture is historical demo evidence, not a fresh screenshot of this branch.

Acceptance remaining: run desktop/mobile screenshot and first-click journeys
with `bunx playwright test --config test/launch-landing.browser.config.js` on an
unrestricted host. Tests check image load, overflow, single hero CTA, actual
navigation, demo readiness and seed. Current invocation failed before tests:
the npm-selected Bun shim reports its postinstall was not run. Direct
`bun --no-env-file run server.js` with isolated stores and ports 39933 and
42153 failed to bind (EADDRINUSE). A direct installed-Chromium launch also
failed with macOS MachPortRendezvous bootstrap permission denied. No fresh
mobile/desktop screenshot or successful first click is claimed.

Verification: `TMPDIR=/private/tmp bun install --frozen-lockfile` passed;
`bun test test/future-machine-data.test.js test/future-machine-diff.test.js
test/two-futures-demo-controller.test.js test/future-machine-ui.test.js`
passed 24, skipped 1 browser-gated test, failed 0 (172 assertions).
`git diff --check` passed. No repository lint/typecheck script is defined.
Risks: provisional copy, historical visual, and pending browser acceptance.
No commit or PR created. Next: complete host browser acceptance and obtain
copy-testing/share-card dependency evidence before release readiness.

## SHE-112 — demo KPI source contract (2026-11-12)

Bounded slice: the flagship One City, Two Futures cards (Homes, Mean unit rent,
City spending). Existing diff tests covered missing values but not each rendered
card after source mutation. Linear issue and GitHub PR search were read before
implementation; returned metric work concerned CityState catalogs and agent
counts, not this rendered-card contract. This isolated SHE-112 workspace owns
only the new test, package command and documentation; no production code changes.

Acceptance: seed-42 synthetic recorded-shape fixtures retain model/month identity;
mutate each arm's authoritative snapshot metrics at Months 16 and 120; use the
existing getFrame → compareFrame → createUI path and native slider callback;
assert exact card inventory, both arm values, units, delta, selected-month
provenance, reverse time, zero, absent/null/nonfinite/nonnumeric values and missing
snapshots. No forecast or empirical provenance is claimed for mutated fixtures.

Delivered `test/demo-kpi-contract.test.js` and `bun run test:demo-kpis`.
Headless checks of snapshot → diff → presentation plus existing UI/diff/data
regressions: 25 passed, 2 browser tests skipped, 216 assertions, 6.70 seconds.
Explicit browser execution was attempted: installed Chromium exits before test
execution with macOS bootstrap_check_in Permission denied (1100). Initial local
server binding was also blocked; final browser test intercepts local module
requests through Playwright and requires no listening server. Browser acceptance
remains unverified; rerun `bun run test:demo-kpis` on a browser-capable host.
`HBL_PLAYWRIGHT_MODULE` optionally points at an installed Playwright ESM module.
No lint/typecheck scripts exist in package.json. No commit/PR, merge, deployment
or production mutation performed. Scope does not claim coverage of every numeric
observation in other application surfaces or the optional raw evidence views.


## Batch 2 ops integration — PRs #122, #141, #150, #155 and #172

Combined server admission with all existing preview, detective, observatory and
release-experiment handlers. Default admission remains six socket-client POSTs
per minute, sixty per process, with read/cancel bypass and exact recovery. The
combined browser config runs many unrelated journeys against one disposable
server, so explicit test-only startup budgets prevent cross-test rate-limit
collisions. `NODE_ENV=test` plus positive integer test settings are required;
production ignores these settings and request-controlled bypasses are absent.

The launch hero preserves every existing navigation destination, including
Developer previews and Operations Observatory. Its historical screenshot still
matches the committed provenance checksum. PR #136 is a research design document
for hero variants, not a live split-test implementation; that document remains
unchanged. Demo KPI scripts and source-contract documentation coexist with
existing performance/model scripts and UI documentation.

The two overlapping recording PRs share four executable real-API journeys:
full uncut timing, paired start/end and provenance, actual native/Canvas building
selection, metric WHY context, no-intervention/reproducibility, mobile/desktop
control hit checks, and offline failure/recovery evidence. Combined configuration
retains canonical regressions. The recorder requires nonempty media with decoded
frames, dimensions and duration before producing its manifest. Manual seeking
stops the presentation director, so evidence scrubbing follows completion rather
than attempting to resume a stopped director. Original SHE-26 evidence was moved
intact under `test/fixtures/one-city-two-futures/she26/` to retain both conflicting
socket-probe logs; raw log bytes were not reformatted.

Verification: 17 initial admission/civic/worker tests passed (149 assertions,
including actual default HTTP burst/recovery); 20 KPI/UI/diff tests passed (175
assertions) with two explicit browser opt-ins skipped. The launch config discovers
two tests. The combined browser config discovers 19 tests; six admission and five
recording-command tests pass with 234 assertions. Syntax and whitespace checks
pass except preserved historical evidence-log whitespace, which is excluded by
explicit path. Chromium startup is already verified blocked by socket EPERM
before page creation, so browser runs/media evidence remain unverified here.

## First-play consumer compatibility — SHE-175

Bounded slice: existing homepage Play Demo → real monthly City seed-42 pair →
first draw → receipt → timeline/WHY, plus no-WebGPU/no-context and actual device
loss. Prerequisites: runnable local Bun server, installed Playwright engines;
physical M-series/integrated Intel/AMD/mobile availability and planning
HBL-1M-039/HBL-1M-041 remain unverified. Acceptance requires measured browser/device
rows with seed/model/run provenance, working interactions and explicit failure
outcomes. Risks: emulation mistaken for devices, draw submission mistaken for
scanout, headless/software backend mistaken for hardware WebGPU.

Delivered review candidate: dedicated opt-in Chromium/Firefox/WebKit desktop and
mobile-profile config, first-play evidence attachments and existing initialized
loss suite integration. No application behavior changed. Focused scene/data/share
regression: 21 pass / 145 assertions; discovery: 8 Chromium / 24 all-engine tests.
Actual browser attempts exited before tests: Bun listen EADDRINUSE on 3199 and
58473. No timings/device passes invented. Matrix, manual protocol, source hashes
and startup log: [compatibility report](first-play-compatibility.md). Browser and
physical-device acceptance remain open; no publication, merge or deployment.


### Batch 2 first-play integration — PR #176

Preserved the full consumer matrix, reuse of actual device-loss tests, and
historical attempt JSON/raw startup log. Added disposable City/share/Decision
stores and the same bounded test-only admission settings used by the combined
recording suite. Syntax/configuration checks and discovery pass: eight Chromium
and 24 all-engine cases. The matrix still distinguishes emulation, native device
availability, draw submission timing and actual physical-device evidence.

Final server smoke used fresh real Bun processes and malformed request bodies
that cannot schedule model work. With NODE_ENV=production, the first six reached
400 validation and the seventh returned 429 despite test-budget environment
variables; with explicit test mode all seven reached 400 validation. This checks
actual server wiring in addition to the default HTTP burst/recovery regression.
Historical raw logs from #155/#172/#176 remain byte-for-byte equal to their PR
heads; only identified evidence-log paths are excluded from whitespace checks.
No new browser success or media evidence is claimed under the existing Chromium
socket EPERM blocker. All six owned PRs retain their original heads as ancestors.

## SHE-38 / HBL-W1-025 — detected rendering backend audit

Scoped ownership: `test/e2e/city-renderer.e2e.js`, this status entry, and the rendering README. No runtime or simulation changes are needed: World appends `rendererMode` to `#source` only after awaiting graphics initialization. `createWorldGPU` awaits init and rejects a non-WebGPU backend; `createCityRenderer` awaits init and reads the actual backend flag; Canvas returns `canvas2d` only after obtaining a 2D context. Future Machine already verifies its initialized backend in `scene/renderer-backend.js`. This overlaps completed renderer/fallback work; capability detection is not used as the final World label.

Added two focused browser regressions through `/world?demo=1&people=10`: keep `navigator.gpu` present but return no adapter, optionally block WebGL contexts, then verify actual WebGL2/Canvas2D stats, precise visible source label, multiple rendered frames, and usable lighting/quality controls. Screenshots are captured to each test's output directory.

Verification on branch `mini/SHE-38`: `bun test test/world-canvas-renderer.test.js test/render-performance.test.js` passed 11 tests / 55 assertions. `bunx --no-install playwright test --config playwright.renderer.config.js --grep detected` could not start the local server (`EADDRINUSE`, port 3198). Retrying with `/tmp/she38-renderer.config.mjs` on isolated port 33938 produced the same startup failure. Browser assertions and screenshots remain unverified; no hardware WebGPU claim, deployment, merge, commit or PR. Next action: run the two new browser cases in an environment permitting local server startup. No model, versioned seed/data, or synthetic-data disclaimer changed.

Revalidation (2026-11-12): inspected the full Linear acceptance criteria and preserved the existing scoped changes. Confirmed the awaited initialization and actual backend flags in `world/render.js`, `world/world-gpu.js`, and `world/render/renderer/webgpu-renderer.js`. Re-ran the exact focused Bun command above: 11 passed, 0 failed, 55 assertions. Re-ran the exact Playwright command above: server startup again failed with `EADDRINUSE` on 3198 before either browser case executed. `git diff --check` passed. Acceptance remains pending real-browser fallback verification; no screenshot or native WebGPU evidence was produced.

## SHE-219 — interaction ablation, first verifiable slice

The source research document and SHE-171 runner are absent in this checkout.
Reuse the actual Population model behind `world/PEOPLE_BENCHMARK.md` through a
bounded headless CLI. Prerequisites inspected: behavior 1.3.0, transport demand
feedback and same-step boarding gates, daily household/economy/employment rules.

Scope: transport-channel intervention, five matched arms (current, frozen
transport, shuffled demand, half and double demand feedback). Keep current
behavior unchanged outside an explicitly attached diagnostic. Record seed,
source/config/model/rules, horizon, units, initial identity digest, outcomes,
resource-incidence graph and paired 95% Student-t seed intervals. Do not label
this a complete resident-independent ablation: households, care, housing and
employer coupling remain. A statistical difference must never override that
coverage failure or authorize an interacting-resident claim.

Acceptance: exact full-arm equivalence; deterministic intervention replay;
freeze both lagged demand and same-step transit gate; shuffle preserves demand
counts; zero/missing metrics remain explicit; paired seeds cannot be duplicated
or dropped; real 10k/100k runs; meaningful failure/boundary tests. No browser
behavior changes. Follow-on: independent-copy adapters for household, care,
housing and firm feedback and actual sharding before the full E2 release gate.

Implemented: shared benchmark context, opt-in demand-read hooks, streamed
transport-resource graph, paired Student-t analysis, bounded sequential CLI,
source/state hashes, atomic complete-report publication and coverage-blocked
E2 result. Protocol and residual interfaces are in
`docs/research/million-agent-architectures.md`; existing benchmark and model
card link it. Hooks preserve normal state exactly; no production config or
checkpoint contract was changed.

Verification so far: focused/adjacent suite 62 pass, 0 fail, 717 assertions
(20.60s); real CLI replay of 15 small runs produced identical scientific fields,
graph evidence, source hashes and initial/final digests; invalid CLI input
preserved an existing output file. Broader six-file regression including
checkpoints: 55 pass, 1 timeout (73.12s). The checkpoint-worker test also timed
out alone with current behavior and with original HEAD behavior in a temporary
source copy; baseline invocation was interrupted after recording the timeout.
This remains a limitation, not a green checkpoint-worker gate. Existing
serialization/continuation and other checkpoint tests passed in the broader
run. No lint/typecheck script exists in package.json. Browser behavior is
unchanged; Playwright is skipped in favor of focused actual-model integration.
The 10k/100k, three-seed (42–44), one-day sweep completed all 30 arms in
814.26 seconds. The complete report is retained at
`docs/research/results/she219-transport-ablation.json`; all 993 source hashes
match the checkout. No headline band excludes zero at 10k; only planned commute
does at 100k (full minus frozen −0.032616 minutes, 95% interval
[−0.053252, −0.011981]). Employment, occupancy and rent differences are zero.
Neither population meets even the transport-only two-outcome criterion;
complete E2 remains unimplemented and the interacting-resident claim withheld.

Final focused/adjacent rerun: 62 pass, 0 fail, 717 assertions (21.64s).
Focused checkpoint checks: 4 pass, 0 fail, 26 assertions (serialization,
deterministic continuation and capture consistency); the previously timed-out
worker case was filtered out and remains unresolved. Whitespace checks pass.
Next implementation task is resident-independent shared-resource adapters with
trajectory perturbation tests, followed by partner/resource rewiring and causal
graph instrumentation as specified in the protocol. No deploy, production
mutation, commit or PR.

## SHE-117 — guided housing versus drainage comparison

Next integrated slice: City Lab offers a fixed, versioned synthetic recipe with
baseline, six-home construction (USD 840,000), and drainage represented by the
existing resilience project (+0.4 protection, USD 200,000). All arms use the same
starting inventory, five matched seeds (42–46), 36 months, and Riverside flood
(month 24, duration 3, severity 0.7). The existing API owns persistence and replay.
No shared engine/API contract changes or parallel implementation are needed.

Acceptance: real funded projects and completion gates, distinct measured outcomes,
immutable baseline, deterministic replay, retained recipe/model provenance, and
an accessible normal-entry-point journey through saved comparison and replay.
Show flood-event damage alongside final housing/rent/budget metrics; avoid claims
of calibrated drainage hydraulics or guaranteed improvements. A 12-home trial
remained utility-constrained; six homes is the bounded supported recipe selected
for verification. Existing imported/custom experiments must retain their behavior.
Delivered: guided entry point, fixed recipe/model provenance, saved three-arm
comparison, observed flood-event damage query, and ordinary replay integration.
The existing partial source edits were retained and completed in this isolated
issue checkout; no engine or shared API changes were necessary. Open GitHub PR
search for housing/drainage returned no duplicate. No parallel work was needed.

Acceptance evidence: all five seed pairs complete both funded projects before
month 24, housing adds six units, drainage lowers flood-event damage, initial
inputs remain unchanged, and independently regenerated monthly evidence matches.
The normal API stores all 15 futures, seeds 42–46 per arm, five observed flood
events per arm, recipe provenance, and replay metrics identical to stored values.
Focused recipe tests: 3 passed. Combined City/recipe/unblock/server regression
suite: 24 passed. Whitespace check passed; no repository-wide lint/type script
exists for this JavaScript module.

Browser regression added for the guided click, saved reload, lineage and drainage
month-24 replay. Playwright could not start its app server: EADDRINUSE at default
3100 and alternate 34117; browser assertions and visual layout remain unverified.
No deployment, production changes, dispatch approval labels, commit or PR were
made. Next action: run the focused browser test in an environment that permits
its local servers, then review/publish the diff through the normal host process.

## SHE-17 — predictable 50-second tour interruption

Scope/ownership: Future Machine demo-controller.js, main.js, ui/index.js and
ui/README.md; focused controller and race-browser tests/config; this plan entry.
Single integrated slice; no delegation or shared model/API changes. Baseline
already implements the 50-second clock, recorded-month playback, pause/resume,
restart and some generation guards (including prior cancel/restart race tests).
The prerequisite paired-run/data infrastructure is present; tracker dispatch
labels/status were not changed and no separate dependency delivery is claimed.

Delivered: explicit preparing/paused/manual captions; pause intent survives
async preparation; restart remains available during loading and supersedes older
requests; explicit manual takeover plus existing navigation invalidates pending
autoplay. Restart resets month and pause intent. Failure returns to idle demo
controls. Computation can complete after takeover, but cannot resume the tour.
Simulation results, recipes, provenance and synthetic disclaimers are untouched.

Acceptance/checks (2026-11-12):
- `bun test test/two-futures-demo-controller.test.js test/future-machine-ui.test.js`:
  9 passed, 1 browser-gated skip, 60 assertions.
- Added actual-API slow-response click sequence play→pause→resume→restart→manual,
  plus restart/manual during a second held load; screenshot capture is in that
  test. Existing real-pair cancel/restart regression retained.
- `bunx playwright test --config test/future-machine-race.browser.config.js`:
  blocked before tests by Bun listener EADDRINUSE on port 39919.
- `HBL_FM_RACE_PORT=39927 bunx playwright test --config test/future-machine-race.browser.config.js`:
  same server startup blocker. Config now supports an alternate port.
- `HBL_FM_BROWSER=1 bun test test/future-machine-ui.test.js`: 6 passed,
  browser test failed at Bun.serve port 0 with EADDRINUSE, before launching Chromium.
  No screenshot or successful browser journey claimed. No lint/typecheck scripts.
- `git diff --check` passed. No commit/PR, merge, deployment or tracker dispatch.
Remaining: run the focused race browser suite on a host that permits the local
listener and review its actual-run manual-takeover screenshot.
- Final combined regression command: `bun test test/two-futures-demo-controller.test.js test/future-machine-ui.test.js test/future-machine-data.test.js test/future-machine-diff.test.js` passed 25 tests / 178 assertions, with 1 browser-gated skip. Includes deterministic paired history, real in-process City API persistence/replay, cancellation/error paths and Month 16 physical divergence.

## SHE-16 — disabled and loading control explanations (2026-11-12)

Scoped source slice on `mini/SHE-16`: onboarding readiness helper, storm page,
plan page, Future Machine UI, focused browser tests and this plan entry. SHE-9
(HBL-W1-004) is Done per Linear readback. Existing first-run repairs already
explain World/Reality prerequisites; reuse that helper rather than replace them.
No model, seed, result contract or synthetic-data disclaimer changed. No dispatch
labels, production state, merge or deployment changed.

Delivered: visible deduplicated status reasons plus accessible descriptions and
native titles for disabled actions; restore original attributes on re-enable,
exclude hidden/inert sections, and update dynamically inserted controls. Plan
explains missing links and active computation, with a retry action on failure.
Storm explains draft/result prerequisites and ensemble waits; editing and playback
are locked during recomputation, and failed runs leave playback unavailable until
a successful retry. Future Machine explains loading, absent replay/household
records and unsupported actions, and refreshes reasons on each state update.

Verification: `bun test test/world-first-run-repairs.test.js
 test/future-machine-ui.test.js test/control-readiness.browser.test.js
 test/storm-scenario.test.js test/storm-physics.test.js test/storm-impacts.test.js
 test/storm-recovery.test.js test/storm-treaty.test.js` passed 25 tests / 703
assertions, with 2 opt-in browser tests skipped. `git diff --check` passed.
Browser attempt: `HBL_FM_BROWSER=1
 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs
 bun test test/control-readiness.browser.test.js test/future-machine-ui.test.js`
failed before browser launch: both local Bun servers reported EADDRINUSE on
port 0 in this sandbox. This is an environment blocker, not passing UI evidence.
The new browser regression exercises missing plan, loading, re-enable, service
failure/retry and storm draft/completion hint cleanup, and writes a screenshot to
`/private/tmp/she-16-disabled-storm.png` when runnable. No screenshot was produced.
Next: run both opt-in browser tests in a host permitting loopback server binding,
inspect the screenshot and verify actual route layout. No PR created here.

## SHE-37 — inspectable player replay receipt

Local slice on `mini/SHE-37`. Ownership: `world/future-machine/main.js`, new
`ui/replay-receipt.js`, the existing Future Machine browser suite, this entry
and `docs/run-receipt.md`. No deployment, merge or Linear dispatch changes.
The HBL-W1-019 prerequisite (SHE-32) remains Backlog in Linear; source inspection
finds existing `direct`/`jump`/`entityDescription` navigation and recorded
construction provenance, so this slice does not implement entity navigation.
Canonical receipts, validation, saved-run replay and CLI already exist; only
player access was missing. No independent delegation is useful for this small,
coupled UI/integration slice.

Implemented: expandable receipt inspection for the displayed run/month, formatted
JSON, clipboard copy with manual-selection fallback, paste/reopen through
`replayRunReceipt`. The existing validator checks versions, checksum, identity,
initial-state digest and selected/terminal outcomes before presentation. No
missing-record fallback is allowed for receipt replay. Export invalidates when
the run/month changes. Existing share links and evidence downloads remain.
Only bounded synthetic City evidence is exported; no account, URL, clipboard
contents beyond explicit pasted input, or private user records are collected.
The retained canonical contract requires a saved experiment on the same service;
its checksum is not authentication and replay is manifest recomputation, not
independently retained checkpoint proof.

Acceptance evidence (2026-11-12):
- `bun test test/run-receipt.test.js test/future-machine-share.test.js test/future-machine-ui.test.js`:
  16 passed, 1 skipped, 1 failed. Existing CLI loopback test failed at Bun server
  bind (`EADDRINUSE`, port 0), before CLI assertions.
- `bunx playwright test --config test/future-machine.browser.config.js -g 'player inspects'`:
  blocked at local server bind (`EADDRINUSE`, port 39884). No screenshot or UI
  pass is claimed. Committed browser coverage exercises real Month 16 inspection,
  clipboard, selected-month restoration, corrupt/version rejection and mobile
  overflow. Next action: run it in an environment permitting local server startup.
- Final focused check results are recorded in the accompanying handoff.

No commit or PR created in this workspace. Remaining review gate: integrated
browser execution and coordinator reconciliation of the dependency's Linear state.

Final checks: `bun test test/run-receipt.test.js -t 'real persisted|seed boundaries|invalid fields'`
passed 3/3 (53 assertions). `bun test test/future-machine-share.test.js test/future-machine-ui.test.js test/future-machine-data.test.js`
passed 18, skipped the opt-in Chromium component test, failed 0 (164 assertions).
`git diff --check` passed. No lint/typecheck script is declared in package.json.

## SHE-36 — costs and tradeoffs

Local branch `mini/SHE-36`; exclusive slice: `world/future-machine/ui/{index.js,model.js,README.md}`,
`test/future-machine-ui.test.js`, and this plan entry. Baseline audit found the
integrated monthly City cards already display recorded homes, whole-stock mean
rent and cumulative capital cost with neutral/change/cost direction semantics.
Existing synthetic assumptions, seed/model/run provenance, exact household joins,
and tiny nonzero values are retained. SHE-32/HBL-W1-019 remains Backlog in Linear,
but its prerequisite event-to-entity path exists in `main.js` (`jump`, `select`,
`explainMetric`) and the integrated browser journey; no duplicate implementation
or dispatch-label change is needed for this local slice.

Acceptance: preserve per-metric unavailable status/reason, reject nonfinite
deltas, show comparison direction and uncertainty limits without a welfare claim,
and verify zero, missing, negative, cost-only and first physical divergence.
A partial comparison must retain supported individual metrics. No simulation,
recipe, seed, data or shared contract changes. Single paired-run variation is
not a confidence interval; empirical/parameter uncertainty is not estimated.
Verification results follow below. No deployment or main merge authorized.

Actual verification (2026-11-12):
`bun test test/future-machine-ui.test.js test/future-machine-diff.test.js test/future-machine-story.test.js test/future-machine-evidence-trail.test.js test/future-machine-data.test.js`
passed 37 tests / 245 assertions, 1 browser-gated skip, 0 failures (5.55s).
Includes real seed-42 Month-16 first physical divergence (+24 units), deterministic
120-month rerun, zero/missing/negative metrics and capital cost semantics.
`bun build world/future-machine/ui/index.js --target browser --outdir /tmp/she36-ui-build`
and `git diff --check` passed. Package has no lint/typecheck scripts.
Browser attempt:
`HBL_FM_BROWSER=1 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test test/future-machine-ui.test.js`
failed before Chromium startup at `Bun.serve({port:0})`, EADDRINUSE in this
restricted environment (6 unit tests passed in that initial attempt). New browser
assertions are included in the working diff but remain unexecuted; no fresh UI
screenshot or integrated browser pass is claimed. Next action: rerun that command
on a host permitting local listening and capture the built-in mobile/desktop
screenshots. Local working diff only; no commit/PR, Linear mutation or deployment.

## SHE-35 — intervention edit and rerun

Audit: Future Machine already has paired 120-month City runs, immutable histories,
pending seed configuration, saved recipe sharing, request-identity guards and
cancel/restart browser coverage. These satisfy the underlying common-start and
comparison prerequisites (HBL-W1-017/018 behavior); fixed housing/no-plan selection
leaves numeric policy editing missing. This slice owns only Future Machine UI,
coordinator configuration messaging, focused browser coverage and their docs.
No dispatcher, model, API, versioned recipe or release gate changes.

Acceptance: edit 1–120 proposed homes using existing validated housing amount;
keep cost, district, delay, compliance, seed and generator unchanged; preserve
displayed history/share while editing; obtain a new actual result with identical
initial and baseline hashes; cancel a delayed old response and retain the latest
edited result. Risks: proposed amount is not guaranteed construction; fixed cost
is an illustrative assumption, not an estimated per-home cost. Existing model
constraints and synthetic disclosures remain visible. Verification pending.

Verification (2026-11-12, branch `mini/SHE-35`, no commit/PR):
`bun test test/future-machine-ui.test.js test/future-machine-data.test.js test/future-machine-share.test.js test/future-machine-scrub-identity.test.js`
passed 21 tests / 349 assertions, one opt-in Chromium test skipped. The added
real-engine regression verifies 12 versus 24 constructed homes, identical initial
and baseline hashes, and immutable prior results. Its first draft incorrectly
read metrics directly from engine steps; corrected to use authoritative normalized
snapshots, then the full focused command passed. `git diff --check` passed.

Browser attempts remain blocked: `HBL_FM_BROWSER=1 HBL_PLAYWRIGHT_MODULE=/Users/wahabma/happybearlandia/node_modules/@playwright/test/index.mjs bun test test/future-machine-ui.test.js test/future-machine-data.test.js test/future-machine-share.test.js`
failed before Chromium at Bun.serve port 0 (`EADDRINUSE`); 18 non-browser tests
passed. `/Users/wahabma/happybearlandia/node_modules/.bin/playwright test test/e2e/intervention-rerun.e2e.js test/e2e/future-machine-race.e2e.js`
failed before browser launch because server port 3100 returned `EADDRINUSE`.
No screenshot or successful browser result claimed. Added actual-API edit/share/
reload browser coverage and extended the existing delayed-response race to edit
12 homes; these require rerun where local servers can start. No lint/typecheck
scripts are defined. No deployment, merge, dispatch or production data changes.

SHE-50 final static verification: browser-target Bun bundle succeeded (30 modules);
`node --check` passed for coordinator, recent store and UI adapter;
`git diff --check` passed. Browser execution remains blocked as recorded above.

## SHE-31 — visible fair comparison inputs

Implemented the scoped Future Machine slice. Audit found existing seed editing,
provenance, matched Month 0 histories, null-intervention controls and versioned
share/replay tests (overlap with HBL-W1-017); these remain authoritative.
Owned changes: `world/future-machine/main.js`, `ui/index.js`, `ui/styles.css`,
`ui/README.md`, new `test/e2e/future-machine-inputs.e2e.js`, and this plan.
No independent implementation tasks justified delegation.

Each arm now displays the recorded comparison recipe's seed, 120-month horizon,
starting household count and people summed from recorded Month 0 household sizes.
Baseline explicitly has no intervention; plan shows district, proposed homes,
illustrative USD cost, delay in months and compliance fraction, preserving zero.
The coordinator passes history recipe/initial state separately from draft inputs,
so editing next-run settings cannot relabel the displayed comparison. Missing
history is explicitly unavailable. No simulation, seed/data version, share format,
or synthetic-data disclaimer changed.

Acceptance evidence: `bun test test/future-machine-ui.test.js test/future-machine-share.test.js`
passed 13 tests / 123 assertions, with one opt-in Chromium component test skipped.
Added real-API browser regressions for seed 0, unchanged control, zero cost/delay/
compliance, pending seed edits, shared-link baseline hash reproduction and mobile
width, with screenshot capture on success. `bunx playwright test test/e2e/future-machine-inputs.e2e.js`
could not start its server: EADDRINUSE at port 3100; retry with
`HBL_PLAYWRIGHT_PORT=34131 HBL_PLAYWRIGHT_PARTY_PORT=34132` failed identically.
Browser assertions and screenshots remain unverified due to local server setup.
No deployment, merge, dispatch label or Linear state change. Next action: run the
committed browser tests in an environment that permits the configured listeners.

Final regression gate: `bun test test/future-machine-*.test.js` passed 96 tests,
942 assertions, 0 failures; 3 opt-in browser tests skipped. `git diff --check`
and Node syntax checks of the changed UI and new browser test passed. Branch:
`mini/SHE-31`; no commit or PR created in this session.

## SHE-32 — exact What Changed selection

Local slice on `mini/SHE-32`: preserve existing deterministic story jumps,
exact scene lookup, monthly City provenance and construction evidence. Audit
found KPI WHY selected an arbitrary physical difference, and raw event receipts
had no selection action. SHE-30 is In Progress in Linear; its policy work is a
separate prerequisite, not claimed complete here. No dispatch state changes.
This slice owns `world/future-machine/main.js`, `evidence.js`, story rendering
and its README, focused tests, and this plan entry. Work is sequential because
selection and receipt composition share one interface.

Acceptance: housing KPI offers only model-owned completed-building receipts;
other aggregate metrics explicitly disclose unsupported entity causality.
Selecting a receipt preserves exact ID, arm and event month, focuses only a
supported scene mapping and retains the WHY receipt. Missing mappings never
substitute a different entity. Verify unit regressions and normal-route browser
interaction, including the unsupported metric path. No simulation changes.

Delivered: KPI inspection no longer picks an arbitrary physical difference;
housing offers exact historical completion stops, other metrics disclose
unsupported causality. Event buttons retain receipt, arm, identity and month
through the existing scene focus/WHY flow. No model, seed or data changes.

Verification (2026-11-12): `bun test test/future-machine-*.test.js` passed
98 tests / 961 assertions, 3 browser-gated skips. After adding a real matched
120-month KPI regression, `bun test test/future-machine-metric-selection.test.js
test/future-machine-story.test.js` passed 12 tests / 65 assertions, including
Month120 → exact Month16 event16-0, missing/zero/unsupported paths and disposal.
`node --check world/future-machine/main.js` and `git diff --check` passed.
No lint/typecheck scripts are defined. Playwright commands
`bunx playwright test test/e2e/future-machine.e2e.js -g 'KPI WHY'` (default and
alternate HBL_PLAYWRIGHT_PORT/HBL_PLAYWRIGHT_PARTY_PORT) and
`bunx playwright test --config test/future-machine.browser.config.js -g 'KPI WHY'`
all failed before test execution: server bind EADDRINUSE on3100,39432,39884.
No browser screenshot obtained; the added browser regression remains unverified.
Next action: run that regression in an environment permitting an isolated app
server, capture the screenshot, and review alongside prerequisite SHE-30.
No commit/PR, dispatch labels, merge or deployment performed by this slice.

## SHE-15 first-divergence emphasis — November 12, 2026

Prerequisite SHE-9 verified Done in Linear. Audit confirms existing seed-42,
121-frame paired fixture, exact-ID scene focus, six-second Month-16 cinematic
hold, construction receipts and reduced-motion camera behavior. Preserve these.
This local slice owns main.js, ui/index.js, ui/styles.css and the focused sprint
browser test additions; no simulation, recipe, renderer or release-gate changes.
No independent tasks justify delegation. Dispatch automation remains untouched.

Next slice: show a static, high-contrast first-construction cue inside the
comparison at its exact recorded month, with observed homes delta and a WHY
button targeting the recorded entity. Hide it at Month 0, missing evidence and
other months. Acceptance: actual first addition visible, unchanged Month 0,
normal/reduced-motion browser screenshots and existing model/clock regressions.
Risk: physical differences need not be construction; require a completion receipt
at that month and avoid making claims for unsupported or absent events.

Delivered: receipt-gated static cue and exact-building WHY action, using the
existing scene highlight/hold and current diff's homes delta. UI adapter contract
and focused boundary regression updated; ownership also includes ui/model.js,
ui/README.md and test/future-machine-ui.test.js. No model/data changes.
Browser command `bunx playwright test --config test/two-futures-sprint.browser.config.js --grep 'first construction cue'`
failed during server startup with EADDRINUSE on 39931; retry with
`HBL_TWO_FUTURES_PORT=40153` failed identically. Browser assertions and screenshot
capture therefore remain unverified. Two normal/reduced-motion tests are added
for the real route, actual added entity, Month 0 equality and reverse scrubbing.
Branch: mini/SHE-15; no commit/PR or deployment made. No lint/typecheck scripts
exist. Next action: run these browser checks on a host able to start the server
and inspect the captured comparison screenshots before visual acceptance.
Final verification: `bun test test/future-machine-*.test.js test/two-futures-*.test.js`
passed 100 tests, 967 assertions, 3 browser-gated skips, 0 failures (18.25s).
`git diff --check` passed. Focused new UI cue test passed as part of that suite.

Revalidation on November 12: inspected the full SHE-15 issue and retained the
existing uncommitted implementation rather than duplicating it. The same Bun
command passed again: 100 passed, 3 skipped, 0 failed, 967 assertions (17.94s).
The focused Playwright command above again exited 1 before assertions because
the configured server reported EADDRINUSE on 39931. No screenshots or browser
acceptance are claimed. Whitespace verification passed; branch remains
`mini/SHE-15`, with no commit, PR, merge or deployment performed here.

## SHE-57 / HBL-W1-044 — network failure injection

Scope: finish the partial changes already present on `mini/SHE-57`; owned paths
are Future Machine data/index.js, main.js, ui/index.js, data/README.md,
test/future-machine-data.test.js, test/e2e/network-demo.e2e.js,
test/network-demo.browser.config.js and this plan. No parallel workers or shared
API/model changes. SHE-28 (HBL-W1-015) remains Backlog in Linear; its useful-error,
preserve-prior-results scope overlaps this pre-existing partial implementation.
This direct local slice does not grant dispatch labels or claim SHE-28 complete.

Audit: existing operation deadlines, AbortSignal polling, current-request guards,
immutable normalized paired history, saved recipe identity validation and explicit
missing-record recomputation already work. Retain those interfaces. Finish
connection/timeout guidance and an explicit retry preserving the failed saved ID,
recipe and selected month. Existing completed evidence stays visible and labeled
when a subsequent request fails. No simulator, seed, model or dataset changes.

Acceptance scenarios use actual City API data (seed 42, model city-systems.1.0.0,
future-machine-synthetic.v1, 30 households, 120 months): disconnect at first physical
divergence Month 16; interrupt shared replay; delay/cancel superseded replay;
expire shared-data deadline; lose network after the share shell loads; hold the
second replay arm while checking loading/no partial history, then recover. These
are controlled synthetic network conditions, not observed public-network timing.
Offline cold navigation cannot load an uncached app shell; no service worker is
introduced. Client cancellation does not cancel already submitted server jobs.

Verification so far: `bun test test/future-machine-data.test.js
 test/future-machine-ui.test.js test/future-machine-share.test.js`: 20 pass,
1 browser-gated skip, 0 fail, 168 assertions. `bun x --no-install playwright test
--config test/network-demo.browser.config.js` and a retry prefixed with
`HBL_TWO_FUTURES_PORT=40957` both stop before browser launch: Bun serve reports
EADDRINUSE on ports 39931 and 40957, with no reachable listener (curl fails and
lsof shows none). Browser recovery/no-stale-state acceptance and screenshots
remain unverified in this sandbox. Run the five-scenario suite on a host permitting
local server startup. No PR, commit, merge, deployment or production mutation.

Final local regression: `bun test test/future-machine-*.test.js` passed 98 tests,
3 browser-gated skips, 0 failures, 948 assertions across 16 files (25.37s), including
interrupted response bodies, HTTP 503 message preservation, stale replay aborts,
manifest validation and boundary seeds. `bun x --no-install playwright test
--config test/network-demo.browser.config.js --list` discovers all five scenarios.
`node --check` passes for data/index.js, main.js and ui/index.js;
`git diff --check` passes. No repository lint/typecheck script is defined.
Existing untracked test/test-results artifacts were preserved. Screenshots are
configured per scenario but none were produced by this blocked run. Finish browser
acceptance before treating SHE-57 as complete; current branch is `mini/SHE-57`.

## SHE-118 — shareable question cards

Next slice: three optional editable policy questions on Future Machine's existing
paired comparison. Reuse canonical-run-receipt.v1 and monthly City replay; no
model changes or new persistence. This isolated SHE-118 checkout owns the new
challenge sharing/view modules, main composition, focused tests and documentation.
Acceptance: all three questions carry a validated receipt and restore exact saved
run/month/outcomes; reject corrupt or mismatched links before displaying results;
render question text safely and preserve ordinary comparison sharing. Prompts are
questions, with no numeric impact claims. Risks: links contain synthetic evidence
and question text (warn against personal information); bounded fragment size and
missing saved records must fail explicitly. Verification: receipt/share unit
regressions and focused browser journey using disposable local storage.

Implemented locally: optional editable homes/rent/capital-cost question cards,
validated receipt fragments, exact query/receipt identity checks and full
regenerated receipt comparison before presentation. Missing saved records fail
explicitly for challenges; ordinary comparison fallback remains available.
Links follow displayed history rather than pending configuration; text uses
native DOM text properties. Startup validation now yields to a newer run/cancel.
No model/rules, server, persistence or production changes. Connected GitHub
search found no open PR matching SHE-118 on 2026-11-12.

Acceptance evidence: six focused challenge/share/data/manifest/UI/diff suites
passed 38 tests (436 assertions), one opt-in browser component test skipped.
After adding unsaved/identity cases, challenge/share rerun passed 9 tests with
114 assertions. Receipt suite's three non-server tests passed; its CLI test
failed at Bun.serve(port:0), EADDRINUSE. Playwright launch failed before executing
assertions when its isolated server could not bind port39884 (EADDRINUSE).
Both challenge browser journeys are discovered by --list: all three links,
refresh, mismatch/missing-record recovery, and delayed startup validation versus
a new run. Actual browser execution and screenshots remain unverified; rerun
`bunx playwright test --config test/future-machine-challenges.browser.config.js`
on a host permitting the isolated local server. `git diff --check` passed.
No commit/PR was created from this source-only sandbox.

## SHE-49 — three playable City recipes

Scope/ownership: `world/future-machine/recipes.js`, catalog insertion in `ui/index.js`, focused recipe tests/config, and this plan. No engine, persistence or deployment changes. Prerequisite audit: the existing Future Machine provides paired City runs, bounded versioned recipes, saved manifests, exact-ID inspection, share/reload and Canvas fallback (overlap with completed housing slice). Tracker dispatch prerequisites remain separate from this local implementation; no readiness/status changes claimed.

Next integrated slice: expose exactly three authored housing examples through the normal Future Machine controls. Use seed 42 and the existing synthetic generator for matched controls; vary scale, district and governance delay. Housing is deliberately chosen because the existing low-fidelity renderer projects recorded buildings and construction; it does not project school or utility upgrades. Risks: construction/funding may constrain requested supply, and multi-input examples cannot isolate individual parameter effects. No promised empirical benefit or invented geometry.

Acceptance: all three catalog links run through saved paired experiments on forced Canvas, have different recorded physical outcomes, survive share/reload with identical metrics, retain immutable Month 0 and model/data/seed provenance, and expose synthetic assumptions and limits. Verification pending below.

Local verification (2026-11-12, branch `mini/SHE-49`): `bun test test/future-machine-recipes.test.js test/future-machine-data.test.js test/future-machine-share.test.js test/future-machine-ui.test.js` passed 19 tests / 191 assertions, with 1 opt-in browser component test skipped. Recorded engine outcomes: small infill completes 6 homes in d1 at month 16; district expansion completes 24 in d2 at month 16; delayed housing completes 12 in d1 at month 64. Each replay hash matches its repeated run and leaves the initial state unchanged. `docs/evidence/she49-recipes.json` stores catalog/model/data/seed/initial-digest provenance, limitations and actual completion records; these are local synthetic recomputations, not browser observations.

`bunx playwright test --config playwright.recipes.config.js` was attempted twice (ports 3199 and 41949); both stopped before tests when Bun server listen reported EADDRINUSE. The committed focused suite covers each catalog link, Canvas backend, Month 0/120 physical changes, blink, downloaded evidence, saved share and reload. End-to-end browser results and screenshots remain unverified; no PR, deploy or merge performed. `git diff --check` passed. Existing partial catalog/UI work was preserved and extended with verification and interface documentation. Next action: run the focused browser command in an environment where the server can bind, inspect its three screenshots and exported evidence, and resolve any failures before claiming full acceptance.

## SHE-8 — core first-play funnel

Next slice: reuse merged SHE-7 schema from PR #113, instrument confirmed Future
Machine UI transitions, retain seven first-only in-memory milestones with actual
renderer, explicit UI version and closed scenario identity. No simulation changes,
external collection, deployment or merge. Integration ownership and exact dependency
provenance: [first-play instrumentation](first-play-instrumentation.md).

Acceptance: valid schema envelopes; no emitted invented outcomes, missing-history
divergence or failed-run start; one milestone per page session across replay;
clipboard settlement result; explicit saved-return entry. Existing City history,
versions, seeds and synthetic disclaimers remain authoritative. Tasks: restore exact
merged prerequisite; implement bounded adapter and entry-point calls; unit-test
failure/dedup paths; run real browser journey and existing regressions; review diff.
Risk: this checkout predates SHE-7; source restoration is integration of completed
work, not a replacement implementation. Browser bind permission may block local
acceptance; no passing browser claim without actual execution.


Delivered locally: restored the exact three SHE-7 dependency files and wired the
seven milestones through the real Future Machine handlers. The versioned wrapper
is bounded to seven records; no persistent identity or network analytics added.
WHY emission follows inspector rendering, including the guided inspector; simulator
facts come from existing paired-history differences. Source remains on `mini/SHE-8`;
no new commit/PR, main merge or deployment was performed.

Actual verification:
- `bun test test/first-play-funnel.test.js test/first-play-events.test.js test/two-futures-demo-controller.test.js test/demo-fallback.test.js test/future-machine-ui.test.js test/future-machine-diff.test.js test/future-machine-data.test.js test/future-machine-share.test.js`:
  47 pass, 1 optional Chromium test skipped, 0 fail, 785 assertions (3.15s).
- `node --check world/future-machine/main.js` and
  `node --check test/e2e/first-play.e2e.js`: passed.
- `git diff --check`: passed. Restored dependency files match PR head bytes.
- `bunx playwright test --config test/first-play.browser.config.js --list`:
  two browser tests discovered successfully.
- `bunx playwright test --config test/first-play.browser.config.js` and
  `HBL_TWO_FUTURES_PORT=39983 bunx playwright test --config test/first-play.browser.config.js`:
  blocked before browser execution by server bind failure (Bun reports EADDRINUSE).
  Independent Python ephemeral localhost socket probe confirms PermissionError,
  errno 1 / Operation not permitted. No port was stopped or existing server reused.

Unresolved acceptance: run the two committed browser tests in an environment that
permits localhost binding. No browser event/replay pass or screenshots are claimed.
The visible UI is unchanged. Existing package scripts expose no lint/typecheck gate.
Final publication should target the sprint with merged SHE-7 present so its restored
files do not appear as new implementation. Coordinator file-ownership/dispatch
metadata has not been changed; no competing worker or dispatch was launched.

## PR #135 / #151 / #153 / #168 integration — November 12, 2026

Merged all four original snapshot heads with their ancestry preserved. Independent
plan, renderer, scene and model-card records were retained. The renderer audit
adds truthful backend/fallback browser assertions without changing simulation
rules. The transport research keeps the full arm identical to ordinary Population
state and retains its explicit incomplete-interaction/E2 limitation, recorded
units, seed matching, report and source provenance.

Scene resolution keeps retained meshes and label nodes, the authoritative tween
target origin/clock, final settled draw, live reduced-motion preference and
progressive graphics readiness. Recorded labels now distinguish additions,
changes and removals. Picks exclude invisible meshes, ghosts and decorative
children and return only exact collection/ID/arm. Missing snapshots clear
selection, camera transition, Canvas inventory and both native label DOM/map.
The new lifecycle fixture supplies the existing media preference contract and
awaits explicit Canvas readiness; it does not claim native browser pixels.

City Lab preserves the existing Life panel and project-unblock inspector while
adding the independent three-arm housing/drainage recipe and flood-event table.
Selecting an experiment clears both Life and flood evidence; refresh retains both
features. The new API test now polls by a bounded 30-second elapsed deadline
rather than a fixed 200-by-20ms loop; its 60-second test cap retains all assertions.
The measured successful API journey took 9.05 seconds under City 1.1.0.

Model-description review compared `docs/models/population.md` with behavior,
transport hooks, paired-seed reports and resource-incidence instrumentation; it
now documents optional arms, initial state, schedule, units, remaining interactions
and checkpoint exclusion. Review of `docs/models/city.md`, City contracts,
engine, systems and residents corrected the stale twelve-pack description to the
existing thirteen-pack 1.1.0 model, including resident identities, initialization,
monthly equations and evidence limits. The guide's versioned scenario assumptions
are explicit; no City equation changed in this merge.

Verification: renderer/Canvas fallback tests passed 11 tests / 55 assertions.
The scene, effects and backend suite passed 29 tests / 156 assertions with one
optional real-Chromium test skipped. The existing Canvas and building-renderer
cases also passed. All 11 transport-ablation cases passed, including ordinary/full
state equality, deterministic matched arms and real CLI output. Policy comparison
and City Life passed 6 tests / 253 assertions; project-unblock's 6 cases passed.
Browser-target bundling of City Lab and the scene succeeded (17 modules).
`git diff --check` passed. Actual browser startup was previously blocked by socket
EPERM and was not retried; no new screenshots or GPU performance claims are made.

Expanded Population validation exposed existing test limits: the weekend scenario
passed in 14.22 seconds when rerun with an explicit 60-second test cap. The worker
checkpoint negative-restore case times out at its original 30-second limit. An
external diagnostic copy raising only that limit to 120 seconds failed after 13
assertions with `Checkpoint requires the committed live worker; regeneration is
forbidden` on both the unchanged prior-batch baseline `e42c370` (62.85 seconds)
and this scene branch `201c8bf` (62.36 seconds). The checkpoint/runtime/worker/pool
source and repository test were unchanged; this is a reproduced pre-existing
limitation, not a claimed passing checkpoint gate. Diagnostic copies remain under
`batch2` outside the repository. No broad extra testing or checkpoint code change
was made for this integration.

## Future Machine bulk integration — November 12, 2026, second batch

Integrated the original heads of PRs #123, #126, #127, #128, #129, #130,
#131, #132, #134, #140, #154, #165, #166 and #183 with individual `--no-ff`
merges on `integrate/b2-ui`, preserving their ancestry. Source integration through
`acd5e0b` starts from `cfa06e6`; no remote mutation or deployment by this worker.
Shared plan additions were retained. Reviewed root design/agent instructions,
Future Machine frozen interfaces and affected UI/data/story/receipt contracts.

The combined controls retain earlier share/copy/card/import actions, evidence
anchors, rent decomposition, Butterfly Ledger, moments, outcome chart, exact
first divergence, hidden-tab timing, reduced motion and progressive readiness.
Pause intent survives data/graphics preparation, restart invalidates earlier
requests, and manual takeover prevents late autoplay. Housing edits coexist with
all original presets and curated recipes; Month-0 labels preserve the recorded
A/B input summaries. PR145's storm hazard inspector remains alongside control
readiness explanations. Receipt/challenge retries preserve strict identity and
selected month, and opt-in local continuation stores only the allowlisted run
context. Event v2 explicitly accepts City 1.1.0, while legacy v1 remains restricted
to City 1.0.0; no model rules or recorded facts changed in this UI integration.

Independent review reproduced three composition defects before repairs: actions
made while graphics were pending lost their first-play milestones; remembered
context incorrectly outranked explicit Play Demo entry; and a failed rerun left
share controls enabled but their handler inactive. Focused coordinator regressions
failed on all three before repair. The fixes retain at most seven validated,
closed milestone payloads until measured readiness, with original action time and
settled share result; prioritize explicit demo over bare-entry continuation; and
allow sharing and divergence inspection of retained completed history after a
failed rerun. Readiness of a retained current stage flushes pending actions even
when a newer request fails, without replacing its error/status message. Disposal
clears deferred events; no event persistence or transmission was added.

Verification:

- Broad Future Machine, rent/game-director, receipt and first-play Bun gate:
  **156 passed, 3 browser-gated skips, 0 failed; 2,362 assertions in 29 files**
  (126 seconds). Includes real City creation/reopen, receipts, challenge links,
  curated recipes, boundary seeds, retained effects and evidence navigation.
- After review repairs: coordinator, first-play and tour-controller suites:
  **34 passed, 0 failed; 502 assertions in 4 files**. Twelve coordinator tests
  execute the actual module in isolated VM contexts with controlled existing
  renderer/network interfaces, covering pending preparation, pause/takeover,
  stale requests, strict retry, challenge hashes, consent, explicit entry,
  quiet autoplay, retained error-state sharing and deferred event readiness.
- Browser-target bundles for Future Machine and storm passed (56 modules);
  final Future Machine rebuild passed (48 modules). All 44 changed JavaScript
  files parsed before follow-up; changed follow-up source and regression files
  were parsed again. All 14 assigned original PR heads are reachable ancestors.
- Chromium execution remains unavailable due the previously observed socket
  `EPERM` launch restriction. No browser execution or screenshot success is
  claimed. Browser assertions were reconciled with copy-button naming, exact
  evidence navigation, retained legend summaries and expanded UI imports.

Parent owns the final cross-branch gate, remote merge and browser-config
composition. The existing first-play compatibility-matrix config and the new
focused funnel config require separate paths in that integration.

## SHE-138 — bounded ripple inspector

Slice: add a downstream Ripple tab to the existing stored-event inspector and a
read-only `/api/causality/ripple` route. Own only ripple traversal, read-route/tab
integration, focused tests and their documentation. No new simulation authority.
Planning SHE-141 and blocking SHE-142 are Done (Linear read November 12); oracle
PR #50 is absent from this checkout, so this slice uses existing monthly City
records only. Backlog audit found no GitHub ripple issue; provenance PR #62 owns
idea diffusion and #4 owns the guided policy model. Neither is modified. Existing
backwards Why traversal and Butterfly Ledger single-input ablation are separate.
Acceptance: at most five downstream edges total, source-event citations, explicit
relation labels, bounded cycles, visible missing dependencies and truncation,
original run/seed/model context. Risk: existing traces may end before a resident
outcome; report the gap rather than inventing a cross-model identity or edge.

Delivered: downstream route/traversal and Ripple tab reuse the existing graph,
relation/evidence display and navigation. Five total edges also bound branch
fanout, with six queries maximum and 100 evidence references per edge. Cycles
and missing source events are explicitly reported; no fabricated bridge to a
resident is introduced. Verification: 8 tests passed, 42 assertions, including
real SQLite City recording through the normal dispatcher. Existing and new
Playwright tab tests remain unverified: both default port39871 and alternate
39983 failed to bind (EADDRINUSE); no existing process was stopped. No configured
package lint/type-check script. Next: run browser suite in a permitted host and
review trace coverage before extending to oracle or other simulation identities.
Final regression gate: 19 tests passed / 332 assertions across ripple, read API,
World causal adapter and shared causality contracts; `git diff --check` passed.

## WHY receipt coverage — SHE-255

Next bounded slice: offline audit of all thirteen monthly City inventory types
using existing WHY receipt matchers; no simulation or explanation changes.
Prerequisites inspected: Future Machine generator/default recipe, City engine,
entity comparator, story matcher and exact construction mapping. No architecture
file exists. Protocol and formula are fixed before running measurements in
[why-receipt-coverage.md](why-receipt-coverage.md). Acceptance: six independent
120-step runs (seeds 42/7/2911, baseline/plan), per-type coverage, uncovered types,
provenance and deterministic replay tests. Main risk: unique-entity coverage can
hide unexplained recurring changes; publish transition coverage alongside it.
Gate is a human-reviewed proposal only. No deployment or production writes.

Delivered: `scripts/why-receipt-coverage.js`, fixed protocol, six-run JSON and
[results with per-type counts](why-receipt-coverage-results.md), plus focused
regressions. Seed42 plan:99/416 entities (23.80%),1083/10643 transitions (10.18%).
23 tests pass/0 fail/158 assertions across audit, story and diff suites, including
exact rerun equality, artifact reproducibility, receipt16-0, missing collections,
wrong month/entity and zero denominators. Review preserves engine and UI behavior;
no browser test needed. Proposed100% gate remains disabled, pending human choice.
No commit/PR or production operation performed. Coverage concerns receipt presence
only and excludes nonentity finance/system summaries as fixed before measurement.

## SHE-128 — neighborhood population brush

Dependency SHE-141 is Done; its executable count contract is present locally.
Read-only GitHub search for neighborhood/SHE-128/brush found no matching PR.
The existing Policy Paintbrush concerns proposals; the proposed monthly City
grid in `docs/reviews/chatgpt-30-neighborhood-proposal.md` has another clock and
identity authority. This slice owns new Population selection adapter/UI/tests
and the minimal model, worker, runtime and Living World wiring. No monthly City
counts or render samples are combined. Work stays in the isolated SHE-128
workspace; no deployment or Git metadata changes.

Acceptance: Shift-drag world ground coordinates or submit keyboard coordinate
bounds; pause and query the entire committed worker population; show tick,
minute, seed, model and explicit activity window. Count current positions with
inclusive edges. Active is distinct residents changing the declared spatial,
activity, travel or need fields during the last committed step, including
intermediate changes that revert. Other state fields are outside this diagnostic.
The complete spatial interaction ledger is absent, so current interactions are
unavailable. Unweighted models have zero aggregate-only persons; represented
weights have no separately located aggregate records, so that count is unavailable.
No weighted person is relabeled an independent agent. Old checkpoints without
activity diagnostics report unavailable until the next step. Diagnostics are
saved with model state and never influence rules or randomness.

Verification in progress: pure reconciliation, zero/unavailable, boundary,
seed-matched replay, serialization and real worker query pass (5 tests,23
assertions). Browser keyboard/pointer integration and existing regression suite
are next. This is coupled model/worker/UI work with shared interfaces, so no
independent implementation delegation is used. Risk: diagnostic arrays add
bounded per-step allocation proportional to resident count; this is not evidence
of million-resident throughput. Pointer projection uses the existing world ground
plane, not surveyed neighborhood boundaries. Results remain labeled snapshots;
subsequent simulation advances require another selection to refresh.

SHE-128 verification checkpoint: integrated selection adapter, diagnostics,
worker/runtime query and toolbar UI delivered. Final focused/regression command
`bun test test/neighborhood-selection.test.js test/agent-counts.test.js
world/population/fresh-start.test.js test/neighborhood-traditions.test.js
test/population-world-view.test.js test/population-model.test.js
test/population-needs.test.js test/population-hotspots.test.js` passed62tests,
665assertions in7.79s. `git diff --check` passed. The new worker checkpoint test
preserves selection evidence exactly through JSON save/restore. Seed metadata
uses the input config seed rather than the generator's derived internal seed.

Existing checkpoint suite:29pass/1timeout; isolated rerun reproduced the timeout.
A separate54MiB `/private/tmp/SHE-128-baseline` source copy with HEAD versions of
model/runtime/worker also timed out on the same existing `worker checkpoints
restore full state and continue identically at10and30minutes` test at30s.
No existing tests or deadlines were changed. Playwright attempted on default
3100 and alternate34128; both server starts failed with EADDRINUSE. Thus the
new keyboard/pointer browser test is added as source but unexecuted, and no
screenshot or visual acceptance is claimed. Remaining release verification:
run `bunx playwright test test/e2e/neighborhood-selection.e2e.js` in an environment
that permits the app to bind a port. No lint/type scripts are configured in the
root package. No PR, commit, deployment or Linear state change performed.

Overlap follow-up: Linear search found related SHE-33/96/97 monthly neighborhood
metrics, SHE-154 density rendering, SHE-161 occupancy/activity heatmaps and
SHE-219 interaction-ablation research. These are separate outputs or model
contracts; this slice owns only Population rectangular inspection and does not
implement their views. Browser bundling passed for the new inspector (2 modules)
and integrated world-view (199 modules). No million-scale performance claim.

Revalidation on November 12: fetched the full SHE-128 contract and confirmed
SHE-141 remains Done. Fresh GitHub SHE-128 search returned no matching issue/PR;
Linear neighborhood search confirmed the separately scoped monthly metrics work.
Preserved the implementation already present in this workspace. The eight-file
focused/regression command above passed again: 62 tests, 665 assertions, 8.25s.
`git diff --check` passed. Fresh Playwright attempts on ports 3100 and 34128 both
failed before test execution with server EADDRINUSE. Browser acceptance and
dispatch review remain outstanding; no merge, deployment or issue mutation.

## Multiscale Population rendering — SHE-155

Independent slice owns `world/population/render-lod.js`, Population renderer and
World toolbar integration, focused LOD tests and `docs/population-render-lod.md`.
Prerequisite SHE-141 is Done; its metric contract remains unchanged. Existing
worker district totals and bounded positions suffice; no simulation changes.
Acceptance: distance heat, sample clusters, individual residents, persistent
record/draw separation, immutable zoom metrics, deterministic fixtures and
explicit disabled low-capability path. Risks: district counts are residence,
not street occupancy; clusters cover only the sample; WebGPU remains required.
Code slice implemented; final focused Population and metric-contract verification
passed 24 tests/345 assertions; git diff --check passed. Browser smoke
was attempted twice: local server startup failed with EADDRINUSE on ports 3100
and 3415. Browser appearance and before/after recordings remain unverified;
rerun with a working server before graphical acceptance. No deployment or merge.


## PR #188–191 integration — November 12, 2026

Merged the four snapshotted original heads with ancestry preserved. Population
neighborhood diagnostics retain #185's allocation failure/recovery behavior,
checkpoint provenance and paused recovery flow. Both DATA_FORMATS contracts remain;
the Population ODD now explains the observed field subset, internal-boundary
accumulation, exact worker counts, clock/window and unavailable interactions.
Multiscale rendering coexists with the neighborhood brush and existing zoom,
filters, interpolation and selected identity. Review found and fixed stale hover
halos/cursors after individuals become aggregate marks, with a focused regression.
The ripple tab follows only bounded stored downstream edges with their evidence
and explicit gaps; it introduces no new simulation or causal inference.

The WHY coverage formula and thirteen Future Machine collections remain fixed.
The original City 1.0.0 JSON was retained byte-for-byte in the version-labeled
artifact, with its historical results and original PR revision. The current report
was regenerated under City 1.1.0 and its source digest list now includes the resident
pack. Resident inventory itself remains explicitly outside the existing WHY
collection scope; neither report claims coverage of every City state mutation or
causal completeness. No coverage threshold gate was enabled.

Focused verification on source head `73237be` passed 59 tests / 375 assertions /
0 failures across ten files in 19.81 seconds: neighborhood-selection,
population-render-lod, population-world-view, population-zoom,
population-memory-pressure, ripple-inspector, causality-read,
why-receipt-coverage, future-machine-story and future-machine-diff. The coverage
test runs all six 120-step scenarios twice and compares the exact current artifact.
Browser-target bundling of population/world-view and the causal inspector succeeded
with 202 modules. All four original heads are ancestors and the complete integration
diff passes `git diff --check`. Independent read-only review found no remaining
blocker in runtime recovery, selection/reset, LOD cleanup and hover behavior.
No browser was launched because the existing socket EPERM blocker remains; actual
UI pixels and interaction journeys are not claimed as verified in this run.


## Catch-up merge verification — PRs #118–191, excluding already merged #159

Integrated all 73 original PR heads with their existing sprint target. Independent
review and focused fixes preserve asynchronous demo controls, strict replay and
sharing, local continuation precedence, progressive first-play events, simulation
admission, allocation recovery, neighborhood inspection and multiscale rendering.
Both first-play browser suites remain available: the cross-engine compatibility
matrix keeps `test/first-play.browser.config.js`; Chromium clipboard/funnel
journeys use `test/first-play-funnel.browser.config.js` (two cases discovered).

Verification on the combined checkout with Bun 1.4.4:

- The 51-file changed-feature/regression gate passed 253 tests, with 5 explicit
  opt-in skips, zero failures and 4,383 assertions in 186.96 seconds.
- After the reviewed coordinator fixes, five focused flow/event/admission files
  passed 40 tests, zero failures and 718 assertions. This explicitly enabled and
  passed the actual HTTP admission test skipped by the ordinary gate.
- The four latest PRs passed 59 focused tests across ten files, zero failures
  and 375 assertions, including real worker queries/recovery and exact WHY-report
  regeneration against the current source.
- The three Python adapter suites passed 34 tests.
- The final Future Machine, storm, City Lab and Living City browser-target build
  passed (66 modules); population world view and causal inspector also bundled
  successfully (202 modules). Bundling and discovery are not browser execution.

Four opt-in browser tests remain unexecuted. Chromium launch was previously
blocked before page creation by socket EPERM. The expanded checkpoint gate also
has a confirmed pre-existing failure: the unchanged baseline and integrated
scene branch fail the same negative-restore case after 13 assertions when its
external diagnostic deadline is extended. No passing checkpoint or browser gate
is claimed. Historical evidence-log bytes and the original City 1.0.0 coverage
artifact are retained; current coverage evidence explicitly identifies City 1.1.0.

## SHE-171 reproducible headless benchmark — review candidate

Audit: existing bounded metric fixture (PR34), scalar oracle (PR50), people
benchmark and renderer benchmark have distinct models and cannot certify a
million-agent production run. Existing core CI installs Chromium; full-scale
benchmark remains opt-in. Isolated issue branch mini/SHE-171 starts clean.
Slice: dedicated synthetic typed-state transfer workload, fixed uint32 seed,
10k/100k/1M records; isolated headless Chromium compute/render/combined phases.
Acceptance: deterministic state/count replay, honest zero/unavailable metrics,
source hashes and device metadata, bounded inputs, machine-readable failure,
and actual browser smoke. Rendering uses a dedicated WebGL point workload,
not the city renderer. Memory is sampled JS heap when supported, not process/GPU
peak memory; that limitation must accompany every report. No production claim,
merge or deployment. Independent oracle/production equivalence remains outside
this runner. Tasks: kernel + phase harness; CLI lifecycle/export; tests/docs.

Delivered: `scripts/benchmark-million.js`, versioned kernel/browser harness,
focused tests, manual-only workflow and `docs/million-benchmark.md`. No production
model limits changed. Playwright intercepts module requests, avoiding any server
or external network. Every combined run must match its compute-only final state;
energy/sample/timing invariants fail closed. Browser launch failure exported
status=failed/records=0 and exit1; macOS sandbox denied Chromium MachPort startup.
Actual render/combined measurements and true process/GPU peak memory remain
unverified/unavailable; operator browser-capable run is the next acceptance gate.
Focused final validation:14tests/316assertions passed, including fresh-process
invalid CLI; `git diff --check` passed. No lint/typecheck scripts configured.

## Spatial neighbor lookup experiment — SHE-149 / HBL-1M-022

Completed isolated headless slice on `mini/SHE-149`: hash bins and sorted tile
bins over up to 1M position indices, independent geometric brute-force oracle,
CLI with version/seed/machine/hash metadata, tests and measured JSON evidence.
Prerequisite SHE-142 is Done in Linear but its scalar source is absent here;
production/scalar snapshot adapters remain explicit follow-on work. Ownership,
source assumptions, contracts and limitations: [benchmark report](spatial-neighbor-benchmark.md).

Acceptance tasks: (1) seed-matched synthetic 0/1/10% hub snapshots; (2) lossless
lookup, exact-radius oracle and boundary/overflow tests; (3) fresh-process build,
query, candidate/match, runtime memory and hot-tile measurements; (4) diff review
and integrated focused checks. Actual 18 million-index builds completed, 4,752
oracle queries with zero mismatches, identical candidate/result hashes across
methods/repeats. With 1% hubs median hash/sorted build 34.62/438.74ms, hub p95
21.04/19.92µs; no universal production recommendation. Raw evidence is
`docs/evidence/spatial-neighbors-1m.json`. Empty CLI succeeds and count above 1M
fails before workload launch. No UI, deployment, publication or production data
change. Final focused test evidence is recorded below after verification.

Final verification: `bun test test/spatial-neighbor-index.test.js test/agent-counts.test.js`
passed 11 tests / 7,636 assertions; `git diff --check` passed. Benchmark and oracle
measurements above are actual executions, not estimates. Package has no lint/type
script; no browser-facing changes, so Playwright was skipped. Source remains
local and uncommitted for review; no commit/PR is claimed.

## SHE-182 unattended dispatch hardening — November 12, 2026

Next integrated slice: preserve SHE-180 as sole queue/lease owner, require both
`hbl-agent-ready` and `hbl-coordinator-approved` in addition to existing pilot and
pressure gates, and enforce the same approvals at host startup/publication.
Harden the legacy opt-in launcher rather than install a second scheduler.
Prerequisites: existing private host assignments, resource-aware scheduler and
source-only handoff. Acceptance: missing/revoked labels hold new grants and
startup/publication, old pilot labels cannot bypass approval, bounded launcher
concurrency and cleanup tests, complete offline host suite. Risks: existing
pilot tickets will intentionally stop until a human reconciles approvals;
external runtime installation and actual OS resource containment remain host
validation, never inferred from offline fixtures. No live activation, issue
mutation, merge, deployment or production write is authorized by this slice.

Delivered in checkout: shared dual-approval policy across coordinator fresh scans,
host worker bootstrap and publication; both legacy templates and the current
workflow retain the additional pilot/pressure gates. Legacy launcher now has a
hard six-worker ceiling, never-approval policy, stripped tracker/GitHub child
environment, explicit Linear turn/stall/backoff limits, and process-group cleanup
even after its leader exits. SHE-180 remains sole queue owner; no competing
scheduler or remote mutation was added. Regression checks include revocation
between scans (pending lease retained, no grant), host rejection before workpad
mutation, and a real SIGTERM-resistant orphan worker stopped before restart.

Verification: ops suite21 tests passed; Linear one-worker dry-run exited0;
focused approval regressions5 passed; whitespace check passed. Host suite final
result is recorded below. No browser behavior changed; Playwright skipped.
Remaining acceptance: external runtime initial/retry label-filter semantics,
kernel CPU/memory containment, runtime retry exhaustion and sustained unattended
operation must be verified on the trusted host. The versioned resource scheduler
provides admission holds, not hard OS quotas. No unattended reliability or full
SHE-182 completion is claimed. Host adoption requires the workflow and Python
modules (including `dispatch_policy.py`) together and operator reconciliation of
old approvals. No dispatcher was activated, issue approved, merge performed,
deployment made or production data changed.

Final combined host suite:219 tests passed in11.659seconds. Together with21
ops tests,240 tests passed. Existing private-credential rejection fixture printed
its expected hold; there were no failures. Final diff whitespace check passed.

## SHE-111 — deterministic seed replay CI matrix

Slice: pin three 120-month normalized monthly City fixtures and check them in
parallel CI jobs on every PR and main push (a superset of engine changes).
Prerequisites: existing City engine, Future Machine generator/normalizer and
canonical SHA-256 helper. No engine behavior or model version changes.
Acceptance: committed hashes match; failures locate first month/entity;
replacement fixtures require a changed model version and documented rationale.
Owned files: replay CLI, golden fixtures/tests, dedicated workflow and version
notes. Risk: exact floating point hashes intentionally expose runtime drift;
CI pins Bun 1.4.2. Initial fixtures establish city-systems.1.0.0, with synthetic
assumptions and full recipe/rules/generator provenance. No cross-model mapping.
The existing 106-case sweep remains separate. GitHub PR audit was attempted
but blocked by network connectivity; local checkout contained no golden matrix.
Delivered and locally verified: all three CLI checks matched 121 normalized
months each on Bun 1.4.2. Golden + existing sweep suites passed 9 tests;
final golden + retained data/boundary/scrub-identity run passed 16 tests,
279 assertions. The final version guard regression also passed 4 tests,
15 assertions. `git diff --check` passed. No lint/type-check script exists.
Browser behavior is unaffected; Playwright skipped. Workflow execution on
GitHub and remote PR/duplicate audit remain unverified due network access.
No merge, deployment, production data change, commit or PR was made.
The guard checks PR base or main push predecessor, permits initial fixture
creation, and requires replacement baselines to introduce a newly documented
model version. Exact full-frame hashes include event/observation provenance;
entity hashes diagnose state additions/removals/changes in the earliest frame.

## SHE-58 accessibility audit — partial, November 12, 2026

Next slice: audit existing primary World sheets and Future Machine controls;
reuse visual-pass accessibility rather than replacing it. Acceptance is rendered
contrast, keyboard focus/dismissal, narration alternatives, static progress and
target sizes, with real browser evidence. SHE-19 remains In Review. This worker
owns only the new SHE-58 report and isolated browser audit/config; shared UI
ownership remains with integration. No simulation contracts change.

Delivered source audit and runnable browser-audit candidate:
[findings and exact evidence](accessibility/she-58-audit.md). Focused checks:
22 passed / 1 skipped / 0 failed. Browser startup failed on two fixed ports and
an ephemeral-port component server (Bun EADDRINUSE); no screenshots or browser
pass claimed. Critical source finding: light quick-demo foreground/background
contrast is 4.26:1, below 4.5:1; shared stylesheet correction is pending integration.
All-panel conformance and prerequisite completion remain unresolved. Branch
`mini/SHE-58`; no PR, merge or deployment. Next: stylesheet owner integrates the
contrast correction, then run the browser audit with local binding available and
complete assisted-input review. Do not mark the issue complete on unit evidence.

## SHE-89 canonical example receipts — November 12, 2026

Next slice: migrate the two recovered evidence fixtures to the now-available
`canonical-run-receipt.v1` exporter and validator. Reuse their supported recipes,
real engine and synthetic provenance; preserve fixture names and hash manifest.
Acceptance: every parsed fixture validates, regenerates byte-for-byte and matches
its pinned whole-receipt SHA-256; reject tampering and retain clear caveats.
No persisted identity is fabricated: these unsaved examples reproduce locally
and cannot use the saved-experiment replay loader. No browser change is needed.

Delivered: both fixtures now use the canonical exporter; `--check` validates the
parsed fixtures, independently regenerates the paired histories, compares exact
JSON bytes and verifies pinned whole-receipt hashes. Tests retain completion and
zero-control evidence and reject altered observations/checksums. Fixture README
and receipt contract describe synthetic limits, hash meanings and unsaved replay.
Verification: `bun scripts/example-receipts.js --write` and `--check` succeeded;
example/share/data/diff suite: 26 passed, 220 assertions. Canonical receipt library
checks (persisted replay, boundaries, invalid inputs): 3 passed, 53 assertions.
The initial combined run had 18 passes and one existing CLI test failure at
`Bun.serve({port:0,hostname:'127.0.0.1'})` with EADDRINUSE; CLI child-process
verification remains blocked in this environment. No browser behavior changed;
Playwright skipped. No commit/PR, tracker mutation, deployment or production data
change was performed. This supersedes the earlier canonical-scope gap above.

## SHE-236 — resident performance lab

In progress: audit the authoritative Population path and measure generation,
fixed-step compute, view selection, snapshot construction and structured copying
at increasing resident counts. Related SHE-151 owns the broader architecture
shootout; SHE-149 owns interaction spatial grids; SHE-171 owns million-scale
browser phases; SHE-167 owns lazy allocation. This slice owns bounded headless
measurements and exact display-selection alternatives, not those interfaces.
Acceptance: repeatable seeded raw samples and machine metadata; compare current
full sort with heap, insertion and partition selection using identical results;
retain simulation determinism and existing non-WebGPU CPU behavior; deliver a
local git-am patch without pushing. Rendering/GPU/frame rate and browser transfer
latency require separate browser evidence and must remain unmeasured here.

Completed locally: [performance report](resident-performance-lab.md), opt-in
seeded runner, raw 1k/10k/100k measurements, sampled CPU profile and three exact
selection alternatives. The chosen production change reuses validated history
need entries; the heap selector remains experimental because it regresses small
populations. The original/optimized comparison at 100k measured median steps of
262.056/210.230 ms; a final full-sort production-path run measured 236.315 ms.
All measured variants retained identical full-state hashes at each size.
Focused acceptance passed 49 tests / 635 assertions, including failure paths,
conservation, replay and existing renderer integration. No package lint/typecheck
scripts exist. No browser/GPU timing or million-resident capacity claim is made.
No production data, deployment, push or Linear status change. Delivery is a local
git-am patch; browser/GPU and broader scenario benchmarking remain separate work.

## SHE-19 — keyboard and screen-reader first-play verification

Audit (2026-11-12): existing `world/future-machine/ui/index.js` already provides
native Play Demo, split/difference buttons with pressed state, a named shared
month range with calendar value text, metric-specific WHY buttons, and share
button/link. Status/error semantics and textual WITHOUT PLAN / WITH PLAN,
capital-cost and synthetic/uncalibrated labels overlap completed flagship work.
No simulation, recipe, disclaimer or application implementation is changed.

This bounded slice owns only the keyboard regression appended to
`test/e2e/two-futures-sprint.e2e.js` and this plan entry on `mini/SHE-19`.
No delegation or shared interface edits. Existing suite/configuration is reused.
Acceptance test enters via homepage Play Demo using Tab/Enter, waits for actual
guided completion, changes view with Enter/Space, scrubs Home/ArrowRight/End,
opens WHY, reaches share, and reopens the exact month/results using the generated
link. It checks visible focus outside hidden/inert/aria-hidden ancestors and
text labels rather than color. Reverse Tab navigation is included. Real replay
completion is required; no synthetic events or injected simulation data.

Actual checks:
- `bun test test/future-machine-ui.test.js test/future-machine-share.test.js test/two-futures-demo-controller.test.js`: 15 passed, 1 browser-gated skip, 136 assertions.
- `git diff --check`: passed.
- `/Users/wahabma/happybearlandia/node_modules/.bin/playwright test --config test/two-futures-sprint.browser.config.js -g 'keyboard first play'`: blocked before test execution by server bind failure. Retry with `HBL_TWO_FUTURES_PORT=41919` produced the same error. Python loopback bind to port 0 independently returned `PermissionError [Errno 1] Operation not permitted`, confirming sandbox restriction rather than evidence of a port collision.

Pending: run the committed keyboard journey in a host permitting loopback servers,
inspect its screenshot, and manually check speech with a screen reader. Browser
semantics and a completed keyboard replay are not claimed verified by this slice.
No new screenshot, commit, PR, deployment or merge. HBL-W1-013 prerequisite and
coordinator ownership beyond these local test/document edits remain unconfirmed;
no dispatch gate or Linear status was changed.

## Landing page simulation FAQ — SHE-119

Slice: add six concise, always-visible answers on the normal `/` homepage,
with a navigation anchor and a Future Machine entry link. Owned files are
`index.html` and this plan; model, persistence, and shared interfaces stay with
their existing owners. No delegation is needed for this single static slice.

Audit: no existing homepage FAQ; connected GitHub open-PR search for FAQ
returned no matches (2026-11-12). This checkout is the isolated `mini/SHE-119`
workspace. No `docs/architecture.md` exists. Copy checked against
`world/future-machine/share/index.js` (version/identity validation and exported
limitations), `data/core.js`, `INTERFACES.md`, `docs/future-machine.md`, and
`world/decision/analysis.js` (successful samples and same-seed pairing).

Acceptance: explain conditional modeled results, deterministic inputs and seed,
sampled uncertainty versus real-world odds, synthetic data, causal limits, and
evidence/recomputation limits without implying all site experiences replay.
Use semantic headings and visible paragraphs without JavaScript; verify the
FAQ anchor/link, readable text and no FAQ overflow at 320px, 390px and desktop.
Risk: ensemble spread omits unmodeled mechanisms; the single-pair flagship
cannot be presented as an uncertainty distribution. No empirical accuracy
or independent checkpoint-equivalence claim is made.

Implemented and statically verified: six FAQ headings, unique IDs, named section,
and navigation anchor. `bun test test/future-machine-share.test.js
 test/decision-analysis.test.js`: 18 passed, 159 assertions, zero failures.
`git diff --check` passed. No lint/typecheck scripts exist in package.json.
Browser verification is blocked: Python local server bind returned Operation
not permitted; cached Playwright Chromium also failed at launch with macOS
MachPortRendezvousServer permission denied. No browser assertions ran. Mobile
320/390px and desktop visual/keyboard checks remain for a browser-capable host.
CSS uses 16px body copy, wrapping paragraphs, responsive padding and existing
visible link focus styles; answers remain in the HTML without JavaScript.
No deployment, production writes, or Git publication is part of this slice.

## SHE-125 — scenario-first onboarding harness

Slice: homepage consent → equal-probability session assignment → direct demo or
policy inspection choice → identical existing demo URL. Coordinator owns homepage,
new isolated onboarding module and tests; no City/model interfaces change. Existing
workspace `mini/SHE-125` is the isolated issue branch. Open PR search for onboarding,
SHE-125 and scenario-first returned no duplicates on 2026-11-12.

Acceptance: no assignment/storage before opt-in; stable assignment on reload;
exposure recorded before any start/choice click for both arms; withdrawal erases session data;
kill switch restores direct routing; both choices use the same demo recipe.
Risks/limits: local session evidence only, no collection endpoint or population
inference; consent selection limits generalization. Policy choice is an inspection
question, not a change to the modeled intervention. Browser storage failure must
fall back to ordinary demo. Tasks: implement harness; unit and browser verification;
record results below. No deployment or production writes.

Delivered: opt-in harness, session-stable cryptographic allocation, pre-click
exposure deduplication, withdrawal, downloadable local JSON and markup kill switch;
normal demo recipe/URL and all simulation code are unchanged. Documentation:
`world/onboarding-experiment/README.md`. No independent tasks justified delegation.
Verification: `bun test test/onboarding-experiment.test.js test/future-machine-data.test.js`
passes (9 tests), including seed-matched model state equality across variants,
120-month deterministic replay and persisted City API reopen. `git diff --check`
passes. Playwright command above attempted with ports 39884 and 39925; both server
starts failed with EADDRINUSE before browser execution. Browser routing, focus and
layout remain unverified; rerun the focused browser suite on an available host.
No repository lint/typecheck script is defined. No commit/PR or deployment created.

## Consented lightweight player feedback — SHE-52

Scoped slice: optional World disclosure → unchecked consent → structured
confusing-step/favorite-moment submission → private durable aggregate receipt.
Audit found simulation presentation and publishing-draft feedback, but no player
collector. Owned changes are `world/player-feedback.js`, `ops/player-feedback/`,
focused tests, this plan, and the small route/HTML integrations in `server.js`
and `world/index.html`. No other feature or simulation contracts changed.
No independent implementation tasks or agents were needed for this small slice.

Implemented and locally verified: strict versioned allowlist, same-origin POST,
bounded body, private aggregate-only SQLite storage, no public reads, explicit
consent, opt-out, timeout/error/retry without awaiting or pausing gameplay.
Acceptance evidence: 13 focused tests pass (84 assertions), whitespace clean;
existing simulation feedback tests pass. Dependencies install with TMPDIR override.
Browser acceptance remains pending: repository Bun shim fails postinstall check;
absolute-Bun retry cannot bind isolated port (EADDRINUSE). No screenshot or real
Chromium execution claimed. See `ops/player-feedback/README.md` for exact commands,
privacy limits, baseline overlap and operator contract. Branch `mini/SHE-52`;
no commit/PR publication or deployment performed. Next action: run the committed
focused browser test in a working server environment and review visual layout.
Counts represent submissions, may duplicate on uncertain retry, and are not
unique-player estimates. Abuse controls and SHE-248 triage remain outside scope.

## SHE-78 — first-play demo readiness

Delivered bounded read-only `/api/demo/ready` in the existing release health
handler and server route. Acceptance: combine homepage demo assets, versioned
synthetic fixture/generator availability and City/World/Decision dependencies;
return safe fixed checks, 200/503, HEAD/405 and no-store without storage writes.
Preserve existing liveness/readiness. No dependency or model changes.

Verification: 15 focused release-health/runbook tests passed, 87 assertions;
whitespace clean. Healthy, missing fixture, cache expiry, degraded City database,
secret/path redaction and non-modification covered. Server smoke assertion added
but startup blocked by Bun EADDRINUSE on port 0; Playwright skipped for that
setup blocker. Full contract, reproducible commands, audit and limitations:
[evidence](evidence/she-78-demo-readiness.md). Next: run real-server smoke in a
listen-enabled environment and publish through the trusted review workflow.
No production changes, commit or PR in this source-only turn.

## SHE-80 — explicit Plan simulation lifecycle

Next integrated slice: extend the existing `/api/world/experiments` authority and
`/world/plan` entry point with observed queued, starting, running, completed,
failed, canceled and retrying lifecycle records. Preserve legacy done/error status
for existing Constitution consumers. Add cooperative cancellation and explicit
retry of failed/canceled jobs using identical pinned inputs; no automatic retry.
Acceptance: backend transition/cancellation race tests, UI status/control tests,
and a reproducible lifecycle receipt. Risks: in-memory jobs reset on restart;
cancellation can only stop CPU work at existing paired-run yield boundaries.

Delivered locally: additive backend lifecycle/event/attempt fields preserve the
legacy status contract; Plan status, cancel/retry and transport refresh controls
use backend snapshots. No unrelated runner interfaces changed. Contract and
reproduction commands: [run-lifecycle.md](run-lifecycle.md); observed controlled
receipt: [she80-lifecycle.json](evidence/she80-lifecycle.json).
Verification: 20 tests / 96 assertions pass across lifecycle UI/backend, experiment
API (including real tiny-town runner), civic API integration and run manager.
JavaScript syntax and whitespace checks pass. Focused Playwright test added but
not executed: server startup returned EADDRINUSE on both 3100 and alternate 3380.
Browser behavior remains unverified until that startup blocker is resolved.
No package lint/type-check commands exist. No commit, PR, merge or deployment
performed; this source increment is ready for review with that browser limit.

## SHE-102 — Local scenario exploration badges

Slice: Decision Studio's existing completed housing results feed an optional
inspection panel. Explicit inspection recognizes four distinct supported policy
levers changed against the saved baseline, plus matched-seed cost/affordability
inspection. Prerequisites: completed non-preview experiment, matching supported
model version, finite metrics and a baseline/alternative seed pair. Repeated
inspection, renamed scenarios and reloads cannot double-award a badge.

Browser storage contains only a version and allowlisted badge IDs: no identity,
scenario text, timestamps, scores, streaks, or server writes. Clearing is explicit;
storage failure falls back to visit-only recognition. Risks: browser storage can
be cleared or edited and is not authoritative; concurrent tabs may overwrite
recognition. Recognition describes inspection, not causal evidence or policy
quality. This isolated issue checkout owns the new badge module/tests and small
Studio integration only. No shared simulation contracts change.

Implemented: `world/decision/exploration-badges.js`, Studio result/reset hooks,
unit tests and a browser journey through example → run → inspect → reload → clear.
Verification: `bun test test/exploration-badges.test.js
test/decision-visualizations.test.js test/decision-integration.test.js` passed
21 tests / 536 assertions. Browser journey remains unrun: checkout has no
`node_modules/.bin/playwright` or installed `@playwright/test`. No lint/typecheck
scripts are defined. GitHub open-PR audit via `gh pr list` failed to connect to
api.github.com; local branch inventory and full Linear issue were inspected.
No existing badge implementation found. Remote overlap review and browser smoke
are remaining gates; no commit, publication, merge or deployment performed.

## Per-route startup smoke — SHE-109

Implemented a bounded local Playwright slice via `bun run test:startup`:
flagship home, pinned synthetic World, idle Future Machine, Saved Future Journey,
Simulation Health and Route directory. Each route independently reports HTTP
status, visible key DOM nodes, uncaught startup errors and disabled controls in
an attached `startup-report` JSON record. Home checks advertised target links;
World must reach its actual startup-ready marker, Future Machine must enable
Fork City while its unrun timeline remains disabled, Journey must enable its
demo action, and Health must finish with available/ready responses. No action
creates a simulation or saved demo. Temporary storage and a dedicated server
isolate the check from existing local data. Existing production release smoke
and deeper model journeys remain separate gates.

Verification: six tests discovered by `bunx playwright test --config
test/startup-smoke.config.js --list`; diff whitespace check passed. Browser run
blocked before tests: Bun server listen returned EADDRINUSE at both 39961 and
41109 in the restricted workspace. No browser pass claimed. Next gate: run
`HBL_STARTUP_SMOKE_PORT=<free-port> bun run test:startup` on a host that permits
local listeners and inspect `test-results/startup-smoke-results.json` and the
per-test attachments. No configured repository-wide lint/typecheck script.
See [startup smoke usage](startup-smoke.md) for scope and reporting limitations.

## SHE-114 — bounded server run queue counters

Audit: current runner had no queue admission bound or operational counters;
GitHub PR search for SHE-114 returned no matching PR. Existing simulation/cache
and server API interfaces are reused. Scope is one integrated manager/API/test
slice; no additional workers, deployment or production data changes.

Acceptance: FIFO queue with trusted finite limits; saturation returns 429 with
retry advice; anonymous process-local counters reconcile success, failure,
duplicates and rejections. Preserve seed/result contracts and test recovery after
failure, observer exceptions, zero waiting capacity and normal server routing.
Material limits: historical job/cache retention and execution timeouts remain
outside this slice. Counter meanings and lifetime: [run queue contract](run-queue.md).

Delivered in `world/run-job-manager.js` and `world/server-civic-api.js`, with
focused manager and API regression coverage. Actual verification: targeted manager,
API and persistence checks pass (10 tests). Broader production-server smoke test
failed before HTTP assertions; direct startup with PORT=0 reproduces Bun listen
EADDRINUSE in this environment. No browser behavior changed; Playwright skipped.
No package lint/typecheck commands exist. Whitespace check passed. No commit or
PR publication performed in this source-only workspace.

## SHE-96 — neighborhood metric evidence

Next integrated slice: monthly World Time Machine district heatmap. Preserve
numeric zero, exclude absent/invalid samples (including occupancy status), and
show each value's synthetic model basis, confidence limits, source and coverage
in a keyboard-accessible tooltip. Reuse stored CityState provenance; do not infer
empirical verification from OSM geometry or invent confidence percentages.
Acceptance: targeted aggregation regressions and browser rendering check.
Scope excludes the separate Population and Decision Studio clocks/models.

Delivered: per-district disclosure with checkpoint dataset/revision/month,
available/eligible coverage, synthetic assumptions and empirical confidence
limitations; native expandable labels support keyboard/touch as well as title
tooltips. Unknown/absent occupancy status is excluded instead of counting as zero;
absent inventories remain missing. Existing numeric/bin contract is unchanged.
Verification: `bun test test/time-machine-heatmap.test.js test/world-causal-adapter.test.js`
passed 9 tests, 272 assertions; `git diff --check` passed. Added disclosure assertions
to the existing Time Machine browser journey, but did not run it: local
`node_modules/@playwright/test` is absent. Browser layout/interaction remains
unverified. No empirical confidence score or verified-data label is invented for
this synthetic monthly model. Other neighborhood surfaces remain separate scope.

## SHE-150 — transparent Population rule audit

Owned slice in existing isolated `mini/SHE-150` workspace: new read-only
`world/population/invariants.js`, audit CLI, focused tests, evidence and model
validation note. No production rule or shared interface changes. Baseline
`b963dd353538294cb0fbf5d34d5283fad6e10e68` was clean. Repository/model-card audit
found synthetic assumptions, full authoritative typed state, bounded render samples,
and existing target checks that do not constitute empirical validation.

Prerequisites: SHE-141 metric contract is present. SHE-142 is Done with PR #50
in Linear, but its scalar source is absent in this checkout. GitHub search for
SHE-150 returned no matching implementation (one unrelated PR #41 result).
Do not infer scalar/Population equivalence or import another owner's work.
No parallel implementation needed for this bounded slice.

Acceptance: independently count full-state membership, population and represented
weight; check labor/housing capacities, needs/resources, service-score bounds,
travel stock/flow balance, choice feasibility and retained event ordering. Mutation
tests must reject broken rules. Compare seeded repeated runs and report normalized
histogram drift through the normal create/step entry points. Run bounded
three-day, two-seed configuration sweep; record actual machine/runtime, versions,
inputs, hashes, failures and elapsed time. Empirical plausibility, long-run stability,
service demand conservation and cross-backend validation remain unavailable.

Risks: Population/City/Decision clocks and IDs differ; service score has no demand
ledger; retained traces omit older evidence; generation target tolerances are
engineering assumptions. Distribution drift is descriptive, with no invented
empirical threshold. Replaying fixed inputs verifies determinism only.

Delivered/verified: read-only auditor and executable configuration sweep, model-card
link and `docs/population-rule-validation.md`. Eight 1,000-record runs (two seeds,
four configurations, 144 half-hour commits each) pass, with recorded synthetic
30-building geography and real travel exposure. Repeat execution matched all
reports and final-state hashes. Measured sweep 19.449s; raw metadata/results in
`docs/evidence/she-150-population-rules.json`. Transit removal trip-mode TV distance
0.116103/0.117005; interpret as synthetic response only. Auditor correctly accepts
explicit null/zero-mass no-feasible-route traces; regression added.

Final five-file suite:46pass/0fail/1180assertions in13.12s using `bun test --timeout
15000` and the files listed in the validation note. Earlier default-limit run had
45pass/1existing eight-day test timeout (5.989s); unchanged assertions then passed
in5.649s under the explicit timeout. CLI population0 exits1; JSON exposure check
and `git diff --check` pass. No root lint/type script exists. No browser-facing
changes; Playwright skipped. No commit/PR created by this source-only slice.

Remaining issue scope: empirical plausibility/calibration requires identified
observational data and matched units/windows; service flow conservation needs an
actual demand/capacity ledger; scalar/backend validation requires SHE-142 source
integration and explicit mappings. Three days/two seeds does not establish
long-run or city-scale stability. These limits are not marked verified.

## SHE-154 — Citywide current-position density

Scope: independent CPU/Canvas2D slice in Population density modules, snapshot
adapter, Living City overview, dedicated tests and data-format documentation.
SHE-141 is Done with metric contract PR34; weighted mass is distinct from
independently updated resident records. No changes to its owned metric files.
Existing district shading measures home population, so retain and label it;
add a current-position tile map under overview → Layer → Population density.

Acceptance: full resident-state aggregation at the snapshot tick, 32×32 bounded
array, explicit and weighted legends, reconciled missing/outside categories,
seed-matched replay independent of visible sample, Canvas2D rendering and reset.
Worker-side typed integer bins avoid transferring or rendering all residents.
No GPU compute claim, observed demographic claim or million-agent benchmark.
Risks: O(residents + locations) per snapshot; no million-scale timing measured.
Weights are uniform model cohort weights, and current mass is not home density.
The Canvas2D map needs no GPU; enclosing Living City retains its existing WebGPU
requirement. No Canvas2D context disables the map with an explicit notice.

Delivered implementation and deterministic tests; verification results below.
Browser before/after capture is provided by population-density.e2e.js but blocked
locally: server bind rejected and Chromium failed MachPortRendezvous bootstrap
with Permission denied (1100). No screenshots or browser success claimed.

Actual verification: `bun test --timeout 15000 test/population-density.test.js
test/population-model.test.js test/population-visible-sample.test.js
test/population-world-view.test.js test/world-runtime.test.js`: 46 passed,
0 failed, 429 assertions. First combined run hit the existing weekend model
test's default 5s timeout; rerun passed with 15s limit, no weakened assertions.
`git diff --check` passed. No package lint/typecheck scripts are defined.
Browser smoke and before/after recordings remain the next verification step on
a host that permits Chromium; the feature is not claimed visually verified.
No merge, publication, deployment or production data changes performed.

## Safe WebGPU negotiation — SHE-168 (review candidate)

Owned slice: storm paired solver (`world/storm/`) and focused tests. The clean
`mini/SHE-168` workspace has no prior edits; issue/PR audit found no matching PR.
Planning dependency SHE-141 is Done. Architecture document is absent. Existing
CI uses Bun unit tests and Chromium journeys; storm coverage is in the civilization
browser suite. No shared interfaces or independent implementation tasks require delegation.

Acceptance: inspect adapter and device storage binding, allocation, binding count,
workgroup and dispatch limits before creating resources; request no raised limits.
Fallback from GPU to a bounded worker to the existing CPU reference, with visible
reasons and unchanged recipe/model/frames. Terminate failed/timed-out workers.
Exercise missing GPU, low limits, successful GPU selection and worker failures;
verify existing Canvas2D visualization fallback. Risk: software/headless adapters
cannot establish physical hardware performance or cross-device numerical parity.

Delivered: adapter and per-run device limit checks before resource allocation,
no raised requiredLimits, paired backend selection and visible reasons, worker
startup/error/message/timeout cleanup, bounded CPU reference recovery. Existing
Canvas2D scene fallback remains the visualization path. This slice covers the
storm compute entry point, not all Three.js renderers or million-agent execution.
CI now includes the focused contracts and visible fallback journeys.

Actual verification (2026-11-12, Darwin arm64, Bun 1.4.2): 19 tests passed,
700 assertions across six storm suites. Synthetic unit inputs use 3×3 grids,
4 steps and rainfall 0.125/0.1; limit-boundary fixture uses 128×128, 240 steps.
Solver has no random draws; seeded scenario regressions retain their recipes.
Adapter tests inject limits, including 1-byte storage/allocation limits, and
prove zero unsupported device requests; no physical GPU measurements claimed.
Default browser scenario is the existing versioned synthetic storm recipe.

Browser verification remains pending: the original config under Node fails on
import.meta; Bun loads it but server startup reports EADDRINUSE on 54388.
The focused .mjs config also reports EADDRINUSE on 54468 before Chromium launch.
No browser/device/Canvas2D result was observed in this sandbox. Added missing-GPU,
low-storage and failed-worker journeys check status, unchanged flood outcomes,
Canvas2D visibility and replay controls. Run `TMPDIR=/private/tmp bun --bun x
playwright test --config test/webgpu-limits.browser.config.mjs` in a host that can
bind a test server. No repository lint/type-check script exists. Review candidate;
no commit, publication, merge or deployment performed. Physical-device GPU parity
and performance remain unmeasured. Next action: run the focused browser gate.

## SHE-90 — selected-month entity causal trail

Audit: existing construction handoff records real inputs and transitions; other
inventory selections open cumulative history without a selected-month trail.
No SHE-90 PR was returned by the connected GitHub search. Work is isolated on
`mini/SHE-90`. Reuse the existing run event store and construction mapping.

Slice: list every recorded event explicitly attached to the selected entity at
the selected month, plus the established construction transition mapping. Link
each actual event ID into the existing inspector. Show run/model/seed and an
explicit missing-evidence state. Same-month membership is not a causal edge;
only the inspector's stored dependencies establish recorded model contributions.
Acceptance: verify run/month/entity isolation, multiple transitions, missing
records, and a browser selection/reload against the real recorded fixture.
Status: implementation and verification in progress. No schema or API changes.

Implemented: `world/causal/history.js` scopes event membership to the exact
run/world/month/entity; `page.js` renders linked event IDs and explicit missing
coverage alongside the shared inspector. Construction retains its model-owned
mapping. README documents the limits. Added real-model regression coverage and
browser assertions for employment selection, API event identity, reload and
missing evidence.

Verification: 10/10 Bun tests passed (304 assertions) with
`bun test test/entity-event-trail.test.js test/world-causal-adapter.test.js test/time-machine-checkpoints.test.js test/causality-read.test.js`.
`git diff --check` passed. Browser execution remains unverified: both the standard
Time Machine config (39876) and a temporary isolated-port config (39927) failed
at server startup with `EADDRINUSE`. Temporary config removed. No lint/typecheck
scripts are defined. Next action: run the updated World Time Machine browser
suite on a host that can bind the configured port, then review/publish this
branch. No merge, deployment, production data update or issue-state change.

## SHE-164 — recorded dependency pulses

Independent slice owns `world/causality/pulses.js`, the existing inspector graph,
focused pulse tests and inspector browser tests. Prerequisite: existing stored
causal explanation API and monthly City entity selection. Acceptance: animate
only resolved same-run chronological event dependencies with all cited evidence
returned; retain event/entity IDs, deterministic selection and a cap of eight
simultaneous pulses. Associations remain static and labeled. Animation ends
after three cycles and reduced-motion uses static connectors. No simulation
state or random streams change. This slice uses the normal city-to-inspector
entry point; spatial map overlays and arbitrary cross-model identities remain
unsupported. CSS/DOM is the low-capability path; no WebGL or Canvas is required.

Implemented selection and rendering. Focused plus causal API integration checks:
6 tests passed, 41 assertions, including actual stored scenario explanation.
Browser verification status is recorded below. Risks: a bounded explanation may
omit upstream records; existing evidence coverage warnings remain authoritative.
The eight-pulse cap applies within the existing 24-node/32-edge graph preview.

Browser run blocked before tests: fixture server failed to bind with EADDRINUSE
on both 39871 and isolated 39879. Browser assertions are added but unverified;
no before/after recording was captured. Repeat the inspector Playwright suite
in an environment allowing the fixture server before marking review complete.

## SHE-105 — WebGPU adapter rejection

Bounded World startup slice: retain the actual adapter initialization error,
let the existing host choose WebGL2 then Canvas2D, and show the downgrade reason
in the persistent source notice. Native startup disables Three's implicit
fallback so the original rejection reaches the host. Partial initialization
cleanup releases the backend without Three r186's dispose-triggered init retry;
cleanup failures cannot suppress the original rejection. Model inputs, seed,
geometry and simulation authority are unchanged. No matching SHE-105 PR was
returned by the connected GitHub search (2026-11-12).

Acceptance tests added to `test/e2e/city-renderer.e2e.js` reject requestAdapter
and exercise both WebGL2 and Canvas2D through the normal World route. They
require visible canvas, model readiness, generated geometry, playback facts,
backend and rejection reason, with no page errors. Browser execution remains
unverified: the existing renderer config failed to bind port 3198 and an isolated
33105 retry also returned EADDRINUSE before tests ran. Temporary config removed.
Actual focused unit verification: `bun test test/world-canvas-renderer.test.js
test/future-machine-backend.test.js` — 11 passed, 1 opt-in browser test skipped.
Next action: run the two adapter-rejection Playwright cases where local server
startup is available. No deployment, production mutation or publication.

## Batch 3 operations/server integration — November 12, 2026

Integrated PRs #204, #213, #216, #219, #234 and #236 with original ancestry on
`integrate/b3-ops` (source merge head `d8e1c30`). All earlier handlers and the
production 6-per-client/60-process submission budget remain intact. Existing
explicit test-only browser budgets remain 120/600. The new startup-only suite
creates no simulation and retains its own isolated stores.

Lifecycle integration keeps one preparing/running paired attempt and eight
waiting. Retries reserve that capacity after the old attempt settles; canceled
attempts release it exactly once and remain retained while draining. Civic queue
observability retains two running/eight waiting and eight adapter calls per job,
including failed-sibling settlement, idempotence, FIFO order and the existing
429 budget response. Terminal counters also handle non-Error rejections without
misclassifying a failed run. Decision Studio keeps stale-request guards, parameter
differences and explicit local exploration badges together. Its controlled race
harness now spies on the inherited parameter-diff callback and verifies the new
draft reached it; no race assertion was removed.

Reconciled already integrated PRs #198/#215 with the current City 1.1 engine.
All six original City 1.0 JSON files, including the canonical receipt hash
manifest, are retained byte-for-byte under explicitly versioned historical
folders. Active golden frames and canonical examples were independently
regenerated from the real current engine/normalizer/exporter on Bun 1.4.4.
Strict current-model validation and version-update requirements are unchanged;
historical receipt rejection and archive byte hashes have regression coverage.
The CLI version guard now permits a bounded 16 MiB Git read because its actual
2–3 MiB fixtures exceeded the child-process default 1 MiB buffer. All three
version guards passed against the pre-integration City 1.0 fixture revision.

Verification: lifecycle/API 17 tests/104 assertions passed; queue/API/store 14
tests/75 assertions passed; final feedback, readiness, admission (including real
HTTP burst), Decision race/badge/parameter, fixture and production-server route
suite 66 tests/523 assertions passed, zero failures. Each of the three complete
121-month CLI golden comparisons passed; both canonical examples passed strict
validation and exact regeneration. All six historical JSON files match their
original PR Git blobs. Startup Playwright configuration discovers six routes;
Chromium was not relaunched because the known socket EPERM blocks this runtime.
No browser execution or hosted CI pass is claimed. The replay workflow retains
its Bun 1.4.2 pin, which has not been executed here. Whitespace checks pass.
No model equations, production data, remote branches or deployment were changed
by this local integration. Root owns final cross-group verification and merge.

## Batch-three Population, storm and causal integration — 2026-11-12

Integrated the exact snapshot heads for PRs #193, #196, #197, #203, #207, #208,
#227 and #230 through merge commits on `integrate/b3-scene`, starting from
`7bcc83e7565da6ddd975be54ca6ff135b9b0c497`. All eight heads are ancestors of the
stable source commit `82ef2c14813289c274246f0b2aa07170c4a52606`.

Resolution decisions: preserve Population allocation/recovery, measured
neighborhood activity and LOD identity/counts while adding full-state density.
The map says **Explicit residents**, because it counts all resident records;
neighborhood `activeAgents` instead measures changed residents in its declared
step window. Count-per-tile and represented-weight units remain distinct.
Retain saved investigation selection, removal/missing states and playback
pause when opening an entity event trail. Event-only selections do not claim
an entity's evidence is absent. Retain Ripple's bounded downstream chains and
evidence gaps beside dependency pulses; the new upstream attribution notices
apply to **Why**, since a Ripple response does not request upstream attribution.
Keep hazard-field rendering, exact storm recipes and readiness/retry controls
with paired GPU/worker/CPU execution. Keep the existing core CI jobs and browser
engines, adding the incoming storm checks. Renderer notices retain actual
backend identity, the adapter rejection reason and inherited startup repairs.

Model-description review compared `docs/models/population.md` and
`world/population/DATA_FORMATS.md`/`MODEL_CARD.md` with density, invariants,
neighborhood selection, model snapshots and world-view code. The ODD now states
the density domain, missingness, weight and count units explicitly. The auditor
and display are read-only diagnostics; resident behavior, RNG and scheduling
remain unchanged. `docs/models/city.md`, the causal adapter/history contracts
and both causal READMEs remain accurate: these views read stored monthly City
records without inventing Population identities or empirical causal evidence.
Storm execution changes hardware selection, not the bounded physics inputs.

Local verification used Linux and Bun 1.4.4, with `bun test --timeout 60000`:

- Population: `test/population-density.test.js`,
  `test/neighborhood-selection.test.js`, `test/population-render-lod.test.js`,
  `test/population-world-view.test.js`, `test/population-zoom.test.js`,
  `test/population-memory-pressure.test.js`, `test/population-invariants.test.js`:
  **34 passed, 0 failed, 802 assertions**.
- Storm: `test/storm-execution.test.js`, `test/storm-physics.test.js`,
  `test/storm-scenario.test.js`, `test/storm-impacts.test.js`,
  `test/storm-recovery.test.js`, `test/storm-treaty.test.js`:
  **19 passed, 0 failed, 700 assertions**.
- Causal/render integration: `test/time-machine-heatmap.test.js`,
  `test/entity-event-trail.test.js`, `test/causal-pulses.test.js`,
  `test/causality-messaging.test.js`, `test/investigation-selection.test.js`,
  `test/ripple-inspector.test.js`, `test/world-causal-adapter.test.js`,
  `test/time-machine-checkpoints.test.js`, `test/causality-read.test.js`,
  `test/world-canvas-renderer.test.js`, `test/future-machine-backend.test.js`,
  `test/hazard-field.test.js`: **40 passed, 1 opt-in browser skip, 0 failed,
  456 assertions**.

Total: **93 passed, 1 skipped, 0 failed, 1,958 assertions across 25 files**.
Five browser entrypoints (`world/render.js`, storm/page, causal/page,
causality/inspector and population/world-view) bundled successfully: 377 modules.
The two absolute browser routes `/tools/paired-comparison.js` and
`/vendor/three/three.module.js` were explicit externals for this bundling check.
Six changed browser test/config files parsed successfully, and
`git diff --check` passed. This is compilation evidence, not browser execution.
Actual browser/hardware acceptance remains unverified because Chromium launch
is already known to fail with socket `EPERM` in this environment; no launch was
repeated and no screenshots or physical-GPU results are claimed. The previously
baseline-confirmed long worker-checkpoint failure was not rerun; the neighborhood
worker checkpoint restore regression passed in the focused Population suite.

## Future Machine bulk integration — November 12, 2026, third batch

Integration slice: merge original PR heads #201, #206, #217, #220, #221, #222,
#223, #224, #232, #233, #237, #238 and #239 on `integrate/b3-ui` from
`7bcc83e`, preserving their ancestry and all completed first-play behavior.
The coordinator, scene and controls share one owner because camera shots,
bookmarks, reset, permalink context and selected-month actions share state.

Acceptance: retain asynchronous request ownership, explicit demo versus local
continuation precedence, strict receipt/challenge replay, deferred first-play
telemetry, quiet playback with explicit announcements, exact evidence anchors,
retained rendering and reduced motion. Add the quest, keyboard navigation,
camera controls, quality setting, provenance, narration, diagnostics, integrity
checks and comparison preview through the normal entry points. Keep model-owned
City validation and saved outcome checks when integrating #233. Regenerate the
current WHY coverage after final story/data changes without changing archived
City 1.0 evidence.

Verification will use focused Bun module/coordinator regressions, normal browser
module bundles, parser checks and ancestry checks. Chromium execution remains
blocked by the previously verified socket EPERM restriction; no new browser
execution or screenshot result will be claimed. Parent owns remote publication
and the final cross-branch acceptance gate.

## SHE-100 — optional first-divergence quest

Implemented a compact Future Machine quest through the existing Fork City,
monthly timeline and exact-entity inspector. Steps require an explicitly requested
successful paired run, a manual visit to the first available recorded entity
difference, and inspection of that same entity at that month. Demo playback and
shared-link loading do not award progress. New completed runs reset progress;
unchanged controls disclose no divergence. Native buttons provide keyboard
operation and an optional hide/show control. Progress is session-local.

Dependencies: existing validated monthly City histories, stable-ID compareHistory
and evidence inspector. No new simulation authority, clock, seed, identity mapping
or persistence contract. The target is the earliest available entity difference,
which can precede physical construction; it is not a causal or welfare ranking.
No parallel implementation tasks justified delegation. This issue workspace owns
only the quest module, coordinator wiring, styles, tests and this plan entry.

Acceptance evidence: 28 focused unit/regression tests passed, 167 assertions;
one existing opt-in Chromium component test skipped. Added a real-entry-point
Playwright quest test covering keyboard completion, recorded target identity,
hide/show and 390px overflow. Its execution is blocked locally: both default
port 3100 and alternate 3198 server launches returned EADDRINUSE before any test
ran. Browser behavior therefore remains unverified. No lint/typecheck script is
configured. Git diff whitespace check passed. Read-only GitHub searches returned
no SHE-100 PR or matching branch; Linear supplied no attachment. No issue status,
approval label, production state, merge or deployment was changed. Next action:
run the committed browser test where the app server can bind, then review/publish.

## SHE-157 cross-scale divergence shot

Next slice: reuse the first renderable recorded building divergence and six-second
hold; frame its schematic neighborhood, then the exact building, with one shared
camera. Add an optional automatic camera control; reduced motion uses immediate
framing. Preserve City month/entity and event receipts, and never add effects for
unchanged state. Canvas2D receives the same framing stages. Neighborhood means a
schematic wider view, not a claimed geographic boundary. Verify deterministic
clock phases, zero-change behavior, scene/UI regressions, and browser availability.
Owned integration files: demo-controller, main, scene focus, UI and focused tests.

Implemented: city overview → wider schematic context → exact building close-up
on the held first physical divergence; receipts use the same month/entity. Demo
camera reset and shots are optional, active transitions cancel on opt-out, native
reduced motion remains immediate, and Canvas has matching shared framing.
Reused tested firstPhysicalStop rather than the coordinator's duplicate selector.
Delayed ticks cannot frame a different month. No simulation or shader changes.

Acceptance evidence: six focused Bun files: 43 pass, 1 browser-gated skip,
223 assertions; browser entry bundle succeeds (25 modules); diff whitespace clean.
Real deterministic City fixture still selects Month 16, exact building
building-project-policy-1-0, +24 homes. Playwright attempted with recording enabled
on ports 39931 and 41757; both isolated servers failed at listen with EADDRINUSE.
Consequently new before/after recordings and graphical normal/reduced-motion
verification remain pending; no visual completion claim. Next: run focused guided
controls and cinematic hold browser cases on a host permitting the local server,
review framing and capture before/after evidence. No merge or deployment.

## SHE-95 controlled year shortcuts

Slice: canvas-focused Page Up / Page Down moves the shared selection by 12
months, clamped to 0–120; D selects the earliest available diff with recorded
entity changes, including nonphysical policy changes. Reuse manualMonth so
playback/director stop and both views, evidence and URL remain synchronized.
Dependencies: existing paired history/diff and focusable scene canvases.
Acceptance: ignore text controls, modifiers, composition and loading; preserve
camera arrows; document keys visibly; handle a zero-difference run explicitly.
Risk: first divergence differs from the demo's first physical building change;
the visible help explicitly explains this distinction. Implemented with delegated
canvas handling and cleanup across stage replacement/disposal; WebGL canvas is
now keyboard-focusable and both renderers expose aria-keyshortcuts.
Verification: 21 passed, 1 browser-gated skip, 317 assertions via Bun on
year-shortcuts, UI, scrub-identity and diff tests; git diff --check passed.
Added integrated Chromium coverage for focused navigation, URL synchronization,
input editing and unchanged-control feedback. Its execution is unverified:
server startup failed EADDRINUSE on both 39884 and isolated retry 39995.
No lint/typecheck scripts are defined. No publication or deployment performed.

## SHE-107 — discoverable mobile rendering quality

Slice: expose Standard / Power saving directly above the homepage comparison scene, using the existing scene authority. Lower backing resolution only (DPR cap 0.75 versus Standard’s existing 1.5 GPU / 2 Canvas), across native GPU and Canvas fallback. No model, recipe, history, clock or receipt changes. Session-local choice is reversible; no persistence or automatic battery detection.

Prerequisites/audit: isolated `mini/SHE-107` checkout; existing World quality manager is debug-only, comparison had no preset. GitHub PR search for power returned no duplicates. Owned files: scene host/Canvas adapter, focused existing browser suite, interface documentation and this plan. Single integrated slice does not justify parallel implementation. Risk: lower scene text sharpness; surrounding DOM controls and evidence remain full resolution. Acceptance: visible native selector at 320px, reduced backing width, exact history/report/metrics/camera equality through both switch directions. Verification pending below.

Verification: `bun test test/future-machine-canvas.test.js test/future-machine-scene.test.js test/future-machine-backend.test.js test/future-machine-share.test.js` passed 34 tests / 225 assertions, with one existing opt-in Chromium skip. Resolution regression verifies backing dimensions, exact projection/diff inputs, camera, inventory, reversal, invalid values and disposal. `git diff --check` passed. Integrated mobile test added to `two-futures-compatibility.e2e.js` compares complete history, evidence report, visible metrics, camera and inventory across both directions; execution blocked before browser launch by server `EADDRINUSE` on ports 39931 and 41077. Browser layout, integrated receipt equality and native GPU switching remain unverified. Reproduce with `HBL_TWO_FUTURES_PORT=41077 bun /Users/wahabma/happybearlandia/node_modules/@playwright/test/cli.js test --config test/two-futures-sprint.browser.config.js --grep 'mobile power saving'` on a host with local server binding available. No deployment or production changes.

## SHE-88 — restore original experiment configuration

Next slice: add one-click reset in the Future Machine's existing pending seed/
policy controls. Original means the recipe at page entry (the shared recipe when
present, otherwise DEFAULT_RECIPE), retained across subsequent forks. Restore all
recipe fields, clear invalid seed input and update controls without running or
replacing the displayed receipt. Fork City explicitly reruns the restored input.
Prerequisites: existing detached pending configuration and immutable saved history.
Acceptance: default/custom/null-policy baselines, repeated edits/runs, invalid input,
busy disablement, unchanged receipt/share/export until explicit run, seed-matched
recomputation. Keep model, persistence and receipt schemas unchanged. One small
coordinator/UI slice; no independent implementation ownership to delegate.

Delivered: reset button, coordinator-owned entry baseline, control/validity restore,
and on-demand rerun; existing history/share/export remain tied to the prior run.
Audit found no existing reset or matching open GitHub issue/PR via repository
search; local issue branch mini/SHE-88 was clean before changes. Documentation
records original as page-entry recipe rather than the latest edited run.
Verification: 23 focused tests passed / 207 assertions, 1 opt-in browser test
skipped; whitespace check passed. Explicit component browser attempt failed at
Bun.serve(port:0), and integrated Playwright attempt failed starting port 39884
(EADDRINUSE). Thus new browser reset regression is added but not executed;
no browser acceptance or captured run artifact is claimed. The browser regression
exports the preserved prior receipt and attaches recipe/result evidence when run.
Remaining: run the focused Playwright reset test in an environment allowing local
server binding; review and host-owned commit/PR publication. No deployment.

## SHE-123 — assistive narration

Slice: Future Machine selected monthly City entity comparison. Reuse exact diff
records and event-linked inspector; no new model or cross-model identity mapping.
Own story narration, coordinator wiring, focused tests and documentation sequentially
in the existing isolated `mini/SHE-123` checkout. No independent work requires delegation.
Acceptance: native user-triggered control announces bounded actual before/after values,
selected month and run provenance; selection/playback never announces automatically;
repeated requests for identical output do not mutate the live region. Missing values,
added/removed inventory and absent comparisons remain explicit. Risks: long structured
fields need bounded summaries; screen-reader speech itself requires manual verification.
Status: implemented in `story/narration.js`, story renderer and `main.js`, with story
README and focused tests. Open PR search for narration/SHE-123 returned no duplicate.
Verification: focused narration/story/diff/UI suites passed 29 tests (175 assertions),
with 2 opt-in browser tests skipped; `git diff --check` passed. Attempting the new
Chromium check failed at Bun local server binding (`EADDRINUSE`, port 0), before
browser launch. Browser integration and actual screen-reader speech remain unverified;
rerun `HBL_FM_BROWSER=1 bun test test/assistive-narration.test.js` on a host permitting
local servers, then check speech manually. No deployment or production writes.

## SHE-94 — synchronized camera bookmark

Slice: add session-local Save view / Restore view to the existing paired scene.
Prerequisites: existing shared Three camera and shared Canvas camera; no model or
shared recipe contract changes. Acceptance: restore target, distance/zoom and
orientation after navigation, scrubbing, resizing and mode changes; empty and
unavailable/disposed stages cannot restore. Stop guided camera movement before
bookmark actions. Keep the bookmark within one stage/run and disclose its lifetime.
Risk: GPU-to-Canvas fallback cannot preserve a 3D orbit; invalidate that bookmark
rather than applying an incompatible pose.

Implemented in `scene/index.js`, with coordinator tour cancellation in `main.js`
and lifecycle/API documentation in `scene/README.md`. No model, server, frozen
interface or recipe changes. Audit: current checkout is isolated `mini/SHE-94`;
no existing bookmark implementation or bookmark commit found locally. Connected
GitHub issue/PR searches for this repository and “bookmark” returned no matches;
branch search for “94” returned only `mini/SHE-194`. Full Linear SHE-94 description
was read; no readiness label, issue status, release or production changes made.

Verification: `bun test test/future-machine-*.test.js` passed 98 tests, 962
assertions, with 3 existing opt-in browser skips and no failures. The new two
stage tests cover real stage/Canvas integration using a DOM adapter, replacement,
no-save/missing-frame/inventory/disposed cases, and new-stage reset. Existing tests
verify shared camera geometry across both Canvas halves. `git diff --check`
passed. No lint/typecheck scripts exist. The two new Canvas/WebGL route tests
are discoverable with Playwright `--list`, but execution failed before tests at
server bind (`EADDRINUSE`) on ports 3100, 3194 and 49194. Native 3D rotation,
responsive layout and real route tour cancellation remain browser-unverified;
next action is to run `test/e2e/future-machine-bookmark.e2e.js` on a host with
working server binding. Bookmark is intentionally session-local, not persisted
or shared. No commit/PR was created in this session.

## SHE-85 provenance badges — bounded comparison slice

Audit (2026-11-12): Linear remains In Review; repository integration audit records
no completed prior SHE-85 implementation. Current Future Machine cards lacked
category/source tooltips despite a run-level seed/version label. This issue branch
owns only Future Machine UI presentation and targeted tests; no model, API or
persistence contract changes. The next independently verifiable slice covers the
three comparative KPI cards and recorded outcome chart. Acceptance: explicit
category/source, synthetic starting-state caveat, no inferred empirical status or
extra numeric precision, explicit unknown metadata, keyboard/mobile access.

Delivered: shared observed/synthetic/modeled presentation helper with unknown
fallback; modeled Monthly City metadata on KPI cards and timeline point titles;
focusable badges expand source details on activation. Values and formatting are
unchanged. Classification follows output origin: a recorded simulation snapshot
is modeled, even when its input generator is synthetic. No observed data is
fabricated. Source states the snapshots and cumulative finance ledger; generator
version and uncalibrated limitation are explicit.

Verification: `bun test test/future-machine-ui.test.js
 test/future-machine-diff.test.js test/future-machine-outcome-timeline.test.js`
passed 20 tests / 142 assertions, 2 browser tests skipped. Explicit browser attempt
`HBL_FM_BROWSER=1 bun test test/future-machine-ui.test.js` failed before Chromium:
Bun.serve({port:0}) returned EADDRINUSE in this sandbox. Browser rendering and
interaction remain unverified. Reproducible result: docs/evidence/she-85-provenance.json.
No lint/type script is configured. Whitespace check passed.

Remaining scope: inventory and integrate other application comparison surfaces
(Decision Studio, World inspectors and narrative comparisons), verify real source
metadata there, and run browser acceptance when local listening is available.
This increment does not satisfy the issue-wide “everywhere” goal; retain review
status. No publication, merge, deployment or production mutation performed.

## SHE-103 — first-play diagnostic report

Next integrated slice: Future Machine (homepage Play Demo destination) boot and
comparison failures expose an optional local diagnostic preview and copy action.
Prerequisites audited: existing retry flow, renderer stats, UI lifecycle and
share contracts; GitHub search found no matching SHE-103/diagnostic PR.
Ownership is limited to the diagnostic module, entry points, focused tests and
documentation. No server collection or persistence is required.
Acceptance: fixed versioned fields for app version, renderer, error category and
random trace ID; exclude all exception text, URLs, stack traces and player inputs.
Require explicit consent before clipboard writes, provide manual copy fallback,
and reproduce a mock failure with fixed trace ID. Verify privacy adversarially
and exercise boot/run entry points in a browser where setup permits.
Risk: trace IDs identify only this local report; they do not imply server tracing.

Implemented: strict bundle builder and consented local preview/copy with manual
fallback; Future Machine boot, comparison and invalid-share entry points.
Release-owned version constant and local-only trace semantics are documented in
`world/future-machine/INTERFACES.md`. Deterministic synthetic artifact:
`test/fixtures/first-play-diagnostic.json` (fixed trace ID; no observed player data).
Verification: 20 unit/regression tests passed, 1 pre-existing browser-placeholder
skip, 0 failures (150 assertions before adding fixture equality); whitespace clean.
Added four Playwright cases for homepage mock failure, boot failure/clipboard
denial, invalid-share privacy and fixed-trace reproducibility/lifecycle.
Browser execution remains unverified: local server startup returned EADDRINUSE
on both canonical port39884 and isolated port39963 before any browser launched.
No lint/type scripts exist in package.json. No PR, deployment or production
mutation was performed. Next verification: rerun
`bun x playwright test --config test/first-play-diagnostics.browser.config.js`
in a host that permits local server startup; review/publish through the normal
host workflow. Report does not cover a failure to download diagnostics.js itself.

## Snapshot integrity — SHE-86

Slice: reject corrupt Future Machine histories before paired rendering. Existing
normalization checked 120 steps/seed/model, but replay responses lacked run
identity and getFrame trusted row position. No completed SHE-86 implementation
or PR was found in the checkout or GitHub search (2026-11-12).

The City replay API now adds an identity envelope (experiment, scenario, run
index and the existing scenario-index run ID). The adapter verifies the envelope
against its request and tags normalized snapshots. Shared integrity guards check
all 121 ordered months, state clocks, seed/model and each snapshot's arm/run
before frame selection, persisted-history diffing and stage construction; stage
updates also validate paired identities. Missing unpersisted diff inputs retain
the existing unavailable semantics. No model equations or persistence changed.
This small additive API change is required because client-assigned response
identity could not detect a wrong server run. Older servers without the envelope
fail closed; deploy frontend/backend together. Identity checks detect routing
and data errors, not authenticated provenance or independently verified replay.

Acceptance: corrupt/missing/reordered frames, swapped arms and wrong experiment,
scenario or run are rejected; valid real persisted pairs reopen deterministically.
Verification results and reproducible evidence recorded after running checks.

Delivered verification (Bun 1.4.2): `bun test test/future-machine*.test.js
 test/server-civic-api.test.js` — 103 passed, 3 existing browser-only skips,
0 failures. `bun test test/future-machine-integrity.test.js
 test/city-systems.test.js test/project-unblock.test.js` — 22 passed, 0 failures.
`git diff --check` passed; no lint/typecheck script is configured in package.json.
Initial runs exposed whole-snapshot equality/hash assertions; fixtures now retain
full model-state equality while accounting for distinct run provenance.

Reproduce the real persisted/reopened run receipt with
`HBL_INTEGRITY_ARTIFACT=/private/tmp/she86-integrity.json bun test
 test/future-machine-integrity.test.js` (single-line command). Recorded output:
[evidence/she86-integrity.json](evidence/she86-integrity.json). Random experiment
IDs vary; recipe, initial digest and arm state digests reproduce. This synthetic
run uses the recipe seed and versioned model manifest; no external observations
or empirical causal claim are included.

Added Playwright wrong-scenario rejection/retry coverage. Browser execution is
blocked by local listen failure: configured port 39884 and isolated retry port
39986 both reported EADDRINUSE; the existing receipt CLI test also fails to bind
port 0 in this sandbox. A broader receipt run had 3 passing tests and that single
socket-setup failure. No browser pass is claimed. Next: trusted reviewer runs
`playwright test --config test/future-machine.browser.config.js --grep
 'wrong scenario replay'` where loopback listening is available, then reviews
frontend/backend coordinated publication. No commit/PR, merge, deployment or
production mutation was performed in this source-only workspace.


## SHE-116 — How this simulation works

Delivered the minimal flagship slice: a native expandable explanation immediately
below the Future Machine header, available before running and during loading or
failure. Ownership is limited to the existing UI, its component browser test and
these interface/status docs; no model or persistence interface changed. Audit of
actual UI/data/share contracts found no panel, and GitHub open-PR search for
SHE-116 / “How this simulation works” returned no matches.

Acceptance: explain synthetic scope, explicit generator assumptions, coarse rules,
metric limitations, matched seeds, versioned recipes and recomputation in plain
language. Source links are pinned to audited base b963dd353538294cb0fbf5d34d5283fad6e10e68.
Native details/summary provides keyboard operation without modal focus handling;
content wraps for small screens. Existing displayed provenance remains authoritative.
No real forecast or independently verified checkpoint claim is introduced.

Verification: UI/model, real SQLite-backed data/replay, share, diff and story
checks passed (38 tests, 282 assertions; one opt-in browser test skipped) via
`bun test test/future-machine-{ui,data,share,diff,story}.test.js`. Whitespace
check passed. Attempted opt-in Chromium component check failed before browser
launch: Bun.serve({port:0}) returned EADDRINUSE under the managed sandbox. Added
Enter/Space disclosure and narrow-screen overflow assertions remain unexecuted.
Browser acceptance therefore remains a follow-up in an environment allowing a
local test listener. No deployment, production data change or issue approval.

## SHE-98 — comparison permalink preview

Next slice: extend the existing Future Machine share codec with optional validated
landing context (view, ghosts, camera); retain old links. Preview the displayed
run's exact recipe, seed, month, saved identity and landing context before an
explicit copy action. Pending next-run edits must not leak into sharing.
Acceptance: codec rejection/boundary tests and a focused browser journey opening
the actual preview URL in a fresh page and comparing restored inputs/month/camera.
Camera representations differ between Canvas and perspective renderers; unsupported
cross-renderer restoration must be disclosed. No deployment or production changes.

Implemented: optional backward-compatible versioned landing codec; paused,
keyboard-focused preview from displayed history; explicit copy with unavailable
clipboard fallback; view/ghosts and compatible camera restoration after graphics
readiness. Shared and coordinator/UI/scene interfaces are documented. Existing
missing-saved-record recomputation and model/identity checks remain intact.

Verification: focused share, scene, UI, Canvas, diff and data/API suites passed
47 tests / 335 assertions (one browser-gated skip); browser bundle passed.
Final share-boundary rerun passed 8 tests / 103 assertions; Playwright test discovery passed. Whitespace check passed.
The dedicated isolated-storage Playwright journey covers pending seed exclusion,
no copy before preview, actual copied URL, clipboard denial and fresh-page input,
month, camera and view restoration. It remains unexecuted: Bun server startup
fails EADDRINUSE on 3198, 43891 and even port 0 in this environment. A temporary
config module-format error was corrected to .mjs before the final startup attempt.
No screenshot or completed browser result is claimed. No lint/typecheck scripts
exist. Next action: run the committed browser config where localhost listening
works, review screenshot and restored context, then publish through the authorized
host workflow. No commit/PR, issue transition, merge or deployment was performed.

## Third-batch Future Machine integration completion — November 12, 2026

All 13 assigned original PR heads (#201, #206, #217, #220, #221, #222, #223,
#224, #232, #233, #237, #238 and #239) are ancestors of `455961e` through
individual no-fast-forward merges. Shared source conflicts were composed; the
append-only implementation entries retain both contributors' sections. The
parent integration owns remote publication and the combined repository gate.

The integrated UI adds the optional exact-entity quest, year shortcuts,
cross-scale shots, quality controls, full local camera bookmarks, page-entry
recipe reset, explicit narration, metric provenance, consented local diagnostics,
strict snapshot identity, model explanation and permalink preview. Existing
copy/native share, receipt import/export, comparison cards, evidence trail,
retained meshes, reduced motion, quiet playback, progressive graphics readiness,
explicit month announcements and strict receipt/challenge recovery remain intact.

Material composition decisions and review fixes:

- Quest progress uses the first recorded entity difference, while the cinematic
  still uses the canonical first physical divergence. Inspect returns to its
  recorded month after later exploration.
- Pause, manual controls and actual camera gestures cancel active camera shots
  and prevent later tour reframing. Programmatic focus and restoration do not
  take over the tour. Pending graphics remain truthfully reported as pending.
- Permalinks serialize the v1 perspective position/target contract; local
  bookmarks retain the additional quaternion and zoom. Deferred shared camera
  restoration yields to intervening user input. Preview freezes displayed-run
  context and preserves direct copy/native sharing alongside explicit preview copy.
- New replay identity is checked across every frame. Canonical receipt v1 hashes
  exclude only the new top-level transport tag after that independent validation,
  preserving prior City 1.1 receipts. The compatibility regression first reproduced
  rejection, then passed actual saved replay and canonical byte equality. Wrong
  identity, changed recorded outcomes and strict saved-receipt mismatch still fail.
- Reset restores the fixed page-entry recipe without recomputation or replacing
  displayed history. Narration is explicit and uses the currently displayed frame;
  loading/retry diagnostics contain only their closed local field contract.
- Existing missingness and finite-delta guards were retained rather than replaced
  by weaker incoming metric availability checks. The chart keeps its single
  retained selected point and existing quiet-frame behavior.

Verification uses Bun 1.4.4. Focused data/integrity/manifest/boundary/diff/scene/
bookmark checks passed 48 tests / 455 assertions. Share/bookmark/Canvas/UI/demo
composition passed 39 tests / 316 assertions with one opt-in browser test skipped.
Receipt plus the existing coordinator checks passed 17 tests / 136 assertions,
including the real disposable SQLite-backed API and CLI receipt roundtrip. The
expanded coordinator then passed 18 tests / 116 assertions, including six added
cross-feature regressions. Final metric UI checks passed 11 tests / 78 assertions
with one opt-in browser test skipped. These groups overlap; they are not a count
of distinct tests.

Current WHY evidence was regenerated after the final story/data source changes.
Only those two source digests changed; all six deterministic run measurements,
model manifests and state/ledger hashes are unchanged. The coverage/story/diff
gate passed 23 tests / 162 assertions. Historical City 1.0.0 evidence remains
unchanged. The browser-target coordinator bundle passed with 50 modules; whitespace
and all 13 original-head ancestry checks passed. Two independent committed-source
reviews cleared camera/readiness behavior and the final receipt/quest fixes.

Browser execution remains unverified in this workspace because the prior actual
Chromium launch was blocked by socket EPERM. No additional launch, screenshot,
visual acceptance result or remote mutation is claimed for this integration.


## Third-batch combined verification — November 12, 2026

The integration contains all 47 original PR heads from #192–#239 except the
previous integration PR #235. The combined Bun gate ran 55 files: 309 passed,
three opt-in browser cases skipped, and one shared-question expectation failed.
That expectation incorrectly included the new transport identity in receipt-v1
outcome hashing. The corrected regression separately asserts the identity and
hashes the recorded simulation fields. The shared-question function also retains
its saved-experiment precondition before full history validation. The complete
challenge file then passed both tests and all 35 assertions, including exact saved
replay, three selected months, tampering and invalid input. The other 54 files
finished the combined gate without failures; the original failing run is retained
in the verification logs rather than relabeled as green.

Offline Python verification passed 83 tests. The homepage/onboarding and Honey
Trail focused checks passed nine tests with 48 assertions. The landing-page check
retained all 47 prior links, added the FAQ link, and retained exactly one primary
Play Demo link. The final browser-target bundle compiled all seven page entrypoints:
Future Machine, Storm, City Lab, Population, Causality, the optional onboarding
experiment and Honey Trail, plus the separately served paired-comparison module.
The server-absolute /tools import is preserved as external and that module was
compiled separately. Playwright discovery found the canonical 18 cases and three
onboarding cases, but discovery does not establish browser execution.

Actual browser execution remains blocked by the previously observed Chromium
socket EPERM in this workspace; no browser pass or screenshot is claimed. The
previously reproduced checkpoint-worker failure also occurs on the unchanged
baseline and is not represented as a new successful checkpoint result. GitHub
publication preserves all original PR heads as parents and uses the verified
working-tree content on the existing sprint target.

## SHE-77 review reconciliation — 2026-11-12

Reviewed checkout `b963dd3` on `mini/SHE-77`; no application changes or worker dispatch were needed for this review. Live GitHub issue #13 is closed with state reason `completed` (closed at 2026-11-12T20:47:49Z), while Linear SHE-77 remains In Review. Treat the original assignment as completed; tracker reconciliation does not authorize release. Historical R13/R14 diagnostics in the coordinator records were not reverified or cleared by this pass.

Fresh verification: `bun test test/future-machine-data.test.js test/future-machine-diff.test.js test/future-machine-story.test.js test/future-machine-share.test.js test/two-futures-evidence.test.js test/two-futures-demo-controller.test.js test/future-machine-scene.test.js test/future-machine-canvas.test.js` passed **52 tests, 0 failures, 332 assertions** across eight files. This includes persisted City API reopen, matched Month 0, deterministic 120-month replay, zero intervention, missing-data behavior, and the seed-42 Month-16 physical addition of 24 homes in one building.

Focused Playwright command: `bunx --no-install playwright test --config test/two-futures-sprint.browser.config.js --grep 'real paired runs'`. Both the default port 39931 and retry with `HBL_TWO_FUTURES_PORT=41777` failed before browser execution because Bun could not bind the server (`EADDRINUSE`). No fresh screenshot, recording, or browser acceptance is claimed. Retry in an environment permitting the isolated test server before relying on current browser acceptance. Prior artifacts remain historical evidence. No main merge, deployment, production data change, or remote tracker mutation was performed.

## SHE-108 — worker and GPU failure boundaries

Scoped slice: shared WebGPU demo device-loss recovery, owned by
`tools/webgpu-demo-runtime.js`, its focused test, and the boundary inventory.
Prerequisites: existing issue branch `mini/SHE-108` was clean; inspected worker,
City and demo renderer paths and existing tests. GitHub PR search for SHE-108,
failure boundaries and the runtime returned only unrelated PR #32; no verified
duplicate. No shared protocol or simulation changes are needed.
Acceptance: device loss stops rendering, attempts every resource cleanup despite
individual failures, and displays an actionable alert without a rejected loss
handler. Test normal loss, cleanup exceptions, rejected loss notification and
late loss after disposal through the normal exported runtime entry point.
Risk: synthetic device/DOM fault injection does not certify physical GPU recovery.

SHE-108 delivered: [boundary inventory and reproduction](compute-failure-boundaries.md).
Shared demo cleanup now attempts remaining resources after individual failures;
resolved/rejected device loss produces an actionable alert, while disposed pages
ignore late loss. Focused integration and existing worker/GPU regressions passed
29/29 (180 assertions) on Bun 1.4.2; no unhandled rejection. No lint/type scripts
exist. Browser-facing verification uses focused runtime integration, not
Playwright or physical GPU testing. Remaining geometry deadlines/post bookkeeping,
City messageerror and host presentation audits are explicitly documented.

## SHE-122 — small-screen flagship regression pack

Next slice: exercise the homepage-linked One City, Two Futures at 320×640,
390×844 and 768×1024 with touch enabled and reduced motion. Own the focused
browser config, regression spec, visual baselines and pack documentation; reuse
existing UI and simulation interfaces. No independent implementation dependencies
justify delegation. This issue checkout is already isolated on `mini/SHE-122`.

Acceptance: real seed-42 paired run, screenshot comparisons for configuration,
timeline, recorded-change inspector and sharing; viewport bounds, minimum touch
targets and browser hit testing for enabled controls, plus a working replay link.
The flagship has inline configuration and share output, not overlay dialogs;
test its actual entry points without inventing UI. Use the supported Canvas
renderer for stable pixels, retain model/run provenance separately, and mask only
volatile run identifiers/URL text. Native GPU pixels remain outside this pack.
Prerequisites: installed Bun dependencies and Playwright Chromium. Open-PR audit
was attempted with `gh pr list` but GitHub network access failed. Baseline review
and focused execution are required before claiming acceptance.

Implemented the focused three-viewport pack and reproducible operator instructions
in `test/e2e/SMALL-SCREEN-GAME.md`. Validation: Node syntax checks pass for both
new JavaScript files; Playwright discovery finds all 3 journeys; existing UI unit
suite passes 6 tests / 41 assertions with 1 browser-gated skip. Browser baseline
generation was attempted twice but Bun server startup reported EADDRINUSE on
39931 and 39978. No screenshots/baselines were generated and no visual or
zero-blocked-controls acceptance is claimed. Next action: run baseline generation
on a host permitting server startup, review twelve images, then rerun without
`--update-snapshots`. Publication/PR audit remains blocked by GitHub connectivity.

## District policy resource allocation — SHE-131

Delivered a bounded completion of the existing World “Challenge a friend” panel,
not a second simulation or the illustrative six-mission arithmetic sandbox.
Scope owned here: `world/challenges/panel.js`, its stylesheet, focused challenge
UI tests and the new district allocation browser test. Existing frozen challenge
contracts, City equations and mapped World entry point remain authoritative.
Planning dependency SHE-141 was read as Done. Connected GitHub searches for
`challenge` and `SHE-131` returned no matches; local overlap is the existing
housing/commute challenge contract and panel, which this slice reuses.

Acceptance: three district-scoped policies show explicit synthetic capital costs
and mechanism tradeoffs. Default cap is 20,000 synthetic USD, below the 25,000
combined menu cost. Live authorized/remaining totals update for both plans;
over-cap selections cannot freeze or start verification. Blank, nonfinite,
negative and excessive caps are rejected. Costs exclude recurring operations;
actual cumulative capital spending still comes from the existing monthly ledger.
Same-seed replay retains the frozen initial hash, engine version and horizon.
Unavailable metrics and differences within tolerance explicitly state that the
model cannot resolve the result. Editing a candidate clears stale comparisons.
No calibrated forecasts or million-agent execution claims are introduced.

Verification: 13 focused Bun tests pass, including deterministic replay of each
policy against an unchanged control, real housing-improvement evidence in the
existing contract suite, input boundaries, missing observations and budget
eligibility. `git diff --check` passes. Added browser test covers live totals,
over-budget rejection, real worker replay, matched provenance and stale-result
clearing, but execution is unverified: repository Playwright server startup fails
with EADDRINUSE on both 3100 and alternate 3191. No deployment or publication.
Next action: run `bunx playwright test test/e2e/district-allocation.e2e.js` in a
host that permits the configured local servers, then review the UI result.

## SHE-18 narrow-mobile collision audit — November 12, 2026

Status: verification prepared; implementation acceptance remains unresolved.
Branch: `mini/SHE-18`; no PR created, merge or deployment performed. Ownership
for this local slice is limited to `test/e2e/narrow-mobile.e2e.js`,
`test/narrow-mobile.browser.config.js`, and this plan entry. No source files
were modified. The checkout started clean. Prior integration audit
(`docs/symphony-workspace-integration-2026-11-11.md`) records no completed
SHE-18 implementation. Existing first-run guide CSS already supplies compact
controls, mobile sheets, landscape rules and focus outlines; panel-manager tests
already cover exclusive sheets and Escape restoration. Reuse these contracts.

Next end-to-end slice: measure actual World navigation and panel bounds at
320x640, 390x844, 844x390 and 1440x1000; repair only demonstrated collisions
in World presentation styles; rerun and retain screenshots and measurements.
Prerequisite: a browser-capable runner that can bind loopback and launch Chromium.
Acceptance: primary shortcuts, expanded Pause/summary and Activity Close remain
inside the viewport, uncovered at three horizontal sample points and visibly
outlined with keyboard modality; no horizontal overflow. Existing simulation
seed/data authority and synthetic disclaimers must remain unchanged.

Prepared focused Playwright coverage with real app navigation, JSON bounding-box
attachments and screenshots for all four sizes. Exact command:
`PATH=/Users/wahabma/.bun/bin:$PATH /Users/wahabma/.bun/bin/bun node_modules/@playwright/test/cli.js test --config test/narrow-mobile.browser.config.js`.
Attempted run cannot start the local server: Bun reports EADDRINUSE at both
41924 and 41978. An independent `Bun.serve` probe using port 0 and 127.0.0.1
also fails. Direct Chromium launch independently aborts with
`bootstrap_check_in ... Permission denied (1100)`. No viewport measurements or
screenshots were produced; no collision repair is claimed. Do not infer a pass
from test collection or existing unit coverage. No separate lint/type scripts
exist in package.json.

Actual check: `bun test test/world-visual-accessibility.test.js
test/world-visual-panels.test.js test/world-first-run-repairs.test.js`:
12 passed, 0 failed, 59 assertions. Browser acceptance and measured CSS repair
remain pending; this is a verification increment, not a completed issue.

## SHE-163 — receipt-linked outcome landscape

Next slice: extend the existing Decision Studio entry point, not a new simulation
or renderer. Own `world/decision/visualizations.js`, focused landscape tests and
this plan entry. SHE-141 is Done; read-only GitHub search found no SHE-163 PR.
The existing API stores full per-run records and serves them on demand; reuse
that record as the receipt rather than claiming the monthly City receipt schema
applies to the separate Decision model. Keep seed, scenario, experiment, model
and engine identity inspectable. SVG is the CPU/low-capability path (no GPU
required); the paged button grid remains the accessible selection alternative.

Acceptance: 100 actual completed runs resolve to their exact API record and
selected recorded timeline; exclude incompatible versions/identities, report
omitted rows and missing axis values, and never place absent depth at a fictional
coordinate. Bounded scenario sampling and on-demand traces remain in place.
Verify deterministic fixtures and the real entry-point browser journey, including
receipt readback, replay and missing data. Risk: summary traces load asynchronously;
receipt access must remain independent of that load. No engine/API/storage changes,
production mutations or deployment. This coupled view slice needs one owner.

Implemented: selected future receipt link uses the existing exact run API; model,
engine, experiment/scenario identity and uint32 seed gate plotted/browsable rows.
Missing depth values are excluded rather than centered, with explicit omission
counts; zero is retained. Existing previous-experiment outlines remain inspection
only and existing version/horizon gates continue to withhold incompatible pairs.
The existing exploratory browser fixture now supplies its actual engine version.

Verification: 49 tests passed / 0 failed (1,384 assertions) across decision
visualizations, kernel, analysis, integration and exploration. New integration
executes 100 real one-year baseline runs (synthetic housing model, seed42), reads
all100 exact receipt URLs, checks identity/metrics, recomputes selected run73's
stored timeline exactly and checks a missing receipt404. Fixtures do not represent
measured city forecasts or agent/render throughput. `git diff --check` passed.
Added real-entry-point Playwright case for100 runs/scenario, exact selection,
receipt readback, playback, missing depth and before/after screenshots. Execution
is blocked before tests: Bun server bind returned EADDRINUSE on ports3183 and43861.
No browser pass or captured media claimed. Next gate: rerun
`HBL_PLAYWRIGHT_PORT=43861 HBL_PLAYWRIGHT_PARTY_PORT=43862 playwright test test/e2e/receipt-landscape.e2e.js test/e2e/visualization-exploration.e2e.js`
in an environment where the local server can bind. No merge/deploy performed.

## SHE-136 — optional neighborhood council scene

Next slice: reuse Living City's existing transit policy and same-seed paired
worker rather than create another council model. Own only Living City page,
council presentation and focused tests. Existing City Council Night and City
Speaks remain separate model surfaces. GitHub searches for council and SHE-136
returned no PR overlap; Linear SHE-141 (HBL-1M-014) is Done.
Acceptance: opt in, choose an existing capacity option, run one 12-month pair,
inspect changed/unchanged/unavailable metrics and version/seed/policy provenance,
leave or revise without a vote gate. Retain the existing 100-pair journey.
Risks: one synthetic pair is not an empirical forecast or an ensemble estimate;
shared recipes reopen the existing 100-pair journey. Verify actual policy mapping,
deterministic replay, browser retry/leave paths and existing Living City tests.

Implemented: optional disclosure and leave control at `/world/living-city/`;
short comparison uses `runCommuteEnsemble({samples:1})` and the existing replay,
policy presets, council rules and outcome records. Changed, unchanged and missing
metrics are explicitly listed; provenance includes scenario/model version,
starting and paired seeds, pair index, terminal month and policy fields.
Changing the proposal clears the previous provenance and returns votes to pending.
The 100-pair action remains available; council votes never gate continuation.

Verification: `bun test test/living-city-council.test.js
 test/living-city-quests.test.js` passed 7 tests / 121 assertions, including all
three policy presets, exact summary-to-replay metrics and 100-pair replay.
`git diff --check` passed. No lint/type-check scripts are defined in package.json.
Browser coverage added for opt-in/leave, injected comparison failure and retry,
one-pair output and policy revision. Playwright could not start its local server:
Bun returned EADDRINUSE on both 3100 and isolated retry port 33136; browser
behavior remains unverified. Next action: run
`HBL_PLAYWRIGHT_PORT=<free-port> HBL_PLAYWRIGHT_PARTY_PORT=<free-port>
bunx playwright test test/e2e/living-city.e2e.js` on a host that permits listening.
No deployment or production changes; dispatch review remains required.

## SHE-10 — first-play browser-error evidence

Audit on branch `mini/SHE-10`: existing `test/e2e/game.e2e.js` already checked
page exceptions, console errors, failed requests/HTTP responses and WebSocket
errors and attached raw strings. Reuse those assertions; no application or
simulation changes. This slice owns only that test, `test/helpers/browser-evidence.js`,
`test/browser-evidence.test.js`, `test/e2e/browser-evidence.e2e.js`,
`test/browser-evidence.browser.config.js`, and this plan entry. Checkout was clean
at start. No coordinator ownership inventory was supplied or modified.

Implemented a reusable bounded collector installed before navigation. Playwright
`pageerror` covers uncaught exceptions and unhandled promise rejections. Attach
versioned JSON with test status, redacted current URL, event kinds/messages and
an overflow count even when navigation/assertions fail. Existing WebSocket and
external-dependency failures use the same redaction. No DOM, cookies, storage,
request bodies, screenshots or production telemetry are collected.

Redaction removes URL paths/query/fragments, email addresses, common credential
assignments/Bearer tokens, home-directory usernames and phone-like numbers.
It is best effort: arbitrary prose names and unrecognized secret formats cannot
be reliably identified. Treat artifacts as local diagnostic data and review
before sharing; Playwright's separately configured traces are outside this
collector's redaction contract. Messages are limited to 2,000 characters and
collection to 100 events. No seed/data/model contracts are changed.

Verification (2026-11-12): `bun test test/browser-evidence.test.js` passed 3 tests,
11 assertions, including attachment contents, redaction, clean traffic, overflow
and disposal. `git diff --check` passed. Browser acceptance tests are added for
real injected exceptions/rejections and a clean page; they remain unverified.
`bunx playwright test test/e2e/browser-evidence.e2e.js test/e2e/game.e2e.js`
failed before tests because port3100 reported EADDRINUSE; retry with
`HBL_PLAYWRIGHT_PORT=54110 HBL_PLAYWRIGHT_PARTY_PORT=54111` failed similarly.
`bunx playwright test --config test/browser-evidence.browser.config.js` reached
Chromium launch but both tests were blocked by macOS MachPortRendezvousServer
bootstrap_check_in Permission denied (1100). No UI changed; no screenshots.
Next: run those browser commands on an authorized host to verify real browser
error delivery and the normal game startup. No PR, merge or deploy performed.

## SHE-167 — lazy million-resident startup audit

Partial review candidate: [audit, reproducible probe and limits](population-startup.md).
Current Population 1.3.0 defaults to 10,000 explicit rows, caps at 100,000 and
starts on activation (ordinary World auto-activates; opt-out/demo defer). No 1M
resident initializer exists in this baseline. SHE-141's metric contract is Done;
it does not choose a paged/cohort simulation architecture. Preserve model semantics
rather than silently downsample using an optional device-memory hint.

Delivered independently verifiable slice: allocation and invalid-request regression
coverage plus cold-process browser probe through the real World toolbar. Acceptance
evidence: 5 new/related tests (75 assertions) and 22 Population/metric tests
(459 assertions) pass. Combined final run: 27 passed, 534 assertions, 9.78s;
syntax and whitespace checks passed. Browser/server setup blocked measurements: listen EADDRINUSE,
Chromium launch closed, Firefox/WebKit absent. No frame/memory numbers claimed.

Remaining prerequisites and acceptance: choose the million-resident architecture,
measure target-device allocation budgets, implement bounded initialization on the
ordinary entry path, and verify cold shipping Chrome/Safari/Firefox memory and
first meaningful interaction. Optional probe currently covers only opt-out startup;
WebKit does not replace Safari. No runtime behavior change, merge or deployment.

## SHE-124 — explicit weekly retention denominators

Scope decision: browser-local, opt-in Reality Compiler session-cohort observations.
There was no analytics collection or matching open PR in the read-only GitHub
audit on 2026-11-12. This issue workspace is isolated on `mini/SHE-124`.
The analytics module owns its storage contract and dashboard; the only application
integration is completed comparison / successful shared-replay callbacks. No
simulation authority, model seed or run provenance changes.

Acceptance: distinct sessions after 30-minute inactivity, deduplicated callbacks,
separate play/shared denominators, Monday UTC half-open weeks, next-week return
windows, withheld immature rates and empty-cohort handling. Dashboard states
local scope, bot heuristics, storage limits and anonymous-session rather than
user counts. Collection excludes automation and browser privacy signals and
records no URLs, link IDs or simulation payloads.

Limitations: local session-cohort proxy; a later play session in this browser
qualifies earlier cohort sessions. Browser storage clearing and capacity eviction
cause missing observations; bots cannot be perfectly identified. Concurrent
localStorage writes can lose observations. Site-wide reporting needs a separately
reviewed collection, consent, storage and access-control contract.

Verification: `bun test test/weekly-retention.test.js test/reality-workflow.test.js test/reality-share.test.js` passed 17 tests / 99 assertions; `git diff --check` passed.
Attempted a Chromium dashboard smoke, but Bun could not bind the local ephemeral
server (`EADDRINUSE`); browser rendering and the full application journey remain
unverified. No merge, deployment, production change or Symphony dispatch
approval occurred. Site-wide reporting remains follow-on work.


## Fourth-batch root integration — November 12, 2026

The additive pass retained 14 original PR heads. Local retention analytics from
#249 coexist with the prior probability-cloud documentation and first-play v2
funnel. The overlapping #243/#250 paired-run test now checks the frozen initial
state, per-arm and frame-diff digests, the exact Month 16 completion event and the
original finite-metric/zero-control contracts, retaining the explicit 15-second
paired-run deadline. Historical City 1.0 digest evidence remains historical.

The #251 small-screen journey uses the unconditional Copy comparison link control
and waits for its requested Canvas2D renderer. The #252 capture journey waits for
a measured graphics backend and actual camera before freezing the camera, then
checks the rendered month before each image. It does not confuse complete model
history with asynchronous graphics readiness.

Focused verification passed all 13 tests / 550 assertions across the paired-run,
capture-planning and weekly-retention files. Playwright discovery passed three
small-screen cases and 20 canonical sprint/compatibility cases. Discovery is not
execution; actual browser execution remains unavailable after the earlier
Chromium socket EPERM. The historical #270 core-tests.log and focused-tests.log
remain byte-preserved, including their original trailing whitespace.

## SHE-110 — invalid and oversized civic run inputs

Completed the integrated `/api/runs` slice: [input contract](run-input-contract.md),
bounded streaming/preflight, inline world shape checks, generation amplification
limit, and observed background rejection handling. Ownership is limited to the
run resolver/manager, new preflight module, security fixtures, core CI workflow,
and documentation. No shared interfaces or independent implementation tasks
required delegation. Audit found no GitHub PR referencing SHE-110.

Acceptance: reject malformed JSON, NaN/infinities, invalid timestamps, oversized
arrays/bodies/depth/node counts before job creation; preserve seed/schema inputs
and valid recovery; retain pollable failures without unhandled process crashes.
The focused suite is wired into CI; synthetic seed-42 fixtures include exact
boundaries, cancelled oversized streams, and an isolated Bun process regression.
Adjacent generator, adapter, reproducibility, City and run API tests are included
in local verification. Browser behavior is unchanged, so Playwright is skipped.
No lint/typecheck commands are configured in package.json. No merge, deployment,
production data changes or remote publication performed. Broader simulation API
limits and aggregate job/cache quotas remain outside this slice.

Final local acceptance evidence (2026-11-12): `bun test --timeout 15000
 test/run-input-security.test.js test/run-job-manager.test.js
 test/server-civic-api.test.js test/world-generator.test.js
 test/simulation-adapter.test.js test/reproducibility.test.js
 test/city-systems.test.js test/project-unblock.test.js` passed **59 tests across
8 files, 575 assertions, zero failures**. `git diff --check` passed. Hosted CI
execution and PR publication remain unverified.

## SHE-73 first-run reconciliation — November 12, 2026

Audit at `b963dd3` on `mini/SHE-73`: GitHub issue17 remains open and PR11
is merged (`2ead54ed`), so no cherry-pick or duplicate first-run implementation
is needed. Existing homepage Play Demo already targets
`/world/future-machine.html?demo=1`; the numeric mood/authority seed, independent
metadata deadline, Reality outcome wording and31-entry registry are present.
The old assignment's `test/first-run-guide.test.js` is absent; Bun silently
ignores that missing argument. Current repair coverage is
`test/world-first-run-repairs.test.js`.

Next integrated slice/acceptance: make `/routes.html` use that same registry,
retain search/category/favorites and auxiliary destinations, and bound Activity
source requests with an actionable error. Prerequisite: reuse existing registry
and dashboard source identity/lifecycle guards. Risks: saved route favorites and
secondary links must survive; stalled work must not update the UI after timeout.
No shared simulation contract or flagship run logic changes.

Delivered: registry-generated directory cards/counts/categories with31 unique
experiences, preserved secondary links and standalone WebGPU collection link.
Activity snapshot/history/place-comparison requests each have a10-second
deadline with close/reopen remediation; underlying source work is not canceled.
Existing serial/lifecycle checks still discard stale responses. No controls
were newly disabled. Worker5 renderer script tags and mode links are unchanged.

Evidence:13 focused tests/61 assertions pass using
`bun test test/world-user-fixes.test.js test/universe-shell.test.js test/world-first-run-repairs.test.js`.
New directory tests execute the actual inline module with a small DOM and verify
membership/routes, search, category filters, persisted favorites and secondary
links. Deadline tests cover sync/async success, thrown/rejected errors and a
never-settling source. Three new Playwright tests discover successfully via
`bunx playwright test test/e2e/world-first-run.e2e.js --list`.
Browser execution is blocked before any test: Bun serve reports EADDRINUSE on
41924,42773 and42774 in this sandbox. No new screenshots, before/after runtime
measurements, seed/mode observations or full first-run acceptance are claimed.
Browser fixtures explicitly select legacy World with30 synthetic residents and
Canvas2D; its geographic authority seed is distinct from flagship City seed42.

Publication remains a trusted-host task: workspace policy grants read-only Git
metadata, so no commit/push/PR was attempted here. Review the source diff, run
the three browser tests in a host able to bind a local server, inspect generated
desktop/mobile screenshots, then publish the bounded repair. No merge/deploy.

Final combined verification:38 tests/252 assertions pass across the focused
three files plus activity-analysis, activity-history, activity-runtime and
legacy-activity-history. `bun build world/activity-dashboard.js --target browser
--outfile /private/tmp/she73-activity-dashboard.js` and `git diff --check` pass.
No lint/typecheck scripts exist in package.json. Remaining verification is the
blocked browser run, including visual inspection and actual seed/mode evidence.

## SHE-176 — bounded first-run recovery (review candidate)

Audited current design, visual-pass contracts, renderer README, map streamer,
quick controller, tests and core-journeys CI on isolated branch `mini/SHE-176`.
The existing quick demo uses a local Balanced recipe, not remote compute; there
is no remote-compute connection in that controller. GitHub offline PR search
returned only historical browser assignment #19, not a competing implementation.
No new worktree is needed: this checkout is already the issue workspace.

Slice: keep the loaded resident neighborhood available when neighboring map
requests stall; bound quick-demo readiness/computation/reveal operations; return
explicit retry/continue guidance. Prerequisites are the existing map retry and
controller cancellation contracts. Acceptance: release request slots, retain the
resident tile, never complete a failed request, retry captured inputs and reject
late results. Risks: a slow legitimate operation can exceed its deadline; defaults
are 15 seconds per map request and 120 seconds per quick-demo operation. No
automatic rerun, replacement model, seed changes or network-status heuristic.

Delivered: abort-aware deadline wrapper that settles even uncooperative providers;
map request timeout and eviction cancellation; comparison timeout through the
existing error/cancellation path; explicit continue-exploring guidance. CI now
includes the focused regression suite. Loaded resident data is retained in memory;
this slice does not add an offline service worker or cold-start asset cache.

Evidence: Bun 1.4.2 on macOS arm64, 25 focused tests passed / 124 assertions,
including stalled map abort, baseline retention, exact seed-176 comparison retry,
and ignored stale map/comparison responses. Existing success, partial coverage,
worker error and cancellation paths also pass. Browser integration harness uses
normal served modules and guide controls with synthetic comparison success,
seed 176, offline mode and CDP 400ms latency / 50KB/s each direction. It is not
full-scene/model acceptance evidence. Reproduce with:
`bunx playwright test --config test/network-recovery.browser.config.js`.
Actual browser execution is blocked: local server startup failed with EADDRINUSE
on both 54476 and 39876 before any browser test ran. No offline/3G browser pass
or public performance claim is made. No standalone lint/type script exists.

Remaining acceptance: run that browser suite in a host permitting local server
startup; exercise the complete World journey and the separate remote-compute and
scenario-request surfaces, including warm-cache provenance and interruption.
Planning dependency HBL-1M-039 remains unverified. This is a reviewable working
increment, not closure of all SHE-176 acceptance. No commit, PR, merge or deploy.

Final local regression: 31 tests / 155 assertions passed across map streamer,
quick-demo controller, first-run repairs and tile navigation. `git diff --check`
passed. Browser startup blocker unchanged; browser tests remain unexecuted.

## Session survey — SHE-120

Next slice: World quick demo → two successful Replay comparison completions →
collapsed optional survey → unchecked consent → private submission receipt.
Initial play, failed/stopped runs and repeated state notifications do not count.
Owned files: new world/onboarding/session-survey modules, ops/session-survey,
focused tests and small render/server integrations. PR204/SHE52 owns structured
player-feedback; preserve that contract and use a separate versioned endpoint.
No delegation is needed for this small coupled slice. This checkout is isolated
on mini/SHE-120. Acceptance: no first-play popup, optional clarity/fun choice and
500-character suggestion, explicit consent, bounded server input, private storage,
submit/failure/retry/dismiss states, no model/provenance changes. Risks: free text
can contain volunteered personal data; warn against it, reject common contact
identifiers, retain no client metadata, and document local operator deletion.

Implemented the scoped quick-demo survey, private answer-only SQLite endpoint,
shared validation, and focused form/lifecycle/API regressions. Actual checks:
19 tests passed / 121 assertions across session-survey, quick-demo-controller and
world-visual-feedback; git diff --check passed. Browser test committed but not
executed: Playwright webServer failed EADDRINUSE on both 3100 and isolated39741;
no process was stopped. Initial dependency install also failed tempdir EPERM;
the existing shared Playwright CLI subsequently reached server startup. Browser
layout and real three-comparison worker integration remain unverified. No new
lint/type scripts exist in package.json. No deployment, production mutation,
Git publication or Linear dispatch labels changed. Review should resolve the
separate PR204 invitation placement and rerun browser acceptance before release.

## SHE-173 — bounded renderer readback (review candidate)

Audit: clean issue workspace; City GPUProfiler already uses asynchronous Three.js
readback with one pending request, but retries at animation cadence and repeats
cached GPU values in percentile exports. No recurring simulation snapshot transfer
exists; storm GPU frames are a bounded per-run asynchronous transfer. No matching
readback PR found in connected GitHub search. Core CI lacks renderer unit coverage.
Smallest integrated slice: throttle existing timing readback, retain request frame
and completion timestamps, suppress stale/duplicate statistical samples, expose
readback on/off and reuse the scripted camera benchmark. No simulation model,
seed, run authority or checkpoint contract changes. Acceptance: deferred, rejected,
synchronous-throw, unsupported and disposed requests tested; frame p95 compared
on/off with device/browser metadata. Actual GPU numbers require a supported device;
software fallback cannot certify hardware performance. No merge or deployment.

Delivered: one 250-ms request slot, generation-safe toggling/disposal, timestamped
transfer observations, once-per-transfer GPU statistics, normal host API and URL
A/B controls, frame-p95 benchmark comparison, focused CI coverage. Installed
Three.js 0.186 source audit confirmed bounded query pool/last-frame result and
backend trackTimestamp control; internal failures may return cached values, so
transfer provenance explicitly does not assert exact source capture time.
Verification: 30 tests passed / 527 assertions across GPU readback, renderer
performance, procedural geometry and building renderer. No lint/typecheck scripts
are configured. Browser smoke was attempted: default runner hit local Bun shim
postinstall failure; absolute Bun retry failed server listen on both 3198 and
39173 (EADDRINUSE). Temporary config removed. Browser smoke and actual readback
on/off p95 numbers remain unverified; this is a review candidate, with hardware
benchmark acceptance pending. No performance gain, publication or deployment claim.

## SHE-170 — shared progressive geometry frame allowance

Review candidate in isolated `mini/SHE-170` worktree. Prerequisite SHE-141 is
Done (metric contract PR34); read-only PR audit found no SHE-170 implementation.
Existing worker geometry and progressive attachments are retained. Current gap:
resident and streamed tile loaders each spend a separate 4 ms allowance.
Owned slice: share a 4 ms attachment allowance across those loaders, publish
measured chunk/frame overruns, test deterministic competing loaders and abort/
failure paths, then run focused browser stress checks when setup permits.
Acceptance: no new chunk starts after the shared allowance is consumed; ready
work remains bounded and cancellation settles immediately. One synchronous
attachment cannot be preempted: budget plus the final chunk is the bound, and
overruns must remain visible. This is geometry scheduling, not a million-agent
model or a total browser frame-time guarantee. No merge/deployment.

Delivered: default shared frame allowance in progressive-loader, cancellation-safe
release, strict finite local budgets, additive chunk/batch/overrun telemetry and
scheduler documentation. No model/run provenance or geometry output changed.
Verification: 42 tests, 6640 assertions passed across progressive loader, map
streamer, procedural geometry and real worker platform; whitespace clean. Includes
seed42 synthetic nine-loader/600-frame stress, oversized chunks, failure recovery,
late results and cancellation of a stalled attachment. No lint/type script exists.
Browser setup failed before launch with EADDRINUSE on3100 and3370; no camera FPS
or observed blocking claim. Remaining acceptance: rerun the documented browser
check and sustained device/browser stress with actual chunk/long-task timings.
Review candidate; full issue acceptance remains pending live browser evidence.


## Batch 4 ops integration — November 12, 2026

Integrated PRs #240, #253, #259, #268, #269 and #273 as six separate merge
commits on `integrate/b4-ops`, from the shared fork `438e867`. Source handoff:
`d56df9dba29e24ec0172dfa50e35c9c1d1767d80`. All six original PR heads and the
shared fork are verified ancestors. This section records the combined result;
earlier per-PR execution reports above retain their original historical scope.

Resolution decisions:

- Public civic runs now use bounded streaming and preflight before generation
  or scheduling. The current manager retains two active jobs, eight waiting,
  fanout at most eight, held sibling settlement, deduplication, observer isolation
  and operational counters. Production admission remains six submissions per
  client and sixty per process per minute. Existing explicit test-only 120/600
  configuration is unchanged.
- The directory uses registry titles, descriptions, primary routes, categories
  and stable experience IDs. Authored secondary destinations, the Research
  Library entry, supplemental links, favorites and search are retained. The
  Activity dashboard keeps its existing eight-second deadline and failed-state
  retry guard. The incoming `activityRequest` export aliases that same contract;
  it does not install the incoming duplicate ten-second implementation.
- Map and quick-demo deadlines retain loaded context, captured inputs and
  cancellation guards. Timed-out work cannot publish a late completed result.
  The optional session survey counts only completed explicit replays; initial
  play, retries after failures, stopped attempts and year-change comparisons do
  not advance its threshold. Existing quick-demo year controls, independent
  model metadata, player-feedback storage and all server handlers are retained.
- Renderer transfers are bounded and carry request/completion timing evidence.
  A rejected or synchronously failing readback also turns off backend timestamp
  recording, preventing automatic backend readbacks after explicit sampling
  stops. The regression checks both failure types. Shared geometry attachment
  allowance, immediate cancellation and measured overruns remain separate from
  simulation timing and hardware performance claims.
- The core workflow retains all nineteen inherited named steps and the full
  Chromium/Firefox/WebKit installation, plus the three new input, recovery and
  readback gates. The scene group's separate hitch-guard gate must also survive
  final workflow integration.

Focused verification used Bun 1.4.4 on Linux:

```sh
HBL_ADMISSION_HTTP=1 bun test --timeout 30000   test/run-input-security.test.js test/run-job-manager.test.js   test/server-civic-api.test.js test/simulation-admission.test.js   test/world-user-fixes.test.js test/world-first-run-repairs.test.js   test/universe-shell.test.js test/map-streamer.test.js   test/world-quick-demo-controller.test.js test/world-visual-feedback.test.js   test/repeat-play.test.js test/session-survey.test.js   test/player-feedback.test.js test/gpu-readback.test.js   test/render-performance.test.js test/progressive-loader.test.js   test/procedural-geometry.test.js test/worker-platform.test.js
```

Result: **140 passed, zero failed, 7,383 assertions across eighteen files**.
This includes real worker cancellation/replay and an actual HTTP admission
burst/recovery test. An additional isolated full server in production mode
passed seventeen HTTP checks: both feedback endpoints retained independent
validation, malformed public runs returned 400, a synthetic seed-42 run
completed, the seventh simulation submission returned 429, and polling and
feedback validation remained available. Queue metrics reported one submitted
and completed job, zero running/waiting, and the unchanged 2/8 limits.

Browser bundles passed for `world/render.js` (363 modules), Activity (two) and
session survey (two), with curated `/vendor/*` imports external. Playwright
`--list` discovered seventeen cases: seven first-run, one survey, one progressive
controls, two recovery and six renderer cases. No browser was launched because
Chromium's socket permission failure was already established in this environment.
Screenshots, complete live worker/browser journeys and hardware performance
remain unverified; no browser pass is claimed.

The #270 historical core/focused logs and performance JSON are byte-identical
to the original PR artifacts. No model versions, current replay fixtures,
historical receipt bytes, strict saved outcomes or simulation units changed.
`git diff --check 438e867 d56df9d` passed without exclusions for this group.
The two previously identified historical log whitespace exclusions remain
limited to `docs/evidence/she67/core-tests.log` and
`docs/evidence/she67/focused-tests.log` when checking the entire batch.
No remote writes or deployment occurred in this isolated integration.

## SHE-133 — two seeded residents (2026-11-12)

Slice: extend the existing World → What if? paired-day result with two resident
ID inputs, showing each resident in both recorded arms. Ownership: what-if panel,
new read-only resident selection helper, focused tests and this plan. No parallel
implementation is needed for this integrated slice.

Audit: SHE-142 is Done / PR50, but scalar oracle files are absent at local base
b963dd3. SHE-226 is Done / PR110 and overlaps household multi-seed exploration;
this slice stays on existing Population paired-day records, not City households,
30-seed inference or a new oracle adapter. GitHub resident and SHE-133 searches
found no matching implementation PR. Existing what-if records already preserve
seed, project, horizon and matched generated resident IDs.

Acceptance: choose any two IDs after a real paired run; show baseline, addition
and differences with units, null commute and missing-ID states; explain identity,
seed and causal limits. Verify repeatability, zero change, arbitrary IDs and UI
selection/invalidation. Risk: this is one synthetic 24-hour intervention at tick
0, not arbitrary policy timelines or a production resident cross-model mapping.

Delivered locally: pair inputs and two recorded-outcome tables in the existing
What If entry point; exact-ID checks, missing resident/arm identity and null-trip
handling; visible seed/model/input-derived run identity, intervention timing,
units and causal limits. Added module README and bounded responsive styles.
Actual verification: 32 Bun tests passed / 362 assertions across neighborhood,
Population and worker suites. Browser test expanded for pair selection and
missing-ID recovery, but execution blocked before browser startup: server bind
EADDRINUSE on both 3100 and alternate 39331. No browser/layout proof claimed.
No lint/type scripts are configured. Final syntax/build and whitespace checks
are recorded with the handoff. No merge, deployment or production mutation.
Remaining scope: arbitrary policy timelines and persistent comparison records
would require a separate data/editor slice; oracle and City household mappings
remain unsupported. Dispatch/release review remains required by SHE-133.

## SHE-158 — progressive City Lab replay tiles

Owned slice: new `world/city/spatial-tiles.js`, `spatial-tiles-view.js`,
focused unit/browser tests and City Lab replay integration (lab.js/html/css).
No World map-streamer, Future Machine, simulation engine or metric contract edits.
SHE-141 is Done (PR34); source metric interface exists. Read-only GitHub issue
search found no SHE-158 PR. Existing World streaming is geometry-only context.

Implement bounded in-memory geometry materialization for visible replay tiles,
with immutable full-city and tile summaries always available. Imported footprints
use geographic coordinates; absent geometry uses explicitly schematic district
positions. Camera loading never advances the model or synthesizes population.
Acceptance: partition sums equal complete replay inventory during loading, errors,
cancellation and summary-only mode; rapid pan rejects obsolete work; month change
cancels old detail; Canvas2D and accessible summary table work without WebGL.
Risks/limits: replay is already in memory; this does not stream the saved snapshot
over a server API or claim million-agent capacity. Record before/after browser
artifacts and deterministic seed158 fixtures, run focused and City integration tests.

Delivered working source increment: City Lab → Enter future mounts the map from
that exact replay step; month/experiment changes cancel prior detail. Immutable
full inventory is independent of the six-tile/two-load rendering window. Canvas
pan/zoom, retry/reset, full inventory table, automatic ≤2GB summary mode and
no-Canvas table path are wired. Geographic imports retain source building IDs;
missing geometry and missing household locations stay in labeled schematic tiles.
No simulation, storage schema, server endpoint or metric semantics changed.

Actual verification:45tests passed/496assertions across spatial tiles, City
systems/API/persistence/replay, project unblock, worker lifecycle and agent counts.
Focused6tests cover seed158 partition/replay, source immutability, geographic
identity, rapid movement, abort/late success, concurrency, failures, retry,
summary-only and disposal. `git diff --check` passed. Playwright discovers both
new integrated tests (mapped replay and no-Canvas fallback), but execution and
before/after recordings remain blocked: server bind returned EADDRINUSE for
3100,3188,49783; direct installed Chromium launch failed bootstrap_check_in
permission denied. No visual pass, recording, commit, PR, merge or deploy claimed.
Next gate: run the two browser tests and capture/inspect the images/videos on a
host allowing server bind and Chromium. This is in-memory progressive rendering;
network-backed tile retrieval and large-city index/latency benchmarks remain
follow-on scope. README documents commands, provenance and these limits.

## SHE-161 — occupancy versus recorded interaction heatmap

Delivered a read-only Living City overview panel, backed by the same worker
snapshot and clock as the rest of the view. Ownership: new city-heatmap module,
model snapshot field, world-view mounting, focused tests and this plan entry.
Residential occupancy counts every synthetic resident at their assigned home,
falling back to their district anchor when building records are absent. It
separately sums represented residents; a million represented residents does not
mean a million independently simulated people. Activity counts recorded hotspot
encounters once each in (minute - 30, minute], without population expansion.
Retained encounters are bounded to 120 citywide; the UI explicitly reports that
this is incomplete when retention removes records. This slice does not claim
coverage of every kind of model interaction. Missing older snapshot data shows
unavailable. No simulation commands or new causal claims are introduced.

Acceptance: deterministic fixture verifies home sums, representation weights,
window boundaries, future exclusion and unmapped encounters; real model tests
verify sample-independent counts and seed-matched projection. SVG uses native
browser rendering with a numeric text summary, independent of WebGL/GPU support.
Schematic coordinates are model coordinates, not a geographic basemap. Each
measure normalizes by its displayed maximum (shown numerically); these intensities
must not be compared as shared physical units across measures or timestamps.
Existing checkpoint selection supplies the snapshot timestamp; no separate
history archive or encounter completeness guarantee is added.

Verification: initial regression run found missing building anchors and the
fallback was corrected. Default 5-second suite timeout expired on the existing
weekend model test; rerun with 30-second per-test limit recorded below. Browser
smoke and before/after capture test added, but Playwright server startup failed
with EADDRINUSE on both 3100 and 3191 in this environment; no browser result or
recording is claimed. No merge, deployment or production data changes.
Final numerical/regression result: `bun test --timeout 30000
 test/city-heatmap.test.js test/population-model.test.js` passed 16/16 tests,
202 assertions in 9.37 seconds. `git diff --check` passed. Browser acceptance
and actual before/after recordings remain outstanding because startup is blocked.

## SHE-174 — adaptive Population scheduling guard

Next integrated slice: measure completed live clock commits and reduce automatic
update frequency under pressure. Existing fixed-step clock and authoritative
worker are prerequisites; SHE-141 metric contract is present in this checkout.
Owned paths: Population scheduling guard/runtime, focused tests, worker contract,
and this plan. Acceptance: bounded observable transitions, hysteretic recovery,
invalid-sample handling, no catch-up burst, and identical full model state after
equal fixed ticks with the same seed/inputs. A single expensive tick remains
non-preemptible; no claim of a maximum hitch or production performance.

Review candidate implemented: `world/population/scheduling-guard.js` and live
runtime integration; contract in `world/workers/README.md`; focused Bun and
Chromium tests plus existing core-journeys CI wiring. Open GitHub PR search for
“adaptive scheduling” returned no matches before implementation; local CI,
Population contracts, fixed-step clock, worker pool and checkpoint code audited.
Existing isolated branch is `mini/SHE-174`; no Git metadata writes or publication.

Acceptance evidence (2026-11-12, Darwin arm64, Bun 1.4.2): injected 120 ms worker
reply delay, synthetic population 20/seed 42/current Population model version;
normal runtime transitions to reduced, admits no tick during cooldown, and full
decoded authoritative model agrees with an unthrottled run at equal modeled tick.
Four focused tests pass, including threshold/recovery boundaries, detached bounded
logs, discarded cooldown backlog, invalid samples and failed-commit rollback.
Device policy is runtime-only diagnostics, outside saved deterministic provenance.

Verification limits: Playwright test added but local server startup failed with
EADDRINUSE at both 3100 and 43174; no browser result claimed. Existing full
checkpoint suite: 21 pass/1 timeout (30 s). The exact failing checkpoint test also
timed out at 30 s against an unmodified HEAD runtime in a temporary baseline
module; wrapper terminated it at 40 s and removed both temporary files. The
model suite initially hit its default 5 s timeout; the 60 s allowance used by core
CI passed that case. No standalone lint/typecheck script exists. Thresholds are
synthetic policy assumptions; no production hitch/throughput claim or deployment.
Next action: review candidate and run the attached Chromium test on a host that
can bind a server; investigate the pre-existing checkpoint timeout separately.

Final combined relevant check: `bun test --timeout 60000
 test/population-scheduling.test.js test/population-studio.test.js
 test/population-weather-input.test.js test/population-model.test.js
 test/agent-counts.test.js` — 40 passed, 0 failed, 554 assertions, 11.11 s.
`git diff --check` passed. Browser remains unverified as described above.


## Batch 4 Population / City integration evidence (2026-11-12)

Integrated exact original PR heads #257, #263, #267 and #274 with no-fast-forward
merges from shared fork `438e867c30d2f4f9001663c1f109b3215e3a6194`; stable source
commit `ca2c64ab77332805b869ae08d588169256f982d2`. This entry records combined
verification; earlier slice entries remain historical evidence.

- #257 keeps the neighborhood impact ranking, exclusions and exact seeded
  Population identities while adding two-resident before/after comparisons.
  Run identity includes the actual model version, context, config and project;
  missing identities fail closed rather than being matched by array position.
- #263 keeps guided housing/drainage actions, project unblock, One Life and saved
  replay behavior. Progressive tiles reset with a new run/month, cancel stale
  loads and retain full totals under summary fallback. Tile `residents` values
  sum household sizes; labels now say **household members**, distinct from the
  City 1.1 individual adult records. No metric arithmetic or wire field changed.
- #267 retains full current-position density and neighborhood changed-state
  diagnostics alongside assigned-home occupancy and bounded recorded encounters.
  The heatmap updates on accepted snapshots and clears on reset; teardown also
  retains density/neighborhood cleanup and recovery-safe activation. Existing
  LOD, selected-resident and hidden-hover contracts remain intact. The Population
  ODD and data contract document these different counts, units and missingness.
- #274 changes automatic wall-clock admission only. Existing allocation failure
  reporting, explicit smaller-population recovery, neighborhood run identity and
  authoritative committed-worker checkpoint paths remain. Failed commits do not
  log success timings; cooldown discards elapsed backlog and cannot preempt one
  expensive fixed tick. All 18 inherited named core-journey gates remain, with
  the scheduling unit test and Chromium journey added. Other owners' additive
  workflow gates must also remain when this branch is combined.

Actual verification on Linux, Bun 1.4.4, matching existing dependencies:

```sh
bun test --timeout 60000 test/neighborhood-what-if.test.js test/neighborhood-impact.test.js
# 9 passed, 0 failed, 116 assertions (2 files)
bun test --timeout 60000 test/city-spatial-tiles.test.js test/district-grid.test.js test/policy-comparison.test.js test/city-life.test.js
# 16 passed, 0 failed, 421 assertions (4 files)
bun test --timeout 60000 test/city-heatmap.test.js test/population-density.test.js test/neighborhood-selection.test.js test/population-scheduling.test.js test/population-memory-pressure.test.js test/population-world-view.test.js test/population-render-lod.test.js test/population-zoom.test.js
# 36 passed, 0 failed, 224 assertions (8 files)
```

Combined result: **61 passed, 0 failed, 761 assertions across 14 files**. The
scheduling test delays real worker replies by 120 ms, checks reduced admission
and failed-commit rollback, and compares full decoded authoritative model states
at equal ticks against an unthrottled run. The heatmap test also checks the
coexisting density projection has the same tick/minute and all 1,000 residents.

`bun build` for `world/city/lab.js`, `world/what-if/panel.js`,
`world/population/world-view.js`, `world/population/runtime.js` and
`world/population/city-heatmap.js` with `--target browser` bundled 225 modules
across all five entries. `bun --bun x playwright test` with `--list` discovered
five journeys across `neighborhood-what-if.e2e.js`, `city-tiles.e2e.js`,
`city-heatmap.e2e.js` and `population-scheduling.e2e.js`. No browser was launched:
this session's previously established Chromium socket restriction still prevents
actual visual verification, so no screenshot or browser pass is claimed. The
known baseline failure in the full worker checkpoint negative-restore suite was
not rerun; the focused guard test's equal-tick checkpoint comparison passed.
`git diff --check` and exact-head ancestry checks passed. No remote mutation was
performed by this integration worktree.

## Future Machine fourth-batch integration — November 12, 2026

Integrate original heads #241, #242, #244, #248, #255, #262, #264, #265 and #266
on `integrate/b4-ui` from common fork `438e867`. The coordinator, timelines and
scene have one owner because preview readiness, explicit navigation, camera
state and resource disposal share lifecycle boundaries. Parent owns remote
publication and the cross-branch gate; independent ops/Population owners use
separate worktrees.

Acceptance: preserve City 1.1 replay identity and receipt-v1 compatibility,
strict saved challenges, request generations, explicit demo versus continuation
precedence, pending-backend truthfulness, manual camera takeover, retained meshes
and quiet playback. Add the follow-up housing revision, local demo timing,
recorded construction previews, inspectable initial inventory, resource cleanup,
device-loss status and household timeline through existing entry points.

Known integration risks: initial preview snapshots need explicit month tags but
must never claim completed outcomes; timing must tolerate unavailable storage and
terminate without success for inventory fallback; exact ghost event navigation
must announce and retain arm identity; household live output must honor explicit
announcement boundaries; cleanup must retain live motion and camera controls.
Keep historical City 1.0 evidence labeled. Rebuild current WHY evidence after the
final evidence.js change. Verification will use focused actual-model, coordinator,
DOM/Canvas and lifecycle tests, parser/browser bundle/discovery checks and ancestry
checks. Actual browser launches remain blocked by the previously verified socket
EPERM limitation and will not be repeated.

## SHE-101 — optional follow-up after replay

Slice: Future Machine offers one compatible housing revision at Month 120 after
replay. Prerequisites: existing validated single-policy recipe, saved paired City
API and synchronized replay. Keep that contract: increase the current housing
proposal by 12 homes (up to 120), scale its illustrative budget by the current
cost per home, and rerun from the same original generator/seed/horizon. This is
an authored synthetic assumption, not a recommended real-world policy cost.
No concurrent policy or checkpoint branching interface is introduced.

Acceptance: dismiss preserves the run; accept changes only housing amount/cost;
identical initial hash and baseline metrics; show added/total cost and constraints;
no offer before Month 120, for absent policy or when the revision exceeds bounds.
Owned implementation: future-machine/follow-up.js and main.js integration.
Focused recipe/data checks passed 7 tests / 46 assertions. Browser acceptance
and final diff review pending. Risk: dismissal is local to the loaded result and
resets on reload; revised results compare to the unchanged baseline, not a third
simultaneous arm. The old saved run remains available through its existing URL.

Final verification: 7 focused recipe/data tests passed (46 assertions). Browser
journey is committed but unverified: both default port 39931 and isolated port
40187 failed server startup with EADDRINUSE in this sandbox. No application
browser result is claimed. Existing issue branch is mini/SHE-101, clean before
this slice; GitHub search returned no SHE-101 PR. No deployment, issue transition,
Git metadata writes, readiness labels or external messages performed.
Final expanded check: recipe/data/UI suite passed 13 tests / 87 assertions, with
one opt-in Chromium fixture skipped; whitespace check passed. The new focused
Playwright journey still requires execution where local server binding works.

## SHE-104 — Play Demo first visible city timing

Owned slice: homepage click handoff, Future Machine coordinator, new local timing
module and focused tests. Existing scene readiness and validated paired history
are prerequisites. Measure click through two visible animation frames after
renderer readiness; require a connected, visible canvas intersecting the viewport
and a foreground document. Empty/loading/inventory-only/error states cannot
complete. This is a browser paint-opportunity proxy, not GPU presentation feedback.
Warm means the default paired history was already in memory; cold means it needed
creation. It does not infer HTTP cache state. Renderer is actual WebGPU/WebGL/Canvas2D.
Only the latest rounded duration, source, renderer and cold/warm label remain in
memory. The homepage stores one expiring, single-use timestamp in sessionStorage;
storage denial is tolerated. No telemetry upload or entity/run/recipe identifiers.

Audit: clean issue workspace at b963dd3; current integration audit explicitly
lists SHE-104 as incomplete with no completed implementation commit/PR. Live
GitHub PR query failed due API connectivity; duplicate verification remains
limited to repository evidence. No Git metadata writes, merge or deployment.
Acceptance: focused regression tests plus real homepage cold/button warm browser
tests for Canvas2D and WebGL, attaching observed JSON durations. WebGPU remains
hardware-dependent and is labeled by the same actual-backend diagnostic.

Verification: timing unit tests passed (3 tests, 18 assertions); integrated focused
regressions passed 22 tests / 140 assertions, with one existing browser-gated skip.
Whitespace check passed. Browser startup
blocked twice: Bun reported EADDRINUSE for ports 39931 and 54804; no browser
journey or real duration is claimed. Reproduce with
`HBL_TWO_FUTURES_PORT=<free-port> bunx playwright test --config test/demo-performance.browser.config.js`.
Real cold/warm timing acceptance remains pending that run in an environment where
the local server can bind. No existing server was stopped or reused.

## SHE-159 — exact construction event silhouettes

Owned slice: Future Machine scene construction-ghost projection, renderer and
Canvas integration, event selection, focused tests and scene documentation.
Prerequisites: existing monthly City history, housingProjectBuildingId mapping
and completion receipts (HBL-1M-015 provenance interface). No model changes.
Acceptance: Month n-1 has no solid new building; a separately labeled preview
silhouette links to exact arm/event/project/policy at Month n; Month n uses only
recorded inventory. Missing prior snapshots or unmatched events create no ghost.
Risk/limit: bounded housing completion support only; no inferred modification
or cross-model mapping. Verify deterministic fixtures and browser before/after.

Delivered: separate next-month preview projection with exact event, arm, project
and policy IDs; native wireframe/Canvas dashed geometry and accessible completion
jump. Solid inventory stays snapshot-owned. Receipt lookup respects selected arm.
Verification: 99 passing Future Machine tests / 958 assertions, 3 existing browser
checks skipped. Focused browser recording test added, but server startup failed
with EADDRINUSE on 39884 and alternate 39959; no screenshots/video claimed.
Linear related-backlog lookup timed out; local provenance interfaces inspected.
No deployment or production mutation. Remaining: run the focused browser journey
and capture before/after on a host with available listeners; add modifications
only when the model supplies explicit building mutation event semantics.
## SHE-166 — instant city preview (review candidate)

Scope: existing Future Machine homepage entry and demo. Audit found no SHE-166
PR in the connected GitHub search; the current isolated branch is mini/SHE-166.
Core journeys CI already verifies Future Machine manifest, boundary and replay
contracts. No architecture.md or more specific AGENTS.md exists for this module.

Implemented smallest slice: render the existing versioned initialForRecipe
Month 0 inventory before any API request. Label it as synthetic initial inventory
with seed, model and dataset version; never generate future metrics or claim a
saved run. Building/household inspection and proposal/seed choice remain usable
while the first run is pending. Fork City replaces the pending request through
the existing abort/stale-response guard. Timeline, future metrics, export and
sharing remain gated on validated history. Failure/cancel retains the preview.
Normal completed runs still use manifest identity validation and recorded replay.

Acceptance evidence: macOS arm64, Bun 1.4.2; `bun test --timeout 15000
 test/future-machine-data.test.js test/future-machine-boundaries.test.js
 test/future-machine-ui.test.js`: 16 pass, 1 optional Chromium component skip,
125 assertions. Includes seeds 0/4294967295, deterministic persisted replay,
identity failures and stale-response cancellation. `git diff --check` passed.
New Chromium test uses default seed 42, 1440x1000 viewport and a held request
followed by HTTP 503 to verify inspection/action choice without future outputs.
`bunx playwright test --config test/instant-city-preview.browser.config.js`
blocked before browser launch: local server returned EADDRINUSE at both 39931
and override 39946. Browser behavior and integrated successful transition remain
unverified in this environment; rerun that test and the existing two-futures
suite on a host that can bind its isolated server. No timing/public performance
claim, merge, production-data change or deployment. Review candidate only.

## SHE-106 — replay resource ownership

Next slice: audit Future Machine stage replacement, release all scene-owned GPU
resources on fallback/disposal, and drop retained frame references. Preserve the
City adapter, seed/version and model results. Acceptance: 30 sequential normal
route runs with stable post-GC heap (first warmed run + 32 MiB), non-growing
geometry/texture counts, identical canonical history digest, and idempotent
disposal. Scene resources and focused tests owned here; no model/API changes.
Risks: renderer counters are not GPU byte measurements; Chromium GC measurements
are local evidence only.

Implemented: recursive deduplicated mesh/grid resource release on rebuild,
fallback and disposal; explicit WebGL context release including deferred
completion; missing-frame Canvas clear and disposed-stage reference cleanup.
Verification: 38 focused tests pass / 215 assertions, 1 opt-in browser skip;
whitespace check clean. Thirty-run browser regression is added with full-history
SHA-256 equality, fixed resource counts and post-GC first-sample +32 MiB bound.
Acceptance remains pending: isolated server cannot bind (EADDRINUSE on 39884
and alternate 39986 after bypassing package-local Bun setup failure). No memory
bound measurement claimed. See scene README for command, assumptions and limits.

## SHE-169 — bounded renderer recovery follow-up

Audit: Future Machine already handles initialized WebGPU/WebGL loss by removing
the native canvas and labels and drawing the same CPU-authoritative paired City
records in Canvas2D. This is renderer recovery, not a GPU simulation checkpoint.
SHE-168 (HBL-1M-041) remains In Progress with PR196; no SHE-169 PR was returned
by the connected GitHub search. Existing core CI does not run the dedicated loss
browser configuration.

Next slice: make the visible recovery notice explicitly identify graphics loss
while retaining the recorded month in the legend, without claiming a durable save. Own
scene/index.js and the existing loss browser assertions. Acceptance: visible
loss notice, same month/seed/model/run/recipe/snapshots, no retained native canvas
or labels, and working recorded WHY and timeline controls. No model changes.
Risk: native browser/device availability limits fault-injection verification;
mid-compute GPU checkpoint recovery remains outside this CPU City renderer slice.

Delivered review candidate: accessible recovery status explicitly says graphics
connection was lost, Canvas2D uses the same recorded inventory/timeline, and no
simulation rerun is needed. Existing browser loss test now asserts this notice
alongside its exact provenance and stale-canvas checks.

Verification (2026-11-12): Bun 1.4.2, macOS arm64; focused scene/data/boundary
suite 19 passed, 0 failed, 106 assertions (8.74s), including deterministic seeds
0 and 4294967295. `git diff --check` passed. Browser command
`bunx --no-install playwright test --config test/pipeline-device-loss.browser.config.js`
failed loading import.meta under CommonJS. A temporary same-directory .mjs copy
resolved loading, but server startup failed EADDRINUSE on both 39974 and 41969;
temporary copy removed. No browser/device/seed-42 loss observation from this run
is claimed. Existing historical loss evidence is separate. Next: run the focused
browser configuration in a bind-capable environment, integrate SHE-168, and define
the GPU-compute receipt/checkpoint owner before claiming full issue acceptance.

## SHE-139 — synchronized household changes

In progress: extend the existing Future Machine outcome timeline with an exact-ID
household selector, paired monthly observations, and previous/next recorded change
navigation through the coordinator's shared month callback. Ownership: new
`ui/household-timeline.js`, its focused test, outcome-timeline composition and UI
documentation only. No engine, storage, Population identity or clock changes.
Dependency SHE-142 is Done (PR #50). Backlog audit found SHE-130's week-following
scope and GH #15's general comparison UI; existing Timeline Braids compares sparse
Population saves, while this slice uses only the monthly City pair. GitHub search
found no dedicated household timeline PR. Acceptance: gaps never carry state,
exact household/unit IDs and run/seed/version remain visible, both arms jump using
one month, deterministic change detection, native keyboard controls and disposal.
Risk: observations are recomputed history, and changes are observational, not
causal events. Dispatch review remains required before publication/merge.

Implemented locally: household selector, paired observations at the shared month,
previous/next adjacent recorded changes, exact-month change table, provenance
validation and disposal. The parent outcome timeline composes the module, so the
normal Future Machine run/reopen path uses it without a second clock or engine.
Verification: existing UI/outcome/data/diff/paired selection passed 26 tests,
2 browser tests skipped by default, 183 assertions. The new household suite then
passed 3/3 with 17 assertions, including a real 12-month City-engine matched pair
and deterministic rerun. `git diff --check` passed. Explicit browser attempt
failed before browser launch: Bun.serve({port:0}) returned EADDRINUSE in both
existing browser suites under this sandbox. Browser layout, keyboard and full
integrated app interaction remain unverified; expanded component smoke is ready
for a host with local port binding. No screenshot is claimed. No production
changes, merge or deployment. Next: host browser verification and dispatch review.

## PRs #264–#266 integration verification — November 12, 2026

Integrated original resource-cleanup, loss-notice and household-timeline heads
with merge ancestry retained. Existing retained rendering, construction previews,
bookmarks, quality controls and media lifecycle remain composed. Household
observations share the existing month callback and preserve manual-only live
announcements; playback updates visible values silently. The resource browser
test waits for native readiness and excludes newly allocated experiment identity
from model-history equality while retaining it in evidence.

Verification on Bun 1.4.4: 37 focused unit tests passed across scene resources,
effects, Canvas, scene projection, household and outcome timelines. A separate
Happy DOM smoke passed shared navigation, missing observations, silent playback,
manual announcements and idempotent disposal. Explicit Chromium launch was
attempted: packaged browser was absent; system Chromium then failed before test
assertions with process-singleton socket EPERM. Browser layout, actual graphics
loss and thirty-run memory measurements remain unverified. No model rules, seeds,
versions, simulation results or persistence records changed.


## Independent merge review for PRs 240–274 — November 12, 2026

User authorized merging all open HappyBearLandia PRs. Reviewed the 35 original
heads against `sprint/one-city-two-futures-20261111` at
`ed6e62eb77246ca466c00930a1463a316ba3ab21`; retained every original head as an
ancestor and combined the shared coordinator, rendering, workflow and
implementation-plan changes. GitHub reported no branch protection or active
rulesets for this sprint target. No review submissions or inline review threads
were present at the inspected original heads. All were authored by the connected
account, so this work does not claim a separate GitHub self-approval.

The integration reuses the earlier composed batch work, preserving existing
interfaces and all selected CI suites. Independent review fixes include:

- Initial preview snapshots carry explicit Month 0 tags and real generator
  inventory. Preview configuration and Fork City submissions remain actionable
  while a request is pending; cancel, failure, supersession and late results
  preserve state correctly. Completed results retain their own provenance.
- Startup timing resolves sessionStorage inside its guarded access; a throwing
  storage getter is covered by a regression test.
- City Lab retains tile DOM/state on cached navigation and still releases it
  on a final unload. The new regression failed before the lifecycle correction.
- Screenshot journeys select the exact model building/completion receipt rather
  than an arbitrary first button or an unselected aggregate explanation.
- Resource disposal and device-loss presentation coexist with retained meshes,
  camera controls and exact construction ghosts. Household playback remains
  quiet, while explicit month selection announces the recorded observation.

Combined verification on local integration `2c80512` passed 246 tests, with two
explicit optional browser skips and no failures, across 40 affected/adjacent
files (9,223 assertions). The repository core-journey unit selection passed
104 tests across 23 files (1,011 assertions). The Future Machine browser bundle
compiled successfully (59 modules). Focused real-worker scheduling, equal-tick
replay, paired City histories, current/historical receipts, bounded inputs,
recovery, consented surveys and scene/resource contracts are included.

ODD/subsystem review compared `docs/models/population.md`,
`world/population/DATA_FORMATS.md`, and `world/workers/README.md` with
`world/population/runtime.js`, `model.js`, `scheduling-guard.js`, and the worker
scheduling tests. Cooldown changes wall-clock dispatch cadence while retaining
the same model step, seed and equal-tick outcomes; represented population and
explicit resident rows remain distinct. This does not establish million-row
browser scalability or a hardware frame-rate claim.

Browser execution remains unverified: Playwright's packaged executable was
missing, and the available system Chromium failed before assertions with a
process-singleton socket EPERM. The new small-screen screenshot baselines still
need generation and visual review on a working browser host. Original #243 and
#270 hosted Core journeys failed on old example receipts; the integrated current
and historical receipt tests now pass. Their recorded hosted performance-budget
failures are not represented as fixed or green. The full model-validation sweep
was started separately and is not claimed complete in this record. This is
integration evidence for the existing sprint branch, not public-launch approval.


## Five-minute GitHub merge checks — November 12, 2026

Requested slice: move the hourly ChatGPT merge task to GitHub Actions with a five-minute schedule. Use the repository GITHUB_TOKEN, the current main and Symphony sprint targets, existing CI, current review state, and explicit holds. Ordinary ready PRs need no extra label or new approval requirement. This is deterministic CI/review-based merging; it does not run an AI semantic code review.

Acceptance: paginate candidates and review evidence; skip drafts, forks, conflicting/unknown merges, holds, unresolved findings, workflow/policy edits, missing or failing CI, stale heads and stale integration bases; bind merges to the checked head SHA; merge at most one PR per pass. Recheck current main CI after every main merge. Add workflow_dispatch to core journeys because a merge made with GITHUB_TOKEN does not trigger its ordinary push event. Allow an explicit manual dry run and publish an Actions summary. Preserve existing targets, branch protections, application code, and deployment behavior.

Implementation: .github/workflows/auto-merge.yml, .github/scripts/auto-merge.cjs, test/auto-merge.test.cjs, and docs/auto-merge.md. No application/browser behavior changes; focused mocked-API tests verify scheduler decisions and failure paths. Live activation and verification are recorded in the implementation PR and workflow run; retire the hourly ChatGPT merger only after the new schedule is active.

Local verification: 79 tests/subtests passed with `node --test --test-reporter=spec test/auto-merge.test.cjs`; zero failures. Both workflow YAML files parsed successfully. The five-minute cron, read-only default token scope, explicit merge-job permissions, manual dry-run default, and core workflow dispatch trigger were checked. No live merges were used as tests.


## First-run World guidance and feedback (November 11)

Status: **implemented on review branch; automated verification pending**.

This slice improves the existing /world entry point without changing simulation contracts or adding a new simulation authority.

- [x] A first-run coach appears before the 3D world finishes initializing; provides a pinned quick-demo link and three guided experiments (matched weekly plan comparison, storm, 10-year packages), plus inspect-resident.
- [x] World publishes actual, bounded outcome notifications for configured plans, local storm effects, matched weekly well-being, and the existing 10-year package experiment. Playback reports observational mood/activity changes without representing them as policy effects.
- [x] A short narrated first-cycle comparison is available through ?demo=1&quick=1&autoplay=1; the original multi-cycle tour remains intact.
- [x] Advanced plan-year, overlay, seed, source and diagnostic controls are grouped under a native disclosure, preserving IDs and existing functionality.
- [x] Focused Bun and Playwright tests have been added to the core workflow.
- [ ] Confirm the branch CI and real /world browser smoke before merging.
- [ ] Verify performance on the target Mac browser and check that slower devices meet the intended quick-demo duration.

Important limits: the quick reel's model computation may take longer than its caption hold times. In the existing 10-year experience, three plan packages are compared; no unmodeled decade-long no-plan outcome is asserted. On the normal /world page, the classic local storm and weekly comparisons are separate from the default Living Population runtime, so guided actions explicitly switch modes first.

Acceptance path: open /world, inspect the coach before startup completes, select a weekly paired comparison, observe the actual delta in "What changed?", run a local storm, pause/play and inspect the observational mood changes, open the 10-year package report, verify advanced disclosure, reload a minimized guide, and open the short demo via its stable URL. Embed and saved-experiment pages should remain free of the coach.

Verification commands: `bun test test/first-run-guide.test.js` and `bunx playwright test --config test/first-run.browser.config.js`.


## PR38 main integration conflict resolution

Preserve both branches’ CI suites, dynamic gallery count, outcome interpretation,
activity toggle/retry accessibility, storm feedback/return value and playback facts.
The early World guide remains available before startup; after startup the panel
manager makes the matched-comparison guide primary and exposes live experiment
feedback as one companion sheet under More city actions. Both guide APIs remain
compatible. Verify unit/CI contracts and actual first-run/visual browser journeys
before merging PR38 into main. Staging/CDN validation remains a separate blocker.

PR38 integration acceptance evidence: workflow unit groups passed 91/68/8 tests
(167 total, zero failures); focused conflict/cache/guide/catalog tests passed
27 tests with540 assertions. First-run browser suite passed4 tests, including
actual storm/weekly simulation and one-visible-guide selection. Desktop visual
integration passed matched replay, injected worker failure/recovery, inspector
and Full Demo after preserving nonblocking optional-plan refresh. The first
pre-correction browser run exposed disabled Full Demo; its failure is retained
in /private/tmp/hbl-pr38-visual.log. Mobile rerun and hosted browser CI are
merge gates checked by the coordinator; their final results belong to PR38.
No live Symphony, staging/CDN approval or deployment is part of this resolution.

Hosted browser CI caught the main renderer-entry bypassing saved checkpoint
restoration on GPU failure. Saved experiment URLs now retain render.js and its
checkpoint-aware Canvas fallback/error return view, rather than starting a new
low-fidelity simulation. Both saved-World failure-path regressions gate merge.

Final local browser gates passed: mobile WebGL/reduced-motion comparison at
320/390/768/844 widths (one panel, no overflow); saved checkpoint Canvas fallback
and all-graphics-unavailable exact return2/2. First-frame timing now records the
first successful normal render too, since synchronous saved restoration may finish
before the scheduled startup frame runs. Desktop replay/recovery passed1/1.

## SHE-250 / GitHub44 — World screen-space global illumination

Next integrated slice: an opt-in GLOBAL ILLUMINATION button on the normal World
entry point, lazy local Three.js SSGI composition, and an off path that bypasses
all GI passes. Reuse installed Three0.186; no dependency/runtime changes. Only
WebGPU is initially supported; WebGL2/Canvas2D remain playable with an explicitly
unavailable control. Preserve simulation identity and clocks. Acceptance: real
GPU on/off pixels, pressed/status semantics, lazy failure recovery, resize and
resource disposal, plus unchanged paused simulation state. Main risk: MRT/SSGI
shader compatibility and GPU cost; retain off by default and bounded samples.
Symphony is held; this chat owns direct implementation, not a duplicate worker.

Delivered: lazy MRT color/diffuse/packed-normal/depth SSGI pipeline; explicit
GLOBAL ILLUMINATION pressed/loading/unavailable control; zero GI passes when off;
renderer-state recovery and target cleanup. Mobile placement avoids the guide
sheet. Existing WebGL/Canvas paths stay available with GI disabled.

Actual verification:28 renderer/lifecycle tests passed,137 assertions (five GI
regressions cover lazy reuse, unsupported paths, import/render failure, disposal
during loading and off-during-loading). Native Metal Chromium acceptance passed
3/3 in24.4seconds: actual World GI pixel difference, identical paused simulation
snapshot, resize/320px click, WebGL unavailable, and Canvas2D unavailable. GI
module bundle succeeded; full application bundling remains blocked by an existing
absolute /vendor/three import in world/buildings/renderer.js, unrelated to GI.
Initial unsafe-software-WebGPU device loss and superseded cleanup/mobile runs
are retained under /private/tmp/hbl-gi-*.log; failures were fixed/rechecked, not
waived. No Safari, performance/FPS, path tracing or offscreen-light claim.
No Symphony activation, automatic merge or deployment. Review through draft PR.

Hosted acceptance caught the narrow saved-future return link beneath the new
button. Saved-future navigation now reserves its top area while GI stays at the
bottom; the existing saved Canvas/graphics-error return tests both passed locally
(2/2,11.1seconds) without changing their assertions. Fresh hosted CI gates review.

### PR5 Social Bear integration — November 12, 2026

User authorized resolving PR5 against main and merging after validation. Retained
main's canonical searchable directory and all current House toolbar controls;
registered Social Bear as one fictional experience with its exact HTML mapping,
while preserving bar entry and safe household return context. The bar remains
independent browser-local authored gameplay; no household/city model coupling.
Acceptance: both bar paths/assets and existing House route work, directory finds
exactly one Social Bear, purchases/conversation/group replies persist after reload,
and 390px/320px layouts remain usable with the graphical fallback.

Validation:32 Node bar gameplay/save tests and15 Bun server/local-journey/registry/
HTML navigation tests passed (228 assertions), plus real-server Chromium smoke. Smoke checks six normal
routes, six guests/three groups, two separate group reactions, spend/dialogue
persistence, safe household return and no horizontal overflow at390px/320px.
WebGL was deliberately disabled for fallback verification; native GPU visuals
were not reverified. No deployment or Symphony mutation. Hosted CI gates merge.

### PR278 homepage entry integration — November 12, 2026

Integrated original head c2bf0099341cd57f265e4bcfa10e31e8c2310038 against
sprint baseline 118aad5bcbe65ba6c5b7a16f47faa08f22adf20b. Added the guided-demo
explanation and accessible CTA description to the existing hero. Preserved the
hero heading, image and caption, optional onboarding, FAQ, timing scripts, styles,
all 52 homepage link destinations, and every directory section. The responsive
test retains its History API rate-limit emulator and complete demo/WHY journey;
its added overlap check compares direct hero blocks without double-counting the
CTA inside its enclosing paragraph. Both original implementation-plan additions
remain recorded.

Verification: the focused demo controller, performance timing, and onboarding
suite passed 16 tests and 77 assertions. Playwright discovered all three approved
responsive cases (1440px, 390px, and 320px); browser execution was unavailable in
this environment, so no new layout or screenshot acceptance is claimed. A parsed
HTML comparison confirmed the preserved destinations and byte-identical styles,
scripts, onboarding, FAQ, and hero figure. The adjacent catalog assertion in
test/world-user-fixes.test.js still reports 32 homepage carousel sections versus
33 registered experiences. The identical failure was reproduced using exact
118aad baseline inputs; this existing catalog mismatch was not changed by PR278.
No simulation, seed, runtime, gallery, or target-branch changes were made.

## SHE-227 r2 — radical ideation audit and report (2026-11-12)

Delivered analysis-only [review report](reviews/SHE-227-r2.md): 30 proposed
capabilities with all five requested fields and five defining-feature finalists.
Preserved the earlier issue-comment catalog, audited current overlap and local
SHE-223–226 commits, and distinguished designs from existing behavior. Read-only
GitHub current-main design/engine inspection succeeded; complete remote sync was
blocked by shared Git permissions and DNS. Original Claude report returned 404;
paired-experiments source was not located. These limits are explicit in the report.

Acceptance: document validator passed 30 consecutive ideas, 150 fields, five
finalists and cited local paths. Focused overlap checks initially passed 15 tests
and failed one Detective case at the default 5s timeout; that case passed alone
with a 20s limit (109 assertions, 5.66s). No runtime code or tests changed.
Whitespace checks passed. Browser checks skipped for documentation-only scope.
No new model means no ODD change; future social mechanisms require their own
ODD/contracts. Next: review the proposed Last Reversible Minute bounded rescue
experiment before authorizing implementation. No PR/commit reference yet; no
merge, deployment or production data changes.

## SHE-237 r2 — emergent storyteller design

Completed design-only slice: [25 situations and five recommendations](reviews/SHE-237-r2.md).
Audited prior SHE-238 output, SHE-49 source/evidence and merged PR #166, live
Linear issue state, current remote sprint SHA `53090035` (matches this checkout),
and newer main `fbdce9e8` integration differences. No existing 25-item SHE-237
deliverable was found. Preserved prior work; no product implementation added.

Acceptance: exactly 25 situations each specify mechanisms, trigger, recorded
state, discovery and causal replay; exactly five ranked systems have feasibility,
replayability and engagement rationale. Shared evidence contract distinguishes
existing rules from proposed extensions, synthetic inputs from results, and
Population/City/idea authorities. No fabricated customer ledger, cross-model
identity, clinical outcome or guaranteed dramatic result is assumed.

Fresh verification: seven focused Bun files passed 61 tests / 418 assertions,
zero failures (5.87s), including normal runtime/worker House actions and checkpoint
transfer, relationships, hotspots, traditions, employment, household risk and
three City recipes. Report count/field/link checks and `git diff --check` pass.
Browser checks skipped for documentation-only scope; these regressions do not
certify proposed receipt journeys. No PR/commit reference exists for this r2 yet.

Next proposed implementation slice (outside this ticket): persist/reopen one
actual dinner-to-conversation receipt through World → House. Prerequisites are a
bounded versioned evidence/save contract, exact actor/time links, retained source
records and immutable revision handling. Acceptance and failure paths are in the
report; browser action-to-receipt/reload verification is required when implemented.
Risks: evidence eviction, clock/identity mismatch and confusing helper fixtures
with integrated outcomes. The named paired-experiments source was not located;
the supplied full experiment-6 issue governs the completed design scope.

## SHE-233 r2 — Road Not Taken design review (2026-11-12)

Delivered [design and acceptance audit](reviews/SHE-233-r2.md): exactly fifteen
proposed interactions, each separating observed model events, causal evidence,
correlations and speculation. Selected #1 Empty Footprint, #6 Ripple with a Missing
Stone and #15 Receipt at the Crossroads for later functional demos, with normal
entry points, prerequisites, success/failure acceptance and explicit model boundaries.
Scope is design only; no runtime or model changes. Ownership: report and this entry.

Audited remote sprint SHA matching local HEAD 53090035, live SHE-90/SHE-37 and
merged PRs 197/127, existing architecture/correctness worker reports and current
source/tests. Both requested Linear readiness/approval labels already exist.
The separate original uploaded paired-experiments document was not located;
SHE-221 confirms child prompts are full copies and SHE-233 supplies experiment 4.

Fresh focused checks: 15 passed, 1 failed, 860 assertions across entity trail,
World causal adapter, causal reads, canonical receipt and paired-future suites.
CLI receipt test failed on local port-0 bind EADDRINUSE; in-process persisted
receipt roundtrip, full deterministic pair and missing-evidence checks passed.
Whitespace, local links, fifteen-design count and four evidence lanes checked.
Playwright skipped: documentation-only change. No package lint/typecheck scripts.
No commit/PR created. Material risks: different runs' edges cannot be combined,
unsupported identities/geography, uncalibrated rules and confusion of seed spread
with empirical probability. See report for exact evidence and demo failure gates.
Next: review the three proposed demos, then a separate implementation slice;
no functional demo implementation or usability validation is claimed here.

## SHE-231-r2 — architectural failure-family taxonomy (November 12, 2026)

Completed analysis-only slice: [review report](reviews/SHE-231-r2.md) contains
exactly 15 explicitly hypothetical failure modes spanning state synchronization,
async lifecycle, API contracts, caching, rendering, accessibility, provenance and
simulation identity. Each has a repository search and proposed regression;
shared-invariant investigations are prioritized. No product code or model rules
changed. Scope ownership is this report and this status entry only.

Prerequisites audited: source 53090035, verified identical to the current remote
sprint base through GitHub compare; existing worker output, issue comments and
PR search; SHE-108/PR246 and SHE-169/PR265 merged source boundaries. Existing
request/identity guards and recorded-history Canvas fallback are preserved and
acknowledged. Required Linear approval labels were already present.

Fresh acceptance evidence: focused demo-runtime, City worker, Future Machine
integrity, boundaries and diff suites passed 34 tests, 276 assertions, no failures
on Bun 1.4.2. Report structure and git diff whitespace checks passed. Browser
execution skipped for this documentation-only change. Limit: hypotheses are not
confirmed diagnoses; proposed regression designs remain unexecuted. Next action:
review the report and select a bounded investigation; no implementation, merge,
deployment or production changes are part of this issue.

## SHE-229 r2 — scientific skeptic critique (2026-11-12)

Analysis-only acceptance delivered in [docs/reviews/SHE-229-r2.md](reviews/SHE-229-r2.md):
20 risk hypotheses, each with concrete scenario, falsifiable test, uncertainty
visualization and practical engineering proposal, plus 5 user-run experiment
protocols grounded in existing Decision Studio/Living City controls. No product
implementation is requested or included. Existing ODD descriptions remain valid.

Audited prior local output/history, live SHE-229 and overlapping SHE-96/SHE-153,
and merged PRs #203/#175; no prior matching SHE-229 report/PR was found in the
bounded searches. Approval labels were already present. Clean isolated branch
mini/SHE-229-r2 owns only the report and this appended record. Git fetch was
blocked by shared metadata permissions; GitHub remote main was pinned at
fbdce9e8b489f2dd02acbe33c007a944ecf64e74 and five critical source blobs were
compared successfully with this checkout. Whole-tree equivalence is not claimed.

Actual verification: focused housing-model, decision-integration,
time-machine-heatmap, demo-evidence, paired-future-comparison and living-city-recipe
suites: 49 pass, 0 fail, 3425 assertions in 6 files (Bun 1.4.2). These establish
implementation behavior including normal Decision API execution/reproduction,
not external scientific validity. All five user protocols remain proposed and
unexecuted. Document checks passed: exactly 20 complete risks and 5 experiment protocols;
all relative report links resolve and both changed documents have no trailing
whitespace. `git diff --check` passed for tracked changes.
No browser behavior changed; Playwright skipped. No configured general lint or
typecheck. No merge/deployment/production mutation; commit/PR publication pending.

## SHE-45-r3 acceptance follow-up (2026-11-13)

Owned files on initially clean `mini/SHE-45-r3`: `ops/backend-load-test.mjs`,
`test/backend-load-test.test.js`, `docs/backend-load-test.md`,
`docs/reviews/SHE-45.md`, and this entry. Existing PRs #167 and #296 are merged;
SHE-42 is Done. Reused their bounded workload and disposable launcher.
Concrete gap: HTTP 200 replay previously passed without validating its content.
Require requested identity, saved-outcome verification and current seeded horizon;
test corrupt contracts and actual civic-handler/worker integration.

Acceptance evidence: 30 pass, 1 opt-in HTTP skip, 0 fail, 427 assertions in
14.28 seconds across the four focused files. Local full-server execution still
fails before listening; independent Python bind returns EPERM. No HTTP p50/p95,
error rates or server resource measurements are claimed. No model, UI, admission,
vote or merge-policy change. Full HTTP measurement acceptance remains blocked
on a host permitting loopback. [Commands and evidence](reviews/SHE-45.md).

## SHE-45-r2 — disposable local staging follow-up (2026-11-12)

Owned slice: `ops/backend-load-test.mjs`, `ops/backend-load-local.mjs`,
`test/backend-load-test.test.js`, one listener-host option in `server.js`,
`docs/backend-load-test.md`, this entry, and `docs/reviews/SHE-45-r2.md`.
Initial worktree was clean on `mini/SHE-45-r2`; prior merged PR #167 supplies
most behavior. SHE-42 is Done and its worker bounds remain covered by tests.

Acceptance: run the existing representative recipe through a real loopback
`server.js` with disposable stores, retaining source data/version/seed semantics;
record per-class p50/p95/error rates and saturation limits. Implemented explicit
loopback target validation and a disposable full-server launcher. No model rules
or provenance contracts changed. Risk: listener permission can block HTTP evidence;
local tiny samples cannot establish deployment capacity.

Verification: 29 passed, 1 opt-in HTTP test skipped, 0 failed, 377 assertions;
`git diff --check` passed. Full-server command attempted but Bun cannot listen;
independent Python bind confirms EPERM. HTTP latency/error/saturation measurements
remain unverified. See [exact evidence and next action](reviews/SHE-45-r2.md).
No browser behavior changed, so Playwright/screenshots are inapplicable. No merge,
deployment, production load or data changes. No new PR/commit created because
shared Git metadata is outside writable roots; host publication remains pending.

## SHE-167-r2 — ordinary-entry deferred Population allocation

Next slice: ordinary World opens the existing legacy exploration shell without
a Population worker; the toolbar starts the unchanged dense model. Explicit
`living=1` and saved checkpoint restoration retain their entry semantics.
Prerequisites: existing mount/start lifecycle and SHE-141 count contract.
Acceptance: ordinary route has no Population runtime/worker before toolbar input;
activation retains seed 42, configured 10,000 residents and bounded render sample.
Risks: ordinary visits now start in legacy mode; no selected million-resident
backend or measured free-memory API exists. Do not change population using
`deviceMemory`, weights or a synthetic cohort substitute. Browser evidence and
final status are recorded in docs/reviews/SHE-167-r2.md.

Delivered r2: disabled ordinary-entry auto-activation; explicit Living links and
saved restoration preserved. Updated ordinary-entry benchmark and added two
browser cases (activation and injected worker failure). Verification: 40 tests /
607 assertions pass; browser build passes with server vendor imports external;
two browser cases discovered, not executed. Fresh server EADDRINUSE and engine
availability failures prevented measurements. Review candidate remains partial;
full receipt and next acceptance work: [SHE-167-r2](reviews/SHE-167-r2.md).

## SHE-171 r2 — acceptance follow-up (review candidate)

Owned slice on clean `mini/SHE-171-r2`: existing runner provenance, focused
CLI acceptance tests, manual workflow, model inventory/ODD and issue report.
Reuse PR192's kernel and rendering workload; no new model or production adapter.
Prerequisites inspected: SHE-141 count contract and SHE-142 scalar oracle; their
bounded fixtures intentionally remain separate. Remote sprint runner was read
through GitHub and matches this checkout; shell fetch is permission/network blocked.
Next tasks: retain runner identity even on launch failure; exercise the real CLI
matrix and missing-browser failure; describe the existing synthetic model.
Acceptance requires nine complete records, phase-specific counts/timings, replay,
metadata and explicit memory availability. Risk: local Chromium sandbox launch
is denied; no simulated browser result may replace actual measurements. True
process/GPU peak memory remains outside the existing sampled-JS-heap contract.

r2 delivered: top-level model/runner SHA256 provenance, subprocess missing-browser
failure coverage, opt-in nine-record CLI acceptance test wired into manual CI,
and separate seven-element ODD for the existing synthetic schedule. Focused plus
dependency tests: 24 passed, 1 opt-in skip, 2385 assertions. Explicit browser gate
was attempted and failed at Chromium launch (macOS MachPort permission denial),
not counted as acceptance. CLI failed with zero records and exit 1; sanitized
host/seed/source evidence retained in `docs/evidence/she-171-r2-launch-failure.json`.
Review candidate with actual-browser acceptance pending; full findings and next
command in `docs/reviews/SHE-171-r2.md`. No production capacity claim authorized.

## SHE-267 — neighborhood stage and recorded divergence

Slice in progress: retain City projections, metrics, recorded floor heights and
existing synchronized director; add muted stage-owned neighborhood architecture,
streets and trees using World geometry, and a receipt-validated construction burst
and ripple. Scenery must never enter inventory, picks, diffs or metrics. Verify
actual seed-42 Month-16 receipt, missing/forged receipts, replay deduplication,
reduced motion, disposal and normal route where browser setup permits.
Remote main scene inspected through GitHub; no SHE-267 PR found. Local Git fetch
is blocked by read-only shared Git metadata; shell remote DNS is unavailable.
No production changes. Single worker owns scene module, integration and tests.

Implemented slice: World architecture generator reused for native schematic
inventory and muted decorative neighbors, streets, sidewalks and trees. Context
is separate from inventory/picks/metrics. Exact recorded completion ID gates the
burst and director dolly; shared camera and particles preserve synchronized arms.
Existing recorded floors and geography disclaimer retained. See
[checked work record](reviews/SHE-267.md) for source and remote audit evidence.
49 tests pass, 1 browser-gated skip, 1608 assertions; browser bundle succeeds.
Playwright server binding failed on 39931 and 41967 before browser execution.
Visual acceptance remains pending; next is the added SHE-267 normal-route test
and guided normal/reduced-motion review on a host able to bind the server.
Canvas retains its low-fidelity view; optional wipe not included. No model change,
merge, deployment or production data change.

## SHE-264 — ground wish construction action (November 12, 2026)

Audit: isolated `mini/SHE-264`, clean initial worktree, base `53090035`.
Remote main inspected through GitHub (`fbdce9e8`); building bridge matches this
checkout. Prior PR search found no implementation for this issue. Existing
Decision housing lifecycle, approval, occupancy and recorded rendering are reused.
Next slice: ground right-click/long-press wish bubble, explicit parsed review,
onboarding entry, selected-project before/after wireframe and project World Diff.
Acceptance: gestures never approve; request uses selected world coordinates;
invalid placement stays rejected; recorded monthly progress and entity IDs remain
consistent across inspector/diff. Risk: housing is an aggregate model, with no
resident identity mapping to live World people. Do not invent move-in agents,
zoning decisions, utility checks or cross-model identities. Existing recorded
occupied units are the supported move-in measure. Verification/status follows.

SHE-264 actual status: ground-wish gesture, shared explicit review, onboarding
entry, recorded scaffold, automatic construction playback, project-ID World Diff
and selected-project ghost implemented. 76 building/gesture/checkpoint tests pass
(1,055 assertions); 8 onboarding tests pass (32 assertions); whitespace passes.
Playwright journey discovers but cannot start local server (`EADDRINUSE` on
3194/43827); browser and mobile visual acceptance remain open. Individual resident
move-in is unsupported by the current cross-model identity contracts; aggregate
recorded occupied homes are exposed honestly. Full evidence and remaining work:
`docs/reviews/SHE-264.md`. No merge/deploy/production action or commit/PR.

## SHE-261 — current commuting residents, review increment (2026-11-12)

Audit: merged SHE-155 provides distance LOD and bounded worker sampling;
SHE-156 is a prerequisite audit, not delivered completed-trip ribbons. Population
behavior commits straight-line endpoint travel and no shared fleet identity.
No architecture.md exists. Reviewed model.js, behavior.js, generator.js,
renderer.js, visible-sample.js, world-view.js, runtime.js, render-lod.js,
docs/models/population.md and DATA_FORMATS.md against executable behavior.

Implemented slice through normal /world Living City: expose current committed
trip metadata; retain moving travelers at default cluster distance; instantiate
car and bus/rail passenger shapes nearby; show synthetic name, purpose and planned
trip time on hover; select/follow on an unhandled click. Preserve command-menu
interception and manual-pan cancellation. Bound display to 500 sampled residents;
keep draw counts separate from population/represented totals. Tests cover real
seed-42 replay, null/finished trips, metadata/coordinate equality, 500 markers,
default-distance count reconciliation, pause, reset and disposal.

Acceptance remains partial: no street-following route model, shared bus identity,
completed-trip flow ribbons, Canvas crowd fallback or verified mid-tier 60fps.
These require a route/fleet authority and SHE-156's versioned ledger rather than
invented renderer paths. Existing >=900m heat and unsupported-WebGPU notice remain.
No model rules, random draws or checkpoint state changed. No merge/deployment.

Verification: focused 34 tests/338 assertions passed before the final default-LOD
regression; subsequent renderer/trip/LOD selection passed 19 tests/138 assertions.
Playwright normal /world acceptance was attempted with
`bunx --no-install playwright test --config test/population-trips.browser.config.mjs`;
server startup failed EADDRINUSE on 39961 before browser launch. No browser pixels,
hover/click observation, rush-hour recording or GPU FPS measurement is claimed.
Next: run the committed browser journey on a bind-capable host, measure actual
500-visible-agent frame timing on target devices, then implement versioned routed
trip/fleet state and completed-trip ribbons with their own model contracts.

Final verification: the five-file model/trip/LOD/view/sample suite passed 35 tests,
343 assertions, zero failures. The added analysis-layer counter regression then
passed in the trip suite (4 tests, 61 assertions). `git diff --check` passed.
A second Playwright attempt on port 39962 also failed EADDRINUSE at server
startup. Broader checkpoint-suite execution was interrupted after two passing
codec/model tests when subsequent work stopped progressing; the complete
checkpoint suite is not claimed passed. No repository lint/type-check scripts
are defined in package.json. Rendering checks exercise Three.js CPU objects,
not actual GPU frame time or device performance.

## SHE-268 postcard place picker — active slice

Replace the explorer dock's first action with a full-screen, accessible picker:
six authored illustrated presets, one-tap selection after opening, deterministic
URL seeds, approximate pin map, existing address search, explicit geolocation
consent and precise-coordinate disclosure. Reuse renderer navigation via a fresh
URL; never carry saved-run identity to a new place. Animate the 3D arrival with
reduced-motion support. Verify URL contracts and normal `/world` entry points.
Risks: map search requires its upstream service; map geometry is live and a seed
alone does not freeze OSM inputs. Postcard hooks are authored prompts, not results.

SHE-268 delivered the integrated picker, URL run-seed wiring in both renderers,
3D arrival, coordinate disclosure and effective activity-seed provenance.
[Review and acceptance evidence](reviews/SHE-268.md) records exact source paths,
remote-main audit and ODD comparison. Focused checks: 25 tests / 215 assertions
passed; diff whitespace passed. Three browser tests are committed but unexecuted:
the normal server failed to bind two attempted ports (`EADDRINUSE`). Browser
acceptance and visual flight/mobile review remain pending on a runnable host.
No commit/PR, merge, deployment or production changes.

## SHE-259 — bounded weekly cycle lifecycle (2026-11-12)

Audit: current sprint head 53090035 already has separate weekly and ten-year
workers and a cancellable detached quick demo. The normal Run cycle path ignored
worker progress fractions, native errors and unreadable messages, and had no
cancellation or deadline. The adjacent Idle label belongs to the ten-year run.
A long first branch therefore looked stalled; this audit does not establish the
specific cause or duration of the reported playtest stall.

Implemented slice: normal Run cycle and subsequent cycles expose weekly
Running/Completed/Failed/Cancelled status, actual worker fraction, Cancel, native
error handling and a 120-second total wall-clock deadline. Cancellation/failure
terminates the worker, rejects pending guided/demo waiters, restores the run
button and offers retry. Ignore late events from retired workers. Explicitly
label ten-year status/history. No model, town size, seed, rules, sampling or
seven-day horizon changes. Legacy ODD (`docs/models/legacy.md`) checked against
`world/cycle.worker.js` and the presentation changes in `world/render.js`;
its model schedule and assumptions remain accurate.

Acceptance evidence: lifecycle tests exercise progress, cancellation, stale
messages/errors, native load errors, unreadable messages, timeout and retry:
2 passed / 22 assertions. Adjacent guide/playback/repeat/replay/feedback suite:
22 passed, 1 failed (114 assertions, 10.18s). Failure is the untouched feedback
fixture looking for a missing “Change one thing” heading; neither its test nor
implementation was changed here. The initial guide/playback selection passed
9/9 (41 assertions). Diff whitespace check passed.

Playwright journey now selects Balanced through the real plan select and Run
cycle button, requires results within 90 seconds on explicitly synthetic geometry
with 16 residents, records elapsed time, and tests cancel/load-failure/retry.
Attempted `bunx --no-install playwright test --config test/first-run.browser.config.js`:
server failed before browser launch with EADDRINUSE on 39889. A second server
attempt on 41983 also failed EADDRINUSE. No browser timing, results or screenshots
are claimed. Normal default-population performance, browser layout and the
90-second journey remain unverified; run this suite on a bind-capable host.
No merge or deployment. No lint/typecheck scripts exist in package.json.

Final focused rerun: 11 passed, 0 failed, 63 assertions (9ms). Browser-target
render bundle passed (356 modules); `/vendor/*` and Three.js externalized to
match served imports. No browser execution is implied by this compile check.

## SHE-263 — World HUD collisions

Audit: merged SHE-122 pack (`test/e2e/small-screen-game.e2e.js`) covers
Future Machine only. Connected-universe navigation already uses a collapsed
handle in this checkout. Main World still independently positions the build
panel, shortcuts, graphics and scrapbook controls; explorer has no completion
state. No model rules or simulation data change.

Slice: reserve HUD lanes, put asynchronous display launchers in one scrolling
flow toolbar, collapse explorer after both numbered actions, expose minimize
and dismiss, and retain controls scroll after Storm. At narrow widths expanded
build and World controls are mutually exclusive. Acceptance: hit testing and
screenshots at 320/390/768/1280/1520/1920, expanded and collapsed explorer,
dismissal, and unchanged Storm scroll offset. Risk: optional renderer modules
mount late; observe child additions so their launchers join the same toolbar.

Local verification: 19 tests / 94 assertions pass across first-run repairs,
visual panels and quick-demo controller; explorer browser bundle builds;
`git diff --check` passes. Expanded feedback suite: 25 pass / 1 fail, existing
`world-visual-feedback.test.js` repeat-prompt lookup expects an h3 absent from
unchanged `world/first-run-guide.js`. Six new World HUD browser tests discover
successfully. Execution blocked before Chromium: Bun EADDRINUSE on both 39978
and 48763, including the real Playwright webServer attempt. No measured HUD
rectangles, screenshots, approved baselines or collision-free viewport claim.
The next required action is a browser run on a host permitting local listen,
visual baseline review, and regression comparison; fix any observed layout
failures before acceptance. No merge, deployment or simulation changes.

## SHE-260 — model-backed World storm (implemented; browser acceptance pending)

Audit: merged renderer has procedural sky/rain, but classic Storm only sets
boolean exposure and teleports residents; there is no depth or recovery clock.
This slice owns classic `/world` Storm, its committed policy/building/person state,
and a bounded renderer layer. Living switches through the existing classic action
entry point. Prerequisites: ranked exposure, normal walking graph, complete legacy
checkpoint and renderer quality tiers already exist.

Acceptance: positive-depth surfaces identify only committed flooded IDs; onset,
rise and recession follow model minutes; evacuations use real resident walking;
checkpoint continuation is deterministic; LOW caps rain and reduced motion removes
rain/cloud drift/lightning/thunder. Verify ordinary Storm entry in Chromium and
report measured frame costs separately from unavailable hardware certification.
Risks: synthetic depth envelope is gameplay, not hydraulic calibration; footprints
are not cadastral street/lot boundaries, so water must remain inside declared
model-recorded surface polygons. The implemented synthetic2m footprint apron
is suppressed near other footprints; it supplies illustrative lot water, not
street-wide hydraulic coverage. No capacity or shelter reachability model is introduced. Sound defaults
muted and requires an explicit user gesture. No deployment or merge.


Delivered through the normal Storm action: captured intensity input; versioned,
checkpointed flooded IDs, depth envelope and evacuation records; actual road
walking instead of teleportation; recovery over180 model minutes; dark sky,
cloud drift, bounded rain, one merged water draw, onset flash and opt-in thunder.
Reduced motion suppresses rain/drift/flash/thunder. Unchanged water skips buffer
uploads. A later user movement command records interrupted evacuation rather
than falsely claiming safe arrival. Existing complete checkpoint authority owns
all new fields, without a second renderer simulation.

Verification (2026-11-12):
-52 tests /702 assertions passed across parcel-storm, person-commands, legacy
 checkpoint, playback, weather, render-performance, procedural-geometry and
 building-renderer suites. Includes exact restored storm continuation, positive
 depth/ID mapping, zero intensity, no destination, recovery, model surface
 polygon use and paused upload suppression.
- Browser bundle passed:369 modules, with existing `/vendor/*` URLs external.
 `git diff --check` passed. No lint/type scripts are declared in package.json.
- Both focused Playwright cases discover successfully. Execution is blocked at
 server startup: Bun reported EADDRINUSE for3199; a separate32991 attempt failed
 identically. No screenshot, audible-thunder, WebGL/WebGPU visual acceptance or
 browser/GPU frame-budget result is claimed.
- Actual isolated Bun CPU update microbenchmark:517 source parcels,73 flooded,
 300 warmups +600 samples, LOW300 streaks, p50=.0254ms, p95=.0320ms,
 p99=.0354ms. Reduced motion:0 streaks, p95=.0245ms. This excludes browser,
 simulation, render submission and GPU execution; it is not a60FPS certificate.
- Adjacent world-visual-feedback suite:6 pass /1 failure in pre-existing
 `Change one thing` prompt lookup. Same failure reproduced with exact HEAD
 first-run-guide.js; neither guide nor test was changed. Broad model-validation
 script was interrupted before results (unrelated housing/city diagnostic scope);
 no pass is claimed for it.

Review: compared docs/models/legacy.md and inventory with world/sim.js,
world/weather/parcel-storm.js, world/person-commands.js, legacy-checkpoint.js,
render.js and render/environment/{storm-effects,storm-cue,sky}. Existing ODD
seven elements still describe the host; added the storm submodel's coefficients,
ordering, state ownership, geometry assumption, versions, reproduction and limits.
No new independent social model. Risks remaining: no hydraulic street coverage,
no capacity/reachability/return-home model; visual apron is synthetic and can be
suppressed by dense footprints. Next action: run focused browser config in a
bind-capable environment, inspect screenshots/audio and benchmark LOW on actual
target hardware before acceptance. No merge, deployment or PR was performed.

## SHE-262 — simulation-clock lighting (2026-11-12)

Slice: default World lighting follows its active Population/legacy minute; expose
full-population building home counts, bind façades by exact building ID, add dusk
street/vehicle lamps and Canvas sky tint. Preserve manual visual overrides.
Prerequisites audited: render host, facade/sky/details, Population snapshot and
House home predicate. No independent work is delegated (single-worker issue).
Acceptance: deterministic full-model counts independent of visible sampling;
night/home fraction and office hours; dawn/dusk/weekend colors; Canvas sky;
normal-entry browser smoke plus focused model/renderer regressions.
Risks: synthetic home anchors can be nonresidential; unmapped buildings must
remain dark. Shader window selection approximates a fraction with finite cells.
Remote audit: GitHub main city-renderer still pins 14:00; no SHE-262 PR found.
Git fetch is blocked by shared-git permissions and shell DNS; preserve this base.

SHE-262 implementation status: implemented and locally verified; browser visual
acceptance remains blocked by sandbox socket permissions. Full-population
snapshot counts, exact façade identity, office gating, authored solar/weekend
lighting, street/headlights and Canvas background are integrated. Review and
exact commands/results: [SHE-262 acceptance evidence](reviews/SHE-262.md).
Focused suite: 35 passed at explicit 15s timeout; final changed tests 8 passed /
82 assertions. Browser bundle: 357 modules; diff check clean. Broader checkpoint
suite has an unresolved 30s timeout; broad City/housing validation was stopped
at 30/106 replay cases (no full pass claimed). Next action: run renderer browser
suite and investigate checkpoint timeout on a host permitting local servers.
No commit/PR, merge, deployment or production data change performed.

## SHE-266 — synthetic Future Machine families (2026-11-12)

Next integrated slice: deterministic seed/City-ID identities and procedural faces,
paired burden cards linked to exact monthly household/unit records, fixed ordering
by maximum matched monthly burden difference, and follow highlights resolved from
each arm's occupied unit to its recorded building on the shared playback clock.
Own only family presentation, coordinator wiring, scene selection, focused tests
and documentation in clean isolated `mini/SHE-266`. No independent worker tasks;
one worker as authorized. Existing raw household inspector remains available.
Prerequisites: existing paired history, reciprocal occupancy and building IDs.
Acceptance: identity replay stability, no invented job or missing observations,
exact record links, different arm buildings after moves, existing app tests and
browser smoke. Risks: synthetic identity is presentation only; absent building
mappings must remain unhighlighted; one modeled pair is not empirical causality.
Remote main audited through GitHub (fbdce9e8); local fetch blocked by shared Git
metadata permissions. No SHE-266 PR found. Labels already present in Linear.

SHE-266 implemented: versioned seeded names/faces; exact-record paired burden,
home and moved/stayed cards; monthly record-linked bars; fixed burden-difference
ranking; follow highlights separately resolved in both scene arms and updated by
the existing clock. Main UI and secondary timeline picker use synthetic names.
No model rules or state generation changed. See `docs/reviews/SHE-266.md` for
source contracts, remote-main audit, scope limits and next action.
Verification: 68 passed / 1 browser opt-in skipped / 0 failed, 929 assertions;
browser entry bundle passed. Playwright attempted twice, blocked before launch
by Bun listen EADDRINUSE on ports 39884 and 41967. Visual/GPU/mobile acceptance
remains unverified. Current remote main has unrelated newer coordinator/scene
fixes to preserve during integration; fetch/rebase/commit are unavailable because
shared Git metadata is outside writable roots. No merge or deployment.

## SHE-182 revision 3 — consolidate publication acceptance

Next slice: remove the duplicate automatic Linear completion workflow and route
its legacy CLI through the existing merged-evidence helper. Require a complete
GitHub event with same-repository/merged-only gates, preserve revision mapping,
and test the CLI with offline transport. SHE-180 remains queue/lease owner;
no runtime changes. Acceptance: neither publication path can mark an issue Done,
ineligible events make no requests, uncertain writes stop with sanitized errors.
Host resource containment and sustained external runtime recovery remain pending.

Revision3 delivered: retired duplicate automatic-close workflow; legacy CLI
now links evidence through the checked same-repository merged-event helper.
Added fail-closed missing repository validation and subprocess CLI regressions;
updated Mini README and workflow test path triggers. See
[checkpoint and remaining blockers](reviews/SHE-182.md). Actual checks: Node7/7,
ops21/21; host299/301 (unchanged supervisor exact-label validation error and
resource boundary failure); Mini54/55 (unchanged server startup failure).
Node syntax and diff checks pass. No repository-wide typecheck/lint script;
no browser change, Playwright skipped. Hard host containment, live retry/recovery
and hosted secret/sync verification remain pending. Automatic merging stays
held by literal false; no quorum, voting/auth/check change, external publication,
merge, deployment or production operation. No commit or PR created this turn.

## SHE-239 — tournament director specification (2026-11-13)

Delivered analysis-only `docs/reviews/SHE-239.md` at baseline `5fdb9683`: seven
missions, each with three competing hypothesis designs and a decisive experiment;
six-dimension weighted rubric, common Codex results template, reproducibility and
failure gates. Audited prior SHE-240 output, clean older SHE-239 worktree, live
SHE-77/131/161/169 statuses and merged PR metadata. Both readiness labels already
exist. Prior disk-full checkout failure is preserved; fresh worktree used.
No product/model behavior changed. Focused existing foundation checks: 24 pass,
1 opt-in browser skip, 0 fail, 654 assertions. Current City 1.1.0 receipt and exact
commands are recorded in the report; historical 1.0.0 hashes are not substituted.
Specification acceptance is complete; no candidate is implemented or declared a
winner. Next: choose and preregister a bounded experiment, recheck ownership and
prerequisites, then gather actual normal-entry/user/device evidence. Voting,
auth/check and merge policy remain unchanged; no release action authorized.

### SHE-263 completion follow-up — 2026-11-13

Audited PR #284, original commit `0591eb6e`, and reconciliation `7958ee12`
against current source. Prior layout lanes, pill/dismiss controls and Storm
scroll restoration remain present; prior acceptance was explicitly blocked.
The postcard picker now navigates, exposing a remaining integration gap: the
new page forgot step one. Reuse its existing `arrival=1` marker for local UI
progress so choosing policy after arrival collapses the explorer. No simulation,
identity, seed, auth, vote, or merge-policy contract changes.

Verification slice: unit-test distinct-step/order/idempotence and actual postcard
URL arrival; correct the browser journey to close its modal before policy;
remove full-viewport screenshot masking; check five target points, all utility
links/summaries, and expanded/collapsed/dismissed screenshots at the original six
sizes. Add arrival/reopen/minimize/dismiss browser coverage. Tests use real
`/world` with `demo=1`, 16 residents and run seed 263; this is a bounded synthetic
layout fixture, not default-population performance evidence.

Evidence: 25 tests pass / 148 assertions across five focused files; browser
bundle builds (3 modules); seven World HUD browser tests discover; whitespace
check passes. Playwright server startup still fails with EADDRINUSE on 39978 and
48963 before any browser runs. No screenshot, measured target bounds, Storm
scroll measurement or approved baseline was produced. No lint/typecheck script
is configured. Full viewport and Storm acceptance remains pending the documented
browser command and review of 18 World baseline images on a bind-capable host.
See `docs/reviews/SHE-263.md` for reproduction and preserved policy. No remote
messages, merge, deployment or production changes.

## SHE-171 r3 — failure coverage and retained evidence (review candidate)

Clean isolated `mini/SHE-171-r3` at `5fdb9683`; prior PR192/294 and current
source/CI audited, SHE-141/142 confirmed Done. Small owned slice: CLI coverage
matrix, its subprocess acceptance assertions, manual workflow artifact path,
benchmark docs and issue-specific review/evidence. Preserve synthetic model,
ODD, hashes and prior history. Acceptance requires all nine actual browser
records; risk remains macOS launch denial and unavailable total peak memory.

Delivered explicit unverified size/phase coverage on failure and workflow CLI
execution after successful browser setup even when its preceding browser test
fails. Focused/dependency checks: 24 pass, 1 opt-in skip, 2392 assertions. Enabled
browser gate: 1 pass/1 fail at MachPort permission denial. Actual CLI seed42,
3 steps, 10k/100k/1M: exit1, zero measurements, nine unverified combinations.
Evidence and exact commands: [SHE-171 review](reviews/SHE-171.md),
[failed-run JSON](evidence/she-171-r3-launch-failure.json). No configured JS
lint/typecheck; diff check passed. Browser-capable nine-record acceptance run
remains next action. No merge/deploy/production or public performance claim;
existing disabled automatic merge policy preserved.
