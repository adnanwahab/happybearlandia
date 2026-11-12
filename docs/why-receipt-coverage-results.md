# WHY receipt coverage results — City 1.1.0 integration

Regenerated on 2026-11-12 using the unchanged formula and thirteen-collection scope in [protocol v1](why-receipt-coverage.md). The integrated engine is `city-systems.1.1.0`; six synthetic monthly City runs use 30 starting households and 120 steps, with baseline and housing-plan arms measured separately. This audit does not change simulation rules or explanations.

The [current machine-readable report](evidence/why-receipt-coverage.json) retains exact model manifests, recipes, selected source digests, initial/terminal state and ledger hashes, per-type counts and uncovered examples. [Original City 1.0.0 results](why-receipt-coverage-results-city-1.0.0.md) and their [original artifact](evidence/why-receipt-coverage-city-1.0.0.json) remain available; do not relabel those historical measurements as current.

| Seed | Arm | Entities with receipt / changed | Entity coverage | Transitions with receipt / changed | Transition coverage |
| --- | --- | --- | --- | --- | --- |
| 42 | baseline | 95/345 | 27.54% | 4100/7798 | 52.58% |
| 42 | plan | 104/416 | 25.00% | 4070/10643 | 38.24% |
| 7 | baseline | 82/297 | 27.61% | 4060/7656 | 53.03% |
| 7 | plan | 96/384 | 25.00% | 4067/10780 | 37.73% |
| 2911 | baseline | 95/349 | 27.22% | 4136/7804 | 53.00% |
| 2911 | plan | 100/400 | 25.00% | 4040/10526 | 38.38% |

## Coverage by change type

Each cell is covered / total monthly transitions. A dash denotes an empty denominator, not perfect coverage. Distinct-entity counts and all zero groups remain in the JSON.

| Change type | 42 baseline | 42 plan | 7 baseline | 7 plan | 2911 baseline | 2911 plan |
| --- | --- | --- | --- | --- | --- | --- |
| districts modified | 316/316 | 290/290 | 313/313 | 280/280 | 316/316 | 253/253 |
| buildings added | — | 1/1 | — | 1/1 | — | 1/1 |
| units added | — | 0/24 | — | 0/24 | — | 0/24 |
| units modified | 0/874 | 0/3475 | 0/867 | 0/3482 | 0/874 | 0/3476 |
| households modified | 3600/3600 | 3600/3600 | 3600/3600 | 3600/3600 | 3600/3600 | 3600/3600 |
| workers modified | 0/582 | 0/643 | 0/519 | 0/591 | 0/568 | 0/620 |
| businesses added | 45/45 | 56/56 | 33/33 | 48/48 | 46/46 | 52/52 |
| businesses modified | 45/360 | 55/447 | 32/375 | 46/492 | 46/366 | 51/447 |
| jobs added | 0/135 | 0/168 | 0/99 | 0/144 | 0/138 | 0/156 |
| jobs removed | 0/150 | 0/180 | 0/111 | 0/153 | 0/153 | 0/168 |
| jobs modified | 0/1065 | 0/1296 | 0/1149 | 0/1458 | 0/1080 | 0/1308 |
| links modified | 0/109 | 0/98 | 0/91 | 0/84 | 0/110 | 0/82 |
| facilities modified | 94/294 | 64/179 | 82/251 | 88/209 | 128/289 | 79/169 |
| utilities modified | 0/268 | 0/168 | 0/248 | 0/196 | 0/264 | 0/152 |
| projects added | — | 1/1 | — | 1/1 | — | 1/1 |
| projects modified | — | 3/13 | — | 3/13 | — | 3/13 |
| policies modified | — | 0/4 | — | 0/4 | — | 0/4 |

## Gaps and interpretation

The fixed scope covers the thirteen collections exposed by Future Machine `ENTITY_KINDS`. City 1.1.0 resident records, aggregate finance/system summaries, parameters, flows and shock configuration remain outside this metric. It is not coverage of every City inventory type or state mutation. The original scope is retained explicitly for comparison across model versions.

A same-month exact-entity receipt establishes recorded association only. It does not prove that every changed field is explained, that a dependency is causal, or that a modeled outcome is empirically valid. Unique-entity coverage credits one receipt anywhere in the run; transition coverage exposes uncovered months. District geography associations and resident observation events can supply receipts without explaining all changed fields. Consult the per-type table and uncoveredFields/uncoveredExamples rather than treating a high aggregate percentage as complete explanation.

Seed 42 plan retains the exact month-16 building-addition event 16-0 regression. No receipt is borrowed from the other arm, a later month or a nearby entity.

## Gate proposal, pending human decision

The proposal remains 100% distinct-entity and transition coverage, overall and per nonempty type, for the fixed runs. The observed results do not meet it. No CI coverage threshold is enabled; tests verify accounting, determinism and equality with the checked-in artifact. A human decision on the threshold and receipt-presence criterion is still required.

## Reproduction

Run from this integrated checkout:

```sh
bun scripts/why-receipt-coverage.js > /tmp/why-receipt-coverage.json
bun test --timeout 60000 test/why-receipt-coverage.test.js test/future-machine-story.test.js test/future-machine-diff.test.js
```

The original City 1.0.0 artifact belongs to PR #191 head `61334afe9f62a38350ac3801b781a394e75b30c0`; its stored source hashes describe that revision. These are deterministic synthetic recomputations, not independently retained historical checkpoints. Browser testing is inapplicable to this offline audit.
