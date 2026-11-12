import { createQuestScenario, QUEST_SCENARIO_VERSION, COMMUTE_OPTIONS, runCommuteEnsemble } from '../../living-city/quests.js';
import { encodeChallenge } from '../../living-city/recipe.js';

export const plannerVersion = 'riverside-fixed-route.v1';
const months = 12;
const samples = 100;

export function predictCommute(scenario, amount) {
  const { trip } = scenario.participant;
  const links = trip.route.map(id => scenario.state.links.find(link => link.id === id));
  if (links.some(link => !link) || !links.some(link => link.mode === 'transit' && link.from === trip.originId)) {
    throw new Error('This participant has no eligible transit link in the starting checkpoint.');
  }
  const evidence = links.map(({ id, from, mode, flow, capacity, freeTime }) => ({
    id, flow, capacity, freeTime, expands: mode === 'transit' && from === trip.originId,
  }));

  // The planner holds the route and demand fixed and uses a linear delay
  // approximation. The full City model recalculates routes and congestion.
  const predict = addedCapacity => evidence.reduce((sum, link) => {
    const capacity = link.capacity + (link.expands ? addedCapacity : 0);
    return sum + link.freeTime + 10 * Math.max(0, link.flow / Math.max(1, capacity) - 1);
  }, 0);
  const baseline = predict(0);
  const intervention = predict(amount);
  return { baseline, intervention, delta: intervention - baseline, evidence };
}

export function runPlannerExperiment({ seed = 2911, amount = 8 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new RangeError('Enter a valid unsigned 32-bit seed.');
  if (!COMMUTE_OPTIONS.some(option => option.amount === amount)) throw new RangeError('Choose a supported capacity increase.');

  const scenario = createQuestScenario({ seed });
  const forecast = predictCommute(scenario, amount);
  const { summary, samples: outcomes, policy } = runCommuteEnsemble({ seed, amount, months, samples });
  const representative = outcomes.find(sample => sample.delta.commuteMinutes !== null);
  return {
    plannerVersion, cityVersion: scenario.modelVersion, scenarioVersion: QUEST_SCENARIO_VERSION,
    seed, amount, policy, months, samples, participantId: scenario.participant.personId,
    startMonth: scenario.month, forecast, summary,
    challenge: representative ? encodeChallenge({
      version: `${QUEST_SCENARIO_VERSION}+${scenario.modelVersion}`, seed, amount, index: representative.index,
    }) : null,
  };
}
