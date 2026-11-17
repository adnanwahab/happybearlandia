# Offline CI evidence adapter (SHE-247)

Implemented slice: normalize existing report formats into explicit per-check
PASS, FAIL or NOT_EVALUATED results, then optionally submit validated
ImprovementProposal.v1 rework data to an injected `sink(identity, proposal)`.
The sink owns durable deduplication; repeats produce identical identities.
Sink failures propagate. No CLI, persistence, executor, network or CI changes.
Shared inbox integration waits for shared-contract PR #41 review.

Use `evaluate(artifact, expected=..., now=..., max_age_seconds=...,
baseline=..., budgets=...)`. An artifact has `kind`, `content`, `provenance`
and an Actions artifact `url`. Inputs are already loaded by the caller; no paths
or URLs are fetched. `submit_rework(result, artifact, sink)` sends only rework,
never passing checks. Missing artifacts return NOT_EVALUATED without a fabricated
measured source. Invalid source references fail shared contract validation.

Provenance requires headSha, buildSha, recordedAt (timezone required), modelVersion,
recipeVersion, seeds, environment and conditions. Expected pins must match;
both head and build must equal the PR head. Environment requires hardware, os,
browser, renderer, supported=true. Conditions record the applicable warmup,
measurement window, runtime, viewport, workload and feature flags. Unrelated
fields may also be recorded. Callers must attest applicability and supply
trusted pins, timestamps, policy and metadata; this adapter does not authenticate
artifact producers or independently establish that a build ran. Sources hash
UTF-8 XML bytes or canonical JSON contents, not an archive/download wrapper.

Supported contents:

- `bun`: Bun JUnit XML (`bun test --reporter=junit`); failures/errors fail,
  skips remain NOT_EVALUATED. This includes checkpoint replay tests without
  claiming held-out model accuracy.
- `playwright`: JSON reporter suites/specs/tests/results. Any failed attempt
  fails, including eventual retry success; skips and unexpected passes cannot pass.
- `renderer`: `scripts/benchmark-renderer.js` JSON using RenderStats fields.
  Compares p95FrameMs; unknown texture memory stays NOT_EVALUATED and GPU
  evaluation always stays NOT_EVALUATED.
- `visual-pass`: the `measured-timings` JSON attachment from
  `test/e2e/world-visual-pass.e2e.js` (invoked by
  `scripts/benchmark-world-visual-pass.js`); compares totalMs only.

Baselines require a valid build SHA and fresh timestamp but may be from another
head. All version, seed, environment and condition pins must match. Renderer
backend/viewport/preset/settings or visual-pass viewport/userAgent must also
match. Budgets are explicit caller records, e.g.
`{'p95FrameMs': {'maxRegressionFraction': 0.15, 'source': 'reviewed policy reference'}}`.
Lower is better. No budget defaults exist, including the renderer script's 15%
threshold. Zero/negative baseline, missing timing or nonfinite numbers cannot pass.
The startup script explicitly asserts no speed threshold; none is invented here.

Pipeline `docs/demo-evidence-manifest.json` is a provenance index, not a test
report: it explicitly describes progressive captures, not final-head images.
It cannot establish PASS and is deliberately unsupported as standalone results.
Its model/recipe/seed references can inform trusted caller pins; individual
artifacts still need their actual build SHA and measurement metadata.

Fixtures retain producer field layouts with sanitized illustrative values.
They are synthetic format examples, not claimed successful CI or benchmark runs.
No GPU support, CI triggering, benchmark execution, nightly scheduling, model
rule changes, Linear writes or execution approvals are included. Host dual
symphony-pilot/symphony-pressure-release gates and one worker remain untouched.

Verification: `python3 -m unittest discover -s ops/improvement/evaluation -p 'test_*.py' -v`.
Coverage includes native layouts, skips/failures/retries, malformed/missing/stale
reports, SHA/version/seed mismatches, environment mismatch, unknown memory/GPU,
explicit budget boundary/violation, shared validation and repeated fake-sink
submission. No browser behavior changes; Playwright execution is inapplicable.

Remaining integration: reviewed shared sink binding, authentic CI provenance
collection and retained real run artifacts. No live execution acceptance claimed.
