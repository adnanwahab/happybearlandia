/** Culture -> existing population event inputs; no outcome offsets or stepping.
 * projectCulturePopulationEvents({events,minute,districtIds,existingEvents})
 * events: [{id,districtId|districtIds,startMinute,endMinute|durationMinutes,
 *           multipliers:{roads,transit,services,demand}}]. `effects` is an
 * explicit alias for multipliers. Only active [start,end) inputs are projected.
 * applyCulturePopulationEvents(populationModel,events,{minute}) installs only
 * this adapter's namespaced schedules. Call before population stepping, and
 * resynchronize at event boundaries; never call the economy separately.
 */
import {validatePopulationConfig} from '../population/contracts.js';
const SOURCE='culture-population-adapter.v1';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const safeId=value=>typeof value==='string'&&value.length>0&&value.length<=160;
export function projectCulturePopulationEvents({events=[],minute,districtIds=[],existingEvents=[]}={}){
 if(!finite(minute)||minute<0||!Array.isArray(events)||events.length>128||!Array.isArray(existingEvents)||!Array.isArray(districtIds)||!districtIds.length||districtIds.length>32||new Set(districtIds).size!==districtIds.length)throw Error('Supply a bounded culture event list, nonnegative minute and unique actual district IDs.');
 const known=new Set(districtIds),seen=new Set(),projected=[],unsupported=[],inactiveIds=[];
 for(const event of events.slice().sort((a,b)=>String(a?.id).localeCompare(String(b?.id)))){
  if(!safeId(event?.id)||seen.has(event.id))throw Error('Culture inputs need unique stable IDs.');seen.add(event.id);
  const start=event.startMinute,end=event.endMinute??(finite(event.durationMinutes)?start+event.durationMinutes:null);
  if(!finite(start)||start<0||!finite(end)||end<=start)throw Error(`Culture ${event.id} needs an explicit positive simulation-minute interval.`);
  const districts=Array.isArray(event.districtIds)?event.districtIds:[event.districtId];
  if(!districts.length||new Set(districts).size!==districts.length||districts.some(id=>!safeId(id)||!known.has(id)))throw Error(`Culture ${event.id} must reference actual mapped districts; no geography is inferred.`);
  const effects=event.multipliers??event.effects;if(!effects||typeof effects!=='object'||Array.isArray(effects))throw Error(`Culture ${event.id} requires explicit mechanism multipliers.`);
  if(Object.values(effects).some(value=>!finite(value)||value<0))throw Error('Culture multipliers must be finite and nonnegative.');
  if(minute<start||minute>=end){inactiveIds.push(event.id);continue;}
  for(const [mechanism,value]of Object.entries(effects).sort(([a],[b])=>a.localeCompare(b))){
   if(value===1)continue;let type=null,magnitude=null;
   if(mechanism==='roads'&&value<=1){type='road-closure';magnitude=1-value;}
   if(mechanism==='transit'&&value<=1){type='transit-outage';magnitude=1-value;}
   if(mechanism==='transit'&&value>1&&value<=2){type='transit-opening';magnitude=value-1;}
   if(mechanism==='demand'&&value>1&&value<=2){type='festival';magnitude=value-1;}
   if(!type){unsupported.push({eventId:event.id,mechanism,multiplier:value,reason:mechanism==='services'?'No independent service multiplier event exists; storm would also alter roads/transit and is not substituted.':'This direction/range has no exact existing population event mechanism; no outcome offset or clipped substitute was applied.'});continue;}
   for(const districtId of districts.slice().sort())projected.push({id:`culture:${event.id}:${districtId}:${mechanism}`,type,districtId,startMinute:start,durationMinutes:end-start,recoveryMinutes:0,magnitude,source:SOURCE,sourceEventId:event.id,mechanism,declaredMultiplier:value});
  }
 }
 const retained=existingEvents.filter(event=>event?.source!==SOURCE),all=[...retained,...projected];
 if(all.length>64)throw Error('Combined scheduled events exceed the population limit of64; no schedules were silently dropped.');
 const checked=validatePopulationConfig({events:all});if(!checked.valid)throw Error(checked.errors.join(' '));
 const before=new Set(existingEvents.filter(e=>e.source===SOURCE).map(e=>e.id)),after=new Set(projected.map(e=>e.id));
 return{schemaVersion:SOURCE,events:structuredClone(all),projected:structuredClone(projected),addedIds:[...after].filter(id=>!before.has(id)),removedIds:[...before].filter(id=>!after.has(id)),inactiveIds,unsupported,changed:JSON.stringify(existingEvents)!==JSON.stringify(all),limitations:['Synthetic mechanism inputs only; no measured cultural effects or downstream outcome values are asserted.','All district scopes must be supplied explicitly. This adapter does not infer real residents or event attendance.','Multiple supported inputs multiply through existing eventEffects equations. Unsupported effects remain unavailable.','Projection is idempotent by source/event/district/mechanism ID. It never advances time, economy, households or jobs.','Resynchronize before model stepping and at source event boundaries for hard [start,end) expiry. No recovery tail is introduced.']};
}
export function applyCulturePopulationEvents(model,events,{minute=model?.minute}={}){
 if(!model?.config||!Array.isArray(model.districts))throw Error('An authoritative population model is required.');
 if(minute!==model.minute)throw Error('Applied culture inputs must use the actual population minute; use pure projection for future queries.');
 const sourceSnapshot=!Array.isArray(events)&&events?.schemaVersion==='culture.v1'?events:null;if(sourceSnapshot&&sourceSnapshot.minute!==minute)throw Error('Culture and population clocks must match; stale active-event snapshots are not applied.');const input=sourceSnapshot?sourceSnapshot.activeEvents:events;
 const projected=projectCulturePopulationEvents({events:input,minute,districtIds:model.districts.map(d=>d.id),existingEvents:model.config.events});
 if(projected.changed){const checked=validatePopulationConfig({...model.config,events:projected.events});if(!checked.valid)throw Error(checked.errors.join(' '));model.config=checked.values;}
 return projected;
}
