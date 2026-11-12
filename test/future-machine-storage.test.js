import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { CityStore } from '../world/city/storage.js';
import { normalizeExperiment } from '../world/city/api.js';
import { createEngine, cityMetrics } from '../world/city/engine.js';
import { createRealityShareStore } from '../world/reality/share-store.js';
import { backupFutureMachine } from '../scripts/backup-future-machine.js';

test('City manifest, runs and share records survive close/reopen and an integrity-checked backup',async()=>{
 const root=mkdtempSync(join(tmpdir(),'future-machine-storage-'));let store,shares,restored;
 try{
  const cityRoot=join(root,'source'),sharePath=join(root,'shares.sqlite');store=new CityStore(cityRoot);
  const manifest=normalizeExperiment({city:{seed:42,households:3},months:120,runs:1,retention:'summary',interventions:[]});
  store.create('city_durability',manifest);store.saveWorld('city_durability',manifest.initial);
  const engine=createEngine();let state=engine.initialize(manifest.initial);const steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}
  await store.saveRun('city_durability',{runId:'baseline-0',scenarioId:'baseline',index:0,seed:42,metrics:cityMetrics(state),steps,durationMs:1,retention:'summary',manifest:engine.manifest});store.status('city_durability','complete');
  const savedInitial=JSON.stringify(store.get('city_durability').manifest.initial);
  store.close();store=null;
  shares=createRealityShareStore(sharePath);const now=new Date();const record={id:'persistent-test',createdAt:now.toISOString(),expiresAt:new Date(+now+60000).toISOString(),recipe:'bounded-test'};shares.put(record);shares.close();shares=null;
  const backup=backupFutureMachine({cityRoot,sharePath,destination:join(root,'backup')});expect(backup.files).toHaveLength(4);
  restored=new CityStore(join(root,'backup/city'));expect(restored.get('city_durability').status).toBe('complete');expect(JSON.stringify(restored.get('city_durability').manifest.initial)).toBe(savedInitial);
  const exported=restored.export('city_durability');expect(exported.byteLength).toBeGreaterThan(0);
  const db=new Database(restored.path('city_durability'),{readonly:true});try{expect(db.query('SELECT COUNT(*) AS n FROM municipal_finance').get().n).toBe(120);expect(db.query('PRAGMA integrity_check').get().integrity_check).toBe('ok');}finally{db.close();}
  shares=createRealityShareStore(join(root,'backup/reality-shares.sqlite'));expect(shares.get(record.id)).toEqual(record);expect(JSON.parse(readFileSync(join(root,'backup/backup.json'))).schemaVersion).toBe('future-machine-backup.v1');
  expect(()=>backupFutureMachine({cityRoot,sharePath,destination:join(root,'backup')})).toThrow();
 }finally{store?.close();shares?.close();restored?.close();rmSync(root,{recursive:true,force:true});}
});
