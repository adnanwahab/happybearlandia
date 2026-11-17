import {VERSION,housingProjectBuildingId} from '../../city/contracts.js';

/** Rendering preview of an observed next-month completion, never current inventory. */
export function constructionGhosts(history, month, mapping) {
  const result={baseline:[],plan:[]};
  for(const arm of ['baseline','plan']) {
    const before=history?.[arm]?.find(s=>s.month===month);
    const after=history?.[arm]?.find(s=>s.month===month+1);
    if(before?.state?.version!==VERSION||after?.state?.version!==VERSION||before.state.month!==month||after.state.month!==month+1)continue;
    const seen=new Set();
    for(const event of after.events||[]) {
      if(event.modelVersion!==VERSION||event.eventType!=='PROJECT_COMPLETE'||event.simulationTime!==after.month||typeof event.id!=='string'||!event.id)continue;
      const project=after.state.projects.find(p=>p.type==='housing'&&p.id===event.payload?.projectId);
      if(!project?.policyId)continue;
      const id=housingProjectBuildingId(project.id);
      if(seen.has(id)||before.state.buildings.some(b=>b.id===id)||!after.state.buildings.some(b=>b.id===id))continue;
      const row=mapping.frame(after.state,after.state).a.find(r=>r.collection==='buildings'&&r.id===id);
      if(!row)continue;
      seen.add(id);
      result[arm].push({...row,arm,ghost:true,eventId:event.id,eventMonth:after.month,projectId:project.id,policyId:project.policyId});
    }
  }
  return result;
}
