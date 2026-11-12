# Neighborhood paired-day comparison

Open `/world` → **What if?**, place an addition, then **Simulate before & after**.
The result includes two editable resident IDs. **Compare residents** reads each
ID's recorded without-addition and with-addition outcomes; unknown IDs and
mismatched identities display an unavailable state. The first two recorded IDs
are selected initially. Replacing or clearing the scenario hides stale results.

`compareNeighborhood` returns the existing `neighborhood-what-if.v1` result plus
`modelVersion` and `runId`. The latter is a deterministic SHA-256 digest of the
serialized input context, project, configuration and model/comparison versions,
not a persistent experiment lookup or an independent replay certificate.
Property serialization order is part of this identity. Identical reruns have the
same ID; different input serialization may have different IDs. Records are held
in memory until replaced; this feature adds no saved experiment or policy editor.
`selectResidentPair(result, ids)` reads exact IDs and verifies both recorded arm
IDs before returning observations. It neither mutates records nor joins models.

Both synthetic populations are generated from identical seed and context before
one addition is applied at minute zero. Each runs 96 fifteen-minute steps.
Resident identity is local to this pair; matching a live Population, monthly City,
House or scalar oracle resident is unsupported. Commute is recorded mean planned
work-departure minutes; null means no observed work departure. Housing burden is
annual household rent/income in percent; daily access is the share of grocery and
park destinations within 400 metres. Deltas for percentages use percentage points.
Different residents are not controls for one another. Policy assumptions, one
paired day, branching random streams and synthetic uncalibrated behavior limit
causal interpretation. Zero differences are valid.

Checks: `bun test test/neighborhood-what-if.test.js test/population-model.test.js test/worker-platform.test.js --timeout 30000`.
Browser journey: `bunx playwright test test/e2e/neighborhood-what-if.e2e.js`.
