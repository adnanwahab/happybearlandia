import { expect, test } from 'bun:test';
import { calculateBakeryTransport } from '../world/journeys/bakery-fixture.js';
import { decodeBakeryRecipe, runBakeryFuture } from '../world/journeys/bakery-scenario.js';
import { buildBakeryEvidence, serializeBakeryEvidence } from '../world/sprint2/bakery-export.js';

test('exports both reproducible runs and their original evidence', async () => {
  const evidence = await buildBakeryEvidence();
  expect(evidence.classification).toBe('synthetic');
  expect(evidence.metricUnits.workerHours).toBe('hours per modeled shift');
  const { baseline, intervention } = evidence.runs;
  for (const { provenance, ...run } of [baseline, intervention]) {
    const code = new URL(provenance.replayPath, 'https://example.test').searchParams.get('recipe');
    expect(code).toBe(provenance.recipeId);
    expect(run).toEqual(await runBakeryFuture(decodeBakeryRecipe(code)));
  }

  expect(baseline.months[72]).toMatchObject({ delivered: 40, unserved: 60, transportCost: 120, workerHours: 3.2 });
  expect(baseline.events[1]).toMatchObject({ month: 74, title: 'Riverside Bakery closes' });
  expect(intervention.months[72]).toMatchObject({ delivered: 100, unserved: 0, transportCost: 100, workerHours: 8 });
  expect(intervention.events[0].title).toBe('The direct flour route stays open');
  expect(evidence.transportEvidence).toEqual({
    openRoad: await calculateBakeryTransport(),
    closedRoad: await calculateBakeryTransport({ blocked: true }),
  });
  const { result } = evidence.transportEvidence.closedRoad;
  expect(result.traces[0]).toMatchObject({ inputHash: result.inputHash, unserved: 60 });
});

test('preserves late intervention failures and exports identical canonical bytes for equivalent recipes', async () => {
  const evidence = await buildBakeryEvidence('bakery-v1.2911.75');
  const { intervention } = evidence.runs;
  expect(intervention.months[75]).toMatchObject({
    roadClosed: false, bakeryOpen: false, delivered: 0, unserved: 0, workerHours: 0,
  });
  expect(intervention.events.at(-1).detail).toContain('had already closed');

  const bytes = serializeBakeryEvidence(evidence);
  expect(JSON.parse(bytes)).toEqual(evidence);
  expect(bytes).toStartWith('{"classification":"synthetic","limitations":');
  expect(bytes).toBe(serializeBakeryEvidence(await buildBakeryEvidence('bakery-v1.02911.075')));
  expect(bytes).not.toBe(serializeBakeryEvidence(await buildBakeryEvidence()));
});

test('reports unsupported recipes instead of substituting a different intervention', async () => {
  await expect(buildBakeryEvidence('bakery-v1.2911.baseline')).rejects.toThrow('requires a road intervention');
  await expect(buildBakeryEvidence('bakery-v2.2911.72')).rejects.toThrow('unavailable');
});
