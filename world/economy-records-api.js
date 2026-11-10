import {analyzeHouseholdRisk} from './population/household-risk.js';
import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
export function createEconomyRecordsHandler({root='.hbl-city'}={}){
 let db;
 function database(){if(!db){mkdirSync(root,{recursive:true});db=new Database(join(root,'economy-records.sqlite'),{create:true});db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY, run_id TEXT NOT NULL, tick INTEGER NOT NULL, minute REAL NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(run_id,tick)); CREATE TABLE IF NOT EXISTS household_money(run_id TEXT NOT NULL, household_id TEXT NOT NULL, settlement_id TEXT NOT NULL, minute REAL NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id,settlement_id)); CREATE INDEX IF NOT EXISTS household_money_lookup ON household_money(run_id,household_id,minute);');}return db;}
 return async request=>{try{
 const url=new URL(request.url),store=database();
 if(request.method==='POST'){
  const raw=await request.text();if(raw.length>4000000)return Response.json({error:'Record exceeds 4 MB'},{status:413});
  const row=JSON.parse(raw);if(!/^population_[a-zA-Z0-9_-]{1,160}$/.test(row.runId)||!Number.isInteger(row.tick)||row.tick<0||!Number.isFinite(row.minute)||row.minute<0||!row.metrics||!Array.isArray(row.people)||row.people.length>500||!Array.isArray(row.events)||row.events.length>10000)throw new Error('Invalid economic snapshot');
  if(row.households!==undefined&&(!Array.isArray(row.households)||row.households.length>500))throw new Error('Invalid households');
  const settlements=(row.households||[]).map(h=>h.moneyHistory).filter(Boolean);
  if(settlements.length>500||settlements.some(r=>typeof r.householdId!=='string'||typeof r.id!=='string'||!Number.isFinite(r.minute)||!Number.isFinite(r.openingSavings)||!Number.isFinite(r.closingSavings)||r.minute>row.minute||!Array.isArray(r.entries)||r.entries.length>32||r.entries.some(e=>typeof e.category!=='string'||!Number.isFinite(e.amount))||!Array.isArray(r.sources)||r.sources.length>1000||r.sources.some(s=>typeof s.personId!=='string'||!Number.isFinite(s.amount))||!Array.isArray(r.events)||r.events.length>10000))throw new Error('Invalid household settlement');
  store.transaction(()=>{
  const inserted=store.query('INSERT OR IGNORE INTO snapshots(run_id,tick,minute,created_at,payload) VALUES(?,?,?,?,?)').run(row.runId,row.tick,row.minute,new Date().toISOString(),raw);
  if(!inserted.changes)return;
  const insert=store.query('INSERT OR IGNORE INTO household_money(run_id,household_id,settlement_id,minute,payload) VALUES(?,?,?,?,?)');
  for(const record of settlements)insert.run(row.runId,record.householdId,record.id,record.minute,JSON.stringify(record));
  })();
  return Response.json(store.query('SELECT id FROM snapshots WHERE run_id=? AND tick=?').get(row.runId,row.tick));
 }
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(url.searchParams.has('risk')){
  const id=Number(url.searchParams.get('snapshot'));if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid snapshot ID');
  const snapshot=store.query('SELECT run_id,minute,payload FROM snapshots WHERE id=?').get(id);if(!snapshot)return Response.json({error:'Record not found'},{status:404});
  const households=JSON.parse(snapshot.payload).households||[],ids=households.map(h=>h.id),groups=new Map();
  if(ids.length){const rows=store.query(`SELECT household_id,payload FROM household_money WHERE run_id=? AND minute<=? AND minute>? AND household_id IN (${ids.map(()=>'?').join(',')}) ORDER BY minute`).all(snapshot.run_id,snapshot.minute,snapshot.minute-15*1440,...ids);for(const row of rows){if(!groups.has(row.household_id))groups.set(row.household_id,[]);groups.get(row.household_id).push(JSON.parse(row.payload));}}
  return Response.json({runId:snapshot.run_id,minute:snapshot.minute,households:households.map(h=>({id:h.id,savings:h.savings,financialRisk:analyzeHouseholdRisk(groups.get(h.id)||[],{savings:h.savings,asOfMinute:snapshot.minute})})),basis:'Collected payments only; sampled households at this snapshot time.'});
 }
 if(url.searchParams.has('household')){
  const runId=url.searchParams.get('run'),householdId=url.searchParams.get('household'),at=Number(url.searchParams.get('at')??Number.MAX_SAFE_INTEGER);
  if(!Number.isFinite(at)||at<0)throw new Error('Invalid payment history time');
  const records=store.query('SELECT payload FROM household_money WHERE run_id=? AND household_id=? AND minute<=? ORDER BY minute DESC LIMIT 366').all(runId,householdId,at).map(r=>JSON.parse(r.payload)).reverse();
  return Response.json({runId,householdId,records,limit:366});
 }
 if(url.searchParams.has('id')){const id=Number(url.searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid record ID');const row=store.query('SELECT * FROM snapshots WHERE id=?').get(id);return row?Response.json({...row,payload:JSON.parse(row.payload)}):Response.json({error:'Record not found'},{status:404});}
 const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)throw new Error('Invalid cursor');
 const runId=url.searchParams.get('run');
 return Response.json({records:runId?store.query('SELECT id,run_id,tick,minute,created_at FROM snapshots WHERE run_id=? AND id < ? ORDER BY id DESC LIMIT 100').all(runId,before):store.query('SELECT id,run_id,tick,minute,created_at FROM snapshots WHERE id < ? ORDER BY id DESC LIMIT 100').all(before)});
 }catch(error){return Response.json({error:error.message},{status:400});}};
}
