# SHE-152: bounded Population seed and parameter sensitivity

Measured synthetic model study; no observed human outcomes, calibrated forecast,
GPU equivalence or million-agent claim. Raw versioned rows, complete effective
configs, district context, per-run denominators, sample indices, invariant
results and source hashes are in [the evidence JSON](evidence/population-seed-ensemble.json).
The executable entry point is [run-seed-ensemble.js](../scripts/run-seed-ensemble.js),
using the production createPopulationModel/stepPopulation entry points directly.
It does not change the engine, UI, save stores or existing sensitivity panel.

## Design and interpretation

Scenario two-district-capacity-per-represented-person.v1, analysis population-seed-ensemble.v1, Population/rules
1.3.0; the actual relative-import rule closure plus CLI is pinned by
156 SHA-256 source hashes. Initial state is fresh at minute 0,
ending minute 1440 (one monotone outer step, internally subdivided by
the production scheduler). Seeds: 11, 29, 42, 73, 101, 211. Baseline uses the
normal defaults; the other arms change only rentMultiplier to 0.85 or
transitService to 2. Both districts are synthetic: centers (0,0) and (5000,0),
rents 1800/1200 USD/month, transit/services 0.7, environment 0.6, each district's
housing units and jobs equal the represented population. No empirical sources.
All remaining effective parameters, including fixed care and transport capacities,
are retained in each raw row; their defaults are assumptions, not calibration.

There are 90 completed model futures: five cases × three arms × six
seeds, plus 90 verification reruns. Case IDs are explicit person
records / represented people. One weight per person is represented/explicit.
100/100, 200/200 and 400/400 change population and district capacities together;
100/400, 200/400 and 400/400 hold represented population and district capacities
fixed while changing resolution. No aggregate cohort weight is called an explicit
person. Each arm is freshly created; no parent state is mutated.

All tables show mean [5th, 95th empirical percentile], linearly interpolated
across **six seeds**, with sample standard deviation also in JSON. These are
central 90% descriptive seed-spread intervals, **not confidence intervals for a
mean, calibrated prediction intervals or proof of robustness**. Interventions
are subtracted from the baseline with the same seed and case before summarizing.
Across sizes the seed matches the scenario, not a validated resident identity.
Seed spread combines generation and stochastic decisions; it does not identify
those two components separately. We do not pool 90 futures or all residents as
independent repetitions. Each group/contrast has requested=6, n=6, missing=0 in
this measurement. Missing trip denominators would produce null with explicit
missing counts, never a fabricated zero.

## Measured modeled outcomes

Burden is annual rent / annual household income, averaged **over people**, not
over households. Trip time is planned minutes / departed trip, not experienced
completed commute time. The JSON records actual trip and completed-trip counts
for every future; different arms can generate different trips.

| Explicit/represented | Baseline person burden | Rent −15% paired burden delta | Transit ×2 paired planned minutes/trip delta |
| --- | --- | --- | --- |
| 100/100 | 0.2922 [0.2641, 0.3204] | -0.0438 [-0.0481, -0.0396] | -0.7562 [-1.2619, -0.2165] |
| 200/200 | 0.2928 [0.2601, 0.3247] | -0.0439 [-0.0487, -0.0390] | -0.7041 [-1.0875, -0.1349] |
| 400/400 | 0.2946 [0.2781, 0.3183] | -0.0442 [-0.0477, -0.0417] | -0.6684 [-1.0757, -0.1785] |
| 100/400 | 0.2922 [0.2641, 0.3204] | -0.0438 [-0.0481, -0.0396] | -0.7562 [-1.2619, -0.2165] |
| 200/400 | 0.2928 [0.2601, 0.3247] | -0.0439 [-0.0487, -0.0390] | -0.7041 [-1.0875, -0.1349] |

The rent effect is largely imposed mechanically by the rent multiplier; it is
not evidence of empirical policy effectiveness. Transit reduces modeled planned
trip minutes in this tested configuration; this does not establish a travel-time
forecast or an individual matched-trip effect. One-day behavior is especially
limited for housing moves, business dynamics and employment transitions.

## Display selection error

We call the production selectVisibleIndices twice at the same terminal state:
a systematic index sample and a camera sample at (0,0) prioritizing travelers.
Both select 16 actual people per run. The target is the full
person-weighted burden in that same run; errors below are sample minus full mean.
These are measured within-model selection errors, not a survey estimate of
real-world sampling bias. Camera samples are not random probability samples.
Selected indices are retained, so no sampled person or missing observation is
invented. Full-population sampling is independently tested to have zero error.

| Explicit/represented | Systematic mean error | Camera mean error |
| --- | --- | --- |
| 100/100 | -0.0124 [-0.0565, 0.0202] | 0.0340 [-0.0304, 0.1302] |
| 200/200 | 0.0196 [-0.0168, 0.0605] | 0.0326 [-0.0400, 0.1379] |
| 400/400 | -0.0121 [-0.0464, 0.0217] | 0.0262 [-0.0463, 0.1372] |
| 100/400 | -0.0124 [-0.0565, 0.0202] | 0.0340 [-0.0304, 0.1302] |
| 200/400 | 0.0196 [-0.0168, 0.0605] | 0.0326 [-0.0400, 0.1379] |

