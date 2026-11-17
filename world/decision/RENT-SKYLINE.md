# Decision rent skyline v1

Normal entry: `/world/decision.html`, run an experiment, then explore the skyline
above the outcome landscape. This is an integrated, bounded **simulation sample**
distribution. Household income/rent distributions remain unavailable. Do not call
the sample count a population, probability or empirical housing distribution.

## Data contract and provenance

`mountRentSkyline.update({experiment,runs})` receives the same read-only records
as the existing Decision visualizations. The integration first applies
`compatibleLandscapeRuns`: completed status, experiment and scenario membership,
model/rules versions and uint32 seed must match. Each run contributes at most one
member; duplicate IDs reject rather than double count. `metrics.median_rent` is
final-horizon base-year USD/month, from the aggregate synthetic housing model.
No annual replay slider state is mixed into this view. Scenarios in an experiment
share its configured horizon and currency basis. Across unrelated experiments,
fixed boundaries alone do not establish compatible horizons or dollar years.

Selected scenario is the cohort. The denominator is compatible completed runs in
that scenario, **not** requested runs or households. Failed/incompatible runs are
excluded upstream. Each numeric, finite, nonnegative rent enters one interval:
`[0,500), [500,1000), [1000,1500), [1500,2000), [2000,2500),
[2500,3000), [3000,4000), [4000,∞)`. Empty bins remain present. Null, absent,
string, nonfinite and negative values increment missing; never impute zero.
Invariant: sum(bin members) + missing = denominator. The fixed edges never
rescale with arriving data or switching scenarios. Heights use 12 CSS px/member;
zero has a 2px selectable baseline labeled zero, not a positive count.

Bin selection lists its actual records, including IDs, seeds and rent. Selecting
a member invokes the existing `choose` path and opens that exact run detail and
receipt. No invented household sample, checkpoint, building, map coordinate or
cross-model identity is created. The scene is CSS perspective with extruded bars;
left/right and depth controls move the viewpoint. It has no collisions, resident
simulation or continuous walking loop. The ordinary controls and sample list
provide a keyboard and touch path independent of spatial chart reading.

Observed sources: none in this distribution. Synthetic assumptions and computed
model effects belong to `world/models/housing/README.md` and the exact run record.
The authored boundary fixture in `test/fixtures/rent-skyline/representative.json`
is explicitly synthetic test data, not an observed dataset or an executed run.
The seed-matched executable test separately checks actual model output using
seeds 42–46, two default scenarios, two years and the current model implementation.
Decorative layers: only chart colors and perspective; no decorative buildings.

## Lifecycle and outstanding acceptance

No WebGL contexts, GPU buffers, timers, animation frames, network requests or
model state are owned by this view. `destroy()` removes its three event listeners,
releases retained run references and DOM; the visualization parent's existing
destroy path calls it. Updates after destruction are inert.

The focused Playwright suite is `test/rent-skyline.browser.config.js`. Actual
browser/visual acceptance and consumer-device frame/disposal measurements remain
unavailable in this sandbox (local server cannot bind). CSS does not establish
measured frame performance. A verified household cohort contract remains needed
for SHE-740's full original acceptance: source identity/vintage, cohort IDs,
units/dollar basis/time, denominator, exclusions, weights and exact supported
sample membership. Aggregate median income/rent cannot supply that distribution.
No new agent mechanism or model rule is introduced; ODD inventory unchanged.
