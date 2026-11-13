import {test,expect} from 'bun:test';
import {attributeOutcomes,runLedger,ABLATIONS} from '../world/future-machine/butterfly-ledger.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe} from '../world/future-machine/data/index.js';
import {createEngine,addIntervention,cityMetrics} from '../world/city/engine.js';
import {stateHash} from '../world/future-machine/data/core.js';

test('integer ledger reconciles signed, zero and dominating residuals; missing is unavailable',()=>{
 const a=attributeOutcomes(1000,259.231,{amount:600,cost:259.231,delay:260,compliance:600});
 expect(a.rows.reduce((s,r)=>s+r.contribution,0)+a.residual).toBe(a.observed);
 expect(a.observed).toBe(-740769);expect(a.rows[0].input).toBe('amount');
 expect(attributeOutcomes(0,0,{amount:0,cost:0,delay:0,compliance:0}).residual).toBe(0);
 expect(attributeOutcomes(100,0,{amount:0,cost:0,delay:0,compliance:0}).residualDominates).toBe(true);
 expect(()=>attributeOutcomes(0,1,{})).toThrow('unavailable');
});
function terminal(initial,policy){let state=policy?addIntervention(initial,policy):structuredClone(initial);const engine=createEngine();for(let i=0;i<120;i++)state=engine.step(state).state;return {month:120,metrics:cityMetrics(state)};}
test('real default seed matched ablations retain provenance and reconcile deterministically',async()=>{
 const initial=initialForRecipe(),initialHash=await stateHash(initial),baseline=terminal(initial,null);
 const history={recipe:DEFAULT_RECIPE,seed:42,modelVersion:DEFAULT_RECIPE.modelVersion,initialHash,experimentId:'city_full',baseline:[],plan:[]};
 history.baseline[120]=baseline;history.plan[120]=terminal(initial,DEFAULT_RECIPE.intervention);
 const calls=[];
 const run=async recipe=>{calls.push(recipe);const plan=[];plan[120]=terminal(initial,recipe.intervention);return {...history,recipe,plan,experimentId:`city_arm${calls.length}`};};
 const ledger=await runLedger(history,{run,baseURL:'http://localhost/world/future-machine.html'});
 expect(calls).toHaveLength(4);
 calls.forEach((recipe,i)=>{const input=Object.keys(ABLATIONS)[i];expect(recipe).toEqual({...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,[input]:ABLATIONS[input]}});});
 expect(ledger.observed).toBe(-740769);
 expect(ledger.rows.reduce((s,r)=>s+r.contribution,0)+ledger.residual).toBe(ledger.observed);
 expect(await stateHash(initial)).toBe(initialHash);
 for(const receipt of Object.values(ledger.receipts)){expect(receipt.recipeHash).toMatch(/^[a-f0-9]{64}$/);expect(receipt.seed).toBe(42);expect(receipt.replayURL).toContain('month=120');}
 console.log('Real City ledger',JSON.stringify({rows:ledger.rows,residual:ledger.residual,dominates:ledger.residualDominates}));
 await expect(runLedger({...history,recipe:{...DEFAULT_RECIPE,seed:43}},{run})).rejects.toThrow('default recipe');
 await expect(runLedger(history,{run:async recipe=>({...history,recipe,initialHash:'wrong'}),baseURL:'http://localhost'})).rejects.toThrow('identity mismatch');
 const controller=new AbortController();controller.abort();await expect(runLedger(history,{signal:controller.signal,run})).rejects.toThrow();
},30000);

test('existing City API persists all four ablation receipts and replays the selected arm',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {CityStore}=await import('../world/city/storage.js');const {createCityApi}=await import('../world/city/api.js');
 const {createExperiment,loadExperiment}=await import('../world/future-machine/data/index.js');
 const root=mkdtempSync(join(tmpdir(),'butterfly-ledger-')),store=new CityStore(root),handle=createCityApi({store}),originalFetch=globalThis.fetch;
 globalThis.fetch=(path,options)=>handle(new Request(`http://localhost${path}`,options));
 try {
   const history=await createExperiment();const ledger=await runLedger(history,{baseURL:'http://localhost/world/future-machine.html'});
   expect(ledger.observed).toBe(-740769);expect(ledger.residual).toBe(-389241);
   for(const [input,receipt] of Object.entries(ledger.receipts)) {
     const record=await (await handle(new Request(`http://localhost/api/city-experiments/${receipt.experimentId}`))).json();
     expect(record.status).toBe('complete');expect(record.manifest.scenarios[1].interventions[0][input]).toBe(ABLATIONS[input]);
     expect(receipt.recipeHash).toBe(await stateHash({...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,[input]:ABLATIONS[input]}}));
   }
   const reopened=await loadExperiment(ledger.receipts.amount.experimentId);
   expect(reopened.recipe.intervention.amount).toBe(12);
   expect(Math.round((history.plan[120].metrics.meanRent-reopened.plan[120].metrics.meanRent)*1000)).toBe(ledger.rows.find(row=>row.input==='amount').contribution);
 } finally {globalThis.fetch=originalFetch;store.close();rmSync(root,{recursive:true,force:true});}
},30000);
