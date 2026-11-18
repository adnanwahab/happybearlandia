# The Collective Mind

Open `/world/collective-mind/` to run 1,000 seeded agents through 60 synchronous rounds. Change the proposal labels, initial seed, chance of adopting a clear winner, or communication network. The address retains the versioned recipe and inspected round after adjusting the slider or pausing. Reloading that address recomputes the same history.

Each synthetic resident belongs to one of eight districts. The seed determines a district-biased initial preference and a private weight of one to two votes. In each round, residents count one vote from each direct contact and add their own initial preference weight. Residents keep their current choice in a tie and otherwise adopt the winner with the configured chance. All updates read the same prior frame. Separate districts use disjoint local contact rings; bridges add 64 inter-district links; the citywide network uses a seeded shuffled ring and its four nearest contacts in each direction. The three graphs share the same seeded initial preferences.

Agreement is the fraction of all links whose endpoints have the same current preference. Leading support is the largest option share across all agents. The animation draws all agents and a deterministic sample of same-preference edges, while the statistics use the complete graph. The WebGPU rendering path uses the same CPU model frames as the Canvas 2D fallback. The question and proposal names label options for the visitor.

Verify with `bun test test/collective-mind.test.js`. The simulation has its own synthetic IDs and rounds. It runs locally and has no saved-world data or external planning dependency.

## Idea Diffusion Tag (SHE-715)

Below the opinion experiment, load the authored diffusion demo, select next
recipients (including none), and reveal one contact round. This uses the existing
`local-idea.v1` / `radius-sharing.v1` engine, not the opinion model. Ada, Bo, Cy
and Dee are synthetic IDs on a fixed graph measured in illustrative meters;
there is no identity/time mapping to saved Population or the opinion agents.

`diffusion-demo.json` pins tick zero, seed 42, radius 8m and probability .65.
`diffusion-expected.json` pins the independently retained tick-one replay
expectation: Ada reaches Cy through event 1 with parent event 0. These files are
reviewable authored fixtures, not measured observations. Predictions only score
set equality after execution. Every highlighted edge comes from a verified
transmission. Cancel invalidates pending work; reload starts from the unchanged
checkpoint. Missing files and replay mismatches clear the graph/results.

Verify with `bun --no-env-file test test/diffusion-tag.test.js test/local-ideas.test.js`
and `bunx playwright test --config test/diffusion-tag.browser.config.mjs`.
The browser test navigates through the Connected Lives directory. No new service,
analytics, persisted votes, or production data is required.
