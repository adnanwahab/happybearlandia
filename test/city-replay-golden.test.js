import {test,expect} from 'bun:test';
import {summarize,firstMismatch,checkUpdate,replay} from '../scripts/check-city-replay.mjs';

test('first mismatch reports earliest month and changed, added or removed entity',()=>{
 const expected={frames:[{month:0,hash:'a',entities:{}},{month:1,hash:'b',entities:{'households/h1':'old'}},{month:2,hash:'c',entities:{}}]};
 expect(firstMismatch(expected,structuredClone(expected))).toBeNull();
 for(const entities of [{'households/h1':'new'},{},{'households/h1':'old','units/u1':'added'}]){
  const actual=structuredClone(expected);actual.frames[1]={month:1,hash:'changed',entities};actual.frames[2].hash='also changed';
  expect(firstMismatch(expected,actual)).toMatchObject({month:1,entity:entities['units/u1']?'units/u1':'households/h1'});
 }
 const missing=structuredClone(expected);missing.frames.pop();
 expect(firstMismatch(expected,missing).month).toBe(2);
 const output=structuredClone(expected);output.frames[0].hash='metric change';
 expect(firstMismatch(expected,output).entity).toContain('metrics');
});
test('normalized hashes ignore object key order but detect outputs and entity edits',async()=>{
 const a={month:0,state:{buildings:[{id:'b',value:1}]},metrics:{homes:1}};
 for(const key of ['units','households','workers','businesses','jobs','links','projects','policies','utilities','facilities','parcels'])a.state[key]=[];
 const before=await summarize(a);
 expect(await summarize({metrics:a.metrics,state:a.state,month:0})).toEqual(before);
 const changed=structuredClone(a);changed.state.buildings[0].value++;
 expect(firstMismatch({frames:[before]},{frames:[await summarize(changed)]}).entity).toBe('buildings/b');
});
test('changed fixtures require both model version bump and version documentation',()=>{
 const old={recipe:{modelVersion:'v1'},hash:'a'}, next={recipe:{modelVersion:'v1'},hash:'b'};
 expect(()=>checkUpdate(old,old,'')).not.toThrow();
 expect(()=>checkUpdate(old,next,'v1')).toThrow('model version');
 next.recipe.modelVersion='v2';
 expect(()=>checkUpdate(old,next,'')).toThrow('Document');
 expect(()=>checkUpdate(old,next,'v2: revised rules')).not.toThrow();
 expect(()=>checkUpdate(old,next,'v2: revised rules','v2 already documented')).toThrow('Document');
});
test('real housing fixture reproduces committed normalized baseline',async()=>{
 const actual=await replay('housing-42');
 const expected=await Bun.file('test/fixtures/city-replay/housing-42.json').json();
 expect(firstMismatch(expected,actual)).toBeNull();expect(actual).toEqual(expected);
},30000);
