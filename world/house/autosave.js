import {saveJSONRequest} from '../save-request.js';
import {readPopulationCheckpoint} from '../population/checkpoint.js';
import {compatiblePopulationContinuation} from '../population/population-growth.js';
import {validateHouseEntry} from './bridge.js';
const sessionPath=(experimentId,householdId)=>'/api/world-experiments/'+encodeURIComponent(experimentId)+'/house-session/'+encodeURIComponent(householdId);
export async function loadHouseAutosave(record,householdId,{fetchImpl=fetch}={}){
 const response=await fetchImpl(sessionPath(record.id,householdId)+'?optional=1',{cache:'no-store'});
 if(response.status===404||response.status===204)return{record,revision:0,resumed:false};
 const saved=await response.json();if(!response.ok)throw Error(saved.error??'Could not load automatically saved progress');
 if(saved.schemaVersion!=='house-session-record.v1'||saved.experimentId!==record.id||saved.householdId!==householdId||!Number.isSafeInteger(saved.revision)||saved.revision<1)throw Error('The automatic save service returned an invalid household session');
 const original=readPopulationCheckpoint(record.save.checkpoint).model,current=readPopulationCheckpoint(saved.checkpoint).model;
 if(current.minute<original.minute||!compatiblePopulationContinuation(original,current))throw Error('Automatically saved progress belongs to a different city or an earlier clock');
 const next={...record,save:{...record.save,checkpoint:saved.checkpoint}};validateHouseEntry(next.save,householdId);
 return{record:next,revision:saved.revision,resumed:true,updatedAt:saved.updatedAt};
}
/** Stable social state, excluding constantly changing in-progress attendance counters. */
export function houseRelationshipSignature(household){return JSON.stringify([...(household.memberDetails??[]),...(household.visitorDetails??household.house?.guests??[])].map(person=>[person.id,(person.relationships??[]).map(row=>[row.personId,row.knownSinceMinute,row.friendship,row.romance,row.tension,row.familiarity,row.directed,row.commitment,row.memories]).sort((a,b)=>a[0].localeCompare(b[0]))]).sort((a,b)=>a[0].localeCompare(b[0])));}
/** One mutable SQLite session, coalesced writes and optimistic concurrency.
 * Full committed checkpoints preserve contact, memories and their shared clock. */
export function createHouseAutosave({experimentId,householdId,revision=0,capture,canSave=()=>true,fetchImpl=fetch,onState=()=>{},intervalMs=10000,debounceMs=350,requestTimeoutMs=60000}={}){
 let scope=experimentId,version=revision,dirty=false,pending=null,timer=null,destroyed=false,conflicted=false,lastMinute=null,lastSignature=null,lastSavedMinute=null,epoch=0;
 const report=(status,error)=>onState({status,error,revision:version,minute:lastSavedMinute});
 async function flush({force=false}={}){if(destroyed||conflicted)return null;if(pending){await pending;if(!dirty)return null;}if(!dirty||!force&&!canSave())return null;clearTimeout(timer);timer=null;dirty=false;const startedScope=scope,startedEpoch=epoch,expectedRevision=version;
  const operation=(async()=>{report('saving');try{const checkpoint=await capture();const {response,value:saved}=await saveJSONRequest(sessionPath(startedScope,householdId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'house-session-save.v1',checkpoint,expectedRevision})},{fetchImpl,timeoutMs:requestTimeoutMs,timeoutMessage:'Automatic save timed out. Your current progress is still in this page; retry when the connection recovers.'});if(response.status===409){if(startedEpoch===epoch)conflicted=true;throw Error('Another tab has newer saved progress. Reload this page before continuing automatic saves.');}if(!response.ok)throw Error(saved.error??'Automatic save failed ('+response.status+')');if(saved.schemaVersion!=='house-session-record.v1'||saved.experimentId!==startedScope||saved.householdId!==householdId||saved.revision!==expectedRevision+1)throw Error('Automatic save acknowledgement is invalid');if(startedEpoch===epoch){version=saved.revision;lastSavedMinute=saved.minute;report('saved');}return saved;}catch(error){if(startedEpoch===epoch){dirty=true;report(conflicted?'conflict':'error',error.message);}return null;}})();pending=operation;try{return await operation;}finally{if(pending===operation)pending=null;}
 }
 function markDirty({urgent=false}={}){if(destroyed||conflicted)return;dirty=true;if(urgent&&!timer&&!pending)timer=setTimeout(()=>{timer=null;void flush();},debounceMs);}
 const heartbeat=setInterval(()=>void flush(),intervalMs);
 return{observe(household,snapshot){const signature=houseRelationshipSignature(household),changed=lastSignature!==null&&signature!==lastSignature;lastSignature=signature;const minute=snapshot?.minute??household.house?.minute;if(lastMinute!==null&&minute!==lastMinute)markDirty();lastMinute=minute;if(changed)markDirty({urgent:true});return changed;},markDirty,flush,async waitForIdle(){if(pending)await pending;},async rebase(experimentId){await this.waitForIdle();epoch++;scope=experimentId;version=0;dirty=false;conflicted=false;lastSavedMinute=lastMinute;report('saved');},getState:()=>({experimentId:scope,revision:version,dirty,saving:!!pending,conflicted,lastSavedMinute}),destroy(){destroyed=true;clearTimeout(timer);clearInterval(heartbeat);}};
}
