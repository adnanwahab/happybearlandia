export const IMPACT_VERSION = 'storm-impacts.v1';
export const MAX_IMPACT_EVENTS = 4096;
export const FLOOD_RULES = Object.freeze({
  depthUnit: 'm',
  roadClosureDepth: 0.20,
  buildingFloodDepth: Object.freeze({ home: 0.15, business: 0.15, service: 0.15 }),
  depot: 'depot',
  roads: 'Undirected synthetic road links close at or above the threshold anywhere on their sampled cells.',
  buildings: 'Flood exposure uses the same peak-cell rule within each building footprint.',
  access: 'Access means a path to the depot through observed open links. Isolation requires a dry-network path and closures that block every potentially open route.',
  coverage: 'Counts ending in Ticks count sampled frames. Thresholds are illustrative and exposure does not estimate damage, travel time, or service capacity.',
});

function validateGeometry(entities, cellCount, kind) {
  const ids = new Set();
  for (const entity of entities) {
    if (!entity || typeof entity.id !== 'string' || !entity.id || ids.has(entity.id) ||
        !Array.isArray(entity.cells) ||
        entity.cells.some(cell => !Number.isSafeInteger(cell) || cell < 0 || cell >= cellCount)) {
      throw new Error('Invalid or repeated ' + kind + ' geometry.');
    }
    ids.add(entity.id);
    if (kind === 'road') {
      if (![entity.from, entity.to].every(node => typeof node === 'string' && node)) {
        throw new Error('Roads need two modeled network nodes.');
      }
    } else if (!Object.hasOwn(FLOOD_RULES.buildingFloodDepth, entity.type) ||
        (entity.households !== undefined && (!Number.isSafeInteger(entity.households) || entity.households < 0))) {
      throw new Error('Invalid building type or modeled household count.');
    }
  }
}

function exposure(depth, cells, threshold, lower, higher) {
  let peak = null;
  let complete = cells.length > 0;
  for (const cell of cells) {
    const value = depth[cell];
    if (!Number.isFinite(value) || value < 0) {
      complete = false;
    } else if (peak === null || value > peak) peak = value;
  }
  // The physics uses Float32Array frames. Round the declared threshold to the
  // same representation so a nominal 0.15 m Float32 sample is inclusive.
  const bound = depth instanceof Float32Array ? Math.fround(threshold) : threshold;
  const status = peak !== null && peak >= bound ? higher : complete ? lower : 'unknown';
  return { status, peak };
}

function adjacency(roads) {
  const graph = new Map();
  function connect(from, to, index) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push({ node: to, index });
  }
  roads.forEach(({ from, to }, index) => {
    connect(from, to, index);
    connect(to, from, index);
  });
  return graph;
}

function reachable(graph, permitsRoad) {
  const visited = new Set([FLOOD_RULES.depot]);
  const queue = [FLOOD_RULES.depot];
  for (let head = 0; head < queue.length; head++) {
    for (const { node, index } of graph.get(queue[head]) ?? []) {
      if (visited.has(node) || !permitsRoad(index)) continue;
      visited.add(node);
      queue.push(node);
    }
  }
  return visited;
}

function accessAt(node, dryNetwork, open, possible) {
  if (!dryNetwork.has(node)) return { status: 'unknown', reason: 'no-modeled-route' };
  if (open.has(node)) return { status: 'reachable', reason: 'observed-open-route' };
  if (possible.has(node)) return { status: 'unknown', reason: 'incomplete-road-exposure' };
  return { status: 'isolated', reason: 'flooded-routes' };
}

const identity = ({ id, name }) => ({ id, name: name ?? id });

function summarize(roads, buildings) {
  const totals = {
    closedRoads: roads.filter(row => row.closedTicks > 0).length,
    unknownRoads: roads.filter(row => row.unknownTicks > 0).length,
    floodedBuildings: 0, floodedHomes: 0, floodedHouseholds: 0, floodedBusinesses: 0, floodedServices: 0,
    isolatedBuildings: 0, isolatedHomes: 0, isolatedHouseholds: 0, isolatedBusinesses: 0, isolatedServices: 0,
    affectedHouseholds: 0, affectedHomesWithUnknownHouseholdCount: 0,
    unknownAccessBuildings: 0, unknownExposureBuildings: 0,
  };
  const suffixes = { home: 'Homes', business: 'Businesses', service: 'Services' };
  for (const building of buildings) {
    const flooded = building.floodedTicks > 0;
    const isolated = building.isolatedTicks > 0;
    if (flooded) {
      totals.floodedBuildings++;
      totals['flooded' + suffixes[building.type]]++;
    }
    if (isolated) {
      totals.isolatedBuildings++;
      totals['isolated' + suffixes[building.type]]++;
    }
    if (building.type === 'home') {
      if (flooded) totals.floodedHouseholds += building.households ?? 0;
      if (isolated) totals.isolatedHouseholds += building.households ?? 0;
      if (flooded || isolated) {
        totals.affectedHouseholds += building.households ?? 0;
        if (building.households === null) totals.affectedHomesWithUnknownHouseholdCount++;
      }
    }
    if (building.unknownAccessTicks) totals.unknownAccessBuildings++;
    if (building.unknownExposureTicks) totals.unknownExposureBuildings++;
  }
  return totals;
}

