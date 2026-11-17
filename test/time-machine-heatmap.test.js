import { expect, test } from 'bun:test';
import { districtHeatmap, districtMetricEvidence } from '../world/causal/heatmap.js';

const state = {
  districts: [
    { id: 'center', name: 'Center' },
    { id: 'outer', name: 'Outer' },
    { id: 'empty', name: 'Empty' },
  ],
  units: [
    { districtId: 'center', status: 'occupied', tenure: 'rental', rent: 900 },
    { districtId: 'center', status: 'available', tenure: 'rental', rent: 1100 },
    { districtId: 'center', status: 'available', tenure: 'owned', rent: 0 },
    { districtId: 'center', status: 'under renovation', tenure: 'owned', rent: 0 },
    { districtId: 'outer', status: 'available', tenure: 'owned', rent: 0 },
  ],
  households: [
    { districtId: 'center', income: 2000 },
    { districtId: 'center', income: 10000 },
    { districtId: 'outer', income: 0 },
  ],
};

test('district rent includes rental units and assigns threshold values to the higher band', () => {
  expect(districtHeatmap(state, 'rent')).toEqual([
    { id: 'center', name: 'Center', value: 1000, bin: 1, count: 2 },
    { id: 'outer', name: 'Outer', value: null, bin: 'missing', count: 0 },
    { id: 'empty', name: 'Empty', value: null, bin: 'missing', count: 0 },
  ]);
});

test('household income keeps an observed zero distinct from an empty district', () => {
  expect(districtHeatmap(state, 'income').map(({ value, bin }) => [value, bin])).toEqual([
    [6000, 3], [0, 0], [null, 'missing'],
  ]);
});

test('occupancy includes all housing units and uses the same scale across checkpoints', () => {
  expect(districtHeatmap(state, 'occupancy').map(({ value, bin }) => [value, bin])).toEqual([
    [.25, 1], [0, 0], [null, 'missing'],
  ]);
  const following = { ...state, units: state.units.map(unit => ({ ...unit, status: 'occupied' })) };
  expect(districtHeatmap(following, 'occupancy').map(({ value, bin }) => [value, bin])).toEqual([
    [1, 4], [1, 4], [null, 'missing'],
  ]);
});


test('missing and invalid inputs are excluded while genuine zero remains available', () => {
  const checkpoint = {
    districts: [{ id: 'd' }],
    households: [null, undefined, NaN, Infinity, '0', 0].map(income => ({ districtId: 'd', income })),
    units: [undefined, null, '', 'unknown', 'occupied', 'available'].map(status => ({ districtId: 'd', status })),
  };
  const income = districtHeatmap(checkpoint, 'income')[0];
  expect(income).toMatchObject({ value: 0, count: 1, bin: 0 });
  expect(districtMetricEvidence(checkpoint, 'income', income)).toMatchObject({ label: 'Partial model data' });
  expect(districtMetricEvidence(checkpoint, 'income', income).details).toContain('1 of 6 eligible records; 5 missing or invalid');
  expect(districtHeatmap(checkpoint, 'occupancy')[0]).toMatchObject({ value: .5, count: 2 });
  expect(districtHeatmap({ districts: checkpoint.districts }, 'income')[0]).toMatchObject({ value: null, bin: 'missing' });
  expect(districtHeatmap({ ...checkpoint, units: [{ districtId: 'd' }] }, 'occupancy')[0]).toMatchObject({ value: null, count: 0 });
});

test('evidence preserves checkpoint provenance and never claims empirical verification', () => {
  const checkpoint = { ...state, month: 0, provenance: {
    datasetVersion: 'osm-area-fixture', worldRevision: 'revision-7',
    assumptions: ['District assignments are synthetic.'],
  } };
  const rows = districtHeatmap(checkpoint, 'rent');
  const evidence = districtMetricEvidence(checkpoint, 'rent', rows[0]);
  expect(evidence.label).toBe('Assumption-based model');
  expect(evidence.details).toContain('Dataset: osm-area-fixture; revision: revision-7; month: 0');
  expect(evidence.details).toContain('Confidence: empirical confidence not established');
  expect(evidence.details).toContain('District assignments are synthetic.');
  expect(evidence.details).toContain('2 of 2 eligible records');
  const missing = districtMetricEvidence(checkpoint, 'rent', rows[1]);
  expect(missing.label).toBe('Missing data');
  expect(missing.details).toContain('No usable samples; no value is estimated.');
});
