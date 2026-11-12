import {housingProjectBuildingId} from '../city/contracts.js';
/** Only housing inventory has an explicit model-owned event → building join. */
export function metricChangeStops(history, diff, metricKey) {
  if(metricKey!=='housingUnits' || !diff?.available || !Number.isFinite(diff.metrics?.housingUnits?.delta) || diff.metrics.housingUnits.delta===0)return [];
  return (diff.entities||[]).filter(row=>row.collection==='buildings').flatMap(row=>
    constructionReceipts(history,{collection:row.collection,id:row.id},diff.month).map(receipt=>({
      month:receipt.month,entity:{collection:row.collection,id:row.id,arm:receipt.future},
      title:`Recorded housing completion · ${receipt.future} · ${row.id} · event ${receipt.eventId}`,
      summary:'Exact City construction relationship; this related record does not establish the cause of the aggregate A/B delta.',
      evidence:[receipt],
    })));
}
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
