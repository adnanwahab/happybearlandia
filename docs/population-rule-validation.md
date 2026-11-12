# Population rule validation — SHE-150

This is an internal consistency audit of Population 1.3.0, not empirical
validation of households or a million-agent model. Read-only adapter
`population-invariants.v1` uses the full committed state, independent of visible
sampling. It does not change runtime rules. The Population model and rules version
is `POPULATION_VERSION`; the adapter rejects other versions.

## Evidence and assumptions

| Domain | Source / assumption | Audit and limits |
| --- | --- | --- |
| Demographics | `world/population/generator.js`, seeded synthetic household sizes, age bands and baseline income | Unique financial membership, full population, represented weight and income-cohort totals. Not observed joint distributions. |
| Travel | `world/population/behavior.js`, district straight-line travel and synthetic mode utility | Finite positions/times, feasible recorded mode choices, normalized probabilities, departures = completed + cancelled + traveling, mode departures and current OD totals. No street routing claim. |
| Labor | `world/population/employment.js`, synthetic work calendars, firms, wages and leave | Independently counted employment and district job capacity. Existing employment tests exercise actual payroll; this audit does not add a balanced economy claim. |
| Housing | `world/population/generator.js` and `behavior.js`, assumed district capacity, rent and resources | Independently counted financial households within represented capacity, finite nonnegative income/rent/savings. No individual lease inventory or empirical affordability threshold. |
| Services | `world/population/generator.js` synthetic district service score; `children.js` care assumptions | Service score in [0,1]. Service demand, throughput and systemwide conservation unavailable; score bounds do not validate access adequacy. |

Observational datasets: none. [Model card](../world/population/MODEL_CARD.md)
and coefficient registry label assumptions and their calibration limits. Source
paths identify code, not external observations. Engineering bounds are not fitted
confidence intervals. Recorded simulation events are modeled evidence. This note
is interpretation; it does not add events to the run.

## Reproduce

```sh
bun test test/population-invariants.test.js test/population-model.test.js test/population-needs.test.js world/population/employment.test.js test/agent-counts.test.js
bun scripts/audit-population-rules.js > /private/tmp/she-150-audit.json
bun scripts/audit-population-rules.js 0
```

The final command must reject with nonzero status before running. Optional raw
population is an integer 1–1000, default 1000. Runs use normal model creation and
144 commits of 30 minutes (three modeled days), seeds 42/43, baseline, no transit,
no employment and 10x represented weight. Weighted care capacities are explicitly
scaled assumptions, not equivalent individual evidence. Effective configs, half-day
reports, initial state summaries and full serialized-state SHA-256 hashes are
recorded in [measured evidence](evidence/she-150-population-rules.json), alongside
machine/runtime and total wall duration including audit overhead. Wall timing is
not part of deterministic identity and is not a production throughput benchmark.

Total variation distance compares normalized income, activity, mode and cumulative trip-departure histograms
at start/end and against the seed-matched baseline. Zero means matching proportions;
one means disjoint support; no exposure returns null. Income bins count households;
activity/mode bins count current residents. Mode stocks include `none` and differ
from cumulative travel departures. Daily stability means tested invariants hold at
each commit, not that distributions must remain stationary. No data-supported drift
threshold exists here. Configuration differences are synthetic model responses,
not causal claims about real residents.

Mutation tests inject invalid membership, missing totals, job/housing capacity
violations, NaN resources, out-of-range needs/services, infeasible choices, future
events and unbalanced travel. Repeated seeded futures compare full serialized state,
not just matching aggregate totals. Evidence buffers are bounded: only retained
events/choices can be checked. No GPU backend, scalar oracle, monthly City, Decision
Studio or browser path is validated. SHE-142's oracle is absent from this base;
its later integration requires explicit unit, identity, clock and rule mappings.

The sweep supplies a recorded synthetic 30-building grid (`i*180`, `i%4*250`
in local meters), so travel is exercised rather than measuring the default
single-location fixture. Supplied-coordinate provenance in model internals does
not turn these invented coordinates into observed geography. Half-day snapshots
include daytime stocks; cumulative mode departures retain overnight travel evidence.

During audit development, a no-feasible-route trace was initially treated as an
invalid normalized choice. Inspection of `world/behavior/core/choice.js` and the
runtime rejection branch showed the correct contract: null chosen mode, all
probabilities zero, and `NO_FEASIBLE_ALTERNATIVE`. The auditor now accepts that
explicit rejection and tests that assigning probability to an unavailable option
still fails. This was an auditor correction, not a production rule defect.

## Measured result (2026-11-12)

Eight 1,000-record, three-day runs passed every committed-step check. A second
execution matched all deterministic reports and eight full-state hashes exactly.
The recorded sweep took 19.449 seconds including audit overhead on Apple M4,
Darwin arm64, Bun 1.4.2 (machine details in the JSON). Removing transit changed
cumulative trip-mode proportions by total variation 0.116103 (seed 42) and
0.117005 (seed 43); the represented-weight scenario matched baseline raw travel
proportions for these inputs. These are bounded synthetic results, not validation
against observations. Day-end activity stocks can coincide despite different
travel flows; use the half-day reports and cumulative departures together.

The initial related 45-test suite passed. After adding the explicit rejected-choice
regression, the default-limit run had 45 passes and one existing eight-day Population
test timeout at 5.989 seconds against Bun's 5-second limit. No assertion or runtime
rule was changed to address timing. The same suite is rerun with `--timeout 15000`.
Invalid CLI population 0 rejected with exit 1. Root package has no general lint or
type-check script; no browser behavior changed, so Playwright is inapplicable.

Final rerun with `--timeout 15000`: **46 passed, 0 failed, 1180 assertions**, 13.12
seconds. The unchanged eight-day test completed in 5.649 seconds. The recorded
JSON passed a separate parse, eight-run success and nonzero-travel exposure check;
`git diff --check` passed.
