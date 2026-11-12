import { expect, test } from 'bun:test';
import { livingNetworkEvidence, projectLivingNetwork } from '../world/living-city/network.js';

const snapshot = {
  state: {
    month: 3,
    districts: [{ id: 'a', name: 'Central' }, { id: 'b', name: 'Riverside' }],
    links: [
      { id: 'road-a-b', from: 'a', to: 'b', mode: 'road', flow: 2, capacity: 4, travelTime: 16 },
      { id: 'transit-a-b', from: 'a', to: 'b', mode: 'transit', flow: 0, capacity: 3, travelTime: 240, closed: true },
    ],
    utilities: [
      { id: 'power-b', districtId: 'b', type: 'electric', effectiveCapacity: 6, capacity: 12, serviceLevel: .75 },
      { id: 'water-b', districtId: 'b', type: 'water', capacity: 14, serviceLevel: 1 },
    ],
    policies: [{ id: 'policy-a', type: 'transit' }],
    flows: [
      { time: 3, resource: 'money', from: 'economy', to: 'city', amount: 54000, system: 'finance' },
      { time: 3, resource: 'money', from: 'city', to: 'policy-a', amount: 1200, system: 'governance' },
      { time: 3, resource: 'money', from: 'city', to: 'policy-a', amount: 50, system: 'governance' },
      { time: 2, resource: 'money', from: 'city', to: 'policy-a', amount: 1700, system: 'governance' },
      { time: 3, resource: 'utility demand', from: 'b', to: 'power-b', amount: 8, system: 'utilities' },
      { time: 3, resource: 'utility demand', from: 'b', to: 'water-b', amount: 9, system: 'utilities' },
      { time: 3, resource: 'people', from: 'a', to: 'b', amount: 4, system: 'housing' },
    ],
  },
  trips: [
    { personId: 'worker-a', originId: 'a', destinationId: 'b', route: ['road-a-b'] },
    { personId: 'worker-b', originId: 'a', destinationId: 'b', route: ['road-a-b'] },
    { personId: 'worker-c', originId: 'b', destinationId: 'b', route: [] },
  ],
  selectedWorkerId: 'worker-a',
};

test('commute and relocation records retain independent values, links and selected worker', () => {
  const [road, transit, local, relocation] = projectLivingNetwork(snapshot, 'people');
  expect(road).toMatchObject({ amount: 2, selected: true, unit: 'assigned trips' });
  expect(road.details).toContain('Trip records using this link · 2');
  expect(transit).toMatchObject({ amount: 0, selected: false, closed: true });
  expect(local).toMatchObject({ amount: 1, unit: 'trips', from: { label: 'Riverside' }, to: { label: 'Riverside' } });
  expect(relocation).toMatchObject({ amount: 4, unit: 'people' });
  expect(projectLivingNetwork({ ...snapshot, trips: undefined }, 'people')[0].details).toContain('Individual trip records unavailable');
});

test('financial transfers and utility demand use the recorded units and month', () => {
  const [revenue, funding] = projectLivingNetwork(snapshot, 'money');
  expect(revenue).toMatchObject({ amount: 54000, unit: 'illustrative USD', from: { label: 'City economy' } });
  expect(funding).toMatchObject({ amount: 1250, evidence: { policyId: 'policy-a' } });
  const [power] = projectLivingNetwork(snapshot, 'energy');
  expect(power).toMatchObject({ amount: 8, unit: 'model demand units' });
  expect(power.details).toContain('Effective capacity · 6 model units');
  expect(power.details).toContain('Share of demand served · 75%');
  expect(projectLivingNetwork(snapshot, 'water')[0]).toMatchObject({ amount: 9, kind: 'Water demand' });
  expect(projectLivingNetwork(snapshot, 'goods')).toEqual([]);
  expect(projectLivingNetwork(snapshot, 'information')).toEqual([]);
});

test('evidence matches exact IDs in the selected month', () => {
  const [road] = projectLivingNetwork(snapshot, 'people');
  const raw = { id: 'denied', simulationTime: 3, eventType: 'DENIED_BOARDING', payload: { linkId: 'road-a-b' } };
  const context = { tick: 3, worldId: 'world:hbl:example' };
  const link = 'link:world-city:world%3Ahbl%3Aexample%2Froad-a-b';
  const events = [
    raw,
    { ...raw, id: 'prior', simulationTime: 2 },
    { ...raw, id: 'different', payload: { linkId: 'another-road-a-b' } },
    { id: 'input', type: 'MODEL_INPUTS', context, entityIds: [link] },
    { id: 'closure', type: 'LINK_AVAILABILITY_CHANGED', context, entityIds: [link], provenance: { source: 'City transport' } },
  ];
  expect(livingNetworkEvidence(road, events, 3)).toEqual([
    { id: 'denied', type: 'DENIED_BOARDING', provenance: undefined },
    { id: 'closure', type: 'LINK_AVAILABILITY_CHANGED', provenance: 'City transport' },
  ]);
  const [power] = projectLivingNetwork(snapshot, 'energy');
  const failure = { id: 'f', simulationTime: 3, eventType: 'UTILITY_CAPACITY_FAILURE', geographyId: 'b', payload: { utility: 'electric' } };
  expect(livingNetworkEvidence(power, [{ id: 'wrapped', type: failure.eventType, context, payload: { source: failure } }], 3))
    .toMatchObject([{ id: 'wrapped', type: 'UTILITY_CAPACITY_FAILURE' }]);
});
