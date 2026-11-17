# Simulation Benchmark Arena

Run the standard suite and save scores from the normal Bun CLI:

```sh
bun scripts/benchmark-arena.js run /private/tmp/hbl-arena
bun scripts/benchmark-arena.js compare /private/tmp/hbl-arena/*.json
bun test test/benchmark-arena.test.js
```

Each execution creates a new UUID JSON file using an atomic rename. Comparison
prints a side-by-side tab-separated summary to stderr and complete structured
columns/rows to stdout, including separate performance, accuracy, uncertainty and
per-case operational counts. Files survive restart; the runner never overwrites
an earlier report. An explicit output directory is recommended; the default is
`.hbl-benchmarks/`. These are local artifacts, not production experiment records.
There is no browser change or deployment.

`city-arena.v1` fixes five seeds (0, 1, 42, 2147483648, 4294967295), 12 months,
and four synthetic scenarios: baseline, 12-home proposal, district flood and
minimum population. Every registered adapter executes the same 20 cases twice
sequentially. Replay compares the full run digest, terminal metrics and counts;
City digests include initial state and every engine step, events, decisions,
observations and provenance. City performs its ordinary state/invariant validation.
Replay equality is reproducibility under that executable, not empirical accuracy.
The existing 106-case replay sweep remains a separate broader acceptance gate.

## Versions and evidence

The checkout supplies one executable City version. To evaluate other retained
versions, export a default adapter with `id` (unique actual model/rules version),
`rules`, `source` and `async run(scenario, seed)`. Supply all adapter modules:

```sh
bun scripts/benchmark-arena.js run /private/tmp/hbl-arena - ./adapters/old.js ./adapters/new.js
```

An adapter returns `{digest, metrics, counts}`. Metrics must be finite terminal
numbers with a consistent schema across cases. Counts must contain nonnegative
safe integers for `activeAgents`, `executedStateTransitions`,
`validatedNumericalResults`; `interAgentInteractions` may be null when unsupported.
The adapter must validate its own model's state and preserve causal evidence in
its digest. Custom modules are trusted local executable code. Pin their transitive
sources as well as their entry module when archiving versions. CLI reports hash
the shared harness, current City dependencies and supplied entry modules; arbitrary
external transitive dependencies are not automatically discovered. Reports retain
rules, source, suite, observations, hashes, runtime, seeds and case failures.
Unavailable historical executables cannot be evaluated by relabeling current code.

For City, active agents are distinct changed household, worker and business IDs.
Transitions count changed/created individual rows once per committed month;
deletions and internal resolver changes are excluded. Neither population nor
rendered records become active counts. City exposes no validated pairwise
interaction adapter, so interactions are null. Numerical results count finite
terminal aggregate values after state validation, separate from historical
validation and from all other operational counts. These units describe each
case, never sums of agents across unrelated scenarios.

## Historical accuracy and uncertainty

Accuracy is unavailable by default. Optional observed-history JSON is an array:

```json
[{"suiteVersion":"city-arena.v1","scenario":"baseline","month":12,"seed":42,"metric":"population","unit":"people","value":90,"source":"identified historical record"}]
```

This is a format example, not real historical evidence. Pass its path as the
second run argument instead of `-`. Each supplied observation must identify the
exact scenario, terminal month, seed, metric, unit and source. The caller must
establish the real place/entity/date mapping and matching units: this synthetic
suite supplies no geographic or calendar mapping. Invalid alignment and duplicate
keys are rejected. Missing observations contribute no accuracy score. Reports
retain observation values, predictions and absolute errors; comparisons show MAE
separately for each metric, never an average across unlike units. Suite and
observation content hashes must match before comparing reports. Source strings
are attribution supplied by the caller, not verification of empirical truth.

Uncertainty is the terminal minimum–maximum range across the fixed seed ensemble,
with lower/upper/width and sample count per metric/scenario. It is a modeled seed
spread, not a calibrated confidence/credible interval or confidence in historical
accuracy. Failed cases suppress the scenario's band instead of narrowing it through
missing results. Replay mismatches and failures remain visible separately.

Performance reports monotonic execution duration and process RSS before/after
and delta, apart from accuracy. Duration includes model setup, validation and
hashing; the independent replay is excluded. RSS samples are neither peak memory
nor isolated allocations. Warm-up, GC, runtime and host load affect measurements.
A stability failure is an exception/invalid result, or a separate replay mismatch;
this local sequential harness has no hard timeout or crash isolation. A process
crash or hung custom adapter cannot generate a completed report. Do not treat
these measurements as production capacity or backend load-test results.
