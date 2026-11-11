import { canonicalJSON, canonicalDigest } from '../../replay/engine.js';
import { validateHousingFork } from '../../models/housing/fork.js';

export const REPLAY_IDENTITY = Object.freeze({ schemaVersion: 'housing-checkpoint.v1', modelVersion: '1.2.0', engineVersion: 'housing-monthly.v1', rulesVersion: 'housing-lifecycle.v1', recipeVersion: 'housing-recipe.v1' });
const MAX_BYTES = 8 * 1024 * 1024;
const copy = value => JSON.parse(canonicalJSON(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function fail(message) { throw new Error(message); }
function bounded(value) { const json = canonicalJSON(value); if (new TextEncoder().encode(json).length > MAX_BYTES) fail('Checkpoint exceeds 8 MiB'); return JSON.parse(json); }
function inputRecipe(input) {
  const { parameters, seed, years, projects = [], scheduledStress = [] } = input;
  if (!parameters || seed === undefined || years === undefined || input.fork || input.replay) fail('Explicit sampled parameters, seed and horizon required; forks belong to lineage');
  return bounded({ parameters, seed, years, projects, scheduledStress });
}
/** Inject the existing housing engine after applying integration.patch; no alternate dynamics. */
export function createHousingCheckpointAdapter({ simulateRun }) {
  if (typeof simulateRun !== 'function') fail('Housing engine required');
  async function seal(body) { body = bounded(body); return freeze({ ...body, digest: await canonicalDigest(body) }); }
  async function restore(serialized, expected = {}) {
    if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > MAX_BYTES) fail('Missing or oversized checkpoint');
    const record = bounded(JSON.parse(serialized)); const { digest, ...body } = record;
    for (const [key, value] of Object.entries(REPLAY_IDENTITY)) if (body[key] !== value) fail(`Unsupported ${key}`);
    if (digest !== await canonicalDigest(body)) fail('Corrupt checkpoint');
    if (body.id !== 'housing:' + await canonicalDigest({ recipe: body.recipe, lineage: body.lineage, month: body.state?.month })) fail('Checkpoint identity mismatch');
    if (body.recipeDigest !== await canonicalDigest(body.recipe)) fail('Recipe identity mismatch');
    const month = body.state?.month;
    if (!Number.isInteger(month) || month < 0 || month > body.recipe.years * 12 || body.state.monthlyTimeline?.at(-1)?.month !== month || body.state.lifecycle?.lastMonth !== month) fail('Checkpoint clock mismatch');
    if (!Array.isArray(body.lineage) || body.lineage.length > 16) fail('Invalid lineage');
    let previous = -1;
    for (const branch of body.lineage) {
      if (branch.month < previous || branch.month >= month || !branch.parentDigest) fail('Invalid causal lineage');
      const checked = validateHousingFork(branch, { years: body.recipe.years }); if (!checked.valid) fail(checked.errors.join(' ')); previous = branch.month;
    }
    for (const key of ['id', 'digest', 'recipeDigest']) if (expected[key] !== undefined && expected[key] !== record[key]) fail(`Requested ${key} mismatch`);
    return freeze(record);
  }
  async function execute(recipe, state, lineage, month, fork, parentDigest = null) {
    if (!Number.isInteger(month) || month < (state?.month ?? 0) || month > recipe.years * 12) fail('Invalid target month');
    let captured;
    const result = simulateRun({ ...copy(recipe), ...(fork ? { fork } : {}), replay: { ...(state ? { state: copy(state) } : {}), stopMonth: month, capture: value => { captured = copy(value); } } });
    if (!captured || captured.month !== month) fail('Engine checkpoint hooks unavailable');
    const body = { ...REPLAY_IDENTITY, recipe, recipeDigest: await canonicalDigest(recipe), lineage, parentDigest, state: captured };
    body.id = 'housing:' + await canonicalDigest({ recipe, lineage, month });
    const checkpoint = await seal(body);
    return { checkpoint, serialized: canonicalJSON(checkpoint), result, source: 'modeled-synthetic', empiricalCalibration: false };
  }
  return {
    restore,
    async start(input, month = input.years * 12) { return execute(inputRecipe(input), null, [], month); },
    async resume(serialized, month) { const parent = await restore(serialized); return execute(parent.recipe, parent.state, parent.lineage, month, null, parent.digest); },
    async fork(serialized, operations, month) {
      const parent = await restore(serialized);
      if (parent.lineage.length >= 16 || month <= parent.state.month) fail('Fork requires future time and at most 16 ancestors');
      const checked = validateHousingFork({ month: parent.state.month, operations }, { years: parent.recipe.years });
      if (!checked.valid) fail(checked.errors.join(' '));
      const branch = { ...checked.values, parentDigest: parent.digest, parentCheckpointId: parent.id };
      return execute(parent.recipe, parent.state, [...parent.lineage, branch], month, checked.values, parent.digest);
    },
  };
}
