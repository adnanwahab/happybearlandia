import { expect, test } from 'bun:test';
import { evaluateLivingCouncil } from '../world/living-city/council.js';

const before = { commuteMinutes: 30, meanRent: 1200, balance: 1000, employed: 50, overloadedServices: 2 };
const proposal = { label: 'Transit project', cost: 200 };
const byId = ({ positions }) => Object.fromEntries(positions.map(position => [position.id, position]));

test('council applies distinct goals and forms groups from current votes', () => {
  const after = { commuteMinutes: 24, meanRent: 1275, balance: 800, employed: 55, overloadedServices: 3 };
  const result = evaluateLivingCouncil({ before, after, proposal });
  const members = byId(result);

  expect(result.tally).toEqual({ support: 3, oppose: 2, hold: 0 });
  expect(result.coalitions).toEqual([
    { vote: 'support', members: ['Commuting residents', 'Local employers', 'City treasurer'] },
    { vote: 'oppose', members: ['Renters', 'Public service operators'] },
  ]);
  expect(members.commuters).toMatchObject({
    baseline: 30,
    outcome: 24,
    initial: { vote: 'hold' },
    current: { vote: 'support' },
  });
});

test('treasurer revises a provisional support position when the paired outcome shows a deficit', () => {
  const pending = evaluateLivingCouncil({ before, after: null, proposal });
  expect(pending.tally).toEqual({ support: 1, oppose: 0, hold: 4 });
  expect(pending.coalitions).toEqual([]);

  const result = evaluateLivingCouncil({ before, after: { ...before, balance: -1 }, proposal });
  expect(byId(result).treasury).toMatchObject({
    initial: { vote: 'support' },
    current: { vote: 'oppose', reason: 'The projected city balance is negative.' },
  });

  const overBudget = evaluateLivingCouncil({ before, after: before, proposal: { ...proposal, cost: 1001 } });
  expect(byId(overBudget).treasury.current.vote).toBe('oppose');
});

test('missing and unchanged metrics hold their votes without inventing evidence', () => {
  const after = { commuteMinutes: null, meanRent: 1200, employed: Infinity, overloadedServices: 0 };
  const result = evaluateLivingCouncil({ before, after, proposal });
  const members = byId(result);
  expect(result.tally).toEqual({ support: 1, oppose: 0, hold: 4 });
  expect(members.commuters.outcome).toBeNull();
  expect(members.employers.outcome).toBeNull();
  expect(members.renters.current.reason).toBe('The measured outcome is unchanged.');
  expect(members.treasury.current.reason).toBe('The projected balance is unavailable.');
  expect(members.services.current.vote).toBe('support');
});

test('short council decisions use supported policies and exactly replay the selected seed', async () => {
  const { COMMUTE_OPTIONS, runCommuteEnsemble, replayCommuteSample } = await import('../world/living-city/quests.js');
  for (const option of COMMUTE_OPTIONS) {
    const options = { seed: 2911, amount: option.amount, months: 12 };
    const run = runCommuteEnsemble({ ...options, samples: 1 });
    const pair = replayCommuteSample({ ...options, index: 0 });
    expect(run.policy).toEqual({ type: 'transit', districtId: 'd1', amount: option.amount, cost: option.cost });
    expect(pair.seed).toBe(run.samples[0].seed);
    for (const arm of ['baseline', 'intervention']) {
      for (const metric of ['commuteMinutes', 'meanRent', 'balance', 'employed', 'overloadedServices']) {
        expect(pair[arm][metric]).toBe(run.samples[0][arm][metric]);
      }
    }
    expect(pair.baseline.state.month).toBe(pair.intervention.state.month);
    const council = evaluateLivingCouncil({ before: pair.baseline, after: pair.intervention, proposal: option });
    expect(Object.values(council.tally).reduce((a, b) => a + b, 0)).toBe(5);
  }
});
