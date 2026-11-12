import {housingProjectBuildingId} from '../city/contracts.js';
/** Exact model-owned building/project mapping, never a spatial or cross-model join. */
export function constructionReceipts(history,{collection,id},throughMonth) {
  if(collection!=='buildings')return [];
  const receipts=[];
  for(const arm of ['baseline','plan'])for(const snapshot of history?.[arm]||[]) {
    if(snapshot.month>throughMonth)continue;
    const project=snapshot.state?.projects?.find(p=>p.type==='housing'&&housingProjectBuildingId(p.id)===id);
    if(!project||!snapshot.state.buildings.some(b=>b.id===id))continue;
    for(const event of snapshot.events||[])if(event.eventType==='PROJECT_COMPLETE'&&event.payload?.projectId===project.id)receipts.push({future:arm,eventId:event.id,month:event.simulationTime,type:event.eventType,modelVersion:event.modelVersion,entity:{collection,id},payload:structuredClone(event.payload),policyId:project.policyId,relationship:'City construction housingProjectBuildingId(project.id)',rule:'world/city/systems.js: construction completion adds ceil(units/10) floors and the recorded housing units.'});
  }
  return receipts;
}
