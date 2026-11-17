import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMiniSymphonyHandler} from '../ops/mini-symphony/api.js';
const id='11111111-1111-4111-8111-111111111111';
const request=(p='/api/mini-symphony',options)=>new Request('http://localhost:3000'+p,options);
const local={localAddress:'127.0.0.1'};
test('operator API separates observed sessions from legacy counts and serves only curated bounded logs',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'mini-api-'));
 try{
  const dir=path.join(root,'telemetry/sessions',id);await mkdir(dir,{recursive:true});
  await writeFile(path.join(root,'tasks.json'),JSON.stringify([{id:'SHE-1',enabled:true}]));
  await writeFile(path.join(root,'state.json'),JSON.stringify({'SHE-2':{status:'pr_created',prompt:'PRIVATE PROMPT',publishError:'PRIVATE ERROR'}}));
  const event=(seq,elapsedMs,type,phase,message)=>({schemaVersion:1,sessionId:id,seq,at:new Date(1700000000000+elapsedMs).toISOString(),elapsedMs,type,phase,message});
  await writeFile(path.join(dir,'events.jsonl'),[event(0,0,'session_started','working','Start'),event(1,15000,'heartbeat','working','Bearer private-secret github_pat_12345678901234567890'),event(2,30000,'session_stopped','stopped','Stop')].map(JSON.stringify).join('\n'));
  await writeFile(path.join(dir,'session.log'),'RAW PRIVATE TRANSCRIPT');
  const handle=createMiniSymphonyHandler({sources:[{id:'fixture',name:'Fixture',root}],now:()=>1700000030000});
  const response=await handle(request(),local);expect(response.status).toBe(200);const body=await response.json();const serialized=JSON.stringify(body);
  expect(body.projects[0].legacy.prCreated).toBe(1);expect(body.projects[0].sessions[0].metrics.prsCreated).toBe(0);expect(body.projects[0].sessions[0].metrics.codingMs).toBe(30000);
  expect(serialized).not.toContain('PRIVATE PROMPT');expect(serialized).not.toContain('PRIVATE ERROR');expect(serialized).not.toContain('private-secret');
  const log=await handle(request(`/api/mini-symphony/log?project=fixture&session=${id}`),local);expect(log.status).toBe(200);const text=await log.text();expect(text).toContain('session_started');expect(text).not.toContain('RAW PRIVATE TRANSCRIPT');expect(text).not.toContain('private-secret');
  expect((await handle(request('/api/mini-symphony/log?project=fixture&session=../../secret'),local)).status).toBe(400);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('operator data rejects remote/cross-origin/write requests; missing telemetry remains unmeasured',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'mini-missing-'));
 try{const handle=createMiniSymphonyHandler({sources:[{id:'empty',name:'Empty',root}]});expect((await handle(request(),{localAddress:'203.0.113.1'})).status).toBe(403);expect((await handle(request('/api/mini-symphony',{headers:{origin:'https://elsewhere.test'}}),local)).status).toBe(403);expect((await handle(request('/api/mini-symphony',{method:'POST'}),local)).status).toBe(405);const result=await(await handle(request(),local)).json();expect(result.projects[0].sessions).toEqual([]);expect(result.projects[0].legacy.prCreated).toBe(0);}
 finally{await rm(root,{recursive:true,force:true});}
});
