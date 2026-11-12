# HappyBearLandia implementation plan

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
