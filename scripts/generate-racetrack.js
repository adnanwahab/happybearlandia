// Offline fixture generation only. No persistence or external inputs.
import { writeFile } from 'node:fs/promises';
import { createEngine, addIntervention, cityMetrics } from '../world/city/engine.js';
import { DEFAULT_RECIPE, MODEL_VERSION } from '../world/future-machine/contracts.js';
import { initialForRecipe } from '../world/future-machine/data/index.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { METRIC, TIME, VERSION } from '../world/racetrack/contract.js';
export async function representativeTrack(index) {
  const recipe=structuredClone(DEFAULT_RECIPE);
  recipe.intervention.amount=index+1;
  recipe.intervention.delay=(index*7)%48;
  const initial=initialForRecipe(recipe), engine=createEngine();
  let state=addIntervention(initial,recipe.intervention);
  const values=[cityMetrics(initial).housingUnits];
  for(let month=1;month<=120;month++) {state=engine.step(state).state; values.push(cityMetrics(state).housingUnits);}
  const body={schemaVersion:VERSION,id:`city-race-${index+1}`,label:`Plan ${index+1}: ${index+1} homes, delay ${recipe.intervention.delay}`,modelVersion:MODEL_VERSION,rules:engine.manifest,seed:recipe.seed,recipe,initialHash:await stateHash(initial),metric:METRIC,time:TIME,values,evidenceKind:'synthetic-model-output',provenance:initial.provenance};
  return {...body,checksum:await stateHash(body)};
}
if(import.meta.main) {
  const tracks=[];
  for(let i=0;i<100;i++) tracks.push(await representativeTrack(i));
  await writeFile(new URL('../world/racetrack/representative.json',import.meta.url),JSON.stringify({schemaVersion:VERSION,tracks})+'\n');
  console.log('Recorded 100 City scenarios, seed 42, months 0–120');
}