Camera selection can have substantial error and its sign changes across seeds.
This is why render samples should not replace authoritative full-population
statistics. Systematic sampling also has error; neither method is declared unbiased.

## Population-size and resolution differences

Baseline differences below use the same seeds against 400/400. All interventions
are also compared in the raw artifact. These are finite-resolution differences,
not bias relative to an empirical or continuum truth. A larger model is a
reference, not a validated ground truth or a convergence guarantee.

| Comparison | Case − reference | Metric | Mean difference and seed interval |
| --- | --- | --- | --- |
| population-size | 100/100 − 400/400 | personMeanHousingBurden | -0.0024 [-0.0229, 0.0283] |
| population-size | 100/100 − 400/400 | plannedTripMinutes | 0.0362 [-1.2908, 0.9911] |
| population-size | 200/200 − 400/400 | personMeanHousingBurden | -0.0018 [-0.0185, 0.0267] |
| population-size | 200/200 − 400/400 | plannedTripMinutes | -0.0462 [-1.0760, 0.6193] |
| resolution | 100/400 − 400/400 | personMeanHousingBurden | -0.0024 [-0.0229, 0.0283] |
| resolution | 100/400 − 400/400 | plannedTripMinutes | 0.0362 [-1.2908, 0.9911] |
| resolution | 200/400 − 400/400 | personMeanHousingBurden | -0.0018 [-0.0185, 0.0267] |
| resolution | 200/400 − 400/400 | plannedTripMinutes | -0.0462 [-1.0760, 0.6193] |

For these two metrics the weighted low-resolution cases equal their unweighted
counterparts at the same explicit count. That observed equality is specific to
this configuration/horizon; other metrics, fixed capacities and longer runs can
respond differently. The intervals cross zero, so this compact ensemble does
not establish a directional population-size or resolution effect.

## Invariants, replay and verification

Every one of the 90 rows passed:

- Conservation: explicit people equal configured population and summed household sizes.
- Membership: every person's household is valid and member counts equal household sizes.
- Trip flow: per-mode departures sum to trips; completed + cancelled + active equals trips and active is nonnegative.
- Finite person burdens; final clock exactly minute 1440, tick 1.

The CLI runs the entire study twice and compares SHA-256 of deterministic report
data (configs, observations, sample identities, summaries and checks). Matched:
true; digest 85357ef09aef3ca1faa94c604cd57b27cab54806fe99e8752a0d8b61b71215cc.
This proves repeatability of retained report observations, not byte equivalence
of every internal model state or cross-backend equivalence. Independent
hand-computed summary and person-weighting tests avoid using the same reducer
as their expected-value oracle. Corrupt membership, invalid seeds/limits,
unavailable trips, full samples and baseline zero deltas are covered.

Measured 2026-11-12T20:26:53.033Z, Bun 1.4.2,
Apple M4, 10 logical CPUs,
17179869184 bytes RAM, darwin
24.6.0 arm64. Sequential CPU, render
off, no GPU adapter. Study 5.961 seconds;
verification rerun 5.458 seconds. One wall-time
measurement includes creation, stepping and analysis, excludes source hashing,
replay and export; no throughput inference. Diagnostic API caps 12 seeds,
6 cases, 1,000 explicit/represented people, one day. It is deliberately bounded.

Reproduce from repository root:

```sh
bun scripts/run-seed-ensemble.js > /private/tmp/she-152-ensemble.json
bun test test/population-seed-ensemble.test.js test/population-model.test.js test/population-visible-sample.test.js test/sensitivity-analysis.test.js
```

Optional first CLI argument is a JSON study overriding seeds, cases, minutes or
sampleSize, with bounded validation; unsupported keys fail. Compare deterministic
data/digest and source hashes on rerun, not machine timestamps or timings.

## Dependencies and limits

The isolated mini/SHE-152 worktree at base b963dd3 owns only the study module,
CLI, tests, evidence, this report and its implementation-plan entry. Connected
GitHub search found no matching open SHE-152 PR. Shell GitHub access failed;
no claim of exhaustive remote ownership audit. No worker delegation or deployment.
SHE-142/HBL-1M-015 is marked Done in Linear but its scalar oracle is absent here;
SHE-151/HBL-1M-024 is Todo. Thus this is a working bounded increment, **not full
architecture-shootout sensitivity acceptance**. The existing Population model
serves as the CPU authority; no independent engine oracle or second backend is
verified. No UI changed, so browser/Playwright checks do not apply.

Next: integrate the versioned oracle and completed shootout receipts when
available, run the same matched-seed analysis over supported common outcomes,
and measure across adapters before extending the claim to large populations.

Actual final checks: 24 tests passed, 0 failed, 318 assertions in 8.22 seconds
across the four listed files. The invalid one-seed CLI request exited 1 with
`Require 2–12 unique uint32 seeds`. Independent evidence validation recomputed
the retained-report digest, verified all 156 source hashes against current files,
and checked all 90 rows' invariant flags. `git diff --check` passed. There is no
configured package lint/type-check command for this JavaScript slice.
