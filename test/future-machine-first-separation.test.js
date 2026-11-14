import {test,expect} from 'bun:test';
import {firstSeparation} from '../world/future-machine/diff/first-separation.js';
import {compareHistory} from '../world/future-machine/diff/index.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
const empty=()=>Array.from({length:121},(_,month)=>({month,available:true,entities:[],metrics:{}}));
test('earliest exact entity ordering, nonphysical changes, metric-only changes, and immutable input',()=>{
 const diffs=empty();diffs[16].entities=[{collection:'buildings',id:'b'}];
 diffs[1].entities=[{collection:'projects',id:'z'},{collection:'policies',id:'a'}];
 const original=structuredClone(diffs);
 expect(firstSeparation([...diffs].reverse())).toEqual({status:'found',month:1,entity:{collection:'policies',id:'a'},metric:null});
 expect(diffs).toEqual(original);
 diffs[1].entities=[];diffs[3].metrics={rent:{baseline:0,plan:2,delta:2}};
 expect(firstSeparation(diffs)).toEqual({status:'found',month:3,entity:null,metric:'rent'});
 diffs[3].metrics.rent={baseline:null,plan:2,delta:null};
 expect(firstSeparation(diffs).month).toBe(16);
});
test('complete zero, empty, missing prefix, duplicate and boundary observations stay distinct',()=>{
 expect(firstSeparation(empty())).toEqual({status:'none'});
 expect(firstSeparation()).toEqual({status:'unavailable',month:0});
 const diffs=empty();diffs[120].entities=[{collection:'buildings',id:'terminal'}];
 expect(firstSeparation(diffs).month).toBe(120);
 diffs[4].available=false;expect(firstSeparation(diffs)).toEqual({status:'unavailable',month:4});
 expect(firstSeparation([empty()[0],...empty()])).toEqual({status:'unavailable',month:0});
});
test('actual matched seed histories preserve exact records and identify policy before construction',()=>{
 const initial=initialForRecipe();
 function replay(intervention){let state=intervention?addIntervention(initial,intervention):structuredClone(initial);const steps=[],engine=createEngine();for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}
 const baseline=replay(null),plan=replay(DEFAULT_RECIPE.intervention);
 const history={seed:DEFAULT_RECIPE.seed,modelVersion:DEFAULT_RECIPE.modelVersion,baseline,plan};
 const before=JSON.stringify(history),result=firstSeparation(compareHistory(history));
 expect(result.status).toBe('found');expect(result.month).toBe(1);
 expect(result.entity).not.toBeNull();expect(JSON.stringify(history)).toBe(before);
 expect(firstSeparation(compareHistory({...history,plan:structuredClone(baseline)}))).toEqual({status:'none'});
});
