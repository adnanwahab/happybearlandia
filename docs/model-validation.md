# Automatic model validation (SHE-189)

The read-only `Model validation / model-validation` GitHub Actions job runs on
all pull requests and main pushes, including changes to shared simulator code,
fixtures and dependencies. `bun run test:models` runs the numerical acceptance
check locally. The workflow also runs calibration, historical backtest, housing,
City, replay and boundary contract tests. Test names identify failed rules;
acceptance failures include a rule name, seed/case and the underlying diagnostic.
JSON results are retained as an artifact even on validation failure. The step
summary links the result to human review. No merge, deployment, production data
write or write token is part of this workflow. Repository administrators must
configure required checks/review protection separately.

## Accuracy rule: housing.houston-stock-error

The versioned fixture `test/fixtures/model-validation/houston.json` pins the
existing published Houston stock diagnostic's dataset, model version, 100 runs,
seed 42, observed 1,023,112 homes and absolute ensemble-mean error
6,572.376443952206 homes. Errors above this baseline plus 0.000001 homes of
floating-point tolerance fail; improvements pass. Missing/nonfinite scores,
changed observation/model/dataset contracts and incomplete ensembles fail.
Seeds follow the diagnostic's recorded golden-ratio uint32 sequence. The report
retains every run seed, source metadata, parameters, version, cutoff, score and
limitations. This fixture was measured with Bun 1.4.2; CI pins that runtime.

These are overlapping ACS five-year estimates, not independent annual ground
truth or a strict forward backtest. Only initial stock and occupied homes are
sourced; other inputs remain synthetic. This rule detects worsening reproduction
of this diagnostic, not general predictive accuracy. Existing synthetic recovery
and held-out tests exercise calibration and leakage boundaries. Additional
source-backed holdouts are needed before claiming validated forecasts. See the
[housing model documentation](../world/models/housing/README.md).

A baseline change requires human review of old/new errors, provenance and model
version rationale. The check never updates its own fixture. SHE-111 is in review;
its proposed normalized-hash matrix is not present in this checkout. This job
reuses the existing SHE-59 `SEEDS`/`BOUNDARIES` definitions rather than inventing
a second matrix. Integrate SHE-111's landed fixtures when available.

## City invariants: city.replay-invariants

The [model invariant catalog](../world/city/VALIDATION.md) defines every invariant
exercised by the seed sweep, engine state validator and capacity contracts.
The job independently runs each pair twice for seeds 0–99 and four uint32/sign
boundaries, plus two minimum/maximum recipe cases. Each arm spans 120 months.
Failure records retain the recipe, case index and assertion message. Replay
agreement is deterministic recomputation, not agreement with observed reality.
The full report retains both digest sets, model/rule versions and seed recipes.
Monthly City and annual housing are separate models: no entity or clock mapping
or cross-model causal interpretation is claimed.
