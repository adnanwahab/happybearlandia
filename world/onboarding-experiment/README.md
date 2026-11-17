# Scenario-first onboarding v1

Homepage Play Demo retains its ordinary URL and works without JavaScript. Optional
consent enrolls the visitor in `scenario-first.v1` with a cryptographic 50/50 draw.
`hbl.onboarding.v1` in sessionStorage contains the assigned variant and event list;
no identity, referrer, URL, or network collection is used. Reloads reuse assignment.
Uncheck consent to erase it. Download session records provides reviewable JSON.
Closing the tab normally ends browser session storage (browser restore may retain it).

Set `#onboarding-experiment`'s `data-enabled` to `false` to disable enrollment and
routing and erase stored participation on next homepage load. Storage failure
restores the ordinary link. Changing allocation or semantics requires a new version.

Both arms record exposure once, when the consented experience is rendered, before
start/choice clicks. Direct clicks record start; policy participants choose a homes
or budget inspection question, then record choice and start. Both questions open
`/world/future-machine.html?demo=1` with the same fixed recipe. No model inputs,
model RNG, run provenance or shared links are modified. Choice records interest;
it does not configure a different policy or auto-select a metric in Future Machine.
Modified/new-tab link activation retains native browser behavior and is not counted
as a start. Exposure means rendered enrollment, not verified attention. These are
local interaction observations; no conversion, completion or causal effect is
inferred. Analysis must include all exposed sessions, including non-starters, and
account for opt-in selection and unavailable storage. No central aggregation ships
in this slice.

Verify:

- `bun test test/onboarding-experiment.test.js test/future-machine-data.test.js`
- `bunx playwright test --config test/onboarding-experiment.browser.config.js`
