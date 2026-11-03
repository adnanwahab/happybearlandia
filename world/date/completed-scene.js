import {replayDateMoment} from '../house/date-replay.js';
/** Recorded coordinates and identities only; this never recreates an active outing. */
export function completedDateScene(dates,{dateId,people=[]}={}){
 const archive=dates?.history?.find(row=>row.id===dateId);if(!archive)return null;
 const record=dates.memories?.records?.find(row=>row.id===archive.id);let frame=null;
 if(record?.frames?.length)try{frame=replayDateMoment(record);}catch{}
 const positions=frame?Object.fromEntries(frame.people.map(p=>[p.id,{x:p.x,z:p.z}])):archive.worldPositions??archive.world?.positions;
 const ids=archive.personIds??[];if(ids.length!==2||!positions||ids.some(id=>!Number.isFinite(positions[id]?.x)||!Number.isFinite(positions[id]?.z)))return null;
 const actors=ids.map(id=>{const appearance=people.find(p=>(p.id??p.personId)===id)??{},recorded=frame?.people.find(p=>p.id===id),name=record?.people?.find(p=>p.id===id)?.name??appearance.name??id;return{id,name,skinColor:appearance.skinColor,hairColor:appearance.hairColor,shirtColor:appearance.shirtColor,...(recorded??{}),x:positions[id].x,z:positions[id].z,datePosition:positions[id]};});
 return{date:{...archive,personIds:[...ids],phase:'history',localPositions:positions,people:actors,travel:null,localMovement:null},people:actors,minute:frame?.minute??archive.endedMinute,source:frame?'Last recorded date frame':'Archived date positions',readOnly:true,paused:true,loadRecordedContext:true,sceneHosts:[]};
}
