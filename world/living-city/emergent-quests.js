import { VERSION } from '../city/contracts.js';

export const QUEST_RULES_VERSION = 'city-needs.v1';
const finite = Number.isFinite;

// Narrative templates interpret modeled measurements; they do not invent events.
export function discoverQuests({ state, trips = [] }) {
  const quests = [];
  const add = (type, collection, row, title, request, metric, value, target, unit) => {
    if (!finite(value) || value <= target) return;
    quests.push({
      id: `${type}:${row.id}`, type, title, request,
      entity: { collection, id: row.id, districtId: row.districtId },
      evidence: [{ metric, label: metric, value, unit, month: state.month,
        source: { collection, id: row.id, observation: structuredClone(row),
          ...(type === 'commute' ? { trip: structuredClone(trips.find(trip => trip.personId === row.id)) } : {}) } }],
      objective: { metric, target, comparison: '<=' },
      provenance: { seed: state.seed, modelVersion: VERSION, rulesVersion: QUEST_RULES_VERSION,
        month: state.month, revision: state.revision, source: structuredClone(state.provenance) },
      status: 'active', completion: null,
    });
  };
  for (const trip of trips) {
    const worker = state.workers.find(row => row.id === trip.personId);
    if (worker && finite(trip.plannedMinutes)) add('commute', 'workers', worker,
      `The ${state.districts.find(row => row.id === worker.districtId)?.name ?? worker.districtId} commute`, 'Reduce this resident’s recorded commute to its uncongested planned duration.',
      'transport.experiencedMinutes', trip.experiencedMinutes, trip.plannedMinutes, 'minutes');
  }
  for (const row of state.households) {
    if (row.unitId && state.units.some(unit => unit.id === row.unitId)) add('housing', 'households', row,
      'An affordable home', 'Bring this household’s rent burden to 40% of income or less.',
      'housing.burden', row.housingBurden * 100, 40, '%');
  }
  for (const row of state.businesses) if (row.status === 'open') add('business', 'businesses', row,
    'Keep the shop open', 'Close the gap between operating costs and modeled demand.',
    'businesses.deficit', -row.viability, 0, 'modeled currency / month');
  for (const row of state.facilities) add('school', 'facilities', row,
    'Room for the neighborhood', 'Provide enough places for recorded service demand.',
    'services.shortfall', row.demand - row.capacity, 0, 'places');
  for (const row of state.utilities) add('utility', 'utilities', row,
    'Restore neighborhood services', 'Close the gap between utility demand and effective capacity.',
    'utilities.shortfall', row.demand - row.effectiveCapacity, 0, 'modeled units');
  return quests;
}

function observe(quest, { state, trips = [] }) {
  const row = state[quest.entity.collection]?.find(row => row.id === quest.entity.id);
  if (!row) return null;
  switch (quest.type) {
    case 'commute': return trips.find(trip => trip.personId === row.id)?.experiencedMinutes ?? null;
    case 'housing': return row.unitId && state.units.some(unit => unit.id === row.unitId) ? row.housingBurden * 100 : null;
    case 'business': return row.status === 'open' ? 0 - row.viability : null;
    case 'school': return row.demand - row.capacity;
    case 'utility': return row.demand - row.effectiveCapacity;
    default: return null;
  }
}

export function updateQuests(quests, checkpoint) {
  return quests.map(original => {
    const quest = structuredClone(original);
    if (quest.status === 'completed') return quest;
    if (checkpoint.state.seed !== quest.provenance.seed || checkpoint.state.month <= quest.provenance.month)
      throw new Error('Quest checkpoint must advance the same seeded scenario.');
    const value = observe(quest, checkpoint);
    quest.status = finite(value) ? 'active' : 'unavailable';
    if (finite(value) && value <= quest.objective.target) {
      quest.status = 'completed';
      quest.completion = {
        month: checkpoint.state.month, revision: checkpoint.state.revision,
        seed: checkpoint.state.seed, modelVersion: VERSION, rulesVersion: QUEST_RULES_VERSION,
        before: quest.evidence[0], after: { ...quest.evidence[0], value, month: checkpoint.state.month,
          source: { ...quest.evidence[0].source, observation: structuredClone(checkpoint.state[quest.entity.collection].find(row => row.id === quest.entity.id)),
            ...(quest.type === 'commute' ? { trip: structuredClone(checkpoint.trips?.find(trip => trip.personId === quest.entity.id)) } : {}) } },
        eventIds: (checkpoint.events ?? []).map(event => event.id),
        interpretation: 'Objective observed in modeled state; no player causality is inferred.',
      };
    }
    return quest;
  });
}
