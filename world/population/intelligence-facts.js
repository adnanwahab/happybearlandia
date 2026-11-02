const records = actor => Array.isArray(actor?.decisionTrace) ? actor.decisionTrace : [];
/** Export only retained facts. Missing trip/decision detail remains null; no
 * inferred route, random draw, score, arrival or observation is manufactured. */
export function populationFactTables(snapshot = {}, entities = []) {
  const globalEvents = Array.isArray(snapshot.events) ? snapshot.events : [];
  const entityEvents = entities.flatMap(entity => (Array.isArray(records(entity)) ? records(entity) : []).map(event => ({ ...event, entityId: event.entityId || event.actorId || entity.id })));
  const unique = new Map();
  for (const [index, event] of [...globalEvents, ...entityEvents].entries()) {
    const id = event.id || event.eventId || `${event.entityId || event.personId || event.householdId || "aggregate"}:${event.type || event.eventType || event.decisionType}:${event.minute ?? event.simulationTime ?? event.tick ?? index}`;
    if (!unique.has(id)) unique.set(id, { ...event, retainedFactId: id });
  }
  const events = [...unique.values()], decisions = [], trips = [];
  for (const event of events) {
    const payload = event.payload || event, type = event.eventType || event.type || event.decisionType;
    if (event.schemaVersion === "decision-event.v1" || event.decisionType || /CHOSEN|DECISION|SEARCH|MOVED|MODE_CHOICE/i.test(type || "")) decisions.push({ decision_id: event.decisionId || event.id || event.retainedFactId, run_id: event.runId ?? snapshot.runId ?? null, scenario_id: event.scenarioId ?? snapshot.scenarioId ?? null, actor_type: event.entityType || event.actorType || null, actor_id: event.entityId || event.actorId || payload.personId || payload.householdId || null, household_id: payload.householdId || null, decision_type: event.decisionType || type, simulation_time: event.simulationTime ?? event.minute ?? null, chosen_option: payload.chosenOption ?? payload.chosen ?? null, random_draw: payload.randomDraw ?? null, model_id: event.model?.id || payload.coefficientModel || null, model_version: event.model?.version || snapshot.modelVersion || null, alternatives: structuredClone(payload.alternatives || []), reasons: structuredClone(payload.reasonCodes || payload.reasons || []) });
    if (/^TRIP_(STARTED|ENDED)$/.test(type || "")) trips.push({ trip_id: payload.tripId || null, event_id: event.retainedFactId, event_type: type, run_id: event.runId ?? snapshot.runId ?? null, person_id: payload.personId || event.entityId || event.actorId || null, origin: payload.origin ?? payload.from ?? null, destination: payload.destination ?? payload.to ?? null, purpose: payload.purpose ?? null, mode: payload.mode ?? null, depart_time: payload.departTime ?? (type === "TRIP_STARTED" ? event.simulationTime ?? event.minute : null) ?? null, arrive_time: payload.arriveTime ?? (type === "TRIP_ENDED" ? event.simulationTime ?? event.minute : null) ?? null, planned_minutes: payload.plannedMinutes ?? null, experienced_minutes: payload.experiencedMinutes ?? null, cost: payload.cost ?? null, delay: payload.delay ?? null });
  }
  const observations = (Array.isArray(snapshot.timeSeries) ? snapshot.timeSeries : []).map(row => ({ simulation_time: row.minute ?? row.simulationTime ?? null, tick: row.tick ?? null, metrics: structuredClone(row.metrics || row), provenance: "actual retained aggregate observation" }));
  return { schemaVersion: "population-fact-tables.v1", decisions, trips, observations, events: structuredClone(events), retention: { globalRetained: globalEvents.length, selectedEntityRetained: entityEvents.length, globalLimit: snapshot.config?.maxLogEntries ?? null, entityLimit: 12, fullTripsAvailable: false, notice: "These tables contain retained events and selected entity traces only. Trip start/end rows are not reconstructed into complete trips when a counterpart was dropped. Missing fields stay null. No exhaustive trip history or regenerated detail is claimed." } };
}
