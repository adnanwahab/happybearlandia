import {test,expect} from 'bun:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPolicyPreviewHandler} from '../world/policy-preview-api.js';
import {simulateConstitutionCity} from '../world/constitution-city/runtime-core.js';
import {deriveSeed} from '../world/world-generator.js';
const fixture=()=>({...JSON.parse(readFileSync(new URL('../world/policy-preview-demo.json',import.meta.url))),simulation:{seed:42,runs:3,months:2}});
const get=(h,id,suffix='')=>h(new Request(`https://hbl.example/api/policy-previews/${id}${suffix}`));
const post=(h,input,suffix='')=>h(new Request(`https://hbl.example/api/policy-previews${suffix}`,{method:'POST',headers:{authorization:'Bearer local-test'},body:JSON.stringify(input)}));
test('summary preserves persisted historical seeds instead of rederiving them with current code',async()=>{
 const {h,directory,config}=setup();try{
 const {id}=await(await post(h,fixture())).json();await settle(h,id);
 const file=join(directory,`${id}.json`),record=JSON.parse(readFileSync(file));
 record.runs[0].seed=0;record.modelVersion='historical-model';writeFileSync(file,JSON.stringify(record));
 const restarted=createPolicyPreviewHandler(config),summary=await(await get(restarted,id,'/summary')).json();
 expect(summary.pairs[0].seed).toBe(0);
 expect(summary.pairs[0].seed).toBe((await(await get(restarted,id,'/results?runIndex=0')).json()).runs[0].seed);
 expect(summary.modelVersion).toBe('historical-model');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
async function settle(h,id){for(let i=0;i<1000;i++){const r=await(await get(h,id)).json();if(!['running','queued'].includes(r.job.status))return r;await Bun.sleep(5);}throw Error('timeout');}
function setup(options={}){const directory=mkdtempSync(join(tmpdir(),'policy-summary-'));const config={directory,token:'local-test',canonicalOrigin:'https://hbl.example',...options};return{directory,config,h:createPolicyPreviewHandler(config)};}
test('summary matches recorded paired values, stable identities, months, units and pages without states',async()=>{
 const {h,directory,config}=setup();try{
 const {id}=await(await post(h,fixture())).json();await settle(h,id);
 const full=await(await get(h,id,'/results')).json(),summary=await(await get(h,id,'/summary?limit=2&month=1')).json();
 expect(summary.recordedMonths).toEqual([0,1,2]);expect(summary.checkpointMonths).toEqual([0,2]);expect(summary.page.nextOffset).toBe(2);expect(summary.pairs).toHaveLength(2);
 for(const def of summary.metricDefinitions){const values=full.runs.map(r=>r.proposal.metricsTimeline[1].metrics[def.id]-r.baseline.metricsTimeline[1].metrics[def.id]);const d=summary.distributions.find(d=>d.metricId===def.id).delta;expect(d.count).toBe(3);expect(d.mean).toBe(values.reduce((a,b)=>a+b,0)/3);expect(def.unit.length).toBeGreaterThan(0);}
 expect(JSON.stringify(summary)).not.toContain('checkpoints"');expect(summary.pairs[0].seed).toBe(full.runs[0].seed);
 const page=await(await get(h,id,'/results?offset=2&limit=1')).json();expect(page.runs).toEqual([full.runs[2]]);expect(page.runIds[0].runId).toBe(`${id}:pair:2`);
 const restarted=createPolicyPreviewHandler(config);expect(await(await get(restarted,id,'/summary?limit=2&month=1')).json()).toEqual(summary);
 // Reads of a full pair use disk, while summaries retain only metric projections.
 const file=join(directory,`${id}.json`),stored=JSON.parse(readFileSync(file));stored.runs[0].baseline.events=[{sentinel:'disk-read'}];writeFileSync(file,JSON.stringify(stored));
 expect((await(await get(restarted,id,'/results?runIndex=0')).json()).runs[0].baseline.events[0].sentinel).toBe('disk-read');
 for(const suffix of ['/summary?limit=0','/summary?limit=101','/summary?month=3','/summary?offset=-1','/summary?limit=01','/summary?month=1&month=1','/summary?extra=1','/results?runIndex=0&limit=1','/results?limit=6','/results?runIndex=00','/results?extra=1','?extra=1'])expect((await get(h,id,suffix)).status).toBe(400);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('interrupted running job resumes missing pairs only; failures exclude distributions, retry preserves successes, mismatch remains readable',async()=>{
 let fail=true,calls=[];const {h,directory,config}=setup({simulate:async(...args)=>{calls.push(args[2]);if(fail&&args[2]===deriveSeed(42,1))throw Error('injected');return simulateConstitutionCity(...args);}});try{
 const input=fixture(),{id}=await(await post(h,input)).json();await settle(h,id);const good=(await(await get(h,id,'/results?runIndex=0')).json()).runs[0];
 const file=join(directory,`${id}.json`),record=JSON.parse(readFileSync(file));record.runs.splice(2);record.job={status:'running',completed:1,failed:1,total:3};writeFileSync(file,JSON.stringify(record));
 calls=[];const restarted=createPolicyPreviewHandler(config);await settle(restarted,id);expect(calls).not.toContain(deriveSeed(42,0));
 const partial=await(await get(restarted,id,'/summary')).json();expect(partial.progress).toEqual({completed:2,failed:1,pending:0,total:3});expect(partial.distributions[0].delta.count).toBe(2);expect(partial.pairs[1].metrics).toBeNull();expect(partial.pairs[1].error).toBe('injected');
 fail=false;await post(restarted,{},`/${id}/retry`);await settle(restarted,id);expect((await(await get(restarted,id,'/results?runIndex=0')).json()).runs[0]).toEqual(good);
 const persisted=JSON.parse(readFileSync(file));persisted.job.status='running';persisted.modelVersion='retired';writeFileSync(file,JSON.stringify(persisted));const mismatch=createPolicyPreviewHandler(config);await settle(mismatch,id);expect((await(await get(mismatch,id,'/summary')).json()).job.status).toBe('unavailable');expect((await post(mismatch,{},`/${id}/retry`)).status).toBe(409);expect((await(await get(mismatch,id,'/results?runIndex=0')).json()).runs[0]).toEqual(good);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('queue admission and concurrency are bounded',async()=>{
 let release;const gate=new Promise(r=>release=r);let active=0,peak=0;
 const {h,directory}=setup({maxRunning:1,maxQueued:1,simulate:async(...args)=>{active++;peak=Math.max(peak,active);await gate;try{return simulateConstitutionCity(...args);}finally{active--;}}});try{
 const a=fixture();a.simulation.runs=1;const first=await(await post(h,a)).json();a.modelRunId='second';const second=await(await post(h,a)).json();a.modelRunId='third';expect((await post(h,a)).status).toBe(429);await Bun.sleep(10);release();await settle(h,first.id);await settle(h,second.id);expect(peak).toBe(1);
 }finally{release();rmSync(directory,{recursive:true,force:true});}
});
test('bounded endpoints enforce UTF-8 byte caps',async()=>{
 const {h,directory,config}=setup();try{const {id}=await(await post(h,fixture())).json();await settle(h,id);const file=join(directory,`${id}.json`),record=JSON.parse(readFileSync(file));record.runs[0].baseline.events=[{text:'x'.repeat(2100000)}];record.uncertainty.description='x'.repeat(520000);writeFileSync(file,JSON.stringify(record));const restarted=createPolicyPreviewHandler(config);expect((await get(restarted,id,'/results?limit=1')).status).toBe(413);expect((await get(restarted,id,'/summary')).status).toBe(413);expect((await get(restarted,id,'/results?runIndex=0')).status).toBe(200);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('process interruption after a successful pair resumes durably without rerunning it',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'policy-process-'));
 try{
 const api=new URL('../world/policy-preview-api.js',import.meta.url).href,runtime=new URL('../world/constitution-city/runtime-core.js',import.meta.url).href;
 const code=`import {createPolicyPreviewHandler} from ${JSON.stringify(api)};import {simulateConstitutionCity} from ${JSON.stringify(runtime)};const h=createPolicyPreviewHandler({directory:${JSON.stringify(directory)},token:'local-test',canonicalOrigin:'https://hbl.example',simulate:async(...args)=>{if(args[2]===${deriveSeed(42,1)})process.exit(77);return simulateConstitutionCity(...args);}});await h(new Request('https://hbl.example/api/policy-previews',{method:'POST',headers:{authorization:'Bearer local-test'},body:${JSON.stringify(JSON.stringify(fixture()))}}));await Bun.sleep(10000);`;
 const child=Bun.spawn([process.execPath,'--no-env-file','--eval',code],{stdout:'pipe',stderr:'pipe'});expect(await child.exited).toBe(77);
 const {readdirSync}=await import('node:fs');const file=join(directory,readdirSync(directory).find(n=>n.endsWith('.json'))),record=JSON.parse(readFileSync(file)),successful=record.runs[0];expect(successful.status).toBe('completed');
 let calls=[];const h=createPolicyPreviewHandler({directory,token:'local-test',canonicalOrigin:'https://hbl.example',simulate:async(...args)=>{calls.push(args[2]);return simulateConstitutionCity(...args);}});
 expect((await settle(h,record.id)).job.status).toBe('completed');expect(calls).not.toContain(successful.seed);expect((await(await get(h,record.id,'/results?runIndex=0')).json()).runs[0]).toEqual(successful);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
