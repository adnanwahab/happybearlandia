/** Golden normalized monthly City replay; no clocks or runtime metadata in hashes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { DEFAULT_RECIPE, ENTITY_COLLECTIONS } from '../world/future-machine/contracts.js';
import { initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { stateHash, freeze } from '../world/future-machine/data/core.js';
export const FIXTURES = {
  'zero-control': {...DEFAULT_RECIPE, seed:0, intervention:null},
  'housing-42': {...DEFAULT_RECIPE, seed:42},
  'delayed-max-seed': {...DEFAULT_RECIPE, seed:4294967295, intervention:{...DEFAULT_RECIPE.intervention, delay:12, compliance:0.5}},
};
export async function summarize(frame) {
  const entities = {};
  for (const collection of ENTITY_COLLECTIONS) {
    for (const row of frame.state[collection]) entities[`${collection}/${row.id}`] = await stateHash(row);
  }
  return {month:frame.month, hash:await stateHash(frame), entities};
}
export async function replay(id) {
  const recipe = FIXTURES[id];
  if (!recipe) throw new Error(`Unknown fixture: ${id}`);
  const initial = freeze(initialForRecipe(recipe)), engine = createEngine(), steps = [];
  let state = recipe.intervention ? addIntervention(initial, recipe.intervention) : structuredClone(initial);
  for (let month=1; month<=120; month++) {
    const step = engine.step(state); steps.push(step); state = step.state;
  }
  const frames = [];
  for (const frame of normalizeReplay(initial, {steps})) frames.push(await summarize(frame));
  return {schemaVersion:'city-replay-golden.v1', recipe, rules:engine.manifest, generator:initial.provenance.datasetVersion, hash:await stateHash(frames.map(f=>f.hash)), frames};
}
export function firstMismatch(expected, actual) {
  for (let i=0; i<Math.max(expected.frames.length,actual.frames.length); i++) {
    const a=expected.frames[i], b=actual.frames[i];
    if (a?.hash === b?.hash && a?.month === b?.month) continue;
    const keys=[...new Set([...Object.keys(a?.entities || {}),...Object.keys(b?.entities || {})])].sort();
    const entity=keys.find(key=>a?.entities[key]!==b?.entities[key]);
    return {month:a?.month ?? b?.month, entity:entity ?? '(frame metadata, metrics, or recorded outputs)', expected:a?.hash ?? null, actual:b?.hash ?? null};
  }
  return null;
}
export function checkUpdate(previous, next, note, previousNote = '') {
  if (JSON.stringify(previous)===JSON.stringify(next)) return;
  if (previous.recipe.modelVersion===next.recipe.modelVersion) throw new Error('Fixture change requires a model version update');
  if (!note.includes(next.recipe.modelVersion) || previousNote.includes(next.recipe.modelVersion)) throw new Error('Document the new model version in docs/city-replay-versions.md');
}
if (import.meta.main) {
  const [id, mode, base] = process.argv.slice(2);
  const path=`test/fixtures/city-replay/${id}.json`;
  if (!FIXTURES[id]) throw new Error(`Unknown fixture: ${id}`);
  if (mode==='--guard') {
    const next=JSON.parse(readFileSync(path));
    const previous=JSON.parse(execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'}));
    const previousNote=execFileSync('git',['show',`${base}:docs/city-replay-versions.md`],{encoding:'utf8'});
    checkUpdate(previous,next,readFileSync('docs/city-replay-versions.md','utf8'),previousNote);
  } else {
    const actual=await replay(id);
    if (mode==='--write') writeFileSync(path,JSON.stringify(actual,null,2)+'\n');
    else {
      const expected=JSON.parse(readFileSync(path));
      const mismatch=firstMismatch(expected,actual);
      if (mismatch || JSON.stringify(expected)!==JSON.stringify(actual)) {
        console.error(JSON.stringify({fixture:id,mismatch:mismatch ?? 'Recipe, rules, generator or aggregate hash mismatch'}));
        process.exitCode=1;
      } else console.log(`${id}: 121 normalized months match ${actual.hash}`);
    }
  }
}
