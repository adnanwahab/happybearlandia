# Matched delay sensitivity — reproducible engine experiment

This experiment describes the current synthetic monthly City model. It does not estimate real-world housing effects or a statistical uncertainty interval. No model equation or browser behavior changed.

Run from the checkout:

```sh
bun scripts/research-future-sensitivity.mjs --output /private/tmp/future-sensitivity.json
bun test test/research-future-sensitivity.test.js
```

The retained [machine-readable result](research/future-sensitivity-20261111.json) contains four seeds (0, 1, 42, 4294967295), housing-policy delays of 0, 6 and 24 months, 30 starting households and a 120-month horizon. Within each seed, all alternatives begin from one immutable original. Independently execute a zero control and repeat every intervention. Each of the 12 cases retains all 121 monthly metric comparisons, exact state hashes, full normalized-history digests and recorded housing completion identities. Initial, generator and model versions, system manifest, Git reference and source byte hashes are included.

The fixed generator sets private parcel capacity to zero, each district/network utility capacity to 200 and annual growth to zero. Construction, finance and rent coefficients are illustrative and uncalibrated. A seed changes initial household income as well as subsequent draws; this is sensitivity across selected synthetic worlds, not isolated stochastic variance.

## Observed results of this execution

All twelve cases passed the verification gates and ended with 24 additional homes and 1,000,000 additional illustrative USD of cumulative capital spending. Completion occurred at Months 16, 22 and 40 for delays 0, 6 and 24 respectively. Those observations are version-specific results, not general monotonicity guarantees.

Month 120 whole-stock mean-rent differences (plan minus baseline), illustrative USD/month, rounded here only:

| Seed | Delay 0 | Delay 6 | Delay 24 |
| --- | ---: | ---: | ---: |
| 0 | -714.70 | -699.51 | -625.19 |
| 1 | -736.08 | -696.35 | -640.75 |
| 42 | -740.77 | -710.13 | -645.09 |
| 4294967295 | -722.82 | -690.87 | -632.86 |

Mean rent includes newly added inventory. These differences do not establish incumbent household savings, welfare or empirical causal effects. Equal housing totals alongside different rent results are compatible with the constrained fixture and do not demonstrate ignored seeds.

The retained run performed 3,840 monthly steps in 6,372.65 ms, including execution, normalization, reconciliation, hashing and comparisons. API workers, persistence, network and rendering are excluded. Source files and Git reference remained unchanged during execution. The deterministic digest of `{protocol,controls,cases}` is `0b13121de75f7745777c7a84b4aa973887b4695a8b65823cb02850d2c0b742bb`; runtime and source metadata are deliberately outside that digest.

## Verification meaning and limits

`passed` means computation completed and the declared checks held. A project unfinished at Month 120 can pass the experiment; it is reported through absent completion records and measured inventory, not counted as a crash. `failed` identifies a violated experiment check; `error` identifies an execution/contract exception. Case errors remain in the output, and the CLI exits unsuccessfully if any case, control or source-stability check fails.

The independent reconciler checks state invariants, month/seed/model identity, homes against unit inventory, rent against inventory sums and cumulative spending against every monthly finance ledger. Every newly observed building and unit must match a completed housing project and contemporaneous event. Regression tests falsify metrics, ledgers, missing months, missing completion events, premature future inventory and unsupported units added to existing buildings. They also execute a 120-month-delay case to distinguish noncompletion from failed computation.

Repeated normalized histories preserve states, events, observations, decisions, moves, trips, flows and diagnostics. This does not establish independent checkpoint equivalence or validate the model against observed cities. Richer trace instrumentation and raw proposal/resolution invariance are separate checks. The experiment intentionally retains the existing model authority, IDs and version.
