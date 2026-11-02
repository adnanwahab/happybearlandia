import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
export function createEconomyRecordsHandler({root='.hbl-city'}={}){
 let db;
 function database(){if(!db){mkdirSync(root,{recursive:true});db=new Database(join(root,'economy-records.sqlite'),{create:true});db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY, run_id TEXT NOT NULL, tick INTEGER NOT NULL, minute REAL NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(run_id,tick));');}return db;}
 return async request=>{try{
 const url=new URL(request.url),store=database();
 if(request.method==='POST'){
  const raw=await request.text();if(raw.length>4000000)return Response.json({error:'Record exceeds 4 MB'},{status:413});
  const row=JSON.parse(raw);if(!/^population_[a-zA-Z0-9_-]{1,160}$/.test(row.runId)||!Number.isInteger(row.tick)||row.tick<0||!Number.isFinite(row.minute)||row.minute<0||!row.metrics||!Array.isArray(row.people)||row.people.length>500||!Array.isArray(row.events)||row.events.length>10000)throw new Error('Invalid economic snapshot');
  store.query('INSERT OR IGNORE INTO snapshots(run_id,tick,minute,created_at,payload) VALUES(?,?,?,?,?)').run(row.runId,row.tick,row.minute,new Date().toISOString(),raw);
  return Response.json(store.query('SELECT id FROM snapshots WHERE run_id=? AND tick=?').get(row.runId,row.tick));
 }
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(url.searchParams.has('id')){const id=Number(url.searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid record ID');const row=store.query('SELECT * FROM snapshots WHERE id=?').get(id);return row?Response.json({...row,payload:JSON.parse(row.payload)}):Response.json({error:'Record not found'},{status:404});}
 const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)throw new Error('Invalid cursor');
 return Response.json({records:store.query('SELECT id,run_id,tick,minute,created_at FROM snapshots WHERE id < ? ORDER BY id DESC LIMIT 100').all(before)});
 }catch(error){return Response.json({error:error.message},{status:400});}};
}
