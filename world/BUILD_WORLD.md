# Build Something + Edit World

The physical-building demo and decision experiment studio share the same proposal,
approval, revision, model and stored-run contracts. Use the existing `/world` for
placement in the town, or `/world/decision.html` for scenario comparisons and a
decision brief. This feature does not create another application or repository.

## Build and inspect a project

1. Open **+ Build something · Edit world** in `/world`, or **+ Propose building**
   in the decision studio. Select the intended scenario.
2. Configure units, affordable units, floors, footprint, location, estimated total
   development cost, public subsidy and permit/build durations. Coordinates are
   meters, rotation is radians, and footprint is explicitly square feet.
3. Choose **Place in 3D world**. Move the ghost, click to place, press **R** to
   rotate, **+ / −** to resize, or **Esc** to cancel. Typing fields retain normal
   keyboard behavior. Ghost placement is a draft, not project approval.
4. Review the proposal/diff and placement warnings. Existing building footprints,
   rotations, optional district polygons and bounds are checked; this is not
   legal, zoning, engineering, parcel-ownership or permitting advice.
5. Explicitly approve the reviewed change. Only approval creates a draft revision
   and changes scenario JSON. Reject/cancel must preserve the original input.
6. Simulate approved projects. Scrub the monthly construction timeline or select
   another future. Permits, foundations, structure, floors, completion and occupancy
   come from the selected run's stored monthly states, not elapsed wall-clock time.
7. Open the exact experiment in the studio. The trust panel and **Decision brief /
   print** distinguish systemic policy from named projects and display delivery,
   timing, actual spending, capacity-delay traces and revision provenance.

A proposed or cancelled input project is inert. Approved interventions consume
shared monthly construction capacity. Housing stock receives delivered units once
on completion; occupancy follows completion. The lifecycle stores public/private
spending separately. Incomplete and cancelled futures retain sunk spending.

## Edit World with explicit approval

Enter one bounded change, for example:

```text
Build a 300-unit residential tower here with 25% affordable housing.
```

The no-key **Demo** option is a deterministic local parser, not an AI model. It
supports a narrow set of single requests and honestly rejects unsupported or
ambiguous instructions. Live providers are optional and require server-side
configuration; all providers return the same validated `world-edit.v1` proposal.

Inspect **Preview edit**, the normalized operations, changed values, inferred
cost/timing assumptions, warnings and the rerun classification. Reject leaves the
input unchanged. **Approve & apply** calls the revision writer with explicit
`approval: true`; a provider response cannot supply user approval. Simulation
changes stale the draft's results and require a new experiment. Visual-only edits
change appearance, not model values or seeds. A success criterion is an explicit
final-metric threshold; it is reported without inventing a probability threshold.

Allowlisted edits include parameters, uncertainty, scenario creation/duplication,
known stress presets, building add/update/remove/move, visual settings, and success
criteria. Arbitrary paths, filesystem writes, equations, executable code, new
metrics, causal-rule editing, evidence changes and other infrastructure are not
available. Model-code editing remains disabled, including in developer-facing
flows; it must not be presented as a working feature.

The housing 1.1.0 model can represent explicitly structured
`scheduledStress: [{presetId, startMonth}]` inputs. Month zero is the initial state;
`startMonth: 24` is the start of the third modeled year. The demo parser recognizes a single known stress request such as **Add a recession
beginning in Year 3** and proposes `{presetId: "recession", startMonth: 24}`. The
scheduled onset is visible in the reviewed operation and stored scenario. A
provider/version that cannot model a timed request must reject it, never silently
substitute a shock at month zero.

## History, sharing and reproduction

Approved edits append immutable revisions with id, parent, prompt, provider/model,
normalized operations, approval time and SHA-256 proposal hash. Undo and restore
append a new revision instead of rewriting history. Stale-base validation prevents
applying a proposal against a different input revision. Provider provenance is not
evidence that the inferred assumption is correct; the report does not independently
verify cryptographic hashes.

Completed experiments retain their original inputs, world revision, version and
stored construction states. Subsequent approvals create drafts/new experiments.
Share the exact experiment's read-only URL to retain its original scenario and
revision. Export the server manifest or **Reproduce experiment** from the trust
panel. Trust exports include approved inputs, edit history, actual run seeds,
sampled parameters, stored project traces and project metrics. Replay uses those
stored states; numerical reproduction resolves the original model version and
passes its approved scenario projects and scheduled stress to the simulator.

For an approved appearance-only change to a completed result,
`POST /api/decision-experiments/:id/visual-revision` creates a **new completed
record** after checking exact mathematical-input identity and an extension of the
approved visual-only audit chain. It reuses immutable simulation rows; it does not
rerun the model or modify the source experiment. `metadata.resultsSourceExperimentId`
records the source, and each reused run retains source provenance. Share the new
record to capture its appearance and approved history. The trust panel, brief and
manifest explicitly disclose reused results instead of implying a fresh execution.
Simulation changes cannot use this shortcut; they require a new run.

Housing **1.1.0** models projects and timed stress. The model resolver retains
**1.0.0** for old manifests and rejects project/timed-stress inputs on that version;
it must never reinterpret an old completed record using the new equations.
Project RNG streams depend on seed and project id, separate from systemic model
randomness. A properly matched scenario with all projects removed returns to its
no-project counterpart under common random numbers. Separate experiments must
match parameters, uncertainty, stress, horizon, model version and seeds before
attributing a difference to a project edit. A renderer-only change cannot provide
that evidence.

## How project analysis is calculated

`buildings/project-analysis.js` is pure and reads stored successful runs only.
Legacy records without project traces show **Unavailable**, not zero construction.
Initially proposed/pre-cancelled projects are excluded from active delivery-risk
denominators. Failed numerical runs are excluded and reported separately by the
experiment; absence of a successful trace is not project cancellation.

