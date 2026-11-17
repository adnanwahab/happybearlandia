import {clamp, VERSION, housingProjectBuildingId} from './contracts.js';

// These monthly proxies are assumptions, not daily Population activities.
export const CITY_RULES = Object.freeze(Object.fromEntries([
  ...['environment','governance','utilities','development','construction','transport','businesses','jobs','housing','services','demographics','finance'],
  'residents',
].map(system => [system, {id:`city.${system}`, version:VERSION, evidenceType:'synthetic-assumption', source:'world/city/README.md'}])));

export function initializeResidents(state) {
  state.residents ??= [];
  for (const worker of state.workers) {
    if (state.residents.some(r => r.workerId === worker.id)) continue;
    state.residents.push({id:`resident-${worker.id}`, workerId:worker.id, householdId:worker.householdId,
      sinceMonth:state.month, status:'active', jobId:worker.jobId, routine:'home',
      needs:{housing:100, livelihood:100, social:50}, relationships:[],
      goals:[{id:'secure-home', achieved:false},{id:'secure-work', achieved:false}], memories:[]});
  }
}

export function advanceResidents(old, state, context) {
  initializeResidents(state);
  for (const resident of state.residents) {
    const household=state.households.find(h=>h.id===resident.householdId);
    const worker=state.workers.find(w=>w.id===resident.workerId);
    const before={status:resident.status,jobId:resident.jobId,routine:resident.routine,needs:structuredClone(resident.needs)};
    resident.status=household&&worker?'active':'departed';
    resident.jobId=worker?.jobId??null;
    resident.routine=resident.status==='departed'?'outside-city':resident.jobId?'home-work-home':'home-job-search';
    resident.needs.housing=household?.unitId?100:0;
    resident.needs.livelihood=household?clamp(100*(1-(household.housingBurden??0)),0,100):0;
    // One stable social tie to another modeled resident in the district.
    const peer=state.residents.find(r=>r.id!==resident.id&&state.households.some(h=>h.id===r.householdId&&h.districtId===household?.districtId));
    if (resident.status==='active'&&peer) {
      let tie=resident.relationships.find(r=>r.residentId===peer.id);
      if(!tie)resident.relationships.push(tie={residentId:peer.id,strength:0});
      tie.strength=clamp(tie.strength+1,0,100);
      resident.needs.social=clamp(resident.needs.social+1,0,100);
    }
    resident.goals[0].achieved=!!household?.unitId;
    resident.goals[1].achieved=!!resident.jobId;
    const event=context.event('residents','RESIDENT_MONTH',household?.districtId??null,{
      residentId:resident.id, householdId:resident.householdId, before,
      after:{status:resident.status,jobId:resident.jobId,routine:resident.routine,needs:structuredClone(resident.needs)},
      inputs:{unitId:household?.unitId??null,housingBurden:household?.housingBurden??null,workerId:resident.workerId},
      contextEventIds:context.events.filter(e=>e.system!=='residents'&&e.geographyId===household?.districtId).map(e=>e.id),
    });
    resident.memories.push({month:state.month,eventId:event.id,ruleId:CITY_RULES.residents.id});
  }
}

export function logBuildingChanges(old, state, context) {
  const before=new Map(old.buildings.map(b=>[b.id,b]));
  const after=new Map(state.buildings.map(b=>[b.id,b]));
  for(const id of new Set([...before.keys(),...after.keys()])) {
    if(JSON.stringify(before.get(id))===JSON.stringify(after.get(id)))continue;
    const building=after.get(id)??before.get(id);
    const causes=context.events.filter(e=>e.system==='construction'&&e.eventType==='PROJECT_COMPLETE'&&housingProjectBuildingId(e.payload.projectId)===id);
    if(!causes.length)throw new Error(`Building change without construction cause: ${id}`);
    context.event('construction','BUILDING_CHANGED',building.districtId,{buildingId:id,before:before.get(id)??null,after:after.get(id)??null,causes:causes.map(e=>e.id)});
  }
}
