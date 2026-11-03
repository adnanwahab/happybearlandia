/** Select only the actual date participants. World-space positions may be
 * supplied by Models as localPositions; never synthesize a second resident. */
export function dateRendererRecords(value={}){
  const date=value.date??value.active??value.dates?.active??null,world=value.world??value.dateWorld??null;
  const ids=new Set((date?.personIds??[]).filter(id=>id!=null).map(String)),rows=value.people??date?.people??[];
  const seen=new Set(),people=[];
  for(const p of rows){if(!p||typeof p!=='object'||(p.id??p.personId)==null)continue;const id=String(p.id??p.personId);if(!ids.has(id)||seen.has(id))continue;seen.add(id);const position=date?.localPositions?.[id]??p.datePosition??p;people.push({...p,id,x:position.x,z:position.z});}
  return {date,world,people,paused:value.paused??true,selectedPersonId:ids.has(String(value.selectedPersonId))?String(value.selectedPersonId):date?.personIds?.[0]??null,readOnly:!!value.readOnly};
}
export function dateMovementRequest({date,people,selectedPersonId},dx,dz,step=3){
  const p=people.find(p=>p.id===String(selectedPersonId));if(!date||!p||![p.x,p.z,dx,dz].every(Number.isFinite))return null;
  const length=Math.hypot(dx,dz);if(!length)return null;
  return {dateId:date.id,personId:p.id,x:p.x+dx/length*step,z:p.z+dz/length*step};
}

/** A model world descriptor is not a renderable map dataset. */
export function isDateEnvironment(world){return !!world&&(Array.isArray(world.buildings)||Array.isArray(world.roads));}
export function dateEnvironmentKey(value={}){
 const date=value.date??value.active??value.dates?.active,world=value.world??value.dateWorld;
 const place=date?.globalPlace??date?.place??date?.venue?.globalPlace??date?.venue;
 const origin=Number.isFinite(place?.lat)&&Number.isFinite(place?.lng)?place:world?.origin;
 return Number.isFinite(origin?.lat)&&Number.isFinite(origin?.lng)?`${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`:isDateEnvironment(world)?world.key??null:null;
}
export function retainDateEnvironment(incoming,cached){
 if(!isDateEnvironment(incoming))return cached??null;
 const count=w=>(w?.buildings?.length??0)+(w?.roads?.length??0);
 if(cached&&count(cached)>0&&count(incoming)===0)return {...cached,places:incoming.places?.length?incoming.places:cached.places,nearby:incoming.nearby??cached.nearby,terrain:incoming.terrain??cached.terrain};
 return incoming;
}
