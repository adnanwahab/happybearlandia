import {test,expect} from 'bun:test';
import {assertHistoryIntegrity,assertFrameIntegrity} from '../world/future-machine/integrity.js';
import {getFrame,loadExperiment,initialForRecipe} from '../world/future-machine/data/index.js';
import {compareHistory} from '../world/future-machine/diff/index.js';
import {normalizeExperiment} from '../world/city/api.js';

function fixture(){
 const history={experimentId:'city_integrity',seed:42,modelVersion:'test'};
 for(const arm of ['baseline','plan'])history[arm]=Array.from({length:121},(_,month)=>({month,state:{month,seed:42,version:'test'},identity:{experimentId:history.experimentId,scenarioId:arm,runIndex:0,runId:`${arm}-0`}}));
 return history;
}
test('corrupt frames and wrong runs fail before comparison or frame selection',()=>{
 const cases=[h=>h.plan.pop(),h=>delete h.plan[20],h=>h.plan[20]=null,h=>h.plan.reverse(),h=>h.plan[20].month=19,h=>h.plan[20].state.month=21,h=>h.plan[20].state.seed=43,h=>h.plan[20].state.version='old',h=>h.plan[20].identity.runId='baseline-0',h=>h.plan[20].identity.experimentId='city_other',h=>h.plan[20].identity.scenarioId='baseline',h=>h.plan[20].identity.runIndex=1,h=>delete h.plan[20].identity,h=>[h.baseline,h.plan]=[h.plan,h.baseline]];
 for(const corrupt of cases){const history=fixture();corrupt(history);for(const check of [assertHistoryIntegrity,h=>getFrame(h,0),compareHistory])expect(()=>check(history)).toThrow();}
 const history=fixture();expect(assertHistoryIntegrity(history)).toBe(history);expect(getFrame(history,120).plan).toBe(history.plan[120]);
});
test('renderer frame guard rejects mismatched identity, clocks and models',()=>{
 const h=fixture();const frame=getFrame(h,20);expect(()=>assertFrameIntegrity(frame,h)).not.toThrow();
 const foreign=structuredClone(frame);for(const arm of ['baseline','plan'])foreign[arm].identity.experimentId='city_other';expect(()=>assertFrameIntegrity(foreign,h)).toThrow('renderer history');
 for(const mutate of [f=>f.plan.identity.experimentId='city_other',f=>f.plan.identity.runId='baseline-0',f=>f.plan.state.seed=9,f=>f.plan.month=21,f=>delete f.plan.identity]){const bad=structuredClone(frame);mutate(bad);expect(()=>assertFrameIntegrity(bad)).toThrow();}
});
test('API adapter rejects wrong replay identity before normalization',async()=>{
 const manifest=normalizeExperiment({initial:initialForRecipe(),runs:1,months:120,scenarios:[{id:'baseline',interventions:[]},{id:'plan',interventions:[]}]});
 const original=globalThis.fetch;
 try{for(const identity of [undefined,{experimentId:'city_other',scenarioId:'baseline',runIndex:0,runId:'baseline-0'},{experimentId:'city_integrity',scenarioId:'plan',runIndex:0,runId:'plan-0'},{experimentId:'city_integrity',scenarioId:'baseline',runIndex:1,runId:'baseline-1'}]){
 globalThis.fetch=async path=>Response.json(path.endsWith('/replay')?{identity,steps:[]}:{id:'city_integrity',status:'complete',manifest});
 await expect(loadExperiment('city_integrity')).rejects.toThrow('Replay run identity mismatch');
 }}finally{globalThis.fetch=original;}
});

test('real persisted pair produces a reproducible integrity receipt',async()=>{
 const {mkdtempSync,rmSync,writeFileSync}=await import('node:fs');
 const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const {CityStore}=await import('../world/city/storage.js');
 const {createCityApi}=await import('../world/city/api.js');
 const {createExperiment}=await import('../world/future-machine/data/index.js');
 const {DEFAULT_RECIPE}=await import('../world/future-machine/contracts.js');
 const {stateHash}=await import('../world/future-machine/data/core.js');
 const root=mkdtempSync(join(tmpdir(),'she86-')),store=new CityStore(root),handle=createCityApi({store}),original=globalThis.fetch;
 globalThis.fetch=(path,options)=>handle(new Request(`http://localhost${path}`,options));
 try{
  const history=await createExperiment(),reopened=await loadExperiment(history.experimentId);
  expect(assertHistoryIntegrity(reopened)).toEqual(history);
  const arms={};
  for(const arm of ['baseline','plan']){
   const snapshots=history[arm];arms[arm]={identity:snapshots[0].identity,frames:snapshots.length,firstMonth:snapshots[0].month,lastMonth:snapshots.at(-1).month,stateDigest:await stateHash(snapshots.map(s=>s.state))};
   expect(await stateHash(reopened[arm])).toBe(await stateHash(snapshots));
  }
  if(process.env.HBL_INTEGRITY_ARTIFACT)writeFileSync(process.env.HBL_INTEGRITY_ARTIFACT,JSON.stringify({schemaVersion:'snapshot-integrity-evidence.v1',source:'isolated SQLite City API; synthetic manifest recomputation',recipe:DEFAULT_RECIPE,initialHash:history.initialHash,modelManifest:history.provenance.modelManifest,arms,reopenedIdentical:true},null,2)+'\n');
 }finally{globalThis.fetch=original;store.close();rmSync(root,{recursive:true,force:true});}
},15000);
