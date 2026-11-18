import { test, expect } from 'bun:test';
import { ENERGY_DEMO, startEnergy, dispatchEnergy, cancelEnergy, verifyEnergy } from '../world/hidden-systems/energy-model.js';

test('pinned scenario succeeds, retains immutable parents and conserves every flow', () => {
  const initial = startEnergy(ENERGY_DEMO);
  let run = initial;
  for (let step = 0; step < 3; step++) run = dispatchEnergy(run, 6);
  expect(run.status).toBe('success');
  expect(run.checkpoints.map(c => c.battery)).toEqual([4, 2, 2]);
  expect(initial.actions).toEqual([]);
  expect(Object.isFrozen(run.checkpoints[0])).toBe(true);
  expect(verifyEnergy(run)).toBe(true);
  expect(run).toEqual([6,6,6].reduce(dispatchEnergy, startEnergy(ENERGY_DEMO)));
  for (const c of run.checkpoints) {
    expect(c.openingBattery + c.generation).toBe(c.battery + c.served + c.spill);
    expect(c.demand).toBe(c.served + c.unmet);
    expect(c.battery).toBe(c.openingBattery + c.charge - c.discharge);
  }
  expect(() => dispatchEnergy(run, 6)).toThrow('closed');
});

test('failure and cancel never invent remaining waves; invalid generation changes nothing', () => {
  const initial = startEnergy(ENERGY_DEMO);
  const failed = dispatchEnergy(initial, 0);
  expect(failed.status).toBe('failed');
  expect(failed.checkpoints[0].unmet).toBe(2);
  expect(failed.checkpoints).toHaveLength(1);
  expect(verifyEnergy(failed)).toBe(true);
  const cancelled = cancelEnergy(dispatchEnergy(initial, 6));
  expect(cancelled.status).toBe('cancelled');
  expect(cancelled.checkpoints).toHaveLength(1);
  expect(verifyEnergy(cancelled)).toBe(true);
  expect(() => dispatchEnergy(cancelled, 6)).toThrow();
  for (const value of [-1, 7, 1.5, NaN, '6']) expect(() => dispatchEnergy(initial, value)).toThrow();
  expect(initial.checkpoints).toEqual([]);
});

test('missing source and tampered source/checkpoints/actions/version fail closed', () => {
  expect(() => startEnergy(null)).toThrow('No source');
  const run = dispatchEnergy(startEnergy(ENERGY_DEMO), 6);
  for (const mutate of [r => r.source.seed++, r => r.source.model = 'other', r => r.checkpoints[0].served++, r => r.actions[0]--, r => r.battery--]) {
    const broken = structuredClone(run); mutate(broken);
    const before = JSON.stringify(broken);
    expect(verifyEnergy(broken)).toBe(false);
    expect(JSON.stringify(broken)).toBe(before);
  }
});

test('all bounded strategies conserve energy including empty battery, spill and unmet demand', () => {
  for (let a=0;a<=6;a++) for(let b=0;b<=6;b++) for(let d=0;d<=6;d++) {
    let run=startEnergy(ENERGY_DEMO);
    for(const action of [a,b,d]) {
      if(run.status!=='playing') break;
      run=dispatchEnergy(run,action);
      const c=run.checkpoints.at(-1);
      expect(c.openingBattery+c.generation).toBe(c.battery+c.served+c.spill);
      expect(c.battery).toBeGreaterThanOrEqual(0);
      expect(c.battery).toBeLessThanOrEqual(4);
      expect(c.spill).toBeGreaterThanOrEqual(0);
      expect(c.demand).toBe(c.served+c.unmet);
    }
    expect(verifyEnergy(run)).toBe(true);
  }
});
