import { VERSION } from '../../city/contracts.js';
import { COMMUTE_OPTIONS, QUEST_SCENARIO_VERSION } from '../../living-city/quests.js';
import { decodeChallenge, encodeChallenge } from '../../living-city/recipe.js';

export const sampleCount = 100;
export const horizon = 12;
export const recipeVersion = `${QUEST_SCENARIO_VERSION}+${VERSION}`;
export const receiptOptions = COMMUTE_OPTIONS;

export function readReceiptRecipe(challenge) {
  return decodeChallenge(challenge, {
    version: recipeVersion,
    options: receiptOptions,
    samples: sampleCount,
  });
}

export function makeReceiptRecipe({ seed, amount, index }) {
  return encodeChallenge({ version: recipeVersion, seed, amount, index });
}

export function pairEvidenceURL(recipe) {
  return '/world/living-city/?' + new URLSearchParams({ challenge: makeReceiptRecipe(recipe) });
}

export function makePolicyReceipt(ensemble) {
  const { seed, scenarioVersion, modelVersion, startMonth, months, policy, samples, summary } = ensemble;
  if (scenarioVersion !== QUEST_SCENARIO_VERSION || modelVersion !== VERSION || months !== horizon) {
    throw new Error('This ensemble does not match the versioned Riverside comparison.');
  }
  const stages = new Map();
  const outcomes = { improved: 0, unchanged: 0, worse: 0, missing: 0 };
  const pairs = samples.map(sample => {
    const stage = sample.intervention.policyStage ?? 'Unavailable';
    stages.set(stage, (stages.get(stage) ?? 0) + 1);
    const commute = sample.delta.commuteMinutes;
    const outcome = !Number.isFinite(commute) ? 'missing' :
      commute < -1e-9 ? 'improved' : commute > 1e-9 ? 'worse' : 'unchanged';
    outcomes[outcome]++;
    return {
      index: sample.index,
      seed: sample.seed,
      baseline: sample.baseline.commuteMinutes,
      intervention: sample.intervention.commuteMinutes,
      commute,
      balance: sample.delta.balance,
      stage,
      outcome,
      shock: sample.shock,
      evidenceURL: pairEvidenceURL({ seed, amount: policy.amount, index: sample.index }),
    };
  });
  return {
    seed,
    scenarioVersion,
    modelVersion,
    startMonth,
    endMonth: startMonth + months,
    policy,
    stages: [...stages.entries()].sort(([left], [right]) => left.localeCompare(right)),
    outcomes,
    pairs,
    meanCommuteDelta: summary.meanDelta,
    minCommuteDelta: summary.minDelta,
    maxCommuteDelta: summary.maxDelta,
    meanBalanceDelta: summary.meanBalanceDelta,
  };
}
