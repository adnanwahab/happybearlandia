import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyRealityManifest} from './runtime-core.js';
import {hash,draw} from '../population/contracts.js';
import {validateState} from '../city/contracts.js';
import {createRealityShareStore,SHARE_TTL_MS} from './share-store.js';
export const SHARE_MAX_BYTES=8000000;
const ID=/^[A-Za-z0-9_-]{8,16}$/;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row);
async function readBounded(request){
 if(Number(request.headers.get('content-length'))>SHARE_MAX_BYTES)fail('Share exceeds 8 MB.',413);
 const reader=request.body?.getReader();if(!reader)fail('A JSON share payload is required.');let bytes=0;const chunks=[];let timer;
 try{const read=(async()=>{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>SHARE_MAX_BYTES)fail('Share exceeds 8 MB.',413);chunks.push(value);}const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(body));}catch{fail('Malformed JSON share payload.');}})();return await Promise.race([read,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Share upload timed out.'),{status:408})),10000);})]);}finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
function privacyAndDepth(value,depth=0,counter={n:0}){if(++counter.n>300000||depth>64)fail('Share structure exceeds bounded complexity.',413);if(value&&typeof value==='object'){if(Object.hasOwn(value,'user')&&Object.hasOwn(value,'uid'))fail('OSM mapper identities must not be included in shares.');for(const entry of Object.values(value))privacyAndDepth(entry,depth+1,counter);}}
function metrics(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>256||Object.values(value).some(v=>v!==null&&!Number.isFinite(v)))fail('Selected future requires bounded numeric baseline and treatment metrics.');return value;}
export function validateRealityShare(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('A frozen manifest and completed run are required.');privacyAndDepth(payload);
 let manifest;try{manifest=verifyRealityManifest(payload.manifest??payload.result?.manifest);}catch(error){fail(`Invalid frozen manifest: ${error.message}`);}
 const rows=payload.result?.runs;const row=payload.run??(Array.isArray(rows)?rows.find(r=>r.runId===payload.runId)??(rows.length===1?rows[0]:null):null);
 if(!row||row.status!=='completed'||!Number.isInteger(row.runIndex)||row.runIndex<0||row.runIndex>=manifest.runs)fail('Select a completed future with a valid manifest run index.');
 const runId=`${manifest.id}-future-${row.runIndex+1}`;
 if(row.runId!==runId||row.id!==runId||payload.runId&&payload.runId!==runId||row.seed!==hash(`${manifest.seed}:future:${row.runIndex}`))fail('Selected future run ID, index or seed does not match the frozen manifest.');
 const expected={};for(const a of manifest.assumptions){let value=manifest.assumptionOverrides[a.id]??(a.kind==='policy'&&!manifest.samplePolicyUncertainty?a.value:a.min+draw(manifest.seed,row.runIndex,0,hash(a.id))*(a.max-a.min));if(a.integer)value=Math.round(value);expected[a.id]=value;}if(canonical(expected)!==canonical(row.assumptions))fail('Selected future assumptions do not match the frozen manifest sample.');
 metrics(row.baseline?.metrics);metrics(row.treatment?.metrics);
 const selected=Object.fromEntries(['id','runId','runIndex','seed','assumptions','status','pass','testStatus','tests','testReport','delta'].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
 selected.baseline={metrics:row.baseline.metrics,...(row.baseline.period?{period:row.baseline.period}:{}),...(row.baseline.geography?{geography:row.baseline.geography}:{})};selected.treatment={metrics:row.treatment.metrics,...(row.treatment.period?{period:row.treatment.period}:{}),...(row.treatment.geography?{geography:row.treatment.geography}:{})};
 if(payload.displayInitial!==undefined){try{validateState(payload.displayInitial);}catch(error){fail(`Invalid displayInitial CityState: ${error.message}`);}if(payload.displayInitial.month!==0)fail('displayInitial must be a frozen month-zero CityState.');if(Object.values(payload.displayInitial).filter(Array.isArray).reduce((n,rows)=>n+rows.length,0)>12000)fail('displayInitial exceeds the 12000-entity host limit.',413);}
 return {result:{manifest,runs:[selected]},runId,...(payload.displayInitial?{displayInitial:payload.displayInitial}:{})};
}
export function createRealityShareHandler({dbPath=fileURLToPath(new URL('../../.data/reality-shares.sqlite',import.meta.url)),now=()=>new Date(),idFactory=()=>randomBytes(9).toString('base64url'),maxWritesPerMinute=20}={}){
 const store=createRealityShareStore(dbPath,{maxWritesPerMinute});let readWindow=0,reads=0;
 const handle=async request=>{try{const url=new URL(request.url),match=url.pathname.match(/^\/api\/reality-shares(?:\/([A-Za-z0-9_-]{8,16}))?\/?$/);if(!match)return json({error:'Share not found.'},404);
 if(request.method==='GET'&&match[1]){const time=now().getTime();if(time-readWindow>=60000||time<readWindow){readWindow=time;reads=0;}if(++reads>240)fail('Share read rate limit reached; retry in one minute.',429);const record=store.get(match[1],time);return record?json(record):json({error:'Share not found or expired.'},404);}
 if(request.method!=='POST'||match[1])return json({error:'Use POST to create a share or GET /api/reality-shares/:id to read one.'},405);
 store.reserveWrite(now().getTime());const payload=await readBounded(request),validated=validateRealityShare(payload),id=idFactory();if(!ID.test(id))fail('Unable to allocate a safe share ID.',500);
 const createdAt=now().toISOString(),record={schemaVersion:'reality-share.v1',id,url:`/r/${id}`,createdAt,expiresAt:new Date(Date.parse(createdAt)+SHARE_TTL_MS).toISOString(),...validated,verification:'client-replay-required',notice:'Locally stored simulation inputs and submitted metrics. The server validates manifest consistency but does not certify data sources or replay outcomes. Client replay must reproduce selected metrics before display.'};
 if(new TextEncoder().encode(JSON.stringify(record)).length>SHARE_MAX_BYTES)fail('Frozen share exceeds 8 MB; reduce geography or result detail.',413);store.put(record);return json(record,201);
 }catch(error){return json({error:error.message||'Share unavailable.'},error.status||400);}};handle.close=()=>store.close();return handle;
}
