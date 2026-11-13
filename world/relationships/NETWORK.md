# Recorded resident network — SHE-135

Select a resident in Living World or the legacy World inspector. The shared
social panel now includes **Recorded social network**, a depth selector (0–3),
a schematic, accessible resident/edge lists and resident inspection buttons.
The view defaults to depth 1. Empty ledgers show only the chosen resident.

`projectSocialNetwork` in `network.js` projects only saved `social.ties` entries.
It never traverses `inspect().relationships`, which includes seeded fictional
backstory, nearby people and household-derived relationships. Exact endpoint
IDs must resolve to existing residents. Invalid/self entries are omitted and
counted. Stable edge IDs are the original ledger keys; node IDs are the original
resident IDs. No names, memory narratives, traits or inferred relation types
are copied into this projection. Display labels identify synthetic residents.
Presence in the saved ledger alone does not establish an observed encounter.

Traversal is deterministic breadth-first, using sorted ledger keys and an
undirected interpretation of the canonical pair ties. Cycles close once per
ledger key. Include ledger edges between admitted nodes at the depth boundary.
Limits are 80 nodes and 160 edges, including the root; smaller limits may be
supplied to the pure projection. Truncation is explicit. This is a bounded
snapshot, not proof that an unshown resident or edge does not exist. UI depth
filters the same depth-3 snapshot. Refresh/reselect the resident to update it.
No new simulation state, mutations, persistence schema or worker command exists.

Population provenance retains prefix (population identity, not a unique fork),
model version, seed, tick and minute. Legacy provenance retains available world
ID/model version/seed/minute and marks missing values unavailable. Model rules
remain those of the existing saved authority. No scalar-oracle, CityState or
House identity/clock equivalence is asserted. Snapshot generation scans/sorts
the saved sparse ledger; it is not a million-agent performance claim.

Validation commands:

```
bun test test/social-network.test.js test/relationships.test.js test/personal-goals-promises.test.js test/house-relationships.test.js test/city-traditions.test.js
HBL_PLAYWRIGHT_PORT=4135 HBL_PLAYWRIGHT_PARTY_PORT=4136 bunx playwright test test/e2e/social-network.e2e.js test/e2e/relationships.e2e.js --grep 'resident panel|real population'
```

The browser check requires permission to bind loopback sockets. This sandbox
returned EADDRINUSE from Bun on both default/alternate ports; a direct ephemeral
Python bind established the underlying EPERM restriction. No browser assertions
ran. The focused browser regression is supplied for an environment with sockets.
