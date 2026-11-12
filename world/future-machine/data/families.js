import {householdObservation} from '../ui/model.js';
const surnames=['Okafor','Rivera','Chen','Patel','Brooks','Mensah','Sato','Hassan','Silva','Kim','Reed','Singh'];
export function familyIdentity(seed,id){
  let hash=2166136261;for(const c of `family.v1:${seed}:${id}`)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return {name:`The ${surnames[hash%surnames.length]} family`,hue:hash%360,hair:(hash>>>8)%3,smile:(hash>>>12)%2};
}
const unique=(rows,id)=>{const matches=(rows??[]).filter(r=>r.id===id);return matches.length===1?matches[0]:null;};
export function familyRecord(snapshot,id){
  const state=snapshot?.state,h=unique(state?.households,id),observation=householdObservation(h,state?.units);
  const unit=observation.unitId?unique(state?.units,observation.unitId):null;
  const building=unit?.buildingId?unique(state?.buildings,unit.buildingId):null;
  return {household:h,unit,building,observation};
}
/** Maximum absolute matched monthly burden difference; missing pairs rank last. */
export function rankFamilies(history){
  const ids=[...new Set(['baseline','plan'].flatMap(arm=>(history?.[arm]??[]).flatMap(s=>s?.state?.households?.map(h=>h.id)??[])))];
  return ids.map(id=>{let difference=null;for(const a of history.baseline??[]){const b=history.plan?.find(s=>s?.month===a?.month);const x=familyRecord(a,id).observation.burden,y=familyRecord(b,id).observation.burden;if(x!==null&&y!==null)difference=Math.max(difference??0,Math.abs(y-x));}return {id,difference};}).sort((a,b)=>(b.difference??-1)-(a.difference??-1)||a.id.localeCompare(b.id));
}
