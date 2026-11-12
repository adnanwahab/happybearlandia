import { test, expect } from 'bun:test';
import { createQuestScenario } from '../world/living-city/quests.js';
import { branchCity } from '../world/living-city/builder.js';

test('builder branches exact checkpoint with matched clocks, seed, shocks and immutable parent', () => {
  const snapshot = createQuestScenario();
  const before = structuredClone(snapshot);
  const result = branchCity({ snapshot });
  expect(snapshot).toEqual(before);
  expect(result.parent).toEqual(before);
  expect(branchCity({ snapshot })).toEqual(result);
  for (let i = 0; i <= result.months; i++) {
    const a = result.baseline[i].state, b = result.intervention[i].state;
    expect(a.month).toBe(snapshot.state.month + i);
    expect(b.month).toBe(a.month);
    expect(a.seed).toBe(snapshot.state.seed);
    expect(b.seed).toBe(a.seed);
    expect(b.shocks).toEqual(a.shocks);
  }
  expect(result.intervention.flatMap(row => row.events ?? []).some(event => event.eventType === 'PROJECT_COMPLETE')).toBe(true);
  expect(result.intervention.at(-1).state.finance.balance).not.toBe(result.baseline.at(-1).state.finance.balance);
});

test('entered future becomes the next parent without resetting time or seed', () => {
  const first = branchCity({ snapshot: createQuestScenario() });
  const entered = first.intervention[5];
  const second = branchCity({ snapshot: entered, months: 3, amount: 4 });
  expect(second.parent).toEqual(entered);
  expect(second.baseline[0]).toEqual(entered);
  expect(second.startMonth).toBe(7);
  expect(second.baseline.at(-1).state.month).toBe(10);
  expect(second.intervention.at(-1).state.policies).toHaveLength(2);
  expect(first.intervention[5]).toEqual(entered);
});

test('builder preserves recorded quest completion across months and subsequent branches', () => {
  const first = branchCity({ snapshot: createQuestScenario() });
  const completed = first.intervention[10].quests.find(quest => quest.status === 'completed');
  expect(completed).toBeDefined();
  for (const checkpoint of first.intervention.slice(11)) {
    expect(checkpoint.quests.find(quest => quest.id === completed.id).completion).toEqual(completed.completion);
  }
  const entered = first.intervention.at(-1);
  const second = branchCity({ snapshot: entered, months: 3, amount: 4 });
  for (const checkpoint of [...second.baseline, ...second.intervention]) {
    const quest = checkpoint.quests.find(row => row.id === completed.id);
    expect(quest.status).toBe('completed');
    expect(quest.completion).toEqual(completed.completion);
  }
});

test('builder fails explicitly on missing checkpoint, incompatible model and unsupported inputs', () => {
  expect(() => branchCity()).toThrow('checkpoint');
  const snapshot = createQuestScenario();
  expect(() => branchCity({ snapshot: { ...snapshot, state: { ...snapshot.state, version: 'unknown' } } })).toThrow('compatible');
  for (const months of [0, 25, 1.5, NaN]) expect(() => branchCity({ snapshot, months })).toThrow('months');
  expect(() => branchCity({ snapshot, amount: 999 })).toThrow('supported');
  expect(() => branchCity({ snapshot: { ...snapshot, participant: null } })).toThrow('district');
  expect(branchCity({ snapshot }).assumptions.join(' ')).toContain('not measured');
});
