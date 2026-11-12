import { expect, test } from 'bun:test';
import { VERSION } from '../world/city/contracts.js';
import { QUEST_SCENARIO_VERSION, replayCommuteSample, runCommuteEnsemble } from '../world/living-city/quests.js';
import {
  makePolicyReceipt, makeReceiptRecipe, pairEvidenceURL, readReceiptRecipe, sampleCount,
} from '../world/laboratory/receipts/receipt.js';

test('receipts preserve paired outcomes, costs, stages and the exact replay recipe', () => {
  const ensemble = runCommuteEnsemble();
  const result = makePolicyReceipt(ensemble);
  expect(result.policy).toEqual({ type: 'transit', amount: 8, cost: 160000, districtId: 'd1' });
  expect([result.startMonth, result.endMonth]).toEqual([2, 14]);
  expect(result.pairs).toHaveLength(sampleCount);
  expect(result.stages.reduce((sum, [, count]) => sum + count, 0)).toBe(sampleCount);
  expect(result.outcomes).toEqual({
    improved: ensemble.summary.improved, unchanged: ensemble.summary.unchanged,
    worse: ensemble.summary.worsened, missing: ensemble.summary.unpaired,
  });
  expect(result.meanBalanceDelta).toBe(ensemble.summary.meanBalanceDelta);
  expect(result.meanCommuteDelta).toBe(ensemble.summary.meanDelta);

  const [pair] = result.pairs;
  const url = new URL(pair.evidenceURL, 'http://localhost');
  expect(url.pathname).toBe('/world/living-city/');
  const recipe = readReceiptRecipe(url.searchParams.get('challenge'));
  expect(recipe).toEqual({
    version: `${QUEST_SCENARIO_VERSION}+${VERSION}`,
    seed: ensemble.seed, amount: ensemble.policy.amount, index: pair.index,
  });
  const replay = replayCommuteSample(recipe);
  expect(pair).toMatchObject({
    seed: replay.seed, baseline: replay.baseline.commuteMinutes,
    intervention: replay.intervention.commuteMinutes, stage: replay.intervention.policyStage,
    shock: replay.shock, commute: replay.delta.commuteMinutes,
  });
  expect(result.pairs.find(row => row.commute === null)?.outcome).toBe('missing');
});

test('links reject stale versions and preserve nondefault seed, proposal and pair', () => {
  const recipe = { seed: 7, amount: 4, index: 99 };
  expect(readReceiptRecipe(makeReceiptRecipe(recipe))).toMatchObject(recipe);
  expect(new URL(pairEvidenceURL(recipe), 'http://localhost').searchParams.get('challenge')).toBe(makeReceiptRecipe(recipe));
  expect(() => readReceiptRecipe(QUEST_SCENARIO_VERSION + ':7:4:99')).toThrow('unavailable model version');
  expect(() => makePolicyReceipt({ scenarioVersion: QUEST_SCENARIO_VERSION, modelVersion: VERSION, months: 6 }))
    .toThrow('versioned Riverside comparison');
});
