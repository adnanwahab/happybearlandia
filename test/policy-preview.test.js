import {test,expect} from 'bun:test';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPolicyPreviewHandler} from '../world/policy-preview-api.js';
import {validatePolicyPreview,policyHash,previewParameterDiff} from '../world/policy-preview-contract.js';
const fixture=()=>{const value={schemaVersion:'policy-impact-preview.v1',source:{system:'civic-synthesis',proposalId:'housing',versionId:'v2',contentHash:'',type:'bill',title:'Housing',url:'https://example.org/proposals/housing',visibility:'public'},legal:{baseVersionId:'v1',clauses:[{clauseId:'clause-1',sourcePolicyId:'h_lots',operation:'add',beforeText:'',afterText:'Permit housing.'}]},baseline:{kind:'prior-proposal-version',versionId:'v1',label:'Prior version'},simulation:{seed:42,runs:1,months:2}};value.source.contentHash=policyHash(value.legal);return value;};
const setup=(extra={})=>{const directory=mkdtempSync(join(tmpdir(),'hbl-policy-'));return{directory,handler:createPolicyPreviewHandler({directory,token:'secret',canonicalOrigin:'https://hbl.example',...extra})};};
const post=(handler,value=fixture(),suffix='',headers={authorization:'Bearer secret'})=>handler(new Request(`https://hbl.example/api/policy-previews${suffix}`,{method:'POST',headers,body:JSON.stringify(value)}));
async function settle(handler,id){for(let count=0;count<500;count++){const r=await (await handler(new Request(`https://hbl.example/api/policy-previews/${id}`))).json();if(['completed','failed','partial'].includes(r.job.status))return r;await Bun.sleep(10);}throw new Error('Timed out');}
test('strict schema, legal hashes, operation consistency and public privacy boundary',()=>{
 expect(validatePolicyPreview(fixture()).simulation.seed).toBe(42);
 for(const change of [v=>v.source.visibility='private',v=>v.extra='secret',v=>v.source.secret='secret',v=>v.simulation.runs=101,v=>v.legal.clauses[0].beforeText='not empty',v=>v.source.contentHash='fake',v=>v.baseline.versionId='wrong',v=>v.source.url='https://example.org/?token=secret',v=>v.legal.clauses.push({...v.legal.clauses[0],clauseId:'another'})]){const value=fixture();change(value);expect(()=>validatePolicyPreview(value)).toThrow();}
});
test('auth rejects missing token, browser Origin and query credentials',async()=>{
 const {handler}=setup();for(const headers of [{},{authorization:'Bearer wrong'},{authorization:'Bearer secret',origin:'https://evil.example'}])expect((await post(handler,fixture(),'',headers)).status).toBe(401);
 expect((await post(handler,fixture(),'?token=secret')).status).toBe(401);
 const disabled=setup({token:undefined});expect((await post(disabled.handler)).status).toBe(401);
});
test('immediate stable URL, immutable snapshot, persisted results and paired deterministic checkpoints',async()=>{
 const {handler,directory}=setup();const value=fixture(),response=await post(handler,value),created=await response.json();expect(response.status).toBe(202);expect(created.job.status).toBe('queued');expect(created.url).toBe(`https://hbl.example/world/impact?preview=${created.id}`);
 const duplicate=await post(handler,value);expect((await duplicate.json()).id).toBe(created.id);expect(duplicate.status).toBe(200);
 value.source.title='Conflicting metadata';expect((await post(handler,value)).status).toBe(409);
 await settle(handler,created.id);const result=await (await handler(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json();expect(result.runs[0].status).toBe('completed');expect(result.runs[0].baseline.checkpoints.map(row=>row.month)).toEqual([0,2]);
 const a=result.runs[0].baseline,b=result.runs[0].proposal;expect(a.checkpoints[0].state.seed).toBe(b.checkpoints[0].state.seed);expect(a.metricsTimeline.length).toBe(3);
 const restarted=createPolicyPreviewHandler({directory,token:'secret',canonicalOrigin:'https://hbl.example'});expect(await (await restarted(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json()).toEqual(result);
 const independent=setup();const other=await (await post(independent.handler)).json();await settle(independent.handler,other.id);expect((await (await independent.handler(new Request(`https://hbl.example/api/policy-previews/${other.id}/results`))).json()).runs).toEqual(result.runs);
 expect(JSON.parse(readFileSync(join(directory,readdirSync(directory)[0]),'utf8')).input.source.title).toBe('Housing');
});
test('unsupported and arbitrary wording do not invent parameter changes; remove reverses authorization selection',async()=>{
 const value=fixture();value.legal.clauses[0]={...value.legal.clauses[0],operation:'modify',beforeText:'Permit housing.',afterText:'Build a million homes instantly.'};value.source.contentHash=policyHash(value.legal);
 const row=previewParameterDiff(value)[0];expect(row.supportStatus).toBe('unchanged');expect(row.before).toBeNull();const {handler}=setup();const created=await(await post(handler,value)).json();await settle(handler,created.id);const result=await(await handler(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json();expect(result.runs[0].baseline.metricsTimeline).toEqual(result.runs[0].proposal.metricsTimeline);
 value.legal.clauses[0].sourcePolicyId='unknown';expect(previewParameterDiff(value)[0].supportStatus).toBe('unavailable');value.legal.clauses[0]={clauseId:'remove',sourcePolicyId:'h_lots',operation:'remove',beforeText:'Permit housing.',afterText:''};const removal=previewParameterDiff(value)[0];expect(removal.before).toBe(4);expect(removal.after).toBe(0);
});
test('failed runs remain absent, explicit bounded retry retains successful pair and no backfill',async()=>{
 let failed=true;const {simulateConstitutionCity}=await import('../world/constitution-city/runtime-core.js');const {handler}=setup({simulate:async(...args)=>{if(failed&&args[2])throw new Error('Synthetic injected failure');return simulateConstitutionCity(...args);}});
 const created=await(await post(handler)).json();expect((await settle(handler,created.id)).job.status).toBe('failed');let results=await(await handler(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json();expect(results.runs[0].baseline).toBeUndefined();expect(results.runs[0].attempts).toBe(1);failed=false;expect((await post(handler,{},`/${created.id}/retry`)).status).toBe(202);expect((await settle(handler,created.id)).job.status).toBe('completed');results=await(await handler(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json();expect(results.runs[0].attempts).toBe(2);
});
test('version ID rejects changed legal content and explicit new model run gets separate frozen preview',async()=>{
 const {handler}=setup();const created=await(await post(handler)).json();const changed=fixture();changed.legal.clauses[0].afterText='Different';changed.source.contentHash=policyHash(changed.legal);expect((await post(handler,changed)).status).toBe(409);
 const rerun=fixture();rerun.modelRunId='review-2';const second=await(await post(handler,rerun)).json();expect(second.id).not.toBe(created.id);await settle(handler,created.id);await settle(handler,second.id);
});
test('partial status, bounded retries, successful pairs preserved and exhausted failures never filled',async()=>{
 const {simulateConstitutionCity}=await import('../world/constitution-city/runtime-core.js');const {deriveSeed}=await import('../world/world-generator.js');const badSeed=deriveSeed(42,0);
 const {handler}=setup({simulate:async(...args)=>{if(args[2]===badSeed)throw new Error('Injected failure');return simulateConstitutionCity(...args);}});const value=fixture();value.simulation.runs=2;const created=await(await post(handler,value)).json();expect((await settle(handler,created.id)).job.status).toBe('partial');
 const read=async()=>await(await handler(new Request(`https://hbl.example/api/policy-previews/${created.id}/results`))).json();const good=(await read()).runs[1];
 for(let retry=0;retry<3;retry++){await post(handler,{},`/${created.id}/retry`);await settle(handler,created.id);}
 const result=await read();expect(result.runs[0].attempts).toBe(3);expect(result.runs[0].baseline).toBeUndefined();expect(result.runs[1]).toEqual(good);expect(result.job.completed).toBe(1);expect(result.job.failed).toBe(1);
});
test('restart resumes queued preview with exact frozen inputs',async()=>{
 const {writeFileSync}=await import('node:fs');const {handler,directory}=setup();const created=await(await post(handler)).json();await settle(handler,created.id);const file=join(directory,`${created.id}.json`),record=JSON.parse(readFileSync(file,'utf8'));record.runs=[];record.job={status:'queued',completed:0,failed:0,total:1};writeFileSync(file,JSON.stringify(record));
 const restarted=createPolicyPreviewHandler({directory,token:'secret',canonicalOrigin:'https://hbl.example'});expect((await settle(restarted,created.id)).job.status).toBe('completed');const selected=await(await restarted(new Request(`https://hbl.example/api/policy-previews/${created.id}/results?runIndex=0`))).json();expect(selected.runs).toHaveLength(1);expect((await restarted(new Request(`https://hbl.example/api/policy-previews/${created.id}/results?runIndex=9`))).status).toBe(400);
});
