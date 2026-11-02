import { test, expect } from 'bun:test';
import { buildTown } from '../world/gen.js';
import { createWorld } from '../world/sim.js';
import { placeBusiness } from '../world/business-mode.js';

function setup() {
  const world = createWorld(buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 100 }));
  const site = world.buildings.find(b => b.kind === 'shop');
  placeBusiness(world, site.index, { price: 8, quality: 90 });
  return world;
}

test('residents travel to a business and pay for finite inventory', () => {
  const world = setup();
  world.step(1440);
  expect(world.business.visits).toBeGreaterThan(0);
  expect(world.business.revenue).toBe(world.business.visits * 8);
  expect(world.business.stock).toBe(100 - world.business.visits);
  expect(world.business.costs).toBe(400);
  expect(world.events.some(e => e.kind === 'business')).toBe(true);
});

test('closed, sold-out and unaffordable businesses cannot make sales', () => {
  for (const mode of ['closed', 'sold-out', 'unaffordable']) {
    const world = setup();
    if (mode === 'closed') world.business.open = false;
    if (mode === 'sold-out') world.business.stock = 0;
    if (mode === 'unaffordable') { world.business.price = 100; world.people.forEach(p => p.money = -10000); }
    world.step(720);
    expect(world.business.visits).toBe(0);
  }
});

test('editing preserves inventory and accounts; homes cannot be taken over', () => {
  const world = setup();
  world.step(300);
  const before = { ...world.business };
  placeBusiness(world, before.building, { price: 20 });
  expect(world.business.revenue).toBe(before.revenue);
  expect(world.business.stock).toBe(before.stock);
  expect(() => placeBusiness(world, world.buildings.find(b => b.kind === 'home').index)).toThrow();
});
