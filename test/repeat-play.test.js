import { expect, test } from 'bun:test';

function compare(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../world/cycle.worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => { clearTimeout(timeout); worker.terminate(); error ? reject(error) : resolve(result); };
    const timeout = setTimeout(() => finish(new Error('Matched comparison timed out')), 30000);
    worker.onerror = event => finish(new Error(event.message));
    worker.onmessage = ({ data }) => {
      if (data.type === 'done') finish(null, data.result);
      if (data.type === 'error') finish(new Error(data.error));
    };
    worker.postMessage({ type: 'run', payload });
  });
}

test('changing implementation year keeps real worker starting conditions and replays exactly', async () => {
  // Synthetic deterministic town; same local Balanced recipe as the normal quick demo.
  const recipe = { origin: { lat: 29.7286, lng: -95.4746 }, maxPeople: 30,
    proposalIds: ['t_brt', 'h_lots', 'f_drainage', 's_311'], label: 'Balanced', source: 'local', days: 7, year: 3 };
  const original = await compare(recipe);
  const changed = await compare({ ...recipe, year: 0 });
  expect(changed.year).toBe(0);
  expect(changed.days).toBe(original.days);
  expect(changed.proposalIds).toEqual(original.proposalIds);
  expect(changed.scores.before).toEqual(original.scores.before);
  expect(changed.scores.noPlan).toEqual(original.scores.noPlan);
  expect(changed.scores.withPlan).not.toEqual(original.scores.withPlan);
  expect(await compare({ ...recipe, year: 0 })).toEqual(changed);
}, 90000);
