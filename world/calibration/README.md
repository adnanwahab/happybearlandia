# Reality Calibration Lab

Open `/world/calibration/` through Research institutions or Decision Studio's
Historical evaluation section. The lab executes housing.v1 **1.2.0** locally;
it does not update a world, save server state, fetch citations or approve changes.
Import JSON, run, review the report and download the report/recipe for replay.
The generated example is entirely synthetic, including its historical dates.

## Recipe contract

`syntheticRecipe()` in `example.js` provides a complete executable fixture.
`reality-calibration-recipe.v1` contains:

- `id`, `geography`, `dollarBasis`, `tuningCutoff` (ISO date), uint32 `seed`,
  `runs` (1–30), `origins` (2–20), `evidence` (0–100).
- Each origin: unique `id`, `startDate`, `inputsAvailableAt` no later than start,
  `split` (`tuning` or `validation`), `label` (`measured` or `synthetic`), `source`,
  `parameters`, `observations`. Explicitly provide initial_housing,
  initial_households, initial_rent and initial_income. Other parameters use
  registered synthetic defaults. A state label describes supplied initial data,
  not the model coefficients. Input dates assert availability of the entire map.
- Each observation: `date`, `availableAt`, `label`, `source`, `metrics` map and
  matching `units` map. Use null for a missing observation. No zero substitution,
  implicit unit conversion or inflation adjustment occurs. Each origin supports
  1–10 distinct annual horizons, 1–30 years. Use one geography and constant-dollar
  basis throughout; the importer must establish comparable metric definitions.
- Tuning outcomes must be published by `tuningCutoff`. Validation origins start
  on/after that cutoff and their targets follow all tuning targets. Input vintages
  must be historical snapshots, not retrospective revisions.
- Optional `tuning`: `parameterId: "rent_response"`, `values` (2–12 bounded
  candidates), `evidenceIds` (nonempty). Every reference must resolve to a
  Research Library record with matching parameter/geography and pre-cutoff
  availability. Other coefficients cannot be tuned in this slice.
- Evidence uses the existing `hbl-evidence.v1` normalizer with required unique
  `id`, `parameterId`, `geography`, `sourceName`, HTTP(S) `url`, `availableAt`,
  `label`, and optional `type`, `notes`. The recipe-local Research Library retains
  records in the report and exposes citation anchors. It is not a remote catalog.

Only tuning-origin median-rent MSE selects candidates; all other metrics are
reported in native units. Selection requires a strict improvement over the
supplied baseline. Ties preserve the baseline/first improving candidate. The
selected value is frozen before validation; baseline and fitted evaluations use
the same seeds. Trials are diagnostics, not confidence intervals or causal proof.
Work is capped at a conservative 20,000 simulated years. Browser imports are
limited to 1 MB. This bounded run yields between origin/horizon evaluations.

## Report and limits

`runCalibrationLab(recipe)` returns `reality-calibration-report.v1` with the full
recipe, model/rules versions, seed family, per-seed resolved parameters and metric
records, grid trials, proposed parameter/evidence links, and separate baseline /
fitted tuning and validation rows. Errors are by origin, metric and annual
horizon; missing values and simulation failures remain visible. Absolute,
squared and percentage errors have native metric units (squared for MSE).
Percentage error is unavailable at observed zero. All model results are synthetic;
observations retain their supplied measured/synthetic labels.

Verification, validation and uncertainty answers explicitly distinguish repeatable
computation from empirical accuracy. P10–P90 is seed variation only. Source
labels, historical availability, boundaries and dollar basis are user assertions;
the lab cannot establish authenticity, measurement error, parameter identification,
structural accuracy or real-world causal effects. Evidence references permit a
reviewable fit; they do not independently certify the proposed coefficient.

Checks: `bun test test/reality-calibration-lab.test.js`; browser journey:
`bunx playwright test --config test/calibration-browser.config.mjs`.
