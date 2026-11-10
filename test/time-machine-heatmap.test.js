import { expect, test } from 'bun:test';
import { districtHeatmap } from '../world/causal/heatmap.js';

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
