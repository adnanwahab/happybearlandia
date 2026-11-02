import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {JOURNAL_CITIES} from './presets.js';
export function createCharacterJournalsHandler({root='.hbl-city'}={}){
 let db;const cities=new Set(JOURNAL_CITIES.map(c=>c.id));
 function database(){if(!db){mkdirSync(root,{recursive:true});db=new Database(join(root,'character-journals.sqlite'),{create:true});db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS character_journals(city_id TEXT NOT NULL, mode TEXT NOT NULL, run_id TEXT NOT NULL, person_id TEXT NOT NULL, name TEXT NOT NULL, day INTEGER NOT NULL, minute REAL NOT NULL, text TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(city_id,mode,run_id,person_id,day));
 CREATE INDEX IF NOT EXISTS journal_person ON character_journals(city_id,mode,person_id,day DESC);`);}return db;}
 const str=(s,max=200)=>typeof s==='string'&&s.length>0&&s.length<=max;
 const handler=async request=>{try{const url=new URL(request.url),cityId=url.searchParams.get('city');
 if(request.method==='GET'&&url.searchParams.get('cities')==='1')return Response.json({cities:JOURNAL_CITIES});
 if(request.method==='POST'){
  const raw=await request.text();if(raw.length>2000000)return Response.json({error:'Journal batch exceeds 2 MB'},{status:413});const body=JSON.parse(raw),{cityId,mode,runId,entries}=body;
  if(!cities.has(cityId)||!['living','legacy'].includes(mode)||!str(runId)||!Array.isArray(entries)||entries.length>500)throw new Error('Invalid preset city journal batch');
  for(const e of entries)if(!str(e.personId)||!str(e.name)||!Number.isSafeInteger(e.day)||e.day<0||!Number.isFinite(e.minute)||e.minute<e.day*1440||e.minute>(e.day+1)*1440||!str(e.text,24000)||!e.activities||typeof e.activities!=='object'||!Array.isArray(e.moments)||e.moments.length>16)throw new Error('Invalid character journal');
  const store=database(),insert=store.query(`INSERT INTO character_journals VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(city_id,mode,run_id,person_id,day) DO UPDATE SET name=excluded.name,minute=excluded.minute,text=excluded.text,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.minute>=character_journals.minute`);
  store.transaction(()=>{for(const e of entries)insert.run(cityId,mode,runId,e.personId,e.name,e.day,e.minute,e.text,JSON.stringify(e),new Date().toISOString());})();return Response.json({saved:entries.length});
 }
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});if(!cities.has(cityId))throw new Error('Choose a supported preset city');const mode=url.searchParams.get('mode'),person=url.searchParams.get('person');if(!['living','legacy'].includes(mode)||!str(person))throw new Error('Choose a character and population mode');
 const before=Number(url.searchParams.get('before')??Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<0)throw new Error('Invalid day cursor');
 const rows=database().query('SELECT * FROM character_journals WHERE city_id=? AND mode=? AND person_id=? AND day < ? ORDER BY day DESC, updated_at DESC, run_id LIMIT 50').all(cityId,mode,person,before);
 return Response.json({entries:rows.map(r=>({...JSON.parse(r.payload),runId:r.run_id,updatedAt:r.updated_at})),next:rows.length===50?rows.at(-1).day:null});
 }catch(e){return Response.json({error:e.message},{status:400});}};handler.close=()=>{db?.close();db=null;};return handler;
}
