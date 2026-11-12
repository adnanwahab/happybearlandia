import { discoverQuests, updateQuests } from './emergent-quests.js';
import { draw, VERSION } from '../city/contracts.js';
import { addIntervention, cityMetrics, createEngine, scheduleShock } from '../city/engine.js';
import { createCity } from '../city/seed.js';

export const QUEST_SCENARIO_VERSION = 'living-city-commute.v1';
export const COMMUTE_OPTIONS = Object.freeze([
  Object.freeze({ amount: 4, cost: 80000, label: 'Add 4 units of capacity' }),
  Object.freeze({ amount: 8, cost: 160000, label: 'Add 8 units of capacity' }),
  Object.freeze({ amount: 12, cost: 240000, label: 'Add 12 units of capacity' }),
]);

const defaultSeed = 2911;
const defaultMonths = 12;
const sampleLimit = 100;
const participantId = 'worker-1';
const engine = createEngine();

function initialCity(seed) {
  const state = createCity({ seed, households: 18 });
  state.provenance.datasetVersion = QUEST_SCENARIO_VERSION;

  // These are authored synthetic starting assumptions for the quest. Leaving
  // parcel capacity at zero keeps unrelated private redevelopment out of this
  // short experiment while the engine still processes public transit projects.
  for (const parcel of state.parcels) parcel.capacity = 0;
  for (const worker of state.workers) worker.age = Math.min(worker.age, 46);
  for (const household of state.households) {
    household.otherIncome += 5500;
    household.leaseUntil = 20;
  }
  for (const job of state.jobs) job.wage = 1800;
  for (const link of state.links) {
    if (link.mode === 'road' && link.to === 'd0') link.freeTime = 35;
    if (link.id === 'transit-d1-d0') link.capacity = 1;
  }

  // Two actual Riverside workers start with Center jobs. The engine will
  // assign their routes and calculate travel time from the resulting load.
  for (const [workerId, jobId] of [[participantId, 'job-d0-0'], ['worker-4', 'job-d0-1']]) {
    state.workers.find(worker => worker.id === workerId).jobId = jobId;
    state.jobs.find(job => job.id === jobId).workerId = workerId;
  }

  state.units.find(unit => unit.id === 'unit-d0-0').rent = 4600;
  state.businesses.find(business => business.id === 'business-d2').operatingCost = 22000;
  state.facilities.find(facility => facility.id === 'school-d0').capacity = 2;
  state.utilities.find(utility => utility.id === 'electric-d2').capacity = 4;
  return engine.initialize(state);
}

function inspectParticipant(state, trips) {
  const trip = trips.find(row => row.personId === participantId) ?? null;
  const worker = state.workers.find(row => row.id === participantId);
  const household = state.households.find(row => row.id === worker?.householdId);
  const unit = state.units.find(row => row.id === household?.unitId);
  return {
    personId: participantId,
    householdId: household?.id ?? null,
    buildingId: unit?.buildingId ?? null,
    unitId: unit?.id ?? null,
    districtId: household?.districtId ?? null,
    jobId: worker?.jobId ?? null,
    trip,
    commuteMinutes: trip?.experiencedMinutes ?? null,
    status: trip ? 'commute-recorded' : worker?.jobId ? 'no-recorded-trip' : worker ? 'no-job' : 'not-in-city',
  };
}

export function createQuestScenario({ seed = defaultSeed } = {}) {
  const { state, trips, events } = engine.step(engine.step(initialCity(seed)).state);
  const participant = inspectParticipant(state, trips);
  return {
    seed, modelVersion: VERSION, scenarioVersion: QUEST_SCENARIO_VERSION,
    month: state.month, state, trips, events, participant,
    quests: discoverQuests({ state, trips }),
  };
}

function experimentOptions({ seed = defaultSeed, amount = 8, months = defaultMonths } = {}) {
  const option = COMMUTE_OPTIONS.find(row => row.amount === amount);
  if (!option) throw new RangeError('Choose a supported transit capacity increase.');
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new RangeError('Choose an experiment horizon between 1 and 24 months.');
  }
  const scenario = createQuestScenario({ seed });
  const districtId = scenario.participant.trip.originId;
  return {
    scenario,
    months,
    policy: { type: 'transit', districtId, amount, cost: option.cost },
  };
}

