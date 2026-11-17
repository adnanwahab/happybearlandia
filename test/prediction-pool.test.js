import { test, expect } from 'bun:test';
import { createPredictionPoolHandler } from '../ops/prediction-pool/api.js';
const plan = { seed: 2911, months: 2, policies: ['transit-d1-8'] };
function setup(options = {}) {
  const handler = createPredictionPoolHandler({ enabled: true, ...options });
  return async (action, data = {}, address = '127.0.0.1') => {
    const response = await handler(new Request('http://localhost/api/prediction-pool', { method: 'POST', body: JSON.stringify({ action, ...data }) }), address);
    return { status: response.status, ...await response.json() };
  };
}
test('sealed commitments, host rights, deterministic result, immutable lock and deletion', async () => {
  const api = setup();
  const pool = await api('create', { plan, metric: 'housingUnits' });
  const host = { id: pool.id, key: pool.host };
  const join = await api('join', { id: pool.id, invite: pool.invite });
  const member = { id: pool.id, key: join.member };
  expect((await api('read', { id: pool.id, key: 'wrong' })).status).toBe(403);
  expect((await api('reveal', member)).status).toBe(403);
  await api('commit', { ...member, expected: 0 });
  const sealed = await api('read', host);
  expect(sealed.committed).toBe(1); expect(sealed).not.toHaveProperty('rows');
  expect(JSON.stringify(sealed)).not.toContain(join.member);
  expect((await api('commit', { ...member, expected: 4 })).status).toBe(400);
  const result = await api('reveal', host);
  expect(result.state).toBe('revealed'); expect(result.rows[0].absoluteError).toBe(0);
  expect(result.provenance.recipe.seed).toBe(2911); expect(result).not.toHaveProperty('ranking');
  expect(await api('reveal', host)).toEqual(result);
  expect((await api('join', { id: pool.id, invite: pool.invite })).status).toBe(403);
  await api('delete', host); expect((await api('read', member)).status).toBe(404);
});
test('expiry, disabled/remote denial and missing run never rank', async () => {
  let time = 0; const api = setup({ now: () => time, run: () => { throw Error('missing'); } });
  const p = await api('create', { plan, metric: 'housingUnits' });
  expect((await api('read', { id: p.id, key: p.host }, '8.8.8.8')).status).toBe(403);
  const unavailable = await api('reveal', { id: p.id, key: p.host });
  expect(unavailable.state).toBe('unavailable'); expect(unavailable).not.toHaveProperty('rows');
  time = 3600000;
  expect((await api('join', { id: p.id, invite: p.invite })).status).toBe(404);
  expect((await setup({ enabled: false })('create', { plan })).status).toBe(403);
});
test('directional ties, missing metric and member deletion', async () => {
  for (const missing of [false, true]) {
    const api = setup({ run: recipe => ({ recipe, scenarioVersion: 'fixture', final: { month: 4, housingUnits: missing ? null : 10 } }) });
    const p = await api('create', { plan, metric: 'housingUnits' });
    const m = await api('join', { id: p.id, invite: p.invite });
    await api('commit', { id: p.id, key: m.member, direction: 'same' });
    const result = await api('reveal', { id: p.id, key: p.host });
    expect(result.rows[0].correct).toBe(missing ? null : true);
    expect(result.rows[0].absoluteError).toBeNull();
    await api('delete', { id: p.id, key: m.member });
    expect((await api('read', { id: p.id, key: m.member })).status).toBe(403);
  }
});
