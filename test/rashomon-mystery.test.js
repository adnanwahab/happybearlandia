import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { demoRunId } from '../world/causal/demo.js';
import { loadMystery } from '../world/rashomon-mystery.js';

test('three frozen beliefs share one stored event; replay matches without changing the run', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const read = path => handle(new Request('http://localhost' + path));
  expect(await loadMystery(read)).toEqual({ state: 'missing' });
  expect((await handle(new Request('http://localhost/api/causality/world-scenario', { method: 'POST' }))).status).toBe(200);
  const revision = store.getRun(demoRunId).revision;
  const report = await loadMystery(read);
  expect(report.state).toBe('ready');
  expect(report.beliefs).toHaveLength(3);
  const source = await read('/api/causality/explain?' + new URL(report.ledger.evidenceLink, 'http://localhost').searchParams);
  expect((await source.json()).nodes.find(n => n.id === report.ledger.eventId)?.type).toBe('FLOOD_DAMAGE');
  expect(new Set(report.beliefs.map(b => b.household)).size).toBe(3);
  for (const b of report.beliefs) {
    expect(b.eventId).toBe(report.ledger.eventId);
    expect(b.cause).toBe('unknown');
    expect(b.otherHouseholds).toBe('unknown');
    expect(Object.isFrozen(b)).toBe(true);
  }
  expect(await loadMystery(read)).toEqual(report);
  expect(store.getRun(demoRunId).revision).toBe(revision);
  const mismatch = async path => {
    const response = await read(path);
    if (!path.startsWith('/api/causality/state?')) return response;
    const value = await response.json(); value.state.seed++;
    return Response.json(value);
  };
  await expect(loadMystery(mismatch)).rejects.toThrow('could not be verified');
  const absent = path => path.startsWith('/api/causality/state?') ? new Response(null, {status:404}) : read(path);
  await expect(loadMystery(absent)).rejects.toThrow('could not be read');
}, 20000);
