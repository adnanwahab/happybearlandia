# Erase one intervention · decision-ablation.v1

Entry: `/world/decision.html`, “Erase one intervention” in the run panel. Save to
server or reopen an experiment first. Choose a saved alternative and one numeric
setting. The lens loads the parent's manifest, ignores unsaved editor changes,
and creates a separate server experiment through the normal Decision API.
The parent is never edited. Local-project-only drafts must first be saved to server.

“Erase” means restore one explicit numeric parameter to the value in that
experiment's saved baseline. It does not undo an arbitrary natural-language
proposal or infer the history of a decision. The fresh control is the selected
saved alternative in full; the fresh variant differs only in that parameter.
Scenario IDs, names and baseline/alternative roles are assigned for the new pair.
Seed, run count, years, model version, uncertainty, projects, outcome criteria,
visual settings and evidence remain from the source. Independent random streams
and run-index seeds come from the existing kernel. Other saved alternatives are
excluded from this two-scenario execution.

The child's `metadata.ablation` contains `schemaVersion: decision-ablation.v1`,
`parentExperimentId`, `sourceScenarioId`, `parameterId`, `originalValue`,
`restoredValue` and an interpretation string. Normal experiment manifests retain
this metadata, source evidence and executable inputs. No new server contract,
model coefficients, social mechanism, entity mapping or RNG is introduced.

Forked, inherited or stress-bearing source/baseline scenarios are conservatively
blocked. A setting with uncertainty on either side is blocked even for a fixed
rule, because retaining that rule could supersede the numeric reset. Missing
values, unchanged settings and unavailable model versions produce no effect.
Projects and other settings remain fixed; this is a conditional model contrast,
not a decomposition into additive independent real-world causes.

The panel immediately explains pending computation and disables repeat execution.
It reveals nothing until terminal completion, exact requested input matching,
and one valid row per scenario/run index are confirmed. Rows must belong to the
new experiment, have the expected engine/model version and seed, completed status,
no error, and finite values for every model metric. Missing, duplicate, cancelled,
failed, mismatched or nonfinite evidence yields “Effect unavailable”; it is never
replaced with zero. Navigation to another saved experiment invalidates pending
callbacks. Page exit disposes the poll watcher; server computation may finish.

The displayed effect is the arithmetic mean of paired **variant minus control**
final `housing_supply` values, in modeled homes at the saved horizon. Pair count
is a count of executed seed pairs, not people or a probability. Observed source
annotations remain in evidence; numerical defaults and rules are synthetic;
the contrast is computed; the surrounding schematic scene is decorative context.
This uncalibrated aggregate housing demonstration establishes no observed causal
or population claim. No new graphics or animation resources are allocated.

Representative fixture: `test/fixtures/decision-ablation/representative.json`,
housing 1.2.0, seed 741, three paired executions, two years, permitting 6 → 18
months while zoning and all other source inputs stay fixed. Unit tests rerun it
and compare complete seed/metric sequences. Browser test:
`bunx playwright test --config test/decision-ablation.browser.config.js`.
`HBL_BUN_EXECUTABLE` can select a real Bun binary if a package shim shadows it.
`HBL_PLAYWRIGHT_PORT` selects an isolated port and temporary Decision store.
