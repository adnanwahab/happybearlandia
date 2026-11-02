import {WORLD_RUNTIME_VERSION,cloneWorld} from './world-state.js';
export function populationEventCount(model){return Object.values(model.eventCounts).reduce((sum,n)=>sum+n,0);}
/** Captures actual retained engine events. Missing source details are counted,
 * never reconstructed as invented per-person transitions. */
export function capturePopulationEvents(model,afterCount=0){
 const total=populationEventCount(model),ledger=model.activityHistory;
 // The population engine emits travel/activity events into its activity ledger,
 // and jobs/housing events into both ledgers. Read the unified ledger once.
 const recent=ledger?.recentEvents??model.events;
 const first=total-recent.length;
 const events=recent.map((source,index)=>({source,ordinal:first+index})).filter(row=>row.ordinal>=afterCount);
 return{events:events.map(({source,ordinal})=>({...cloneWorld(source),id:source.id??`${model.prefix}-activity-event-${ordinal}`,sourceSequence:ordinal,sourceSchemaVersion:source.schemaVersion??'activity-history.v1',schemaVersion:'world-event.v1',modelVersion:source.modelVersion??model.modelVersion,system:'population',synthetic:true})),total,missing:Math.max(0,total-afterCount-events.length)};
}
export function runtimeEvent(type,minute,payload={}){return{schemaVersion:'world-event.v1',modelVersion:WORLD_RUNTIME_VERSION,system:'world-runtime',type,minute,synthetic:true,...cloneWorld(payload)};}
