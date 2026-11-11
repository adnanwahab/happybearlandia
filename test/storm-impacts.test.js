import { expect, test } from 'bun:test';
import { assessFlood, FLOOD_RULES, IMPACT_VERSION, MAX_IMPACT_EVENTS } from '../world/storm/impacts.js';

const size = 4;
const roads = [
  { id: 'direct-a', from: 'hub', to: 'depot', cells: [0] },
  { id: 'direct-b', from: 'hub', to: 'end', cells: [1] },
  { id: 'alternate-a', from: 'depot', to: 'alt', cells: [2] },
  { id: 'alternate-b', from: 'alt', to: 'end', cells: [3] },
];
const buildings = [
  { id: 'home', name: 'Elm House', type: 'home', node: 'end', cells: [6, 11], households: 3 },
  { id: 'shop', type: 'business', node: 'end', cells: [7] },
  { id: 'station', type: 'service', node: 'depot', cells: [8] },
  { id: 'unmapped', type: 'service', node: 'outside', cells: [9] },
  { id: 'home-no-count', type: 'home', node: 'end', cells: [10] },
];

function frame(tick, values = {}) {
  const depth = new Float32Array(size * size);
  for (const [cell, value] of Object.entries(values)) depth[cell] = value;
  return { tick, depth };
}

test('tracks peak exposure, alternate routes, unknown coverage and recovery separately', () => {
  const frames = [
    frame(0),
    frame(1, { 0: FLOOD_RULES.roadClosureDepth, 6: FLOOD_RULES.buildingFloodDepth.home }),
    frame(2, { 0: .21, 2: .22, 6: .16, 8: .16 }),
    frame(3, { 0: NaN, 2: .22, 6: .14, 11: NaN }),
    frame(4),
  ];
  const before = frames.map(row => Array.from(new Uint8Array(row.depth.buffer)));
  const result = assessFlood({ size, roads, buildings, frames });
  expect(result.version).toBe(IMPACT_VERSION);
  expect(result.eventsOmitted).toBe(0);
  expect(result.roads[0]).toMatchObject({
    firstClosedTick: 1, closedTicks: 2, unknownTicks: 1, lastStatus: 'open',
  });
  const home = result.buildings[0];
  expect(home).toMatchObject({
    name: 'Elm House', households: 3, firstFloodedTick: 1, floodedTicks: 2, isolatedTicks: 1,
    firstIsolatedTick: 2, unknownExposureTicks: 1, unknownAccessTicks: 1, lastAccess: 'reachable',
  });
  expect(home.peakDepth).toBeCloseTo(.16, 6);
  expect(result.buildings[3]).toMatchObject({
    isolatedTicks: 0, unknownAccessTicks: 5, lastAccessReason: 'no-modeled-route',
  });

  const access = result.events.filter(row => row.kind === 'building-access' && row.entityId === 'home');
  expect(access.map(({ tick, status, reason }) => [tick, status, reason])).toEqual([
    [2, 'isolated', 'flooded-routes'],
    [3, 'unknown', 'incomplete-road-exposure'],
    [4, 'reachable', 'observed-open-route'],
  ]);
  expect(result.events.filter(row => row.kind === 'building-exposure' && row.entityId === 'home')
    .map(({ tick, status }) => [tick, status])).toEqual([[1, 'flooded'], [3, 'unknown'], [4, 'dry']]);
  expect(result.totals).toMatchObject({
    closedRoads: 2, unknownRoads: 1, floodedBuildings: 2, floodedHomes: 1, floodedHouseholds: 3,
    floodedServices: 1, floodedBusinesses: 0, isolatedBuildings: 3, isolatedHomes: 2,
    isolatedHouseholds: 3, isolatedBusinesses: 1, isolatedServices: 0, affectedHouseholds: 3,
    affectedHomesWithUnknownHouseholdCount: 1, unknownAccessBuildings: 4, unknownExposureBuildings: 1,
  });
  expect(frames.map(row => Array.from(new Uint8Array(row.depth.buffer)))).toEqual(before);
});

test('keeps transition output bounded without losing aggregate exposure history', () => {
  const frames = Array.from({ length: MAX_IMPACT_EVENTS + 2 }, (_, tick) => ({
    tick, depth: [tick % 2 ? .3 : 0],
  }));
  const result = assessFlood({
    size: 1,
    roads: [{ id: 'road', from: 'depot', to: 'end', cells: [0] }],
    buildings: [],
    frames,
  });
  expect(result.events).toHaveLength(MAX_IMPACT_EVENTS);
  expect(result.eventsOmitted).toBe(1);
  expect(result.roads[0].closedTicks).toBe(Math.floor(frames.length / 2));
  expect(result.roads[0].lastStatus).toBe('closed');
});

test('known flood exposure persists with missing cells while missing geometry does not imply closure', () => {
  const result = assessFlood({
    size,
    roads: [{ id: 'dry-unknown', from: 'depot', to: 'end', cells: [] }],
    buildings: [buildings[0]],
    frames: [frame(0, { 6: .2, 11: NaN })],
  });
  expect(result.roads[0].lastStatus).toBe('unknown');
  expect(result.buildings[0]).toMatchObject({
    lastExposure: 'flooded', lastAccess: 'unknown', lastAccessReason: 'incomplete-road-exposure',
  });
  expect(() => assessFlood({ size, roads, buildings, frames: [frame(1), frame(1)] }))
    .toThrow('increasing');
  expect(() => assessFlood({ size, roads: [...roads, roads[0]], buildings, frames: [frame(0)] }))
    .toThrow('repeated road geometry');
});
