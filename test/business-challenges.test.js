import { test, expect } from 'bun:test';
import { BUSINESS_CHALLENGES, challengeDefinition, beginBusinessChallenge, advanceBusinessChallenge, businessChallengeProgress, recordBusinessChallengeBest } from '../world/models/business-v1/challenges.js';
import { approveDefinition, copy, validateDefinition } from '../world/models/business-v1/schema.js';
import { createBusinessState, defaultPlan, simulatePeriod, financeAction } from '../world/models/business-v1/index.js';
import { runFutures, replayFuture } from '../world/models/business-v1/futures.js';

function start(id = 'first-profit', overrides = {}) {
  const c = BUSINESS_CHALLENGES.find(c => c.id === id);
  const def = approveDefinition({ ...challengeDefinition(id), ...overrides });
  return beginBusinessChallenge(createBusinessState(def, c.seed), id);
}
const resolve = (state, period, overrides = {}) => advanceBusinessChallenge({ ...copy(state), period, ...overrides });

test('all curated challenges use approved, valid definitions and fixed fresh starts', () => {
  for (const c of BUSINESS_CHALLENGES) {
    expect(validateDefinition(challengeDefinition(c.id)).valid).toBe(true);
    const state = start(c.id);
    expect(state.challenge.status).toBe('active'); expect(state.challenge.official).toBe(true);
    expect(state.seed).toBe(c.seed); expect(state.period).toBe(0);
    expect(() => beginBusinessChallenge({ ...state, period: 1 }, c.id)).toThrow('fresh');
    expect(() => beginBusinessChallenge({ ...state, totalProfit: 1000 }, c.id)).toThrow('fresh');
  }
  expect(() => challengeDefinition('unknown')).toThrow();
});
test('goals settle at the exact deadline, never after it, with positive cash required', () => {
  const state = start();
  const won = resolve(state, 10, { totalProfit: 100, cash: 200 });
  expect(won.challenge.status).toBe('completed'); expect(won.challenge.result.period).toBe(10);
  expect(resolve(state, 10, { totalProfit: 99, cash: 200 }).challenge.status).toBe('failed');
  expect(resolve(state, 11, { totalProfit: 1000, cash: 200 }).challenge.status).toBe('failed');
  expect(resolve(state, 10, { totalProfit: 1000, cash: 0 }).challenge.status).toBe('failed');
  expect(state.challenge.result).toBe(null);
});
test('a survival challenge cannot be won early; bankruptcy ends it immediately', () => {
  const state = start('weather-the-year');
  expect(resolve(state, 2, { totalProfit: 20000, cash: 200000 }).challenge.status).toBe('active');
  expect(resolve(state, 12, { totalProfit: 20000, cash: 200000 }).challenge.status).toBe('completed');
  expect(resolve(state, 2, { bankrupt: true, cash: -100 }).challenge.status).toBe('failed');
});
test('subscriptions count active customers; financing is not profit', () => {
  const subscribers = start('subscriber-launch');
  expect(resolve(subscribers, 2, { totalSales: 500, customers: 499 }).challenge.status).toBe('active');
  expect(resolve(subscribers, 2, { customers: 500 }).challenge.status).toBe('completed');
  const state = start(), borrowed = financeAction(state, 'loan', 100);
  expect(borrowed.cash).toBe(state.cash + 100); expect(borrowed.totalProfit).toBe(0);
  expect(resolve(borrowed, 1).challenge.status).toBe('active');
});
test('the subscription growth challenge needs an actual capacity decision', () => {
  let cautious = start('subscriber-launch'), growing = copy(cautious);
  const plan = defaultPlan(cautious.def);
  for (let i = 0; i < 6; i++) {
    cautious = simulatePeriod(cautious, plan, {trace:false}).state;
    if (growing.challenge.status === 'active') growing = simulatePeriod(growing, {...plan, staff:2}, {trace:false}).state;
  }
  expect(cautious.challenge.status).toBe('failed');
  expect(growing.challenge.status).toBe('completed');
  expect(growing.customers).toBeGreaterThanOrEqual(500);
});
test('edits and future seeds become practice, while cosmetic edits and allowed decisions remain official', () => {
  const state = start();
  const renamed = { ...copy(state), def: { ...state.def, name: 'My stand', version: 2 } };
  expect(advanceBusinessChallenge(renamed).challenge.official).toBe(true);
  const edited = { ...copy(state), def: { ...state.def, startingCash: 9999 } };
  const practice = advanceBusinessChallenge(edited); expect(practice.challenge.official).toBe(false);
  practice.def = copy(state.def); expect(advanceBusinessChallenge(practice).challenge.official).toBe(false);
  const alternate = advanceBusinessChallenge({ ...state, seed: 999 }); expect(alternate.challenge.official).toBe(false);
  const cheaperStart = start('first-profit', { rent: 0 }); expect(cheaperStart.challenge.official).toBe(false);
  const plan = { ...defaultPlan(state.def), price: 2.5, production: 30 };
  expect(simulatePeriod(state, plan).state.challenge.official).toBe(true);
});
test('terminal results and progress survive save/reload and later trading without rewriting the finish', () => {
  const state = resolve(start(), 3, { totalProfit: 110, cash: 600 });
  const loaded = JSON.parse(JSON.stringify(state));
  const continued = resolve(loaded, 4, { totalProfit: -5, cash: 100 });
  expect(continued.challenge.result).toEqual(state.challenge.result);
  const progress = businessChallengeProgress(continued);
  expect(progress.goals[0].value).toBe(110); expect(progress.elapsed).toBe(3);
  expect(progress.status).toBe('completed');
  const failed = resolve(start(), 10, { totalProfit: -10 });
  expect(resolve(failed, 11, { totalProfit: 1000 }).challenge.status).toBe('failed');
});
test('best results prefer faster completion then higher profit and reject practice/failure', () => {
  const won = resolve(start(), 5, { totalProfit: 110, cash: 600 });
  const first = recordBusinessChallengeBest({}, won);
  expect(first['first-profit'].period).toBe(5);
  expect(recordBusinessChallengeBest(first, resolve(start(), 6, { totalProfit: 200, cash: 700 }))).toBe(first);
  const improved = recordBusinessChallengeBest(first, resolve(start(), 5, { totalProfit: 130, cash: 650 }));
  expect(improved['first-profit'].profit).toBe(130); expect(first['first-profit'].profit).toBe(110);
  expect(recordBusinessChallengeBest(first, { ...won, seed: 50 })).toBe(first);
  const practice = resolve(start('first-profit', { rent: 0 }), 1, { totalProfit: 1000 });
  expect(recordBusinessChallengeBest(first, practice)).toBe(first);
  expect(recordBusinessChallengeBest(first, resolve(start(), 10))).toBe(first);
});
test('engine resolves challenge progress without changing economic outcomes or mutating inputs', () => {
  let state = start(), sandbox = copy(state); delete sandbox.challenge;
  const plan = { ...defaultPlan(state.def), production: 30 };
  for (let i = 0; i < 10 && !state.bankrupt; i++) {
    const a = simulatePeriod(state, plan), b = simulatePeriod(sandbox, plan);
    expect(a.report).toEqual(b.report); expect(a.trace).toEqual(b.trace);
    expect(state.period).toBe(i); state = a.state; sandbox = b.state;
  }
  expect(state.challenge.status).not.toBe('active');
});
test('futures project practice results without awarding or advancing the active challenge', async () => {
  const state = start('subscriber-launch'), before = copy(state);
  const result = await runFutures(state, defaultPlan(state.def), { count: 2, horizon: 3 });
  const replay = replayFuture(result, 0);
  expect(state).toEqual(before); expect(state.challenge.status).toBe('active');
  expect(replay.state.challenge.official).toBe(false);
  expect(recordBusinessChallengeBest({}, replay.state)).toEqual({});
});
test('legacy and unknown challenge metadata leave sandbox economics alone', () => {
  const def = approveDefinition(challengeDefinition('first-profit'));
  const state = createBusinessState(def);
  expect(advanceBusinessChallenge(state)).toBe(state); expect(businessChallengeProgress(state)).toBe(null);
  const unknown = { ...state, challenge: { schemaVersion:'business-challenge.v1',version:1,id:'unknown',status:'active' } };
  expect(advanceBusinessChallenge(unknown)).toBe(unknown);
});
