import { test, expect } from 'bun:test';
import { predictionKey, resolvePrediction, scoreDirection } from '../world/decision/prediction.js';
const input = {modelId:'housing.v1',modelVersion:'1.2.0',seed:42,runs:1,years:10,scenarios:[{id:'b',kind:'baseline'},{id:'p',kind:'plan-a'}]};
const prediction = Object.freeze({key:predictionKey(input),scenarioId:'p',direction:'tie'});
const data = {experiment:{...input,id:'e',status:'completed'},runs:[{id:'b1',scenarioId:'b',seed:42,status:'completed',metrics:{housing_supply:10}},{id:'p1',scenarioId:'p',seed:42,status:'completed',metrics:{housing_supply:10}}]};
test('directions, exact ties, unknowns and nulls',()=>{
 for (const [direction,a,b,matched] of [['up',1,2,true],['down',2,1,true],['tie',1,1,true],['up',1,1,false],['unknown',1,2,null],['tie',null,0,null],['up',0,NaN,null]]) expect(scoreDirection(direction,a,b).matched).toBe(matched);
});
test('exact input and complete seed-matched observations required; records unchanged',()=>{
 const before=JSON.stringify({prediction,data});
 expect(resolvePrediction(prediction,data).matched).toBe(true);
 for(const field of ['seed','years','runs','modelVersion']) expect(resolvePrediction(prediction,{...data,experiment:{...data.experiment,[field]:'changed'}})).toBeNull();
 expect(resolvePrediction(prediction,{...data,runs:[]} ).matched).toBeNull();
 expect(resolvePrediction(prediction,{...data,runs:[data.runs[0],{...data.runs[1],seed:99}]}).matched).toBeNull();
 expect(JSON.stringify({prediction,data})).toBe(before);
});
test('2000-row comparison benchmark',()=>{
 const large={experiment:{...data.experiment,runs:1000},runs:Array.from({length:1000},(_,seed)=>data.runs.map(r=>({...r,seed}))).flat()};
 const p={...prediction,key:predictionKey(large.experiment)};
 const start=performance.now();for(let i=0;i<100;i++)resolvePrediction(p,large);
 console.log(`Prediction comparison: 100 × 2000 rows ${(performance.now()-start).toFixed(2)}ms`);
 expect(resolvePrediction(p,large).matched).toBe(true);
});
