import { expect, test } from 'bun:test';
import { DEMO } from '../world/coalition/scenario.js';
import { openDecision, moveCard, result, cancelDecision } from '../world/coalition/model.js';

test('single decision integrates existing council rules: successful bloc, disagreement, abstention and failed bloc', () => {
  const parent = JSON.stringify(DEMO);
  let decision = openDecision(DEMO);
  const original = decision;
  expect(result(decision)).toMatchObject({ winning: false, support: 0, seats: 5, threshold: 3 });
  for (const id of ['commuters', 'employers', 'treasury']) decision = moveCard(decision, id, true);
  expect(result(decision)).toMatchObject({ winning: true, support: 3 });
  decision = moveCard(moveCard(decision, 'renters', true), 'services', true);
  expect(result(decision)).toMatchObject({ winning: true, support: 3, oppose: 1, abstain: 1 });
  decision = moveCard(decision, 'treasury', false);
  expect(result(decision)).toMatchObject({ winning: false, support: 2, oppose: 1, abstain: 1 });
  expect(original.selected).toEqual([]);
  expect(JSON.stringify(DEMO)).toBe(parent);
  expect(Object.isFrozen(decision.checkpoint.baseline)).toBe(true);
  expect(decision.positions).toEqual(original.positions);
});

test('duplicate, unknown and removed cards never inflate vote counts', () => {
  let d = openDecision(DEMO);
  d = moveCard(moveCard(d, 'commuters', true), 'commuters', true);
  expect(result(d).support).toBe(1);
  expect(moveCard(d, 'invented', true)).toBe(d);
  d = moveCard(d, 'commuters', false);
  expect(result(d).support).toBe(0);
});

test('cancel and no source never return a vote result; reopening is deterministic', () => {
  for (const d of [openDecision(null), cancelDecision()]) {
    expect(result(d).winning).toBeNull();
    expect(moveCard(d, 'treasury', true)).toBe(d);
  }
  const a = openDecision(DEMO), b = openDecision(structuredClone(DEMO));
  expect(a).toEqual(b);
  expect(a.checkpoint.seed).toBe(b.checkpoint.seed);
  expect(a.checkpoint.month).toBe(b.checkpoint.month);
});

test('replay mismatch, missing observations and version/identity drift fail closed', () => {
  for (const change of [
    d => d.baseline.meanRent = null,
    d => d.intervention.balance = -1,
    d => d.rulesVersion = 'future',
    d => d.seed++, d => d.month++, d => d.checkpointId = 'another',
    d => d.expectedVotes.commuters = 'oppose',
  ]) {
    const source = structuredClone(DEMO); change(source);
    expect(openDecision(source).status).toBe('replay-mismatch');
    expect(result(openDecision(source)).winning).toBeNull();
  }
});
