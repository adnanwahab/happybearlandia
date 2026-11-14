import { fingerprint } from './reproducibility.js';

// Synthetic control fixture: no people, social rules or empirical calibration.
export const GYM_VERSION = 'hbl-resource-gym.v1';
const recipe = {
  version: GYM_VERSION, model: 'bounded-resource.v1', rules: 'resource-step.v1',
  dependencies: [], source: { kind: 'synthetic', revision: 'authored.v1' },
  initialState: { stock: 2 }, inputs: { capacity: 4 },
  actions: ['wait', 'replenish'], observation: 'stock-and-tick.v1',
  limits: { steps: 8, maxArtifactBytes: 65536 },
  reward: { version: 'availability.v1', units: 'utility points',
    components: { served: 1, shortage: -2, replenish: -0.25 },
    terminal: 'sum through eight ticks', constraints: 'stock in [0,4]' },
  trainingSeeds: [11, 12], evaluationSeeds: [101, 102],
};
const equal = (a, b) => fingerprint(a) === fingerprint(b);
export function gymEnvironment() {
  return { id: `gym_${fingerprint(recipe)}`, ...structuredClone(recipe), rewardDigest: fingerprint(recipe.reward) };
}
export function rebuildGym(environment) {
  if (!environment || !equal(environment, gymEnvironment())) throw new Error('Unsupported or changed gym environment/reward declaration');
  return structuredClone(environment);
}
const policies = {
  'stock-threshold.v1': stock => stock < 2 ? 'replenish' : 'wait',
  'wait.v1': () => 'wait',
};
export function gymEpisode(environment, seed, policyVersion, actions = null) {
  const env = rebuildGym(environment);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid seed');
  if (!policies[policyVersion]) throw new Error('Unsupported policy');
  if (actions !== null && (!Array.isArray(actions) || actions.length > env.limits.steps)) throw new Error('Invalid action sequence');
  let stock = env.initialState.stock, rng = seed >>> 0, total = 0;
  const trajectory = [];
  let termination = 'step-limit';
  for (let tick = 0; tick < env.limits.steps; tick++) {
    if (actions && tick === actions.length) { termination = 'interrupted'; break; }
    const observation = { stock, tick };
    const action = actions ? actions[tick] : policies[policyVersion](stock);
    if (!env.actions.includes(action)) { termination = 'invalid-action'; break; }
    // Authored assumption: independent binary demand, deterministic LCG v1.
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const demand = rng >>> 31;
    if (action === 'replenish') stock = Math.min(env.inputs.capacity, stock + 2);
    const served = Math.min(stock, demand);
    stock -= served;
    const weights = env.reward.components;
    const components = { served: weights.served * served, shortage: weights.shortage * (demand - served), replenish: action === 'replenish' ? weights.replenish : 0 };
    const reward = Object.values(components).reduce((a, b) => a + b, 0);
    total += reward;
    trajectory.push({ id: `step_${tick}`, causes: tick ? [`step_${tick - 1}`] : [env.id], observation, action, demand, components, reward, nextObservation: { stock, tick: tick + 1 } });
  }
  return { environmentId: env.id, rewardDigest: env.rewardDigest, seed, policyVersion, trajectory, total, termination };
}
export function runGym(environment, policyVersion = 'stock-threshold.v1') {
  const env = rebuildGym(environment);
  const training = env.trainingSeeds.map(seed => gymEpisode(env, seed, policyVersion));
  const heldOut = env.evaluationSeeds.map(seed => gymEpisode(env, seed, policyVersion));
  const summarize = episodes => ({ sampleCount: episodes.length, units: env.reward.units,
    meanReward: episodes.reduce((sum, episode) => sum + episode.total, 0) / episodes.length,
    uncertainty: 'Two authored seeds; no population confidence estimate.' });
  return { schemaVersion: 'hbl-agent-gym-run.v1', id: `gym_run_${fingerprint({ env, policyVersion })}`,
    environment: env, policyVersion, training, heldOut,
    evaluation: { simulated: { kind: 'synthetic', environmentId: env.id, policyVersion,
      training: summarize(training), heldOut: summarize(heldOut),
      limitations: 'Scripted policies, synthetic binary demand; no learning or empirical validation.' },
    realWorld: { status: 'unavailable', sampleCount: 0, provenance: null, reason: 'No real-world evaluation performed.' } },
    registry: { resultKind: 'synthetic', modelVersion: GYM_VERSION, hypothesis: 'Maintain stock under synthetic demand', intendedUse: 'Controlled agent contract verification' } };
}
export function replayGym(snapshot) {
  if (JSON.stringify(snapshot).length > recipe.limits.maxArtifactBytes) throw new Error('Gym artifact exceeds size limit');
  const regenerated = runGym(snapshot.environment, snapshot.policyVersion);
  return { exact: equal(snapshot, regenerated), resultLabel: 'Synthetic model results', environmentId: regenerated.environment.id };
}
