import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { loadLayers } from '../world/civilization/archaeology/history.js';

test('archaeology reads exact saved layers and matches a new building to its construction trace', async () => {
  using db = new Database(':memory:');
  const handle = createCausalityHandler({ store: createCausalStore(db) });
  const origin = 'http://localhost';
  const request = (path, init) => handle(new Request(new URL(path, origin), init));
  expect(await loadLayers(request)).toEqual({ state: 'missing' });

  const record = await request('/api/causality/world-scenario', { method: 'POST' });
  expect(record.status).toBe(200);
  const read = await loadLayers(request);
  expect(read.state).toBe('ready');
  expect(read.entities.buildings[0].firstMonth).toBe(16);
  const [{ month, description, event }] = read.entities.buildings[0].layers;
  expect(month).toBe(16);
  expect(description).toContain('floors');
  expect(event.type).toBe('PROJECT_COMPLETED');
  expect(event.context.runId).toBe(read.context.runId);
  expect(read.entities.households.some(row => row.layers.some(layer => layer.event?.type === 'HOUSEHOLD_RELOCATED')))
    .toBe(true);
  expect(read.entities.businesses.some(row => row.layers.some(layer => layer.event?.type === 'BUSINESS_CLOSED')))
    .toBe(true);

  await expect(loadLayers((path, init) => path.includes('tick=5&') ? new Response(null, { status: 404 }) : request(path, init)))
    .rejects.toThrow('Recorded month 5 could not be loaded');
}, 20000);
