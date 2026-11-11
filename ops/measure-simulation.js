import { createCustomHouseholdSave } from '../world/house/creator-model.js';
import { runCommuteEnsemble } from '../world/living-city/quests.js';

async function measure(label, task) {
  const before = process.memoryUsage();
  const cpu = process.cpuUsage();
  const start = performance.now();
  const result = await task();
  return {
    label, elapsedMs: Math.round(performance.now() - start), cpu: process.cpuUsage(cpu),
    rssBeforeBytes: before.rss, rssAfterBytes: process.memoryUsage().rss,
    ...result,
  };
}

const reports = [];
reports.push(await measure('100 paired commute futures', () => {
  const run = runCommuteEnsemble({ seed: 2911, amount: 8, months: 12, samples: 100 });
  return { samples: run.samples.length, horizonMonths: run.months, resultBytes: Buffer.byteLength(JSON.stringify(run)) };
}));
reports.push(await measure('one guided household Population checkpoint', async () => {
  const { save } = await createCustomHouseholdSave({
    name: 'Measurement household', startingMoney: 14250, relationship: 'roommates',
    members: [{ name: 'Alex Rivera', ageYears: 35, voice: 'warm', skinColor: '#d1a77c',
      shirtColor: '#658da6', hairColor: '#534d36', traits: ['social', 'creative', 'romantic'], interests: ['hobbies'] }],
  });
  return { checkpointBytes: Buffer.byteLength(JSON.stringify(save.checkpoint)), saveBytes: Buffer.byteLength(JSON.stringify(save)) };
}));
console.log(JSON.stringify(reports, null, 2));
