import { test, expect } from 'bun:test';
import { createRescueHandler, replayRescue } from '../world/storm/rescue-api.js';

test('private roles, revision isolation, atomic spend, matched replay and deletion', async () => {
  const handler = createRescueHandler();
  const send = (method, id = '', key = '', body) => handler(new Request('http://localhost/api/storm/rescue' + (id ? '/' + id : ''), { method, headers: { Authorization: 'Bearer ' + key }, ...(body && { body: JSON.stringify(body) }) }));
  const room = await (await send('POST')).json();
  expect((await send('GET', room.id)).status).toBe(403);
  expect((await send('POST', room.id, room.budget, { action: 'commit', revision: 0 })).status).toBe(422);
  expect((await send('POST', room.id, room.crew, { action: 'propose', value: 'before', revision: 0 })).status).toBe(422);
  expect((await send('POST', room.id, room.crew, { action: 'propose', value: 'crossing', revision: 0 })).status).toBe(200);
  expect((await send('POST', room.id, room.budget, { action: 'propose', value: 'before', revision: 0 })).status).toBe(409);
  await send('POST', room.id, room.budget, { action: 'propose', value: 'before', revision: 1 });
  expect((await send('POST', room.id, room.crew, { action: 'commit', revision: 2 })).status).toBe(403);
  const commits = await Promise.all([send('POST', room.id, room.budget, { action: 'commit', revision: 2 }), send('POST', room.id, room.budget, { action: 'commit', revision: 2 })]);
  expect(commits.map(r => r.status).sort()).toEqual([200, 409]);
  const { receipt } = await commits.find(r => r.status === 200).json();
  expect(receipt.run.spent).toBe(480000);
  expect(receipt.run).toEqual(replayRescue(receipt.plan));
  expect(receipt.run.baseline.seed).toBe(receipt.run.adjusted.seed);
  expect(receipt.run.baseline.rainRate).toBe(receipt.run.adjusted.rainRate);
  await send('DELETE', room.id, room.crew);
  expect((await send('GET', room.id, room.budget)).status).toBe(404);
});

test('missed window is explicit, has no spend, and expiration denies access', async () => {
  const result = replayRescue({ version: 'storm-rescue.v1', resources: 'crossing', timing: 'missed' });
  expect(result.outcome).toBe('missed');
  expect(result.realWorldOutcome).toBe('unknown');
  expect(result.spent).toBe(0);
  expect(result.control).toEqual(result.response);
  let time = 0;
  const handler = createRescueHandler({ now: () => time });
  const room = await (await handler(new Request('http://localhost/api/storm/rescue', { method: 'POST' }))).json();
  time = 3600000;
  expect((await handler(new Request('http://localhost/api/storm/rescue/' + room.id, { headers: { Authorization: 'Bearer ' + room.crew } }))).status).toBe(404);
});
