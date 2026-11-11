import {housingProjectBuildingId} from '../../city/contracts.js';
import {assertMonth} from '../contracts.js';

/** Recorded relationships only. Edges are not independent causal verification.
 * Nodes carry first observed month (not inferred creation time), arm-scoped IDs,
 * cloned evidence and unavailableReason. Null month means no supported jump.
 * The housing-units node groups exact record.ids under their building selection;
 * it never treats a building ID as a unit ID. No DOM or simulation is invoked.
 */
export function buildEvidenceTrail(history,{collection,id,month}={}) {
  assertMonth(month);
  if(typeof id!=='string'||!id||typeof collection!=='string')throw new TypeError('Exact City collection and ID required');
  const result={schemaVersion:'future-machine-evidence-trail.v1',selection:{collection,id,month},
    experimentId:history?.experimentId??null,seed:history?.seed??null,modelVersion:history?.modelVersion??null,nodes:[],edges:[],
    limitations:['Recorded monthly City relationships, not empirical causal certainty.','Synthetic inventory; no inferred parcel, geography or cross-model identity.']};
  const copy=value=>structuredClone(value);
  function node(arm,type,at,entity,record,reason=null,eventId=null){
    const row={id:`${arm}:${type}:${entity?.id??id}:${at??'unavailable'}`,arm,type,month:at,eventId,
      experimentId:result.experimentId,seed:result.seed,modelVersion:result.modelVersion,
      entity:entity??null,status:reason?'unavailable':'recorded',unavailableReason:reason,record:record?copy(record):null};
    result.nodes.push(row);return row;
  }
  function edge(from,to,relationship,reason=null){result.edges.push({id:`${from.id}->${to.id}:${relationship}`,from:from.id,to:to.id,arm:to.arm,month:to.month,eventId:to.eventId,
    relationship,status:reason?'unavailable':'recorded',unavailableReason:reason,causalClaim:false});}
  for(const arm of ['baseline','plan']){
    const snapshots=(history?.[arm]??[]).filter(s=>s&&Number.isInteger(s.month)&&s.month<=month).sort((a,b)=>a.month-b.month);
    if(new Set(snapshots.map(s=>s.month)).size!==snapshots.length)throw new Error('Duplicate evidence month');
    const selected=snapshots.find(s=>s.month===month);
    if(collection!=='buildings'){node(arm,'selection',null,{collection,id},null,'Evidence trail supports monthly City housing buildings only.');continue;}
    if(!selected||selected.state?.month!==month){node(arm,'building',null,{collection,id},null,'Selected monthly snapshot unavailable.');continue;}
    const buildings=selected.state.buildings;
    if(!Array.isArray(buildings)){node(arm,'building',null,{collection,id},null,'Building inventory unavailable.');continue;}
    const building=buildings.find(b=>b.id===id);
    if(!building){node(arm,'building',month,{collection,id},null,'Building is absent at the selected recorded month.');continue;}
    const first=snapshots.find(s=>s.state?.month===s.month&&s.state.buildings?.some(b=>b.id===id));
    const buildingNode=node(arm,'building',first.month,{collection,id},first.state.buildings.find(b=>b.id===id));
    const candidates=snapshots.flatMap(s=>(s.state?.month===s.month?s.state.projects??[]:[]).filter(p=>p.type==='housing'&&housingProjectBuildingId(p.id)===id).map(p=>({snapshot:s,project:p})));
    const projectIds=new Set(candidates.map(c=>c.project.id));
    if(projectIds.size!==1){const missing=node(arm,'project',null,null,null,'No unambiguous recorded housing project maps to this building.');edge(missing,buildingNode,'housingProjectBuildingId(project.id)',missing.unavailableReason);continue;}
    const {snapshot:projectSnapshot,project}=candidates[0];
    const projectNode=node(arm,'project',projectSnapshot.month,{collection:'projects',id:project.id},project);
    let policyNode;
    const policyMatch=typeof project.policyId==='string'?snapshots.flatMap(s=>(s.state?.month===s.month?s.state.policies??[]:[]).filter(p=>p.id===project.policyId).map(p=>({snapshot:s,policy:p})))[0]:null;
    if(policyMatch)policyNode=node(arm,'policy',policyMatch.snapshot.month,{collection:'policies',id:policyMatch.policy.id},policyMatch.policy);
    else policyNode=node(arm,'policy',null,null,null,'Project has no available exact recorded policy reference.');
    edge(policyNode,projectNode,'project.policyId = policy.id',policyMatch?null:policyNode.unavailableReason);
    const completions=snapshots.flatMap(s=>(s.events??[]).filter(e=>e.eventType==='PROJECT_COMPLETE'&&e.system==='construction'&&e.payload?.projectId===project.id&&e.payload.type==='housing'&&e.simulationTime===s.month&&e.modelVersion===s.state?.version&&s.state?.month===s.month&&s.state.projects?.some(p=>p.id===project.id&&p.stage==='completion')&&s.state.buildings?.some(b=>b.id===id)).map(event=>({snapshot:s,event})));
    if(completions.length!==1){const missing=node(arm,'completion',null,null,null,'Exactly one matching recorded completion event is unavailable.');edge(projectNode,missing,'event.payload.projectId = project.id',missing.unavailableReason);continue;}
    const {snapshot:completed,event}=completions[0];
    const completionNode=node(arm,'completion',completed.month,{collection:'projects',id:project.id},event,null,event.id);
    edge(projectNode,completionNode,'event.payload.projectId = project.id');
    edge(completionNode,buildingNode,'City construction housingProjectBuildingId(project.id)');
    const units=completed.state.units?.filter(u=>u.buildingId===id);
    const unitsValid=Array.isArray(units)&&Number.isInteger(event.payload.units)&&units.length===event.payload.units&&units.every(u=>typeof u.id==='string'&&u.id)&&new Set(units.map(u=>u.id)).size===units.length;
    const unitsNode=node(arm,'housing-units',completed.month,{collection:'buildings',id},unitsValid?{count:units.length,unit:'homes',ids:units.map(u=>u.id).sort(),buildingId:id}:null,unitsValid?null:'Completion unit inventory is missing, ambiguous or differs from the event count.',event.id);
    edge(completionNode,unitsNode,'recorded units.buildingId = building.id',unitsValid?null:unitsNode.unavailableReason);
    edge(policyNode,completionNode,'independent causal dependency trace','The API replay does not supply an independently verified causal dependency trace.');
  }
  return result;
}