function recordPeak(row, peak) {
  if (peak !== null && (row.peakDepth === null || peak > row.peakDepth)) row.peakDepth = peak;
}

export function assessFlood({ size, roads, buildings, frames }) {
  if (!Number.isSafeInteger(size) || size < 1 || !Number.isSafeInteger(size * size) ||
      !Array.isArray(roads) || !Array.isArray(buildings) || !Array.isArray(frames) || !frames.length) {
    throw new Error('Choose a storm grid, monitored entities, and at least one sampled frame.');
  }
  const cellCount = size * size;
  validateGeometry(roads, cellCount, 'road');
  validateGeometry(buildings, cellCount, 'building');
  const graph = adjacency(roads);
  const dryNetwork = reachable(graph, () => true);
  const roadRows = roads.map(road => ({
    ...identity(road), peakDepth: null, closedTicks: 0, unknownTicks: 0, firstClosedTick: null, lastStatus: null,
  }));
  const buildingRows = buildings.map(building => ({
    ...identity(building), type: building.type,
    households: building.type === 'home' ? building.households ?? null : null,
    peakDepth: null, floodedTicks: 0, unknownExposureTicks: 0, isolatedTicks: 0, unknownAccessTicks: 0,
    firstFloodedTick: null, firstIsolatedTick: null, lastExposure: null, lastAccess: null, lastAccessReason: null,
  }));
  const roadStatus = new Array(roads.length);
  const events = [];
  let eventsOmitted = 0;
  let previousTick = -1;

  function transition(previous, normal, event) {
    if (event.status === (previous ?? normal)) return;
    if (events.length < MAX_IMPACT_EVENTS) events.push(event);
    else eventsOmitted++;
  }

  for (const { tick, depth } of frames) {
    if (!Number.isSafeInteger(tick) || tick <= previousTick ||
        !(Array.isArray(depth) || (ArrayBuffer.isView(depth) && !(depth instanceof DataView)))) {
      throw new Error('Storm frames need increasing nonnegative ticks and indexed depths.');
    }
    previousTick = tick;
    for (const [index, road] of roads.entries()) {
      const row = roadRows[index];
      const { status, peak } = exposure(depth, road.cells, FLOOD_RULES.roadClosureDepth, 'open', 'closed');
      roadStatus[index] = status;
      recordPeak(row, peak);
      if (status === 'closed') {
        row.closedTicks++;
        row.firstClosedTick ??= tick;
      } else if (status === 'unknown') row.unknownTicks++;
      transition(row.lastStatus, 'open', { tick, kind: 'road-access', entityId: road.id, status, peakDepth: peak });
      row.lastStatus = status;
    }

    const open = reachable(graph, index => roadStatus[index] === 'open');
    const possible = reachable(graph, index => roadStatus[index] !== 'closed');
    for (const [index, building] of buildings.entries()) {
      const row = buildingRows[index];
      const { status, peak } = exposure(depth, building.cells, FLOOD_RULES.buildingFloodDepth[building.type], 'dry', 'flooded');
      const access = accessAt(building.node, dryNetwork, open, possible);
      recordPeak(row, peak);
      if (status === 'flooded') {
        row.floodedTicks++;
        row.firstFloodedTick ??= tick;
      } else if (status === 'unknown') row.unknownExposureTicks++;
      if (access.status === 'isolated') {
        row.isolatedTicks++;
        row.firstIsolatedTick ??= tick;
      } else if (access.status === 'unknown') row.unknownAccessTicks++;
      transition(row.lastExposure, 'dry', {
        tick, kind: 'building-exposure', entityId: building.id, status, peakDepth: peak,
      });
      transition(row.lastAccess, 'reachable', {
        tick, kind: 'building-access', entityId: building.id, status: access.status, reason: access.reason, peakDepth: peak,
      });
      row.lastExposure = status;
      row.lastAccess = access.status;
      row.lastAccessReason = access.reason;
    }
  }

  return {
    version: IMPACT_VERSION, rules: FLOOD_RULES, events, eventsOmitted,
    roads: roadRows, buildings: buildingRows, totals: summarize(roadRows, buildingRows),
  };
}
