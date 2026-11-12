import {test,expect} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCity} from '../world/city/seed.js';
import {normalizeRealityRequest,simulateRealityPair,replayRealityFuture} from '../world/reality/runtime-core.js';
import {createRealityShareHandler} from '../world/reality/share-api.js';
import {SHARE_TTL_MS} from '../world/reality/share-store.js';

for(const seed of [0,4294967295])test(`persisted selected future reopens and scrubs exactly at seed ${seed}`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scenario-replay-')),dbPath=join(dir,'shares.sqlite');
 const initial=createCity({seed,households:3});
 const manifest=normalizeRealityRequest({initial,program:{engine:'city',parameterPatch:{permits:6}},runs:2,months:3,seed,parameterUncertainty:[]});
 const run=await simulateRealityPair(manifest,1);
 let now=new Date('2026-01-01T00:00:00Z');
 let handler=createRealityShareHandler({dbPath,now:()=>now,idFactory:()=> 'AuditShare01'});
 const get=id=>handler(new Request('http://local/api/reality-shares/'+id));
 try{
  const response=await handler(new Request('http://local/api/reality-shares',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest,run,displayInitial:initial})}));
  expect(response.status).toBe(201);const saved=await response.json();
  handler.close();handler=createRealityShareHandler({dbPath,now:()=>now});
  const reopened=await(await get(saved.id)).json();expect(reopened).toEqual(saved);
  expect(reopened.result.manifest).toEqual(manifest);expect(reopened.displayInitial).toEqual(initial);
  const terminal=await replayRealityFuture(reopened.result,{runId:reopened.runId});
  expect(terminal.baseline.metrics).toEqual(run.baseline.metrics);
  expect(terminal.treatment.metrics).toEqual(run.treatment.metrics);
  for(const month of [0,1,3,0,3]){
   const replay=await replayRealityFuture(reopened.result,{runId:reopened.runId,month});
   const source=await simulateRealityPair(manifest,1,{retain:true,through:month});
   expect(replay.baseline).toEqual(source.baseline);expect(replay.treatment).toEqual(source.treatment);
   expect(replay.baseline.state.month).toBe(month);expect(replay.treatment.state.month).toBe(month);
   expect(replay.seed).toBe(run.seed);expect(replay.assumptions).toEqual(run.assumptions);
  }
  expect(await(await get(saved.id)).json()).toEqual(saved);
  const missing=await get('Missing00001');expect(missing.status).toBe(404);
  expect((await missing.json()).error).toBe('Share not found or expired.');

  // A retained historical model version must fail before producing a state.
  const obsolete=structuredClone(saved);obsolete.result.manifest.modelVersion='unsupported-audit-version';
  const db=new Database(dbPath);
  try{db.query('UPDATE reality_shares SET data=? WHERE id=?').run(JSON.stringify(obsolete),saved.id);}finally{db.close();}
  const incompatible=await(await get(saved.id)).json();
  await expect(replayRealityFuture(incompatible.result,{runId:incompatible.runId})).rejects.toThrow('Stored model version is unavailable');
  const tampered=structuredClone(saved);tampered.result.runs[0].baseline.metrics.population+=1;
  await expect(replayRealityFuture(tampered.result,{runId:tampered.runId})).rejects.toThrow('did not reproduce');

  now=new Date(Date.parse(saved.createdAt)+SHARE_TTL_MS-1);expect((await get(saved.id)).status).toBe(200);
  now=new Date(now.getTime()+1);const expired=await get(saved.id);expect(expired.status).toBe(404);
  expect((await expired.json()).error).toBe('Share not found or expired.');
 }finally{handler.close();rmSync(dir,{recursive:true,force:true});}
});
