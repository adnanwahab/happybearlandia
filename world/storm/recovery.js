import { roads, buildings } from './scenario.js';

export const RECOVERY_VERSION = 'storm-recovery.v1';
export const RESPONSE_BUDGET = 200000;
export const SHIFTS = 8;
const SHELTER_PLACES = 12;
const SHELTER = { id: 'shelter', label: 'Open depot shelter', cost: 20000, duration: 1 };

export function responseOptions(impact) {
  return [
    ...impact.roads.filter(row => row.lastStatus === 'closed').map(row => ({
      id: 'road/' + row.id, target: row.id, label: 'Pump and clear ' + row.name, cost: 30000, duration: 2,
    })),
    ...impact.buildings.filter(row => row.type !== 'home' && row.lastExposure === 'flooded').map(row => ({
      id: 'building/' + row.id, target: row.id, label: 'Restore ' + row.name, cost: 45000, duration: 3,
    })),
    SHELTER,
  ];
}

function reachable(openRoads) {
  const nodes = new Set(['depot']);
  for (let changed = true; changed;) {
    changed = false;
    for (const { id, from, to } of roads) {
      if (openRoads.has(id) && nodes.has(from) !== nodes.has(to)) {
        nodes.add(from);
        nodes.add(to);
        changed = true;
      }
    }
  }
  return nodes;
}

export function simulateRecovery(impact, { actions = [], aid } = {}) {
  const crews = 1 + (aid?.accepted ? aid.crews : 0);
  const aidCost = aid?.accepted ? aid.price : 0;
  if (!Number.isInteger(crews) || crews < 1 || crews > 3 || !Number.isInteger(aidCost) || aidCost < 0) {
    throw new Error('Invalid response resources.');
  }
  const options = new Map(responseOptions(impact).map(job => [job.id, job]));
  if (!Array.isArray(actions) || new Set(actions).size !== actions.length || actions.some(id => !options.has(id))) {
    throw new Error('Choose unique response actions from this storm.');
  }
  const pending = actions.map(id => options.get(id));
  const committed = aidCost + pending.reduce((sum, job) => sum + job.cost, 0);
  if (committed > RESPONSE_BUDGET) throw new Error('This dispatch plan exceeds the response budget.');

  const roadsById = new Map(roads.map(row => [row.id, row]));
  const buildingsById = new Map(buildings.map(row => [row.id, row]));
  const exposed = new Set(impact.buildings.filter(row => row.lastExposure === 'flooded').map(row => row.id));
  const dry = new Set(impact.buildings.filter(row => row.lastExposure === 'dry').map(row => row.id));
  const open = new Set(impact.roads.filter(row => row.lastStatus === 'open').map(row => row.id));
  const closed = new Set(impact.roads.filter(row => row.lastStatus === 'closed').map(row => row.id));
  const running = [];
  const sheltered = new Map();
  const timeline = [];
  let shelterOpen = false;
  let spent = aidCost;

  function accessible(job, nodes) {
    if (job.id === 'shelter') return true;
    const road = roadsById.get(job.target);
    return road ? nodes.has(road.from) || nodes.has(road.to) : nodes.has(buildingsById.get(job.target).node);
  }

  for (let shift = 0; shift <= SHIFTS; shift++) {
    const events = [];
    for (const job of running.filter(job => job.finish === shift)) {
      const road = roadsById.get(job.target);
      if (road) {
        open.add(road.id);
        closed.delete(road.id);
      } else if (job.id === 'shelter') shelterOpen = true;
      else dry.add(job.target);
      events.push({ shift, kind: 'completed', jobId: job.id, label: job.label });
      running.splice(running.indexOf(job), 1);
    }
    const nodes = reachable(open);
    if (shift > 0) {
      while (running.length < crews) {
        const index = pending.findIndex(job => accessible(job, nodes) && shift + job.duration <= SHIFTS);
        if (index < 0) break;
        const [job] = pending.splice(index, 1);
        running.push({ ...job, finish: shift + job.duration });
        spent += job.cost;
        events.push({ shift, kind: 'dispatched', jobId: job.id, label: job.label });
      }
    }
    if (shelterOpen) {
      let places = SHELTER_PLACES - [...sheltered.values()].reduce((sum, count) => sum + count, 0);
      for (const building of buildings) {
        if (!places || !building.households || sheltered.has(building.id) || !exposed.has(building.id) || !nodes.has(building.node)) continue;
        const count = Math.min(places, building.households);
        sheltered.set(building.id, count);
        places -= count;
        events.push({ shift, kind: 'sheltered', buildingId: building.id, count, label: building.name });
      }
    }
    const operating = type => buildings.filter(row => row.type === type && dry.has(row.id) && nodes.has(row.node)).length;
    timeline.push({
      shift, closedRoads: closed.size, reachableBuildings: buildings.filter(row => nodes.has(row.node)).length,
      operatingServices: operating('service'), operatingBusinesses: operating('business'),
      shelteredHouseholds: [...sheltered.values()].reduce((sum, count) => sum + count, 0),
      spent, events,
      active: running.map(({ label, finish }) => ({ label, finish })),
      pending: pending.map(job => ({ label: job.label, reachable: accessible(job, nodes) })),
    });
  }
  return { version: RECOVERY_VERSION, crews, committed, timeline };
}
