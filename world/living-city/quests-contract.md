# Emergent City quests

`discoverQuests({state, trips})` reads a monthly City checkpoint. Authored
narrative templates interpret measured problems across all matching entities:
congested commute, rent burden over 40%, open-business deficit, facility
shortfall, and utility shortfall. These are synthetic modeled measurements.
There is no external observation dataset or random quest selection.

Every quest records its entity, source observation, measurement and units,
month, seed, city revision, model version, source provenance, and quest rules
version. Commutes also retain the trip. Objectives use fixed, inspectable
thresholds; the commute target is the planned duration at discovery.

`updateQuests(quests, checkpoint)` checks a later month on the same seed.
Missing entities, closed businesses, unhoused households, missing trips and
nonfinite measurements are unavailable, never successful. A met objective
retains its first completion receipt with before/after source observations and
that month's engine event IDs. Event IDs provide checkpoint context; they do
not assert that a particular event or player caused completion. Completed
quests remain completed if conditions later regress. Replay checks every month
and adds newly discovered entity objectives, with one objective per type/entity
per run. A renewed episode for a completed entity is follow-on scope.

Living City's worker replay returns these records for both arms; the request
panel displays the selected arm's status and completion change. Compact
100-sample ensembles retain their previous shape. Engine inputs and share
recipes remain compatible; quest rules have their own version.

`createSharedScenario(checkpoint, players)` and
`applyScenarioCommand(scenario, {playerId, expectedRevision, intervention})`
provide a local immutable authority for multiple named players. Each accepted
command advances one month through the City engine and logs the player and
optional supported intervention. Unknown players and stale revisions fail
without changing the parent. These IDs are not authentication. Online sessions,
transport, storage, permissions and lobby UI are not implemented. A host must
serialize commands against the current revision before offering remote play.
