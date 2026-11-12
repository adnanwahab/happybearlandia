import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeExperiment,createCityApi} from '../world/city/api.js';
import {CityStore} from '../world/city/storage.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createExperiment,loadExperiment,initialForRecipe} from '../world/future-machine/data/index.js';
import {stateHash} from '../world/future-machine/data/core.js';
const id='city_manifest_validation';
function fixture(){return normalizeExperiment({title:'City pair',initial:initialForRecipe(),runs:1,months:120,retention:'summary',scenarios:[{id:'baseline',interventions:[]},{id:'plan',interventions:[structuredClone(DEFAULT_RECIPE.intervention)]}]});}
async function withManifest(manifest,run){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(path,options)=>{
  calls.push(path);
  if(path.endsWith('/replay')){
   const plan=JSON.parse(options.body).scenarioId==='plan';
   const policy=plan?manifest.scenarios[1].interventions[0]:null;
   return Response.json(createEngine().run(policy?addIntervention(manifest.initial,policy):manifest.initial,120));
  }
  return Response.json({id,status:'complete',manifest});
 };
 try{return await run(calls);}finally{globalThis.fetch=original;}
}

test('malformed pair shape yields actionable validation errors before replay',async()=>{
 const cases=[
  ['missing scenarios',m=>delete m.scenarios],['null scenario',m=>m.scenarios[0]=null],
  ['non-object scenario',m=>m.scenarios[1]='plan'],['swapped IDs',m=>m.scenarios.reverse()],
  ['duplicate IDs',m=>m.scenarios[1].id='baseline'],['unsupported ID',m=>m.scenarios[1].id='unknown'],
  ['missing baseline interventions',m=>delete m.scenarios[0].interventions],
  ['fake baseline array',m=>m.scenarios[0].interventions={length:0}],
  ['missing plan interventions',m=>delete m.scenarios[1].interventions],
  ['multiple plan policies',m=>m.scenarios[1].interventions.push(m.scenarios[1].interventions[0])],
  ['null plan policy',m=>m.scenarios[1].interventions=[null]],['primitive plan policy',m=>m.scenarios[1].interventions=[false]],
 ];
 for(const [name,change] of cases){const manifest=fixture();change(manifest);await withManifest(manifest,async calls=>{
  let failure;try{await loadExperiment(id);}catch(error){failure=error;}
  expect(failure, name).toBeInstanceOf(Error);expect(failure,name).not.toBeInstanceOf(TypeError);expect(failure.message,name).toMatch(/scenario|pair|intervention/i);expect(calls).toEqual([`/api/city-experiments/${id}`]);
 });}
});
test('optional existing title is bounded text; malformed metadata is never echoed',async()=>{
 for(const title of [null,12,{},'', '   ','x'.repeat(201),'private-value\nforged event','private-value\u0000','private-value\u202e']){
  const manifest=fixture();manifest.title=title;
  await withManifest(manifest,async calls=>{
   let failure;try{await loadExperiment(id);}catch(error){failure=error;}
   expect(failure).toBeInstanceOf(Error);expect(failure.message).toMatch(/title/);expect(failure.message).not.toContain('private-value');expect(calls).toHaveLength(1);
  });
 }
});
test('unsupported versions, missing initial data and changed generator fail before replay',async()=>{
 const cases=[m=>m.version='unsupported',m=>m.months=119,m=>m.runs=2,m=>delete m.initial,m=>delete m.initial.buildings,m=>m.initial.seed=-1,m=>m.initial.seed=4294967296,m=>m.modelManifest[0].version='unsupported',m=>m.initial.parameters.annualGrowth=.01];
 for(const change of cases){const manifest=fixture();change(manifest);await withManifest(manifest,async calls=>{await expect(loadExperiment(id)).rejects.toThrow();expect(calls).toHaveLength(1);});}
});
test('valid API-shaped manifest and missing legacy title preserve exact common initial and replay',async()=>{
 for(const title of [undefined,'City pair · نموذج 🐻','<text> & comparison', 'x'.repeat(200)]){
  const manifest=fixture();if(title===undefined)delete manifest.title;else manifest.title=title;
  const before=await stateHash(manifest);
  await withManifest(manifest,async calls=>{
   const history=await loadExperiment(id);
   expect(calls).toHaveLength(3);expect(history.recipe).toEqual(DEFAULT_RECIPE);expect(history.experimentId).toBe(id);expect(history.seed).toBe(42);
   expect(history.baseline[0]).toEqual(history.plan[0]);expect(history.baseline).toHaveLength(121);expect(history.plan).toHaveLength(121);
   expect(history.plan[16].metrics.housingUnits-history.baseline[16].metrics.housingUnits).toBe(24);expect(history.initialHash).toBe(await stateHash(manifest.initial));expect(await stateHash(manifest)).toBe(before);
  });
 }
});
test('real isolated City API creates and reopens its existing display title unchanged',async()=>{
 const root=mkdtempSync(join(tmpdir(),'fm-manifest-')),store=new CityStore(root),handle=createCityApi({store}),original=globalThis.fetch;
 globalThis.fetch=(path,options)=>handle(new Request(`http://localhost${path}`,options));
 try{
  const history=await createExperiment(),reopened=await loadExperiment(history.experimentId);
  expect(reopened).toEqual(history);const response=await globalThis.fetch(`/api/city-experiments/${history.experimentId}`);const record=await response.json();
  expect(record.manifest.title).toBe('Future Machine — synthetic housing pair');expect(record.manifest.scenarios.map(row=>row.id)).toEqual(['baseline','plan']);expect(record.manifest.initial.seed).toBe(42);
 }finally{globalThis.fetch=original;store.close();rmSync(root,{recursive:true,force:true});}
},15000);


test('missing or non-object saved responses fail without raw runtime exceptions',async()=>{
 const original=globalThis.fetch;
 try{for(const record of [null,[],42,'untrusted-payload']){
  globalThis.fetch=async()=>Response.json(record);
  let failure;try{await loadExperiment(id);}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(Error);expect(failure).not.toBeInstanceOf(TypeError);expect(failure.message).toContain('response');expect(failure.message).not.toContain('untrusted-payload');
 }}finally{globalThis.fetch=original;}
});


test('supported empty plan remains a deterministic zero-control manifest',async()=>{
 const manifest=fixture();manifest.scenarios[1].interventions=[];
 await withManifest(manifest,async calls=>{
  const history=await loadExperiment(id);expect(calls).toHaveLength(3);expect(history.recipe.intervention).toBeNull();expect(history.baseline).toEqual(history.plan);
 });
});
