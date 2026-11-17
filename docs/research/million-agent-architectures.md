# Million-resident feasibility: E2 interaction ablation

This document records the local SHE-219 implementation and its limits. The
research document referenced by the issue was absent from this checkout;
this is not a reconstruction of its other experiments. The
[issue](https://linear.app/shel-bernstein/issue/SHE-219/hbl-res-08-1m-feasibility-e2-show-that-residents-really-interact-with)
is the source of the E2 requirements below. No external measurements or
empirical calibration are supplied.

## Required experiment and current coverage

E2 requires identical populations and seeds in five arms: full coupling, no
interaction with frozen/independent resources and no partners, shuffled partners
and resources preserving counts, coupling ×0.5, and coupling ×2. It asks for
commute time, employment, occupancy, rent, mean degree, giant-component share
and cross-shard share. Full and no interaction must differ beyond a 95% seed
band on at least two headline outcomes. State the number of seeds.

**Status: E2 remains incomplete; the interacting-resident claim is withheld.**
The implemented end-to-end slice isolates transport demand feedback in the
actual Population model. It does not substitute a toy energy-transfer model or
multiply resident weights to imply a larger population. The existing
[SHE-141 metric fixture](../agent-counts.md) proves different, bounded properties.
The SHE-171 benchmark runner is not present in this checkout. The headless CLI
shares the exact synthetic geography with the
[existing people benchmark](../../world/PEOPLE_BENCHMARK.md).

| E2 requirement | Delivered transport slice | Remaining |
|---|---|---|
| Full coupling | Current Population rules; exact-state equivalence tested | None for this arm |
| No interaction | `frozen-transport`: read initial congestion=1, crowding=0, demand=0 | Resident-independent copies of household, guardian/care, housing and employer resources; disable partner encounters |
| Shuffled partners/resources | `shuffled-transport`: a seeded permutation of district transport feedback each internal interval | Partner rewiring, housing and labor/resource assignment preserving counts |
| Half/double coupling | Scale congestion excess above 1, transit crowding and boarding-demand reads | Define corresponding controls for the remaining mechanisms |
| Graph | Actual sampled resident/resource-episode incidence with isolates | Verified state-changing interaction graph and real shard ownership |
| Pass criterion | Pointwise 95% paired seed intervals; transport-only criterion reported separately | A valid complete no-interaction arm; current `e2Pass` is always false |

The transport mechanisms are lagged road congestion, lagged transit crowding,
and current within-step boarding demand. The freeze includes that last gate:
freezing only congestion would leave residents competing for transit seats.
Half/double change feedback read by choices and boarding checks, rather than
rescaling final outcomes. Congestion uses `1 + factor * (congestion - 1)`.
District physical capacities, exogenous events, initial state and choice RNG
streams are identical. The shuffled stream consumes no resident choice draws.
Each interval has a bijection of district indices, preserving the resource
feedback multiset; the synthetic two-district fixture has a deliberately small
shuffle space. This is demand feedback permutation, not destination reassignment.

The unmodified model still shares household transport spending, savings, wages,
child/guardian schedules, care seats, housing vacancies, firm capacity, staffing,
payroll, customer budgets and social encounters. Calling `frozen-transport` a
"no interaction" arm would be false. Even a significant transport result cannot
make this adapter pass E2. A negative transport result also cannot establish
that the remaining interactions are irrelevant.

## Reproduce

From the repository root, with Bun and no browser/server setup:

```sh
bun scripts/benchmark-interaction-ablation.js 10000,100000 42,43,44 1 /private/tmp/she219-transport-ablation.json
bun test --timeout 30000 test/interaction-ablation.test.js test/population-model.test.js test/population-needs.test.js test/population-hotspots.test.js world/population/employment.test.js world/population/children.test.js world/population/checkpoint.test.js
```

Defaults are 10k and 100k residents, five seeds 42–46, and one modeled day.
The recorded acceptance run uses three seeds explicitly, rather than the
five-seed default. Supported bounds are 1–100k actual people, 1–31 days,
1–32 unique uint32 seeds and up to four unique population sizes. Fewer than
three seeds yields unavailable statistical intervals. Larger sweeps can take
substantial CPU time. Runs execute sequentially with one authoritative model;
there is no parallel resident sharding. Progress goes to stderr, complete JSON
to stdout or the optional output file. A failed arm aborts without publishing a
partial report. File publication uses a temporary sibling and atomic rename.

The manifest records normalized config, synthetic world context, Population
version, intervention rules version, exact seeds, horizon, clocks and units.
Every arm has a SHA-256 digest of actual initial state (including typed bytes,
reference structure, employment and household state) and final state. Seed-matched
initial digests must agree. Full source hashes are checked before and after the
run; a detected edit rejects publication. Hashes pin source, not empirical validity.
Repeated recipe execution must reproduce scientific fields and digests; execution
timestamps and wall timings are observations and naturally differ. These
research-only controls are attached to a model by WeakMap and are not supported
by production checkpoints; regenerate a diagnostic from its recipe.

## Measurements and interpretation

| Output | Definition and missing-data policy |
|---|---|
| Commute | Mean **planned** minutes per actual work-bound departure during the observation window. No departures means null. It excludes return trips and is not experienced commute duration. |
| Employment | Employed residents divided by adult residents, from the authoritative model. |
| Occupancy | Actual households × representation weight / total assumed housing units. This aggregate utilization can be invariant when only district allocation changes. |
| Rent | Mean actual household monthly rent, USD. District rents are exogenous; changes require a change in household allocation. |
| Mean degree | Undirected **bipartite incidence graph**, `2 * incidences / (resident nodes + resource-episode nodes)`. This is not resident-to-resident degree. |
| Giant-component share | Largest component's resident count / all actual residents; isolated residents included. |
| Cross-shard share | Null with explicit reason: this model has no actual shards. Arbitrary district or ID partitions are not reported as shard ownership. |

A resource episode is a destination district's road (cars) or transit (bus/rail)
resource during one internal interval, normally 15 minutes. Residents still in
transit at interval end contribute one incidence. Union-find connects actual
co-users through the resource episode without allocating quadratic resident
cliques. Trips finishing inside the interval are omitted. These are sampled
opportunities for dependence, not verified pair events or proof of a state
change. The report keeps interval count, incidence count, a streaming order
checksum, and bounded samples with person IDs, district IDs and minute intervals.
The FNV checksum detects ordinary replay changes; it is not cryptographic event
provenance. All identities and minutes belong to this same Population run;
there is no mapping to the monthly City or housing Decision Studio models.

For each population and control, the unit of replication is one seed. Compute
`full(seed) - control(seed)`, then its mean and two-sided Student-t 95% interval
using sample variance and `n - 1` degrees of freedom. A band excludes zero only
when both bounds have the same strict sign. A constant zero delta fails; a
constant nonzero delta has a degenerate interval. Any missing pair invalidates
the whole band's inference, retaining the missing seed IDs. The analysis never
silently drops seeds, substitutes zero, pools populations, or treats residents
as independent replicates. Duplicate seeds/runs, missing arms, incompatible
model versions and mismatched initial digests reject the summary.

These pointwise intervals assume independent seed draws and meaningful replicate
variation. They are descriptive synthetic sensitivity, not empirical confidence
or a multiple-comparison-adjusted causal guarantee. Three seeds are a small
feasibility sample. The one-day horizon barely exercises housing allocation and
employer cash exhaustion; longer horizons should be prespecified, not selected
until an outcome passes. There is no monotonicity requirement: changing demand
feedback can change choices and cascade nonlinearly.

## Recorded transport result — November 12, 2026

The [complete report](results/she219-transport-ablation.json) retains all 30
runs: 10k and 100k actual residents, seeds 42, 43 and 44, five transport arms,
one modeled day. The sequential sweep took 814.26 seconds including generation,
observation and hashing; this is not a throughput benchmark. All report source
hashes were independently checked against the checkout before retention.

Full minus frozen-transport paired differences:

| Population | Planned commute difference (minutes) | Pointwise 95% seed interval | Other three headlines |
|---:|---:|---|---|
| 10,000 | −0.003016 | [−0.009796, 0.003764] | All differences and intervals zero |
| 100,000 | −0.032616 | [−0.053252, −0.011981] | All differences and intervals zero |

Only the 100k commute band excludes zero. Neither population meets even the
transport-only two-outcome criterion. Both retain `e2Pass: false`. This result
does not show that all resident interactions are irrelevant: the control only
removes transport feedback, and the horizon is one day. The required complete
no-interaction control and causal interaction graph remain unimplemented.

## Next complete slice

Before enabling E2 acceptance, enumerate and version every shared read/write
boundary in household, guardian/care, housing, employer and social rules. Provide
frozen or independent resource copies while preserving exogenous shocks and
seeded individual behavior. Test isolation by perturbing another resident and
verifying that a no-interaction resident's trajectory is unchanged. Rewire
partners/resources with preserved counts and explicit eligibility constraints.
Apply half/double to these declared coupling mechanisms. Then run the same
seed-matched experiment at 10k/100k, record the complete graph with causal state
changes, and assess the two-outcome gate. Actual cross-shard metrics and million
resident feasibility depend on a future authoritative sharded runner.

The inspected integration boundaries for that next slice are:

| Boundary | Existing owner | Isolation acceptance |
|---|---|---|
| Household travel affordability, wages, savings and housing allocation | `world/population/behavior.js`: `modeAlternatives`, `householdDecisions`, `scoreHousing` | Another member's spending, pay or move cannot change the focal resident's control trajectory. Preserve the focal resident's own budget consequences. |
| Guardian availability, enrollment and care charges | `world/population/children.js`: `prepareChildrenInterval`, `parentCareConstraint`, `parentHiringAvailability` | Changing a different child's enrollment or guardian's employment cannot affect the focal control resident. Do not manufacture a live partner to supply care. |
| Vacancies, staffing, payroll and customer demand | `world/population/economy.js`: `stepLocalEconomy`; `world/population/employment.js` | Another worker's hire, departure, productive time or spending cannot change the focal control resident's resource reads. Own work and pay still reconcile. |
| Encounters, commitments and household systems | `world/population/model.js`: `stepPopulation`; `world/population/hotspots.js`; `world/relationships/model.js`; `world/house/system-registry.js` | Disable partner encounters and audit scheduled promises, traditions and household callbacks. A mutation of another resident must not change the focal control resident's state or decisions. |

These are prerequisite interfaces, not implemented isolation adapters. Test each
with a seed-matched perturbation of another resident before composing the full
control. Retain identical resident IDs, exogenous inputs and clock boundaries;
compare focal trajectories rather than only terminal aggregate totals.
