import {test, expect} from 'bun:test';
import {createCustomHouseholdSave} from '../world/house/creator-model.js';
import {readPopulationCheckpoint, createPopulationCheckpoint} from '../world/population/checkpoint.js';
import {savePrivateRemix, readPrivateRemix} from '../world/future-journey/remix.js';
import {readFuture, checkpointLineage} from '../world/future-journey/model.js';

test('private remix pins source, records source credit and never writes shared API', async () => {
 const {save} = await createCustomHouseholdSave({name:'Fixture',startingMoney:1000,relationship:'roommates',members:[{name:'Alex',ageYears:35,voice:'warm',skinColor:'#d1a77c',shirtColor:'#658da6',hairColor:'#534d36',traits:['social','creative','romantic'],interests:['hobbies']}]});
 const source={record:{id:'source0001',schemaVersion:'world-experiment-record.v1',save},state:readPopulationCheckpoint(save.checkpoint)};
 const before=JSON.stringify(source);
 const state=structuredClone(source.state); state.runtime.tick++;state.model.minute+=state.runtime.stepMinutes;
 const result={control:{summary:{person:'fixture-p0'}},changed:{checkpoint:createPopulationCheckpoint(state),summary:{person:'fixture-p0',tick:state.runtime.tick}}};
 const entries=new Map();const storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)};
 const {record}=await savePrivateRemix(source,'fixture-p0',.8,result,{summary:'More rain'},storage);
 expect(JSON.stringify(source)).toBe(before);
 expect(record.save.view.remix.recipe.checkpoint).toEqual(save.checkpoint);
 expect(record.save.view.remix.recipe.checkpointDigest).toHaveLength(64);
 expect(readPrivateRemix(record.id,storage)).toEqual(record);
 expect(record.save.view.remix.credit.id).toBe('source0001');
 await expect(savePrivateRemix(source,'fixture-p0',.8,result,{summary:'Public',visibility:'public'},storage)).rejects.toThrow('access controls');
 await expect(savePrivateRemix(source,'fixture-p0',.8,result,{summary:' '},storage)).rejects.toThrow('Describe');
 expect(()=>readPrivateRemix('remix_missing',storage)).toThrow('unavailable');
 const lineage=await checkpointLineage({record:{...record,parentId:'missing001'},state},async()=>({ok:false,status:404}));
 expect(lineage.notice).toContain('missing');
 await expect(readFuture('source0001',async()=>({ok:true,json:async()=>({...source.record,save:{...save,mode:'legacy'}})}))).rejects.toThrow('different simulation');
});

test('matched replay from the pinned checkpoint and seed is exact', async () => {
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const {compareRainFork,inspectFuture}=await import('../world/future-journey/model.js');
 const runtime=createPopulationRuntime({config:{population:2,seed:584},initialMinute:360,stepMinutes:1});
 try {
  await runtime.ready;
  const checkpoint=await runtime.exportCheckpoint();
  const source={record:{id:'source0584',save:{checkpoint,view:{selection:null}}},state:readPopulationCheckpoint(checkpoint)};
  const person=inspectFuture(source).person;
  const before=JSON.stringify(checkpoint);
  const first=await compareRainFork(source,person,.8);
  const second=await compareRainFork(source,person,.8);
  expect(first).toEqual(second);
  expect(JSON.stringify(checkpoint)).toBe(before);
 } finally {runtime.destroy();}
});
