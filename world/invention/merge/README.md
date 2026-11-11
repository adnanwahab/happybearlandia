# Worldline Merge Studio

Open `/world/invention/merge/` and paste two `/world/invention/future/?plan=…` links. The example uses Riverside transit and Center housing. Integrations can prefill `left` and `right` with individually URL-encoded results of `encodePlan`. A complete comparison updates the page URL so that reopening it reruns the same four plans.

Source recipes must use a supported recipe and City model version and share the seed and horizon. Duplicate identical policies are counted once. Different options for the same policy type and district produce a conflict. The baseline, both source policies, and the merged policies run through the existing City engine from the same synthetic starting scenario. All four outcomes link to a replayable future recipe. The view uses a browser worker and creates no saved runs.

The separate-effects comparison subtracts the sum of both baseline-relative changes from the merged change. It is a diagnostic for this modeled seed. If the source plans share a policy, the additive comparison is unavailable because it would count the shared policy twice. Missing observations stay unavailable, and the commute comparison reports each arm's measured trip count.

Run `bun test test/worldline-merge.test.js`.
