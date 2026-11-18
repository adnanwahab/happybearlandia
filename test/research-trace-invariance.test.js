import {test,expect} from 'bun:test';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe} from '../world/future-machine/data/index.js';
import {freeze,stateHash} from '../world/future-machine/data/core.js';

for(const seed of [0,4294967295])test(`full flagship boundary seed ${seed}: tracing preserves every non-trace result`,async()=>{
 const original=freeze(initialForRecipe({...DEFAULT_RECIPE,seed})),originalHash=await stateHash(original);
 let plain=addIntervention(original,DEFAULT_RECIPE.intervention),traced=structuredClone(plain),traceCount=0;
 const engine=createEngine(),instrumented=createEngine(undefined,{trace:true});
 for(let month=1;month<=120;month++){
  const expected=engine.step(plain),actual=instrumented.step(traced);
  const {causalRecords,...withoutTrace}=actual;
  expect(withoutTrace).toEqual(expected);
  expect(expected.causalRecords).toBeUndefined();
  expect(Array.isArray(causalRecords)).toBe(true);
  traceCount+=causalRecords.length;plain=expected.state;traced=actual.state;
 }
 expect(traceCount).toBeGreaterThan(0);expect(plain.month).toBe(120);
 expect(await stateHash(original)).toBe(originalHash);
 console.log(JSON.stringify({experiment:'flagship-trace-invariance',seed,months:120,traceCount,originalHash}));
},15000);
