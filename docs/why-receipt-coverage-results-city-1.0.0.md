# WHY receipt coverage results — historical City 1.0.0

Measured 2026-11-12 after fixing [protocol v1](why-receipt-coverage.md).
All results are synthetic monthly City recomputations, 30 starting households,
120 steps per run; baseline and housing-plan arms remain separate. Source, recipe,
model manifest, state and ledger digests and uncovered examples are in the
[machine-readable report](evidence/why-receipt-coverage-city-1.0.0.json). No model changes.

| Seed | Arm | Entities with receipt / changed | Entity coverage | Transitions with receipt / changed | Transition coverage |
| --- | --- | --- | --- | --- | --- |
| 42 | baseline | 91/345 | 26.38% | 2237/7798 | 28.69% |
| 42 | plan | 99/416 | 23.80% | 1083/10643 | 10.18% |
| 7 | baseline | 71/297 | 23.91% | 1660/7656 | 21.68% |
| 7 | plan | 83/384 | 21.61% | 770/10780 | 7.14% |
| 2911 | baseline | 87/349 | 24.93% | 2010/7804 | 25.76% |
| 2911 | plan | 92/400 | 23.00% | 918/10526 | 8.72% |

## Coverage by change type

Each cell is covered / total monthly transitions. A dash means no such change,
not perfect coverage. Full per-type distinct-entity counts are in the JSON.

| Change type | 42 baseline | 42 plan | 7 baseline | 7 plan | 2911 baseline | 2911 plan |
| --- | --- | --- | --- | --- | --- | --- |
| districts modified | 316/316 | 252/290 | 304/313 | 221/280 | 316/316 | 204/253 |
| buildings added | — | 1/1 | — | 1/1 | — | 1/1 |
| units added | — | 0/24 | — | 0/24 | — | 0/24 |
| units modified | 0/874 | 0/3475 | 0/867 | 0/3482 | 0/874 | 0/3476 |
| households modified | 1737/3600 | 651/3600 | 1209/3600 | 362/3600 | 1474/3600 | 527/3600 |
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

Zero receipt coverage where observed: unit additions and modifications, worker
modifications, job additions/removals/modifications, link modifications, utility
modifications, and policy modifications. Partial transition coverage occurs for
districts, households, business modifications, facilities, and project
modifications. Parcels and other omitted combinations have no observed changes.
All observed building additions, business additions and project additions have
receipts. Seed 42 plan's new building has the exact month-16 event 16-0 receipt.

For example, household savings updates, unit rent/occupancy updates, worker job
assignments and utility demand updates are included even without events. See
JSON uncoveredFields and uncoveredExamples for exact records. Receipt presence
does not mean every field is explained. District geography matches can associate
an event with a district without explaining its changed accessibility field.
Unique-entity coverage also credits an entity after just one covered transition;
the lower transition figures expose this limitation. Neither figure measures
causal validity or finance-summary coverage.

## Gate proposal, pending human decision

Propose 100% entity and transition coverage, overall and per observed change type,
under the fixed protocol. These runs fall short. No CI gate is enabled; tests
verify reproducibility and accounting, with no minimum coverage assertion.
A human should decide whether to accept that threshold and whether receipt
presence is an adequate requirement before enabling any gate.

This historical measurement belongs to original PR #191 head `61334afe9f62a38350ac3801b781a394e75b30c0`. Its protocol/source digests describe that checkout. Reproduce from that revision:

```sh
bun scripts/why-receipt-coverage.js > /tmp/why-receipt-coverage.json
bun test test/why-receipt-coverage.test.js test/future-machine-story.test.js test/future-machine-diff.test.js
```

Verification: 23 tests passed, 0 failed, 158 assertions. The audit runs all six
120-step runs twice and compares exact reports, and checks the checked-in artifact.
This is same-version deterministic replay, not independent historical validation.
Browser tests skipped because no browser behavior changed.
