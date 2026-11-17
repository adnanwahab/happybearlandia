import {randomBytes,createHash} from 'node:crypto';
import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {readBounded,validateRealityShare} from '../reality/share-api.js';
const digest=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
/** Capabilities authorize only uploaded snapshots, never projects or sessions. */
export function createGuestHandler({dbPath='.data/guest.sqlite',now=()=>Date.now(),maxRecords=100}={}){
 if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
 const db=new Database(dbPath,{create:true});
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS guest_snapshots(view_hash TEXT PRIMARY KEY,owner_hash TEXT UNIQUE NOT NULL,expires INTEGER NOT NULL,data TEXT NOT NULL);');
 const insert=db.transaction((view,owner,expires,data)=>{
  db.query('DELETE FROM guest_snapshots WHERE expires <= ?').run(now());
  if(db.query('SELECT COUNT(*) AS n FROM guest_snapshots').get().n>=maxRecords)throw Object.assign(new Error('Guest storage full.'),{status:507});
  db.query('INSERT INTO guest_snapshots VALUES(?,?,?,?)').run(digest(view),digest(owner),expires,JSON.stringify(data));
 });
 const handle=async request=>{try{
  const path=new URL(request.url).pathname;
  if(path!=='/api/guest-snapshots')return json({error:'Guest snapshot unavailable.'},404);
  if(request.method==='POST'){
   if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin request required.'},403);
   const input=await readBounded(request);
   if(input.publishConsent!==true||input.rightsConfirmed!==true||!Number.isInteger(input.ttlSeconds)||input.ttlSeconds<60||input.ttlSeconds>86400)return json({error:'Explicit publication consent, rights confirmation and lifetime of 60–86400 seconds required.'},400);
   const snapshot=validateRealityShare(input),view=token(),owner=token(),expiresAt=now()+input.ttlSeconds*1000;
   const data={schemaVersion:'guest-snapshot.v1',expiresAt:new Date(expiresAt).toISOString(),...snapshot,forkAllowed:false,verification:'client-replay-required',notice:'Submitted simulation inputs and metrics; sources and replay outcomes are not server certified. Fork-to-own unavailable until ownership and rights enforcement exist.'};
   insert(view,owner,expiresAt,data);
   return json({url:`/world/guest/index.html#${view}`,revokeToken:owner,...data},201);
  }
  if(!['GET','DELETE'].includes(request.method))return json({error:'Method unavailable.'},405);
  const credential=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!credential)return json({error:'Guest snapshot unavailable.'},404);
  const column=request.method==='DELETE'?'owner_hash':'view_hash';
  const row=db.query(`SELECT view_hash,expires,data FROM guest_snapshots WHERE ${column}=?`).get(digest(credential));
  if(!row||row.expires<=now()){
   if(row)db.query('DELETE FROM guest_snapshots WHERE view_hash=?').run(row.view_hash);
   return json({error:'Guest snapshot unavailable.'},404);
  }
  if(request.method==='DELETE'){db.query('DELETE FROM guest_snapshots WHERE view_hash=?').run(row.view_hash);return json({deleted:true});}
  return json(JSON.parse(row.data));
 }catch(error){return json({error:error.status?error.message:'Invalid guest snapshot.'},error.status||400);}};
 handle.close=()=>db.close();return handle;
}
