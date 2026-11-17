# Butterfly Ledger prototype

Open a default-recipe comparison in `/world/future-machine.html`, select a
month, click a metric's WHY button, then Open Butterfly Ledger. Four sequential
matched-seed pairs use the existing persisted City API/data adapter. Each changes
one policy input: amount 24→12, cost 1000000→500000, delay 0→12, compliance 1→0.5.
The original experiment remains immutable. Each row shows a canonical SHA-256
recipe hash, seed, model version and saved experiment replay link at that month.

A contribution is the full plan's metric minus that ablated plan's metric.
The observed difference is full plan minus no-policy baseline. Each is rounded
to integer thousandths of the metric's stated unit, and the residual is observed
minus the sum of the four rounded contrasts. Thus the displayed values reconcile
exactly. Raw recomputed observations remain available in the linked replay.

These local contrasts depend on the chosen reference values. The residual
includes nonadditivity, omitted/reference effects and rounding; it cannot be
interpreted as a pure interaction estimate. These are not Shapley values or
empirical causal effects. The interface says “model attribution under stated
assumptions” and warns when the residual exceeds every individual contribution.
The default Month-120 rent residual is −389.241 of −740.769 USD/month, which
raises the issue's kill-criterion concern rather than identifying a unique
dominant input (amount and compliance tie).

Failures leave a retry button. Inspector replacement cancels requests; City jobs
already submitted may still complete, as with normal Future Machine cancellation.
The prototype supports only the default recipe and existing measured metrics.
Replays are manifest recomputations, not independent recorded checkpoints.

Verification: `bun test test/butterfly-ledger.test.js` and
`bunx playwright test --config test/butterfly-ledger.browser.config.js`.
