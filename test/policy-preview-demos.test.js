import {test,expect} from 'bun:test';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {civicHandoff} from '../world/policy-preview-demos/handoff.js';
import {createPolicyPreviewHandler} from '../world/policy-preview-api.js';
import {catalog,fixture,recordAll,recordDemo} from '../world/policy-preview-demos/record.js';
import {policyHash,validatePolicyPreview,previewParameterDiff} from '../world/policy-preview-contract.js';
import {simulateConstitutionCity} from '../world/constitution-city/runtime-core.js';
const hashes={"housing": "bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e", "drainage": "745768b9ba8fa6d892db30c958344c54f927d83471f1ca4656336c6278f1f8da", "transit": "f04dc7ec9e5ea2be5f2f8391baf5026f16b552b089997021d97f8734379cec31", "unsupported": "471afdc534ca4a01964578eed17e4c4239f9a7a1a226f145b63b3fea3cd111ef"};
test('immutable exact fixtures, canonical content and supported vs unsupported legal mappings',()=>{
 const handoff=JSON.parse(readFileSync(new URL('../world/policy-preview-demos/civic-handoff.json',import.meta.url),'utf8'));
 for(const d of handoff.demos){expect(d.input).toEqual(fixture(d.id));expect(d.legalHash).toBe(hashes[d.id]);}
 const original=JSON.parse(readFileSync(new URL('../world/policy-preview-demo.json',import.meta.url),'utf8'));
 expect(fixture('housing')).toEqual(original);
 for(const {id,mappingId} of catalog.demos){const input=fixture(id);expect(validatePolicyPreview(input)).toEqual(input);expect(input.source.contentHash).toBe(policyHash(input.legal));if(hashes[id])expect(input.source.contentHash).toBe(hashes[id]);expect(input.simulation).toEqual({seed:42,runs:100,months:24});expect(input.legal.clauses[0].sourcePolicyId).toBe(mappingId);expect(input.legal.clauses[0].beforeText).toBe('');expect(previewParameterDiff(input)[0].supportStatus).toBe(id==='unsupported'?'unavailable':'supported');}
});
test('all recorded demos: 100 pairs, exact distributions/checkpoints, restart, baseline parity and deterministic replay',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'SHE1043-test-store-')),output=mkdtempSync(join(tmpdir(),'SHE1043-test-receipt-'));
 try{
  const receipt=await recordAll({directory,output});
  const golden=JSON.parse(readFileSync(new URL('../world/policy-preview-demos/civic-handoff.json',import.meta.url),'utf8'));
  const handoff=civicHandoff(receipt);expect(handoff.demos).toHaveLength(4);
  for(const demo of receipt.demos){
   expect(demo.resultsHash).toBe(golden.demos.find(d=>d.id===demo.fixtureId).resultsHash);
   expect(demo.job).toEqual({status:'completed',completed:100,failed:0,total:100,error:null});
   const record=JSON.parse(readFileSync(join(directory,`${demo.previewId}.json`),'utf8'));
   expect(demo.modelVersion).toBe('city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0');
   expect(record.input).toEqual(fixture(demo.fixtureId));expect(demo.pairs).toHaveLength(100);
   expect(demo.pairs.map(p=>p.seed)).toEqual(receipt.demos[0].pairs.map(p=>p.seed));
   expect(demo.initialHash).toBe(receipt.demos[0].initialHash);
   for(const summary of demo.summaries){
    expect(summary.checkpointMonths).toEqual([0,12,24]);expect(summary.pairs).toHaveLength(100);
    for(const d of summary.distributions){
     const values=record.runs.map(p=>p.proposal.metricsTimeline[summary.month].metrics[d.metricId]-p.baseline.metricsTimeline[summary.month].metrics[d.metricId]);
     expect(d.delta.count).toBe(100);expect(d.delta.missing).toBe(0);expect(d.delta.min).toBe(Math.min(...values));expect(d.delta.max).toBe(Math.max(...values));expect(d.delta.mean).toBe(values.reduce((a,b)=>a+b,0)/100);
    }
   }
   // Replay every retained checkpoint for first and last pair, independently of handler persistence.
   for(const pair of [record.runs[0],record.runs[99]])for(const scenario of record.runtimeManifest.scenarios)for(const checkpoint of pair[scenario.id].checkpoints){
    const replay=await simulateConstitutionCity(record.runtimeManifest,scenario,pair.seed,{throughMonth:checkpoint.month,retainState:true});expect(policyHash(replay.state)).toBe(policyHash(checkpoint.state));
   }
   if(demo.fixtureId==='unsupported'){
    expect(demo.supportStatus).toBe('unavailable');for(const p of record.runs)expect(p.baseline.metricsTimeline).toEqual(p.proposal.metricsTimeline);
   }
  }
 }finally{rmSync(directory,{recursive:true,force:true});rmSync(output,{recursive:true,force:true});}
},300000);

test('demo recording preserves actual all-failed state and never manufactures samples',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'SHE1043-failure-'));
 try{
  const handler=createPolicyPreviewHandler({directory,token:'local-test',canonicalOrigin:'http://localhost:3000',simulate:async()=>{throw new Error('Injected demonstration failure');}});
  const receipt=await recordDemo({id:'drainage',handler,token:'local-test'});
  expect(receipt.job.status).toBe('failed');expect(receipt.job.completed).toBe(0);expect(receipt.job.failed).toBe(100);
  expect(receipt.pairs.every(p=>p.status==='failed'&&!p.checkpoints&&!p.outputHash)).toBe(true);
  for(const s of receipt.summaries)for(const d of s.distributions){expect(d.delta.count).toBe(0);expect(d.delta.missing).toBe(100);expect(d.delta.mean).toBeNull();}
 }finally{rmSync(directory,{recursive:true,force:true});}
});
