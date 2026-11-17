import { test, expect } from 'bun:test';
import { PLAYABLE_RECIPES } from '../world/future-machine/recipes.js';
import { initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { stateHash, freeze } from '../world/future-machine/data/core.js';
import { createShareURL, parseShareURL } from '../world/future-machine/share/index.js';
function run(initial, intervention) {
  let state=intervention ? addIntervention(initial,intervention) : structuredClone(initial);
  const engine=createEngine(),steps=[];
  for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}
  return normalizeReplay(initial,{steps});
}
test('three curated recipes reproduce distinct recorded housing outcomes with matched immutable starts',async()=>{
  expect(PLAYABLE_RECIPES).toHaveLength(3);
  const signatures=[];
  for(const entry of PLAYABLE_RECIPES){
    const initial=freeze(initialForRecipe(entry.recipe)), hash=await stateHash(initial);
    const baseline=run(initial),plan=run(initial,entry.recipe.intervention);
    expect(plan[0]).toEqual(baseline[0]);
    expect(await stateHash(initial)).toBe(hash);
    expect(await stateHash(run(initial,entry.recipe.intervention))).toBe(await stateHash(plan));
    expect(initial.provenance.datasetVersion).toBe(entry.datasetVersion);
    expect(parseShareURL(createShareURL({recipe:entry.recipe,month:120},'https://example.test/world/future-machine.html')).recipe).toEqual(entry.recipe);
    const completion=plan.flatMap(s=>s.events).find(e=>e.eventType==='PROJECT_COMPLETE');
    expect(completion.geographyId).toBe(entry.recipe.intervention.districtId);
    expect(plan[120].metrics.housingUnits-baseline[120].metrics.housingUnits).toBe(entry.recipe.intervention.amount);
    expect(plan[120].metrics.capitalSpending).toBe(entry.recipe.intervention.cost);
    signatures.push([completion.simulationTime,completion.geographyId,completion.payload.units]);
  }
  expect(new Set(signatures.map(JSON.stringify)).size).toBe(3);
  expect(signatures[2][0]).toBeGreaterThan(signatures[0][0]);
  console.log('CURATED_RECIPE_OBSERVATIONS',JSON.stringify(signatures));
},15000);
