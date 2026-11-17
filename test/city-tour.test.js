import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {anchorRecord,validateRecipe,resolveStep,moveStep,tourURL,readTour,TOUR_VERSION} from '../world/city-tour/core.js';
const save={schemaVersion:'world-experiment-save.v1',checkpoint:{schemaVersion:'legacy-checkpoint.v1',modelVersion:'neighborhood-activity.v2'},view:{camera:{position:[1,40,3],target:[0,0,0]}},geometry:{area:{source:'synthetic'}}};
const record={schemaVersion:'world-experiment-record.v1',id:'TourSave001',checksum:'sha256:'+createHash('sha256').update(JSON.stringify(save)).digest('hex'),save};
const step=await anchorRecord(record,'User interpretation <script>alert(1)</script>');
const recipe={version:TOUR_VERSION,title:'My tour',steps:[step,step,step]};
test('bounded inert recipes detach immutable anchors and round-trip native guest route',()=>{
 const clean=validateRecipe({...recipe,script:'alert(1)'});expect(clean.script).toBeUndefined();clean.steps[0].pose.position[0]=99;expect(step.pose.position[0]).toBe(1);
 const url=tourURL(recipe,2);expect(url.startsWith('/world?experiment=TourSave001#')).toBe(true);expect(readTour(url.slice(url.indexOf('#')))).toEqual({recipe,index:2});expect(readTour('#other')).toBeNull();
 for(const n of [0,2,9])expect(()=>validateRecipe({...recipe,steps:Array(n).fill(step)})).toThrow();
 for(const patch of [{id:'javascript:alert(1)'},{checksum:'fake'},{pose:{position:[Infinity,0,0],target:[0,0,0]}},{description:'a'.repeat(501)}])expect(()=>validateRecipe({...recipe,steps:[{...step,...patch},step,step]})).toThrow();
 expect(()=>readTour('#city-tour='+encodeURIComponent(JSON.stringify({recipe,index:99})))).toThrow();expect(()=>readTour('#city-tour='+'a'.repeat(60000))).toThrow();
});
test('reorder and reverse preserve all pinned inputs without changing source recipe',()=>{
 const input=[{...step,description:'A'},{...step,description:'B'},{...step,description:'C'}],before=JSON.stringify(input);
 expect(moveStep(input,0,2).map(s=>s.description)).toEqual(['B','C','A']);expect(JSON.stringify(input)).toBe(before);expect(moveStep(input,-1,2)).toEqual(input);
 expect(validateRecipe({...recipe,steps:input.slice().reverse()}).steps.map(s=>s.description)).toEqual(['C','B','A']);
});
test('guest validates hash, source, pose and identity; denial and missing never fall back',async()=>{
 const fetchRecord=async()=>Response.json(record);expect(await resolveStep(step,fetchRecord)).toEqual(record);
 for(const status of [401,403,404,500])await expect(resolveStep(step,async()=>new Response('',{status}))).rejects.toThrow(/denied|missing|unavailable/);
 await expect(resolveStep({...step,id:'OtherSave01'},fetchRecord)).rejects.toThrow('changed');
 await expect(resolveStep({...step,pose:{position:[99,40,3],target:[0,0,0]}},fetchRecord)).rejects.toThrow('changed');
 await expect(anchorRecord({...record,save:{...save,label:'mutated'}})).rejects.toThrow('integrity');
 await expect(resolveStep({...step,source:'real observed results'},fetchRecord)).rejects.toThrow('changed');
});
