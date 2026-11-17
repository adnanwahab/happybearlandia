# Social civilization and character continuity

Initial journey: select an existing Living City resident (person panel), or a generated/saved Inner Lives person, then open **Character continuity**. Follow that exact reference into Game, Everybody Act Normal, or World Line Talk. Game offers private fictional memory recording; the party offers an explicit name-prefill action while retaining its existing room/session authority; World Line Talk records resolved conversation turns as fictional references. Every destination also offers the same character actions.

`continuity.js` uses foundation canonical IDs and NavigationContextSchema; `journey.js` uses the shell's contextFromURL/contextURL/navigationMessage. Person/household/home/job/location IDs use source namespace and `${worldId}/${sourceLocalId}`; no name/coordinate matching. Population `personRow` now exposes actual home/current location IDs from indexed locations. Unknown mappings stay null. Schedule, relationships, needs and journal are copies of the inspected source record. Source journals and conversation memories are fictional; current activity, needs and commute are synthetic snapshot output, never observed resident facts or causal evidence.

The canonical entity is retained across all five destinations with world/experiment/run/branch/tick context. Browsing defaults come from the shell and do not constitute recorded run provenance. This handoff does not replay a native simulator to the URL tick, reassign native casts, or claim a narrative caused model outcomes. Saved Inner Lives IDs retain their original browser save; no household or multiplayer save is written. A shared browser's continuity store is private browser-local data, not a server authorization mechanism.

The dedicated localStorage key `hbl-social-continuity-v1` retains 50 character snapshots and 200 references, partitioned by exact world/scenario/experiment/run/branch/tick/entity. No network writes occur. References expose canonical narrative IDs and optional validated sourceRecordId; absent causal records stay null. Links alone cannot transfer local references across devices. Household economic projections accept explicit external mappings and are not automatically inferred from a Living City household.

Focused checks: `bun test test/social-continuity.test.js test/population-world-view.test.js test/household-economic-adapter.test.js`; `test/e2e/social-continuity.e2e.js` covers the handoff UI, party name action and fictional reference persistence. The browser tests can use the normal app server, or a static server after mapping extensionless registry routes to their `.html` files (as the tests do). Full WebGPU gameplay and live multiplayer are outside these focused handoff checks.

The World resident toolbar's **Social…** button now opens a nearby-resident picker
using the selected authority's current social inspection (`legacySocial.inspect`
or the Living runtime's `inspectPerson().social`). It shows actual target IDs,
names and distances; map selection remains available. The dialog sends the same
existing social commands, displays their returned outcome text, and refreshes
eligibility after success or rejection. Empty, unavailable and stale inspections
remain explicit and retryable. Child targets and same-household targets cannot
be selected for romance in the picker; the authoritative command retains every
proximity, age, household and cooldown check. Inspection does not simulate time,
create pedestrians or promise a favorable outcome. Regression coverage:
`test/e2e/resident-social-menu.e2e.js`.
