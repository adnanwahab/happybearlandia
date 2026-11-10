import {RunContextSchema, sameRun} from '../../shared/causality/index.js';
/** Deterministic replay of JSON authority. Domain adapters own complete state projection. */
export class ReplayError extends Error {
 constructor(code,message){super(message);this.name='ReplayError';this.code=code;}
}
const fail=(code,message)=>{throw new ReplayError(code,message);};
export function canonicalJSON(value){
 const active=new Set();
 function encode(v){
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(!v||typeof v!=='object'||active.has(v))fail('INVALID_STATE','State must be finite, acyclic JSON');
  if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('INVALID_STATE','Adapter must encode non-JSON state explicitly');
  active.add(v);let result;
  if(Array.isArray(v)){if(Object.keys(v).length!==v.length)fail('INVALID_STATE','Sparse or decorated arrays are not canonical');result='['+v.map(encode).join(',')+']';}
  else result='{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+encode(v[k])).join(',')+'}';
  active.delete(v);return result;
 }
 return encode(value);
}
export async function canonicalDigest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJSON(value)));return 'sha256:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
const copy=v=>JSON.parse(canonicalJSON(v));
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const tick=t=>{if(!Number.isSafeInteger(t)||t<0)fail('INVALID_TICK','Tick must be a nonnegative safe integer');};
function scope(s){return copy(RunContextSchema.parse(s));}
const sameScope=(a,b)=>Boolean(a&&b)&&sameRun(a,b);
function version(record,adapter){if(record.domain!==adapter.domain||record.modelVersion!==adapter.modelVersion||record.adapterVersion!==adapter.adapterVersion)fail('MODEL_INCOMPATIBLE','No exact domain/model/adapter version match');}
export async function createReplayCheckpoint({id,context,tick:at,adapter,state}){
 tick(at);if(typeof id!=='string'||!id)fail('INVALID_CHECKPOINT','Checkpoint needs an immutable ID');
 const body={schemaVersion:'replay-checkpoint.v1',id,context:scope(context),tick:at,domain:adapter.domain,modelVersion:adapter.modelVersion,adapterVersion:adapter.adapterVersion,state:copy(await adapter.serialize(state))};
 return freeze({...body,hash:await canonicalDigest(body)});
}
export async function verifyReplayCheckpoint(checkpoint){
 const {hash,...body}=copy(checkpoint);if(body.schemaVersion!=='replay-checkpoint.v1'||hash!==await canonicalDigest(body))fail('CHECKPOINT_HASH_MISMATCH','Checkpoint content hash does not match');
 tick(body.tick);scope(body.context);return freeze({...body,hash});
}
export class ReplayAdapterRegistry {
 #adapters=new Map();
 register(adapter){for(const key of ['domain','modelVersion','adapterVersion'])if(typeof adapter[key]!=='string'||!adapter[key])fail('INVALID_ADAPTER',`Missing ${key}`);
 for(const key of ['serialize','restore','applyEvent'])if(typeof adapter[key]!=='function')fail('INVALID_ADAPTER',`Missing ${key}`);
 const key=canonicalJSON([adapter.domain,adapter.modelVersion,adapter.adapterVersion]);if(this.#adapters.has(key))fail('DUPLICATE_ADAPTER','Adapter version already registered');this.#adapters.set(key,Object.freeze({...adapter}));return this;}
 get(record){const adapter=this.#adapters.get(canonicalJSON([record.domain,record.modelVersion,record.adapterVersion]));if(!adapter)fail('MODEL_INCOMPATIBLE','Replay model version is unavailable');return adapter;}
}
/** Repository load(context) returns one immutable snapshot: {checkpoints,events,digests}. */
export class HistoricalStateService {
 constructor({repository,registry}){this.repository=repository;this.registry=registry;}
 async stateAt({context,targetTick,checkpointId,mode='recorded-playback'}){
  tick(targetTick);context=scope(context);if(!['recorded-playback','verified-recomputation'].includes(mode))fail('INVALID_MODE','Unknown replay mode');
  const data=copy(await this.repository.load(context));
  const eligible=data.checkpoints.filter(c=>sameScope(c.context,context)&&c.tick<=targetTick&&(!checkpointId||c.id===checkpointId));
  eligible.sort((a,b)=>b.tick-a.tick||(a.id<b.id?-1:a.id>b.id?1:0));
  if(!eligible.length)fail('CHECKPOINT_UNAVAILABLE','No checkpoint at or before requested tick');
  const checkpoint=await verifyReplayCheckpoint(eligible[0]),adapter=this.registry.get(checkpoint);version(checkpoint,adapter);
  if(mode==='verified-recomputation'&&typeof adapter.recompute!=='function')fail('RECOMPUTATION_UNSUPPORTED','Adapter cannot regenerate authoritative state');
  const events=data.events.filter(e=>sameScope(e.context,context)&&e.tick>checkpoint.tick&&e.tick<=targetTick);
  const orders=new Set(),ids=new Set();for(const e of events){tick(e.tick);if(!Number.isSafeInteger(e.sequence)||e.sequence<0||typeof e.id!=='string'||!e.id)fail('INVALID_EVENT','Event needs stable ID and sequence');version(e,adapter);const order=`${e.tick}:${e.sequence}`;if(orders.has(order)||ids.has(e.id))fail('AMBIGUOUS_EVENT_ORDER','Duplicate event ID or tick/sequence');orders.add(order);ids.add(e.id);}
  events.sort((a,b)=>a.tick-b.tick||a.sequence-b.sequence);
  let state=await adapter.restore(copy(checkpoint.state));
  if(adapter.getTick&&adapter.getTick(state)!==checkpoint.tick)fail('CHECKPOINT_TICK_MISMATCH','Checkpoint state clock differs from envelope');
  // Narrative, wall clock and rendering records never enter model regeneration.
  const inputs=events.filter(e=>e.replayKind==='input');
  if(mode==='verified-recomputation'){
   if(events.some(e=>!['input','transition','narrative','render','wall-clock'].includes(e.replayKind)))fail('EVENT_NOT_REPLAYABLE','Unclassified descriptive events cannot reconstruct authority');
   state=await adapter.recompute(state,freeze(copy(inputs)),{fromTick:checkpoint.tick,targetTick,context:freeze(context)});
  }else{
   for(const event of events){if(['narrative','render','wall-clock'].includes(event.replayKind))continue;if(!['input','transition'].includes(event.replayKind))fail('EVENT_NOT_REPLAYABLE','Descriptive events cannot reconstruct authority');state=await adapter.applyEvent(state,freeze(copy(event)));}
   if(typeof adapter.advance==='function')state=await adapter.advance(state,{targetTick,fromTick:checkpoint.tick});
   else if(targetTick!==checkpoint.tick&&events.filter(e=>['input','transition'].includes(e.replayKind)).at(-1)?.tick!==targetTick)fail('INCOMPLETE_HISTORY','Adapter cannot advance through unrecorded ticks');
  }
  if(adapter.getTick&&adapter.getTick(state)!==targetTick)fail('INCOMPLETE_HISTORY','Replay did not reach target tick');
  const serialized=copy(await adapter.serialize(state)),digest=await canonicalDigest(serialized);
  const expected=(data.digests||[]).filter(d=>sameScope(d.context,context)&&d.tick===targetTick&&d.domain===checkpoint.domain&&d.modelVersion===checkpoint.modelVersion&&d.adapterVersion===checkpoint.adapterVersion);
  if(expected.length>1&&new Set(expected.map(d=>d.digest)).size>1)fail('CONFLICTING_DIGESTS','Target has conflicting recorded digests');
  if(mode==='verified-recomputation'&&!expected.length)fail('VERIFICATION_UNAVAILABLE','No recorded digest at target tick');
  if(expected.length&&expected[0].digest!==digest)fail('STATE_DIGEST_MISMATCH','Replayed state differs from recorded authority');
  return freeze({context,targetTick,checkpoint:{id:checkpoint.id,tick:checkpoint.tick,hash:checkpoint.hash},mode,verified:mode==='verified-recomputation',digest,state:serialized,eventIds:events.map(e=>e.id)});
 }
 async timeline({context,fromTick=0,toTick=Number.MAX_SAFE_INTEGER}){context=scope(context);tick(fromTick);tick(toTick);if(toTick<fromTick)fail('INVALID_TICK','Timeline bounds are reversed');const data=copy(await this.repository.load(context));return freeze({context,fromTick,toTick,checkpoints:data.checkpoints.filter(c=>sameScope(c.context,context)&&c.tick>=fromTick&&c.tick<=toTick).map(({id,tick,hash,domain,modelVersion,adapterVersion})=>({id,tick,hash,domain,modelVersion,adapterVersion})).sort((a,b)=>a.tick-b.tick),events:data.events.filter(e=>sameScope(e.context,context)&&e.tick>=fromTick&&e.tick<=toTick).sort((a,b)=>a.tick-b.tick||a.sequence-b.sequence)});}
}
