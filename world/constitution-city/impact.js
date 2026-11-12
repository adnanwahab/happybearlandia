/** Adapt the selected, same-time package replay to the shared impact view.
 * State changes belong to the full evaluated package, not the inspected clause.
 * IDs here are synthetic city IDs used by the city view, never live residents.
 */
export function studioImpactState({plan,selected,analysis,scenarioId,scenario}={}){
 const state=selected?.state,baseline=selected?.baselineState;
 const clauses=plan.clauses.filter(clause=>(scenario?.clauseIds||[]).includes(clause.id));
 const profiles={
  h_lots:{benefit:'Residents seeking housing may gain more options if permitted projects are delivered.',cost:'Builders and public services may face financing and infrastructure demands; parking and neighborhood effects need separate assessment.',timing:'Entitlements can change before construction completes.'},
  f_drainage:{benefit:'Residents in affected modeled districts may gain flood protection if drainage projects reach operation.',cost:'Public funders and project teams may face capital, maintenance and construction demands.',timing:'Drainage benefits depend on project stage, delivery and operation.'},
  t_brt:{benefit:'Transit riders may gain access or service when the included transport changes become operational.',cost:'Operators and public funders may face vehicle, staffing and infrastructure demands.',timing:'Transport capacity and realized journeys can change at different times.'}
 };
 const includedProfiles=clauses.map(c=>profiles[c.id]).filter(Boolean);
 const impactProfile=includedProfiles.length?Object.fromEntries(['benefit','cost','timing'].map(key=>[key,includedProfiles.map(profile=>profile[key]).join(' ')])):undefined;
 const law={impactProfile,id:`package:${scenarioId||'pending'}`,text:state?`Full evaluated package: ${scenario?.label||scenarioId}. These differences are not isolated effects of the inspected clause.`:'Evaluate a package to inspect matched household and institution changes.',institutions:clauses.map(c=>c.authority).filter(Boolean),scope:{buildingKinds:[]},limitations:['The selected scenario can include multiple clauses. Distribution and place records describe the complete package at the selected seed and month.']};
 const buildings=(state?.buildings||[]).map(b=>({id:b.id,name:b.name||`Building ${b.sourceId||b.id}`,kind:b.kind||'home'}));
 if(!state||!baseline||!analysis)return{law,result:null,buildings};
 const records=[];
 const changed=key=>(analysis.changes?.[key]||[]).filter(row=>row.status!=='unchanged');
 const allBuildings=[...(baseline.buildings||[]),...(state.buildings||[])],units=[...(baseline.units||[]),...(state.units||[])];
 for(const building of buildings){const b=allBuildings.find(row=>row.id===building.id),changes=[];
  for(const row of changed('buildings').filter(row=>row.id===building.id))changes.push({kind:'building-state',changedFields:row.changedFields});
  for(const row of changed('parcels').filter(row=>row.id===b?.parcelId))changes.push({kind:'synthetic-parcel-proxy',changedFields:row.changedFields});
  for(const row of changed('units').filter(row=>units.some(unit=>unit.id===row.id&&unit.buildingId===building.id)))changes.push({kind:'synthetic-unit-state',changedFields:row.changedFields});
  if(changes.length)records.push({buildingId:building.id,changes});
 }
 return{law,buildings,result:{status:'completed',supported:true,comparable:analysis.comparison?.comparable===true,analysis,scorecard:analysis.scorecard,manifest:{months:state.month,seed:state.seed},visual:{recordedBuildingIds:records.map(row=>row.buildingId),records},limitations:analysis.limitations}};
}
