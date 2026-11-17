# Household Cost Atlas contract v1

Entry: `/world/decision.html` → run experiment → select a future in the landscape
or Best/Median/Worst → Household Cost Atlas in selected-future replay.
`visualizations.js` validates completed compatible run identity before handing the
selected record to `cost-atlas.js`. No new endpoint, persistence, or state authority.

Supported producer: `housing.v1` model version `1.2.0`, `world/models/housing/index.js`.
The projection reads the same final-horizon run as other Decision views:

| Field | Meaning / unit |
| --- | --- |
| `metrics.low_income_rent_burden` | Synthetic cohort net annual rent / modeled low-income annual income × 100; percent, not a probability |
| `metrics.public_expenditure` | Cumulative incremental modeled public spending; USD |
| `accounting.subsidySpent` | Cumulative construction grants paid; USD |
| `accounting.voucherSpent` | Cumulative rental assistance paid; USD |
| `accounting.projectPublicSpent` | Cumulative project public spending; USD |

The three nonnegative finite numeric ledger entries must sum to public expenditure
within max(0.01 USD, total × 1e-10). Otherwise bins are unavailable. Strings, null,
missing, negative and nonfinite values are not zero. Zero spending and zero burden
are supported values. Display rounds USD to two decimal places, without changing
source records. No annual/cumulative or median/sum mixing. The replay slider does
not change this explicitly labeled final-horizon panel.

These bins partition expenditure by use, **not household incidence**. All ledger
categories are included; private costs, taxation/financing incidence and individual
household bills have no supported allocations and are excluded. No residual bin,
per-capita division, household names, invented counts or population weights.
Every bin and the source link opens the existing exact run JSON endpoint,
`/api/decision-experiments/:experimentId/runs/:runId`. Source paths are visible.
Record identity includes experiment/run/scenario, seed, model and engine versions;
source JSON retains inputs and trace provenance.

Cohort count and eligible count are explicitly unavailable: the producer uses a
synthetic 25% eligibility share internally but does not retain a cohort count in
this output. Reconstructing a count from another view would violate the output
contract. Low-income income is a synthetic 55% median-income assumption adjusted
for unemployment. The burden output is a computed model result, not an observed
bill or calibrated effect. Historical source-backed starting inputs do not turn
these policy coefficients into empirical evidence. There are no decorative layers.

No run: select-future prompt. Unsupported model/version: unavailable contract.
Missing/inconsistent ledger: unavailable bins; independently valid burden remains
visible. Switching selection replaces all contents and links. It creates no
listeners, timers, animation frames, graphics contexts or retained caches; the
parent visualizer removes its DOM on destroy. No model, RNG, scheduling or ODD
change: aggregate housing remains outside the ABM inventory boundary documented
in `docs/models/README.md`.

Deterministic representative fixture: `test/fixtures/household-cost-atlas.js`, seed
42, two years, synthetic annual voucher funding 600m USD and construction subsidy
3bn USD; remaining parameters use versioned model defaults. It executes the real
producer rather than hand-authoring incidence. Tests cover conservation, zeros,
invalid and absent fields, unsupported model/version and deterministic replay.

Remaining producer prerequisite for a true household-incidence atlas: a versioned
allocation output with disjoint cohort/household identity, eligibility/count
coverage, units/time, supported total and explicit exclusions. This change does
not create such a social/economic mechanism.
