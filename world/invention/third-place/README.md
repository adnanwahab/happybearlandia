# Third Place Designer — SHE-708

Enter from `/world/invention/` → Third Place Designer. This session-local authored
challenge validates pocket park/plaza designs on `third-place-lot-1`, a synthetic
400 m² lot with 100,000 illustrative USD for the first year. The pinned source
`empty-lot.v1` and rules `third-place-design.v1` carry seed 708 in both arms.
No random draws occur. This identity/clock is not a City parcel or monthly run.

Park: 300 m², capital 60,000 + annual upkeep 6,000 USD. Plaza: 400 m²,
80,000 + 10,000 USD. These are authored toy assumptions, including immediate
completion. First-year cost is capital plus one year of upkeep; remainder is
budget minus that sum. Before/after refer to design revisions, not dated
construction checkpoints. Success means a permitted design fits those rules.
Real planning permissions, financing, delays, maintenance effectiveness and
community success are unavailable. There are no measured data or live services.

No social mechanism is added. Visitation, relationship and measured-observation
fields are unavailable/null in both checkpoints; no zero, score, effect or
narrative resident testimony is substituted. City `systems.js` service demand
is a population/capacity proxy, and `residents.js` district ties do not respond
to these designs. Neither can establish project-driven visits or social benefit.
The scripted invitation is visibly fictional. This is outside the ODD inventory's
ABM boundary; City and Population mechanisms remain unchanged.

Confirmation validates the fixed source revision, catalog membership, permitted
use, area and first-year budget before returning deeply frozen checkpoints.
New confirmations replace the session comparison without mutating earlier
objects. Cancel changes only the draft. Clearing source disables confirmation
while retaining the prior comparison. Replay JSON is bounded to 8192 UTF-8 bytes;
unsupported versions/source and altered checkpoint content fail closed. The
arithmetic is recomputed and compared to the supplied records, including both
seeds and all unavailable fields. This detects inconsistency, not authenticity;
JSON can be authored by anyone. Replay does not claim independent recorded City
state verification. No persisted source World, account, vote or run is touched.

Copy the replay JSON before reload; paste and verify to reopen both checkpoints.
All controls are native labeled DOM elements. No animation/WebGL is required.
External prerequisite for community outcomes: a reviewed model-owned third-place
intervention and visitation/social observation contract with documented rules,
versions, time/identity mapping and matched-control tests. Real observations
would also require a sourced dataset; toy costs are not empirical estimates.

Checks:

```sh
bun test test/third-place.test.js test/city-invention-plan.test.js
HBL_DOM_MODULE=/path/to/happy-dom/lib/index.js bun test test/third-place-dom.test.js
bunx playwright test --config test/third-place.browser.config.mjs
```
