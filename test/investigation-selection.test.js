import { test, expect } from 'bun:test';
import { createCity } from '../world/city/seed.js';
import { cityEntityId } from '../world/causal/demo.js';
import { cityInventory, compareInventory, hasInventoryEntity } from '../world/causal/history.js';

test('investigations resolve canonical buildings and districts only within their world', () => {
  const state = createCity({ seed: 2911 });
  const before = structuredClone(state);
  const rows = cityInventory(state, 'world:fixture');
  for (const [collection, kind] of [['districts', 'district'], ['buildings', 'building']]) {
    expect(rows[collection]).toHaveLength(state[collection].length);
    const id = cityEntityId('world:fixture', kind, state[collection][0].id);
    expect(hasInventoryEntity(rows, id)).toBe(true);
    expect(hasInventoryEntity(rows, cityEntityId('world:other', kind, state[collection][0].id))).toBe(false);
  }
  expect(hasInventoryEntity(rows, 'missing-entity')).toBe(false);
  expect(state).toEqual(before);
});

test('removed entities remain inspectable at their transition month then become stale', () => {
  const state = createCity({ seed: 2911 });
  const previous = cityInventory(state, 'world:fixture');
  const id = previous.buildings[0].id;
  const current = { ...previous, buildings: previous.buildings.slice(1) };
  const transition = compareInventory(current, previous);
  expect(hasInventoryEntity(transition, id)).toBe(true);
  expect(transition.buildings.find(row => row.id === id).change).toBe('Removed');
  expect(hasInventoryEntity(compareInventory(current, current), id)).toBe(false);
});
