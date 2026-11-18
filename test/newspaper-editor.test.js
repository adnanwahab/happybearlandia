import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { loadArchive } from '../world/newspaper/editions.js';
import { createDesk, reviewPage } from '../world/newspaper/editor.js';

test('pinned editorial challenge: three supported claims pass, drama and changed evidence fail', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const fetcher = path => handle(new Request(new URL(path, 'http://localhost')));
  expect(createDesk(await loadArchive(fetcher))).toBeNull();
  await handle(new Request('http://localhost/api/causality/world-scenario', { method: 'POST' }));
  const archive = await loadArchive(fetcher);
  const desk = createDesk(archive);
  const selections = desk.stories.slice(0, 3).map(s => ({ id: s.event.id, treatment: 'record', label: 'interpretation' }));
  const result = reviewPage(desk, selections, createDesk(await loadArchive(fetcher)));
  expect(result.ok).toBe(true);
  expect(result.page.claims).toHaveLength(3);
  for (const claim of result.page.claims) {
    expect(store.listEvents(desk.run.context.runId, { limit: 1000 }).items).toContainEqual(claim.event);
    expect(claim.href).toContain('targetId=');
  }
  expect(reviewPage(desk, selections.slice(1), desk).ok).toBe(false);
  expect(reviewPage(desk, [selections[0], selections[0], selections[0]], desk).ok).toBe(false);
  expect(reviewPage(desk, selections.map(s => ({ ...s, treatment: 'prediction' })), desk).errors.join()).toContain('Unsupported headline');
  expect(reviewPage(desk, selections.map(s => ({ ...s, label: 'fact' })), desk).ok).toBe(false);
  expect(reviewPage(desk, selections.map(s => ({ ...s, id: 'fabricated' })), desk).ok).toBe(false);
  const mismatch = structuredClone(desk); mismatch.run.context.seed++;
  expect(reviewPage(desk, selections, mismatch).errors.join()).toContain('mismatch');
  expect(reviewPage(null, selections, desk).ok).toBe(false);
  expect(archive.run).toEqual(desk.run);
}, 20000);
