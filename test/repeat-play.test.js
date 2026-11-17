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

test('custom card levers reach real worker unchanged and replay against identical baseline',async()=>{
  const recipe={origin:{lat:29.7286,lng:-95.4746},maxPeople:10,proposalIds:[],label:'Make my own',days:7,year:0};
  const baseline=await compare(recipe);
  const customEffects={speedMult:2.13,floodMitigation:.17,housingGrowth:.53,voucherMonthly:41};
  const result=await compare({...recipe,customEffects});
  expect(result.effects).toEqual({...baseline.effects,...customEffects});
  expect(result.custom).toBe(true);expect(result.year).toBe(0);expect(result.proposalIds).toEqual([]);
  expect(result.scores.noPlan).toEqual(baseline.scores.noPlan);expect(result.scores.before).toEqual(baseline.scores.before);
  expect(result.scores.withPlan).not.toEqual(baseline.scores.withPlan);
  expect(await compare({...recipe,customEffects})).toEqual(result);
},90000);
