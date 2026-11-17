import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CityStore} from '../world/city/storage.js';
import {normalizeExperiment,createCityApi} from '../world/city/api.js';
import {migrateCitySave,compareSavedOutcome} from '../world/city/save-format.js';

test('legacy v0 migration preserves every field, discloses its effects and is idempotent',()=>{
 const old=normalizeExperiment({runs:1,months:1});delete old.saveFormatVersion;
 const before=structuredClone(old), migrated=migrateCitySave(old);
 expect(old).toEqual(before);
 expect(migrated.manifest).toEqual({...before,saveFormatVersion:1});
 expect(migrated.migrations).toEqual([expect.objectContaining({from:0,to:1,outcomeChanged:false})]);
 expect(migrateCitySave(migrated.manifest)).toEqual({manifest:migrated.manifest,migrations:[]});
 for(const saveFormatVersion of [-1,2,1.5,'1',null])expect(()=>migrateCitySave({...old,saveFormatVersion})).toThrow();
 expect(()=>migrateCitySave({})).toThrow();
});
test('outcome comparison reports changed, missing and unavailable evidence',()=>{
 expect(compareSavedOutcome({a:1},{a:1}).status).toBe('matched');
 for(const actual of [{a:2},{},{a:1,b:2},{a:NaN}])expect(compareSavedOutcome({a:1},actual).status).toBe('mismatch');
 expect(compareSavedOutcome({},{}).status).toBe('unavailable');
});
test('normal API saves reopen, verify replay and reject changed recorded outcomes without overwriting them',async()=>{
 const root=mkdtempSync(join(tmpdir(),'city-migration-'));let store=new CityStore(root);
 try {
  let api=createCityApi({store});
  const request=(path,body)=>api(new Request('http://localhost/api/city-experiments'+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  const created=await (await request('',{city:{households:3,seed:42},runs:1,months:2})).json();
  let record;
  for(let i=0;i<200;i++){record=store.get(created.id);if(['complete','failed'].includes(record.status))break;await new Promise(r=>setTimeout(r,10));}
  expect(record.status).toBe('complete');expect(record.manifest.saveFormatVersion).toBe(1);
  // Emulate the exact pre-format manifest in both persistent manifest copies.
  const legacy=structuredClone(record.manifest);delete legacy.saveFormatVersion;
  store.control.query('UPDATE experiment_index SET manifest_json=? WHERE experiment_id=?').run(JSON.stringify(legacy),created.id);
  store.close();store=new CityStore(root);api=createCityApi({store});
  expect(store.get(created.id).migrations[0].outcomeChanged).toBe(false);
  let response=await request('/'+created.id+'/replay',{});
  expect(response.status).toBe(200);expect((await response.json()).verification.status).toBe('matched');
  await store.enqueue(created.id,db=>db.query("UPDATE run_metrics SET value=value+1 WHERE run_id='baseline-0' AND metric_id=(SELECT MIN(metric_id) FROM run_metrics WHERE run_id='baseline-0')").run());
  const before=store.savedOutcome(created.id,'baseline-0');
  response=await request('/'+created.id+'/replay',{});
  expect(response.status).toBe(409);expect((await response.json()).verification.status).toBe('mismatch');
  expect(store.savedOutcome(created.id,'baseline-0')).toEqual(before);
  expect(JSON.parse(store.control.query('SELECT manifest_json FROM experiment_index WHERE experiment_id=?').get(created.id).manifest_json)).toEqual(legacy);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
