/** Local server-side harness. No listener, browser credential, or alternate simulator. */
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createPolicyPreviewHandler} from '../policy-preview-api.js';
import {policyHash} from '../policy-preview-contract.js';
import {ImpactData} from '../policy-impact-data.js';
import {cityMetrics} from '../city/engine.js';
import {deriveSeed} from '../world-generator.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
export const catalog=read('catalog.json');
export const fixture=id=>read(`${id}.json`);
export async function waitForPreview(handler,id){
 const deadline=Date.now()+240000;
 while(Date.now()<deadline){const m=await(await handler(new Request(`http://localhost/api/policy-previews/${id}`))).json();if(['completed','partial','failed','unavailable'].includes(m.job.status))return m;await Bun.sleep(10);}
 throw new Error(`Timed out waiting for ${id}; retained records may still be running`);
}
export async function recordDemo({id,handler,token}){
 const input=fixture(id),post=()=>handler(new Request('http://localhost/api/policy-previews',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)}));
 const response=await post();if(![200,202].includes(response.status))throw new Error(`Creation failed: ${response.status}`);
 const created=await response.json(),manifest=await waitForPreview(handler,created.id);
 const duplicate=await post();if(duplicate.status!==200||(await duplicate.json()).id!==created.id)throw new Error('Idempotency failed');
 const get=async suffix=>{const response=await handler(new Request(`http://localhost/api/policy-previews/${created.id}${suffix}`));if(!response.ok)throw new Error(`Read failed: ${response.status}`);return response.json();};
 const results=await get('/results'),summaries=await Promise.all(manifest.checkpointMonths.map(month=>get(`/summary?month=${month}&limit=100`)));
 const viewerData=new ImpactData(created.id,{fetcher:path=>handler(new Request(`http://localhost${path}`))});
 const viewerManifest=await viewerData.manifest();
 for(const month of manifest.checkpointMonths){const summary=await viewerData.summary(month,viewerManifest);for(const row of [summary.pairs[0],summary.pairs.at(-1)])if(row.status==='completed')await viewerData.pair(row,viewerManifest);}
 const pairs=results.runs.map(pair=>{
  if(pair.seed!==deriveSeed(input.simulation.seed,pair.runIndex))throw new Error('Pair seed mismatch');
  if(pair.status!=='completed')return {runIndex:pair.runIndex,seed:pair.seed,status:pair.status,error:pair.error};
  const checkpoints={};
  for(const arm of ['baseline','proposal']){
   checkpoints[arm]=pair[arm].checkpoints.map(({month,state})=>{
    if(state.seed!==pair.seed||policyHash(cityMetrics(state))!==policyHash(pair[arm].metricsTimeline[month].metrics))throw new Error('Recorded checkpoint/metrics mismatch');
    return {month,stateHash:policyHash(state),metrics:cityMetrics(state),mechanismState:{parcelCapacity:state.parcels.reduce((sum,p)=>sum+p.capacity,0),districtResilience:state.districts.map(d=>({id:d.id,resilience:d.resilience||0})),transitLinks:state.links.filter(l=>l.mode==='transit').map(l=>({id:l.id,capacity:l.capacity,freeTime:l.freeTime,travelTime:l.travelTime}))}};
   });
  }
  // Authorization records may differ at month zero; entity identity and observed metrics must match.
  if(policyHash(checkpoints.baseline[0].metrics)!==policyHash(checkpoints.proposal[0].metrics))throw new Error('Baseline parity failed');
  for(const key of ['households','workers','units','parcels','buildings','districts']){
   const ids=arm=>pair[arm].checkpoints[0].state[key].map(row=>row.id);
   if(policyHash(ids('baseline'))!==policyHash(ids('proposal')))throw new Error(`Entity identity mismatch: ${key}`);
  }
  return {runIndex:pair.runIndex,seed:pair.seed,status:pair.status,outputHash:policyHash({baseline:pair.baseline,proposal:pair.proposal}),eventHashes:Object.fromEntries(['baseline','proposal'].map(arm=>[arm,policyHash(pair[arm].events)])),checkpoints};
 });
 return {fixtureId:id,previewId:created.id,url:created.url,inputHash:policyHash(input),legalHash:input.source.contentHash,modelVersion:manifest.modelVersion,mappingVersion:manifest.mappingVersion,parameterDiff:manifest.parameterDiff,supportStatus:manifest.supportStatus,job:manifest.job,seed:input.simulation.seed,initialHash:policyHash(manifest.runtimeManifest.initial),runtimeManifestHash:policyHash(manifest.runtimeManifest),resultsHash:policyHash(results.runs),pairs,summaries,uncertainty:manifest.uncertainty};
}
export async function recordAll({directory=mkdtempSync(join(tmpdir(),'SHE-1043-previews-')),origin='http://localhost:3000',output=mkdtempSync(join(tmpdir(),'SHE-1043-receipts-'))}={}){
 const token=randomBytes(32).toString('hex');
 let handler=createPolicyPreviewHandler({directory,token,canonicalOrigin:origin});
 const demos=[];
 for(const {id} of catalog.demos){
  const receipt=await recordDemo({id,handler,token});demos.push(receipt);
  // Terminal records only: one active writer; restart validates persisted outputs.
  handler=createPolicyPreviewHandler({directory,token,canonicalOrigin:origin});
  const restarted=await(await handler(new Request(`http://localhost/api/policy-previews/${receipt.previewId}/results`))).json();
  if(policyHash(restarted.runs)!==receipt.resultsHash)throw new Error('Restart changed recorded results');
  console.log(`${id}: ${receipt.job.status} ${receipt.job.completed}/${receipt.job.total} pairs; ${receipt.resultsHash}`);
 }
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const receipt={schemaVersion:'hbl-demo-local-receipt.v1',testedHead:git('rev-parse','HEAD'),sourceDirty:!!git('status','--porcelain','--','world/policy-preview-demos','test/policy-preview-demos.test.js'),sourceFileHashes:Object.fromEntries(['record.js','catalog.js','index.html','catalog.json',...catalog.demos.map(d=>`${d.id}.json`)].map(file=>[file,createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex')])),directory,origin,demos};
 mkdirSync(output,{recursive:true});const path=join(output,'receipt.json');writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');console.log(`Receipt: ${path}`);return receipt;
}
if(import.meta.main){
 const [directory,output,origin]=process.argv.slice(2);
 if(!directory||!output)throw new Error('Usage: bun --no-env-file world/policy-preview-demos/record.js ABSOLUTE_DISPOSABLE_STORE ABSOLUTE_OUTPUT [http://localhost:3000]');
 if(![directory,output].every(path=>[tmpdir(),'/private/tmp','/tmp'].some(root=>resolve(path).startsWith(root+'/'))))throw new Error('Use disposable paths under the system temporary directory');
 await recordAll({directory,output,origin});
}