* Completion/cancellation frequency is measured by the recorded horizon among
  initially active projects with traces. Report its denominator and missing traces.
* Completion-month P10/median/P90 condition on completing. Unresolved projects are
  right-censored; cancelled projects are not assigned an invented finish date.
  Always read timing together with completion share.
* Direct units are final stored `completedUnits`; affordable and occupied units
  are separate recorded state fields. Planned units are not delivered units.
* Estimated total development cost and authorized subsidy are input assumptions.
  Actual public, private and total spending are distinct final cumulative state
  fields, including sunk spending. Missing observed spending is not replaced with
  an estimate. Values are USD, not billions, unless a model explicitly says so.
* Capacity bottleneck prevalence counts unique traced futures with recorded
  capacity-delay events or positive capacity shortfalls. Explanations quote actual
  events; percentages are co-occurrence frequencies, not causal contributions.
* Same-seed total housing-stock differences can be compared with observed direct
  project-unit differences. Their difference is labeled **remaining stock
  difference (descriptive residual)**. It may reflect systemic policy, capacity
  crowd-out, demolitions and other dynamics. It is not an uncomputed “indirect
  project effect” or a standalone causal counterfactual.
* Success share counts successful stored runs meeting the scenario's recorded
  `gte`/`lte` final-metric criterion. Missing metrics are excluded and disclosed;
  no criterion means no invented success share. Different scenario thresholds
  are not directly comparable.

Construction and policy behavior remain exploratory. The existing source/evidence
ledger and historical diagnostics retain their actual source dates and limitations.
The Houston ACS comparison uses overlapping published five-year estimates, not a
strict blind historical backtest. Building assumptions are not thereby empirically
calibrated. Geometry is illustrative and does not create local rent/displacement
estimates where the metropolitan model has no spatial submodel.

## Provider setup and data boundaries

See [`ai/providers.env.example`](ai/providers.env.example) for the server-only
configuration. `AI_PROVIDER=demo` makes no vendor calls. Remote adapters use
`AI_PROVIDER=openai|anthropic|gemini`, the corresponding `*_API_KEY`, and an explicit
`OPENAI_MODEL`, `ANTHROPIC_MODEL` or `GEMINI_MODEL`. Keys never belong in HTML,
client bundles, source control, manifests or reports. Provider implementation files
are server-only and blocked from static serving; browser-safe schema/validation
and revision modules are separate.

The proposal endpoint sends only bounded allowlisted scenario fields, selected
object metadata, field definitions and the user's explicit request. It does not
send journals, resident/customer records, evidence uploads, credentials or source
files. Do not paste sensitive content into the request. Live adapters are bounded
and errors must not echo credentials or upstream response bodies. Automated tests
use fixtures/mocked fetch or the explicitly local demo adapter, never paid calls.

## Acceptance matrix

This matrix identifies the check to run; it is not a claim that every workstream's
integration checks have already passed. The analysis owner verifies its focused
tests and studio bundle, while the reliability owner verifies complete journeys.

| Requirement | Verification surface |
| --- | --- |
| Enter Build Mode in `/world` and the studio | Build-world browser journey; existing-world bridge and flagship renderer |
| Place/rotate/resize ghost; Esc cancels; typing keys stay normal | Placement/renderer tests plus browser journey |
| Rotated overlap, boundaries and bounds checked | Building proposal/placement tests |
| Edit proposal before approval | World-tools browser/unit tests |
| Preview/reject are pure; only explicit approve changes input | Edit validation/revision tests and integration journey |
| Approval persists project JSON and immutable revision | Revision/contract serialization tests and manifest retrieval |
| Same seed reproduces timing and monthly replay | Housing/lifecycle tests plus replay browser journey |
| Project uses capacity, spending and delivered stock once | Housing/lifecycle accounting tests |
| Proposed/cancelled inputs have no numerical effect | Housing/lifecycle inert-project and analysis denominator tests |
| Remove projects returns common-random-number baseline | Housing deterministic removal-equality test |
| Compare with/without project without false attribution | Paired-analysis tests and scenario comparison |
| Timing/cancellation/censoring, cost separation, bottleneck traces | `bun test test/project-analysis.test.js` |
| Provider/model/prompt/date/hash and restore provenance visible | Revision tests; project analysis/brief escaping tests |
| Explicit success criterion reporting | `test/project-analysis.test.js` threshold tests |
| Configured OpenAI/Claude/Gemini return one proposal contract | Mocked provider tests; no paid calls |
| Unsupported code/equations/evidence edits fail | Edit allowlist/provider rejection tests |
| Timed requests modeled explicitly or rejected | Scheduled-stress model tests and provider/validator rejection tests |
| Visual-only edits preserve metrics/seeds; source rows remain immutable | `world-edits.test.js` visual-revision API test and build-world integration |
| Undo/restore append immutable history | Revision tests and world-history browser journey |
| Share/manifest preserve revision; completed records stay immutable | API/read-only integration and browser journey |
| Housing 1.0.0 manifests remain reproducible | Legacy resolver/reproduction tests |
| Printable brief includes projects, timing, costs, provenance, limitations | Project/report tests; browser print view |

Focused analysis checks:

```sh
bun test test/decision-analysis.test.js test/project-analysis.test.js
bun build world/decision/studio.js --target browser --external '/vendor/*' --outfile /tmp/hbl-studio-check.js
```

For the rest of the demo, see [`DECISION_DEMO.md`](DECISION_DEMO.md). Deployment and
live provider credentials are separate operational decisions, not part of approval
of a world-edit proposal.