function sampleStart(state, index) {
  const seed = (state.seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  const sharedState = { ...structuredClone(state), seed };
  let shock = null;
  if (draw(seed, 'quest-riverside-flood') < 0.25) {
    shock = {
      type: 'flood',
      districtId: 'd1',
      start: state.month + 5 + Math.floor(draw(seed, 'quest-flood-start') * 8),
      duration: 1 + Math.floor(draw(seed, 'quest-flood-duration') * 3),
      severity: 0.75,
    };
  }
  return { seed, shock, state: shock ? scheduleShock(sharedState, shock) : sharedState };
}

function advance(state, months, includeCheckpoint, initialQuests) {
  let quests = initialQuests;
  const events = [];
  let result;
  for (let step = 0; step < months; step++) {
    result = engine.step(state);
    state = result.state;
    if (includeCheckpoint) {
      quests = updateQuests(quests, result);
      for (const quest of discoverQuests(result)) {
        if (!quests.some(row => row.id === quest.id)) quests.push(quest);
      }
    }
    if (includeCheckpoint) events.push(...result.events);
  }
  const { trips } = result;
  const { meanRent, balance, employed, overloadedServices } = cityMetrics(state);
  const participant = inspectParticipant(state, trips);
  return {
    commuteMinutes: participant.commuteMinutes,
    meanRent, balance, employed, overloadedServices,
    policyStage: state.policies.at(-1)?.stage ?? null,
    participant,
    ...(includeCheckpoint ? { state, trips, events, quests } : {}),
  };
}

function compareSample(experiment, index, includeCheckpoint) {
  const { scenario, policy, months } = experiment;
  const start = sampleStart(scenario.state, index);
  const quests = discoverQuests({ state: start.state, trips: scenario.trips });
  const baseline = advance(start.state, months, includeCheckpoint, quests);
  const intervention = advance(addIntervention(start.state, policy), months, includeCheckpoint, quests);
  const delta = Object.fromEntries(['meanRent', 'balance', 'employed', 'overloadedServices']
    .map(key => [key, intervention[key] - baseline[key]]));
  delta.commuteMinutes = baseline.commuteMinutes === null || intervention.commuteMinutes === null
    ? null : intervention.commuteMinutes - baseline.commuteMinutes;
  return { index, seed: start.seed, shock: start.shock, baseline, intervention, delta };
}

function summarize(samples) {
  const paired = samples.filter(sample => sample.delta.commuteMinutes !== null);
  const deltas = paired.map(sample => sample.delta.commuteMinutes).sort((a, b) => a - b);
  const middle = Math.floor(deltas.length / 2);
  const mean = values => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  const improved = deltas.filter(delta => delta < -1e-9).length;
  const worsened = deltas.filter(delta => delta > 1e-9).length;
  return {
    paired: paired.length,
    unpaired: samples.length - paired.length,
    improved,
    unchanged: paired.length - improved - worsened,
    worsened,
    meanDelta: mean(deltas),
    minDelta: deltas[0] ?? null,
    medianDelta: deltas.length ? (deltas[middle] + deltas[Math.floor((deltas.length - 1) / 2)]) / 2 : null,
    maxDelta: deltas.at(-1) ?? null,
    meanBaseline: mean(paired.map(sample => sample.baseline.commuteMinutes)),
    meanIntervention: mean(paired.map(sample => sample.intervention.commuteMinutes)),
    meanBalanceDelta: mean(samples.map(sample => sample.delta.balance)),
  };
}

export function runCommuteEnsemble({ samples = sampleLimit, ...options } = {}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > sampleLimit) {
    throw new RangeError('Choose between 1 and 100 paired samples.');
  }
  const experiment = experimentOptions(options);
  const { scenario, policy, months } = experiment;
  const results = Array.from({ length: samples }, (_, index) => compareSample(experiment, index, false));
  return {
    seed: scenario.seed,
    modelVersion: VERSION,
    scenarioVersion: QUEST_SCENARIO_VERSION,
    startMonth: scenario.month,
    months,
    amount: policy.amount,
    policy,
    samples: results,
    summary: summarize(results),
  };
}

export function replayCommuteSample({ index, ...options } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= sampleLimit) {
    throw new RangeError('Choose a sample index from 0 to 99.');
  }
  return compareSample(experimentOptions(options), index, true);
}
