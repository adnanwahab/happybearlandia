import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
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

test('historical City 1.0 replay evidence retains its original bytes and model version',async()=>{
 const hashes={
  'zero-control':'62ff7595c9902f1d8ba8dc12cfe442a403aa80bf4a56405a48baf85f52e68148',
  'housing-42':'64fe4eecb06d144bc0ab81278b6ac7ae6478914483a8a9d2efc6a2e69340c0b9',
  'delayed-max-seed':'65c3eb850deb546709663de147d7e00051b90b5f3db6f73340de3dcd2a7cd634',
 };
 for(const [name,hash] of Object.entries(hashes)){
  const bytes=Buffer.from(await Bun.file(`test/fixtures/city-replay/historical/city-systems.1.0.0/${name}.json`).arrayBuffer());
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
  expect(JSON.parse(bytes).recipe.modelVersion).toBe('city-systems.1.0.0');
 }
});

test('version guard reads the complete committed fixture through its real CLI',()=>{
 const result=Bun.spawnSync([process.execPath,'scripts/check-city-replay.mjs','zero-control','--guard','HEAD'],{stdout:'pipe',stderr:'pipe'});
 expect(result.exitCode).toBe(0);
});
