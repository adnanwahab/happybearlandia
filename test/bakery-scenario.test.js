import { expect, test } from 'bun:test';
import {
  BAKERY_DECISION_MONTH, BAKERY_FINAL_MONTH, decodeBakeryRecipe,
  encodeBakeryRecipe, runBakeryFuture,
} from '../world/journeys/bakery-scenario.js';

test('the bakery mystery follows recorded supply, business, and worker outcomes', async () => {
  const baseline = await runBakeryFuture();
  expect(baseline.months).toHaveLength(BAKERY_FINAL_MONTH + 1);
  expect(baseline.months.at(-1)).toMatchObject({ year: 2046, bakeryOpen: false, workerHours: 0 });
  expect(baseline.months[BAKERY_DECISION_MONTH - 1]).toMatchObject({
    delivered: 100, transportCost: 100, workerHours: 8,
  });
  expect(baseline.months[BAKERY_DECISION_MONTH]).toMatchObject({
    delivered: 40, unserved: 60, transportCost: 120, workerHours: 3.2,
  });
  expect(baseline.events.map(event => event.month)).toEqual([
    BAKERY_DECISION_MONTH, BAKERY_DECISION_MONTH + 2,
  ]);
});

test('shareable recipes preserve the prefix and replay early and late interventions', async () => {
  const baseline = await runBakeryFuture();
  const reopenMonth = BAKERY_DECISION_MONTH + 2;
  const future = await runBakeryFuture({ reopenMonth });
  const replay = await runBakeryFuture(decodeBakeryRecipe(encodeBakeryRecipe(future.recipe)));
  expect(replay).toEqual(future);
  expect(future.months.slice(0, reopenMonth)).toEqual(baseline.months.slice(0, reopenMonth));
  expect(future.months.at(-1)).toMatchObject({ bakeryOpen: true, workerHours: 8 });
  expect(future.events.at(-1).month).toBe(reopenMonth);
  const late = await runBakeryFuture({ reopenMonth: reopenMonth + 1 });
  expect(late.months.at(-1)).toMatchObject({ roadClosed: false, bakeryOpen: false, workerHours: 0 });
  expect(late.events.at(-1).detail).toContain('had already closed');
  expect(await runBakeryFuture()).toEqual(baseline);
});

test('unsupported recipes fail without silently changing the model or decision', async () => {
  for (const code of ['bakery-v2.2911.72', 'bakery-v1.99.72', 'bakery-v1.2911.71',
    'bakery-v1.2911.241', 'bakery-v1.2911.72.75', 'bakery-v1.2911.']) {
    expect(() => decodeBakeryRecipe(code)).toThrow();
  }
  await expect(runBakeryFuture({ reopenMonth: 72.5 })).rejects.toThrow();
});
