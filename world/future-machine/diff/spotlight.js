import {housingProjectBuildingId} from '../../city/contracts.js';

/** Curated construction milestones backed by exact City event/project joins.
 * Other differences remain in the existing inspector; no causal links are inferred.
 */
export function buildSpotlight(history, diffs = []) {
  if (!history || !diffs.length) return {status:'unavailable',stops:[]};
  const frames = Object.fromEntries(['baseline','plan'].map(arm => [arm,new Map((history[arm] || []).map(s => [s.month,s]))]));
  const seen = new Set(), stops = [];
  const types = new Set(['PROJECT_FINANCED','CONSTRUCTION_STARTED','PROJECT_COMPLETE']);
  for (const diff of [...diffs].sort((a,b) => a.month-b.month)) {
    if (!diff.available) continue;
    for (const arm of ['baseline','plan']) {
      const snapshot = frames[arm].get(diff.month);
      for (const event of [...(snapshot?.events || [])].sort((a,b) => String(a.id).localeCompare(String(b.id)))) {
        if (!types.has(event.eventType) || typeof event.id !== 'string' || !event.id || event.simulationTime !== diff.month) continue;
        const projectId = event.payload?.projectId;
        const project = snapshot.state?.projects?.find(p => p.id === projectId && p.type === 'housing');
        if (!project) continue;
        const buildingId = housingProjectBuildingId(projectId);
        const collection = event.eventType === 'PROJECT_COMPLETE' ? 'buildings' : 'projects';
        const id = collection === 'buildings' ? buildingId : projectId;
        if (!snapshot.state[collection]?.some(row => row.id === id) || !diff.entities?.some(row => row.collection === collection && row.id === id)) continue;
        // IDs are scoped to a run arm; repeated copies of a receipt never add stops.
        const key = `${arm}:${event.id}`, milestone = `${arm}:${projectId}:${event.eventType}`;
        if (seen.has(key) || seen.has(milestone)) continue;
        seen.add(key);seen.add(milestone);
        stops.push({month:diff.month,eventId:event.id,entity:{collection,id,arm},title:`${event.eventType} · ${arm} · ${id}`,summary:`Recorded event ${event.id} · Month ${diff.month}. Synthetic City model result; related evidence does not establish aggregate causality.`,evidence:[{future:arm,eventId:event.id,month:diff.month,type:event.eventType,payload:structuredClone(event.payload),modelVersion:event.modelVersion,entity:{collection,id},relationship:collection === 'buildings' ? 'City housingProjectBuildingId(project.id)' : 'Exact event payload.projectId'}]});
      }
    }
  }
  return {status:stops.length?'ready':diffs.some(d => !d.available)?'unavailable':diffs.some(d => d.changedCount)?'unsupported':'empty',stops};
}
