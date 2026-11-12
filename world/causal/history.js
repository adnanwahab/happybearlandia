import { housingProjectBuildingId } from '../city/contracts.js';
import { cityEntityId } from './demo.js';

const collections = {
  districts: 'district',
  buildings: 'building',
  households: 'household',
  workers: 'person',
  businesses: 'business',
  links: 'link',
};

export function cityInventory(state, worldId) {
  const names = new Map(state.districts.map(district => [district.id, district.name]));
  const units = new Map();
  for (const unit of state.units) {
    const counts = units.get(unit.buildingId) ?? { total: 0, occupied: 0 };
    counts.total++;
    if (unit.householdId) counts.occupied++;
    units.set(unit.buildingId, counts);
  }
  const district = id => names.get(id) ?? id ?? 'Unassigned';
  const describe = {
    districts: row => `Modeled district · ${row.name ?? row.id}`,
    buildings: row => {
      const counts = units.get(row.id) ?? { total: 0, occupied: 0 };
      return `${district(row.districtId)} · ${row.floors} floors · ${counts.occupied}/${counts.total} units occupied`;
    },
    households: row => `${district(row.districtId)} · ${row.unitId ?? 'Unhoused'}`,
    workers: row => `${district(row.districtId)} · ${row.jobId ?? 'No job'}`,
    businesses: row => `${district(row.districtId)} · ${row.type} · ${row.status}`,
    links: row => `${district(row.from)} → ${district(row.to)} · ${row.mode} · ${row.closed ? 'closed' : `capacity ${row.capacity}`}`,
  };
  return Object.fromEntries(Object.entries(collections).map(([collection, kind]) => [
    collection, state[collection].map(row => ({
      id: cityEntityId(worldId, kind, row.id),
      name: row.name ?? row.id,
      description: describe[collection](row),
    })),
  ]));
}

export function compareInventory(current, previous) {
  if (!previous) return current;
  return Object.fromEntries(Object.entries(current).map(([collection, items]) => {
    const prior = new Map(previous[collection].map(row => [row.id, row]));
    const rows = items.map(row => {
      const before = prior.get(row.id);
      prior.delete(row.id);
      if (!before) return { ...row, change: 'Added' };
      if (before.description !== row.description) {
        return { ...row, change: 'Changed', previous: before.description };
      }
      return row;
    });
    for (const row of prior.values()) rows.push({ ...row, change: 'Removed' });
    return [collection, rows];
  }));
}

// The model emits the source event and the causal trace separately. Join the
// same project's records in the same month using the model's building ID rule.
export function indexConstructionEvidence(events, worldId) {
  const key = (month, entityId) => `${month}/${entityId}`;
  const traces = new Map();
  for (const event of events) {
    if (event.type !== 'PROJECT_COMPLETED' || event.payload.system !== 'construction') continue;
    traces.set(key(event.context.tick, event.entityIds[0]), event.id);
  }
  const buildings = new Map();
  for (const event of events) {
    const completion = event.payload.source?.payload;
    if (event.type !== 'PROJECT_COMPLETE' || completion?.type !== 'housing' ||
        typeof completion.projectId !== 'string') continue;
    const month = event.context.tick;
    const project = cityEntityId(worldId, 'project', completion.projectId);
    const trace = traces.get(key(month, project));
    if (!trace) continue;
    const building = cityEntityId(worldId, 'building', housingProjectBuildingId(completion.projectId));
    buildings.set(key(month, building), trace);
  }
  return (month, buildingId) => buildings.get(key(month, buildingId));
}

// Removed rows remain inspectable at the transition month that records them.
export function hasInventoryEntity(rows, entityId) {
  return Object.values(rows).some(items => items.some(row => row.id === entityId));
}
