/** Sequential acceptance harness; monthly City remains the sole simulation authority. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { DEFAULT_RECIPE, ENTITY_COLLECTIONS } from '../world/future-machine/contracts.js';
import { initialForRecipe, validateRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { freeze, stateHash } from '../world/future-machine/data/core.js';

export const SEEDS = Object.freeze([...Array.from({length:100}, (_, i) => i), 2147483647, 2147483648, 4294967294, 4294967295]);
export const BOUNDARIES = Object.freeze([
  {seed:0, households:1, intervention:null},
  {seed:4294967295, households:120, intervention:{...DEFAULT_RECIPE.intervention, amount:120, cost:0, delay:120, compliance:0}},
]);
export function checkSeeds(seeds) {
  assert(Array.isArray(seeds) && seeds.length > 0, 'Expected nonempty seed list');
  assert.equal(new Set(seeds).size, seeds.length, 'Duplicate seeds');
  for (const seed of seeds) assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Expected uint32 seed');
  return seeds;
}
export function checkStep(step, initial, month, manifest) {
  const s = step.state;
  assert.equal(s.seed, initial.seed, 'Seed identity');
  assert.equal(s.month, month, 'Monthly clock');
  assert.equal(s.version, initial.version, 'Model version');
  assert.equal(s.provenance.datasetVersion, initial.provenance.datasetVersion, 'Generator provenance');
  assert.deepEqual(s.provenance.assumptions, initial.provenance.assumptions, 'Synthetic assumptions');
  for (const collection of ENTITY_COLLECTIONS) {
    assert.equal(new Set(s[collection].map(row=>row.id)).size, s[collection].length, `${collection} identity`);
  }
  const systems = new Map(manifest.map(pack=>[pack.id,pack.version]));
  const ids = new Set();
  for (const event of step.events) {
    assert(!ids.has(event.id), 'Duplicate event identity'); ids.add(event.id);
    assert.equal(event.simulationTime, month, 'Event time');
    assert.equal(event.modelVersion, initial.version, 'Event version');
    assert(systems.has(event.system), 'Event system provenance');
    assert.equal(event.modelId, event.system, 'Event model identity');
  }
  assert(step.observations.length > 0, 'Missing observations');
  for (const observation of step.observations) {
    assert.equal(observation.simulationTime, month, 'Observation time');
    assert.equal(observation.modelVersion, systems.get(observation.system), 'Observation rules');
  }
}
async function armDigest(initial, policy) {
  const engine = createEngine(), steps = [], hashes = [];
  let state = policy ? addIntervention(initial, policy) : structuredClone(initial);
  for (let month=1; month<=120; month++) {
    const step = engine.step(state);
    checkStep(step, initial, month, engine.manifest);
    hashes.push(await stateHash(step));
    steps.push(step); state = step.state;
  }
  const frames = normalizeReplay(initial, {steps});
  assert.equal(frames.length, 121);
  assert.deepEqual(frames[0].state, initial, 'Common original Month 0');
  return {rawDigest:await stateHash(hashes), historyDigest:await stateHash(await Promise.all(frames.map(stateHash))), frames:frames.length};
}
export async function pairDigest(input) {
  const recipe = validateRecipe(input), initial = freeze(initialForRecipe(recipe));
  const initialDigest = await stateHash(initial);
  const baseline = await armDigest(initial, null);
  const plan = await armDigest(initial, recipe.intervention);
  assert.equal(await stateHash(initial), initialDigest, 'Original mutation');
  assert.equal(await stateHash(initialForRecipe(recipe)), initialDigest, 'Generator replay');
  return {initialDigest, baseline, plan};
}
export function compareDigests(actual, replay) {
  assert.deepEqual(replay, actual, 'Independent replay mismatch');
}
export async function sweep({seeds=SEEDS, boundaries=BOUNDARIES, runPair=pairDigest, onCase=()=>{}}={}) {
  checkSeeds(seeds);
  const cases = [...seeds.map(seed=>({...DEFAULT_RECIPE,seed})), ...boundaries.map(value=>({...DEFAULT_RECIPE,...value}))];
  const results=[], mismatches=[];
  for (const [index,input] of cases.entries()) {
    let recipe;
    try {
      recipe=validateRecipe(input);
      const actual=await runPair(recipe), replay=await runPair(recipe);
      results.push({index,recipe,actual,replay});
      compareDigests(actual,replay);
    } catch(error) {
      mismatches.push({index, input, message:error.message});
    }
    onCase(index+1, cases.length);
  }
  return {schemaVersion:'city-seed-replay-sweep.v1',seeds:[...seeds],boundaries,caseCount:cases.length,passed:cases.length-mismatches.length,results,mismatches};
}
if (import.meta.main) {
  const command='bun scripts/verify-city-seed-replay.mjs';
  const sources=['world/city/contracts.js','world/city/engine.js','world/city/seed.js','world/city/systems.js','world/future-machine/contracts.js','world/future-machine/data/index.js','world/future-machine/data/core.js','scripts/verify-city-seed-replay.mjs'];
  const report=await sweep({onCase:(n,total)=>{if(n%10===0||n===total)console.log(`${n}/${total} cases completed`);}});
  Object.assign(report,{command,sourceSHA:execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),runtime:Bun.version,concurrency:1,modelVersion:DEFAULT_RECIPE.modelVersion,rules:createEngine().manifest,generator:'future-machine-synthetic.v1',limitations:['Synthetic inventory, illustrative uncalibrated monthly equations; no empirical or geographic forecast.','Independent recomputation verifies deterministic replay, not saved-checkpoint equivalence or causal validity.','Only monthly City identities/time; no Population/House mapping.','Engine-only acceptance; excludes API, persistence, browser and performance guarantees.']});
  const path='docs/evidence/city-seed-replay-100.json';
  writeFileSync(`${path}.tmp`,`${JSON.stringify(report,null,2)}\n`);renameSync(`${path}.tmp`,path);
  console.log(JSON.stringify({passed:report.passed,cases:report.caseCount,mismatches:report.mismatches.length,path}));
  if(report.mismatches.length)process.exitCode=1;
}
