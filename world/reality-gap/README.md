# Reality Gap Explorer

Open `/world/reality-gap/` through the Research hub. Paste or import one
`reality-gap.v1` JSON comparison. The explorer scores imported runs; it does not
run or calibrate a model. Use the historical backtest pipeline to produce runs
with pre-cutoff inputs, then retain their exact provenance here. The importer
cannot independently verify source accuracy or absence of input leakage.

Required comparison fields:

- `schemaVersion`: `reality-gap.v1`; `id`: immutable comparison/revision identity.
- `metric`, `unit`, `geography`: common identity and basis for both series.
  Convert units and map entity identities upstream. Separate incompatible series.
- `source`: observation dataset citation, vintage and interval interpretation.
- `synthetic`: explicit boolean. Synthetic fixtures are not empirical validation.
- `runId`, `modelVersion`, `rulesVersion`, `seed` (uint32), `parameters` (object),
  `cutoff` (YYYY-MM-DD): historical simulation recipe. Include initial-state,
  input sources and release vintages within parameters. Seeds and recipe remain
  evidence; the explorer makes no claim to have independently replayed the run.
- `threshold`: positive absolute error in metric units, chosen before comparison.
- `observed`, `simulated`: arrays of at most 1000 uniquely dated rows per series.
  Each row has `date`, `value`, `lower`, `upper`. Bounds must contain the value.
  Declare the same interval meaning in source metadata; a point estimate alone
  is insufficient. Observed rows also require `availableAt` (release date).
  Use `value: null` without bounds for explicit missingness. Missing dates are
  also unscored. No interpolation, extrapolation or zero replacement occurs.

Both series use calendar dates on one time axis and a common value axis. Each
post-cutoff matched point has signed error (simulated minus observed), absolute
error and absolute percentage error. Percentage is unavailable for zero observed
values. Pre-cutoff points are initialization, never validation. Intervals show
supplied uncertainty, not a causal test or a standardized confidence level.

Each gap at or above threshold can be drafted into browser-local triage. Drafts
include the full immutable comparison, row-level evidence, hypotheses and
acceptance criteria for a seed-matched rerun. Identical drafts are idempotent;
changed evidence under the same identity is rejected (use a new comparison/run
revision). Draft status stays `triage`, with human review required. Export JSON
for backup or review elsewhere. This slice has no Linear publication, automatic
approval/execution, shared server queue or model-improvement automation. Browser
storage failures report an error and do not report success. Invalid existing
storage is preserved and disables drafting. Clearing site data removes drafts.
