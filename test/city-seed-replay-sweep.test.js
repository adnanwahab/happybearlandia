import {test,expect} from 'bun:test';
import {SEEDS,BOUNDARIES,checkSeeds,checkStep,pairDigest,compareDigests,sweep} from '../scripts/verify-city-seed-replay.mjs';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe} from '../world/future-machine/data/index.js';
import {createEngine} from '../world/city/engine.js';

test('explicit sweep covers 100 seeds and uint32/sign boundaries',()=>{
 expect(SEEDS.length).toBe(104);expect(checkSeeds(SEEDS)).toBe(SEEDS);
 for(const seed of [0,42,99,2147483647,2147483648,4294967294,4294967295])expect(SEEDS).toContain(seed);
 for(const seeds of [[],null,[0,0],[-1],[4294967296],[NaN],[Infinity],[1.5],['42']])expect(()=>checkSeeds(seeds)).toThrow();
});
test('report retains mismatching digests and continues after failures',async()=>{
 let n=0;
 const report=await sweep({seeds:[0,1,2],boundaries:[],runPair:async recipe=>{
   n++;if(recipe.seed===1)throw new Error('injected engine failure');
   return {digest:recipe.seed===0?n:42};
 }});
 expect(report.caseCount).toBe(3);expect(report.passed).toBe(1);
 expect(report.mismatches).toHaveLength(2);expect(report.results).toHaveLength(2);
 expect(report.results[0].actual).not.toEqual(report.results[0].replay);
 expect(report.mismatches[1].message).toBe('injected engine failure');
 expect(()=>compareDigests({baseline:'a'},{baseline:'b'})).toThrow('Independent replay mismatch');
});
test('malformed boundary recipe is a reported failure',async()=>{
 const report=await sweep({seeds:[0],boundaries:[{seed:-1}],runPair:async()=>({digest:'same'})});
 expect(report.passed).toBe(1);expect(report.mismatches[0].index).toBe(1);
});
test('step audit detects identity, time, model, observation and provenance corruption',()=>{
 const initial=initialForRecipe(),engine=createEngine(),step=engine.step(initial);
 checkStep(step,initial,1,engine.manifest);
 for(const mutate of [s=>s.state.seed++,s=>s.state.month++,s=>s.state.version='old',s=>s.state.provenance.datasetVersion='old',s=>s.state.units.push(s.state.units[0]),s=>s.observations=[],s=>s.observations[0].simulationTime++,s=>s.observations[0].modelVersion='old']){
  const bad=structuredClone(step);mutate(bad);expect(()=>checkStep(bad,initial,1,engine.manifest)).toThrow();
 }
 const withEvent=structuredClone(step);withEvent.events=[{id:'bad',simulationTime:2,system:'invented',modelVersion:'old'}];
 expect(()=>checkStep(withEvent,initial,1,engine.manifest)).toThrow();
});
test('real independent pairs replay exactly including null and hard recipe boundaries',async()=>{
 for(const changes of [{seed:42},...BOUNDARIES]){
  const recipe={...DEFAULT_RECIPE,...changes};
  const actual=await pairDigest(recipe),replay=await pairDigest(recipe);
  compareDigests(actual,replay);expect(actual.baseline.frames).toBe(121);expect(actual.plan.frames).toBe(121);
  if(recipe.intervention===null)expect(actual.baseline).toEqual(actual.plan);
 }
},60000);
