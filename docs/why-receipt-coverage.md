# WHY receipt coverage protocol v1 (SHE-255)

The formula and collection scope were fixed before measurement on 2026-11-12.
Authority: monthly City and Future Machine synthetic generator v1. The original
measurement used `city-systems.1.0.0`; the integrated current report is regenerated
under `city-systems.1.1.0` with the same seeds, inputs and fixed coverage scope.
Each run records its actual model version, manifest and source digests. The
[original results](why-receipt-coverage-results-city-1.0.0.md) and
[original report](evidence/why-receipt-coverage-city-1.0.0.json) are retained with
PR #191's original revision for reproduction. This is an offline measurement of
the existing WHY surface, not a model or explanation change.

## Formula and fixed change set

For each individual run, **coverage = number of distinct changed entities with
at least one WHY receipt for an observed transition / number of distinct changed
entities**. Identity is `(collection, id)` within that run. Empty denominators
produce null (unavailable), never 100%. Repeated changes do not increase this
primary denominator. Also report transition coverage, using `(month, collection,
id)` as the counting unit, so one explained month cannot conceal 119 unexplained
months. The same ratio applies to that explicitly labeled secondary unit.

Compare each complete committed state at months 1–120 against its immediately
previous state. Include additions, removals, and any deep field change other than
`id`, without tolerance or significance filtering. Use the existing
`compareEntities` semantics, including missing versus null. Include the thirteen
Future Machine inventory collections from `ENTITY_KINDS`: districts, parcels, buildings,
units, households, workers, businesses, jobs, links, facilities, utilities,
projects, policies. Report each collection × added/removed/modified combination,
including zero denominators. Groups can overlap in distinct entities; transition
groups partition the secondary denominator.

Exclude clock/version/provenance metadata, parameters, aggregate finance/system
summaries, flows, and shock configuration: these are not entity inventory.
The additional `residents` collection in City 1.1.0 is also outside the existing
Future Machine `ENTITY_KINDS`/WHY scope; it is not silently added to or removed
from the fixed denominator during the integration rerun. Finance and resident
changes are therefore outside this metric; this must never be described as
coverage of every City inventory type, all state mutations, or other engines. Policies
injected before stepping are inputs; month 0 includes the intervention in the
plan arm. Creation of that input is not a modeled transition.

A receipt exists only when the existing `explainChange` finds an exact entity
match in that run's same-month events, or `constructionReceipts` finds the exact
model-owned building/project completion mapping in the same month. Never borrow
an event from the other arm, a later month, a district neighbor, a decision, or a
narrative. Deduplicate receipt IDs. Event association counts presence, not proof
that all changed fields are explained, causal completeness, or empirical truth.
No new explanations or inferred joins are introduced.

## Preregistered runs and acceptance

Run seeds 42 (flagship), 7 and 2911, each for 120 steps with 30 starting
households and the existing DEFAULT_RECIPE housing intervention. Measure baseline
and plan independently with their own month-0 state. Preserve model manifest,
recipe, source-file digests, initial/terminal state hashes, and ledger hash in
`docs/evidence/why-receipt-coverage.json`. Runs are local synthetic recomputations,
not retained historical checkpoints, observed cities, or uncertainty estimates.
The CLI must finish all six runs before writing output.

Acceptance: reproducible report, per-type counts and uncovered field examples,
seed-42 event 16-0 construction regression, missing-inventory failure, and tests
for duplicate receipts, wrong-month/wrong-entity events and empty denominators.
No browser behavior changes; browser testing is inapplicable.

## Proposed gate (not enabled)

Propose 100% distinct-entity AND 100% transition coverage, overall and per nonempty
change type, for these fixed runs. A human must decide the threshold and whether
receipt presence is sufficient before any CI gate is enabled. Do not reduce the
change set to reach a target. This audit adds no CI gate.
