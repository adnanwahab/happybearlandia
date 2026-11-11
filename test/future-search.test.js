import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createCausalityHandler } from '../world/causality/api.js';
import { createCausalStore } from '../shared/causality/storage.js';
import { assessRun, searchFutures } from '../world/civilization/futures/search.js';
import { contextFromURL } from '../world/universe/navigation.js';

test('searches exact saved City months and opens inspector and replay evidence', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const origin = 'http://localhost';
  const reads = [];
  const fetcher = async path => {
    const url = new URL(path, origin);
    if (url.pathname.endsWith('/observations')) url.searchParams.set('limit', '50');
    reads.push(url);
    return handle(new Request(url));
  };
  const query = { start: 0, end: 20, rent: 'any', travel: 'any' };
  expect(await searchFutures(query, { fetcher })).toEqual({ results: [], truncated: false });

  const response = await handle(new Request(origin + '/api/causality/world-scenario', { method: 'POST' }));
  expect(response.status).toBe(200);
  const { context } = await response.json();
  const { results } = await searchFutures(query, { fetcher });
  expect(reads.some(url => url.searchParams.has('afterSequence'))).toBe(true);
  expect(results).toHaveLength(1);
  const [result] = results;
  expect(result.status).toBe('match');
  expect(result.metrics.map(metric => metric.unit)).toEqual(['modeled USD/month', 'minutes']);
  expect(result.metrics.every(metric => Number.isFinite(metric.change))).toBe(true);
  expect(result.replay.map(link => contextFromURL(link.url).tick)).toEqual([0, 20]);

  const rentEvidence = new URL(result.metrics[0].end.url, origin);
  expect(contextFromURL(rentEvidence).runId).toBe(context.runId);
  const evidence = await handle(new Request(origin + '/api/causality/explain?' + rentEvidence.searchParams));
  expect(evidence.status).toBe(200);
  expect((await evidence.json()).nodes[0]).toMatchObject({ value: result.metrics[0].end.value });

  const absent = await searchFutures({ ...query, end: 21, rent: 'lower' }, { fetcher });
  expect(absent.results[0].status).toBe('missing');
  expect(absent.results[0].replay.map(link => link.tick)).toEqual([0]);
  await expect(searchFutures({ ...query, end: 0 }, { fetcher })).rejects.toThrow('end after the start');

  const observations = store.listObservations(context.runId, { limit: 1000 }).items;
  const { run, metrics } = result;
  const [rent] = metrics;
  const strict = { ...query, rent: 'lower' };
  const expected = rent.change < 0 ? 'match' : 'excluded';
  expect(assessRun(run, observations, [], strict).status).toBe(expected);
  const endRent = observations.find(row => row.metricId === rent.id && row.context.tick === 20);
  expect(assessRun(run, [...observations, endRent], [], strict).status).toBe('missing');
  expect(assessRun(run, observations.map(row => row === endRent ? { ...row, unit: 'USD' } : row),
    [], strict).status).toBe('missing');
});
