import {lawPotentialScope} from './world-layer.js';

// These are conditional policy questions, never estimated effects or fiscal scores.
const PROFILES={
 'Time & work':{benefit:'Workers and families may gain more control over time, leave or job transitions.',cost:'Employers and administrators may face staffing, payroll and compliance demands.',timing:'Changes depend on eligibility, schedules, requests and implementation; an allowance need not be used.'},
 'Housing & places':{benefit:'Residents and prospective residents may gain housing options or access to neighborhood services.',cost:'Builders, housing agencies and neighbors may face financing, infrastructure and land-use tradeoffs.',timing:'Permissions can change before any homes are built. Financing, permits and construction can delay outcomes.'},
 'Health':{benefit:'Patients and caregivers may gain access to care or relief from out-of-pocket costs.',cost:'Providers, insurers and public funders may face staffing, reimbursement and funding demands.',timing:'Coverage changes and new clinical capacity have different implementation schedules.'},
 'Kids, youth & tech':{benefit:'Children, parents and caregivers may gain safer routines, care or youth opportunities.',cost:'Schools, care providers, employers and platforms may need staff, funding or new operating rules.',timing:'School calendars, provider capacity and enforcement determine when changes reach families.'},
 'Money & economic security':{benefit:'Eligible households may gain savings, income security or lower consumer charges.',cost:'Funders, employers and financial providers may face program costs or changes in revenue.',timing:'Enrollment and payment schedules affect when households receive support.'},
 'Education & learning':{benefit:'Students and adult learners may gain access to learning or training.',cost:'Schools, colleges, instructors and funders may need staff, places and sustained budgets.',timing:'Hiring and school terms can delay access; learning outcomes may take longer to assess.'},
 'Government & trust':{benefit:'Residents may gain easier access to services or greater participation and accountability.',cost:'Public agencies may need implementation funding, staff training and oversight.',timing:'Administrative systems and institutional rules require implementation before outcomes can be assessed.'},
 'Nature, transport & environment':{benefit:'Travelers and nearby residents may gain access, comfort or environmental protection.',cost:'Transport operators, utilities, public funders and nearby users may face operating or construction demands.',timing:'Service changes may precede infrastructure delivery; staffing, procurement and construction constrain timing.'},
 'Meaning, culture & civic life':{benefit:'Residents and community groups may gain access to civic and cultural opportunities.',cost:'Organizers, cultural institutions and public funders may need staff, venues and ongoing funding.',timing:'Programming and participation must occur before community outcomes can be assessed.'}
};
const SPECIFIC={
 22:{benefit:'Builders may avoid the cost of mandated parking; residents may gain housing options if projects become feasible.',cost:'Parking availability, curb demand and travel choices may change. The model does not measure those tradeoffs.',timing:'The reviewed proxy changes construction-cost inputs first. Built housing depends on later financing and construction.'},
 83:{benefit:'Bus riders may gain shorter waits and more travel options when additional service is delivered.',cost:'Operators and funders may need more drivers, vehicles and operating funds. These direct costs are not estimated.',timing:'The service index changes first; realized waits and travel depend on demand, mode choice and shared capacity.'}
};
const finite=Number.isFinite;
export function impactPlaces(law,result,buildings=[]){
 if(!law)return[];
 const recordedAllowed=result?.supported!==false&&result?.comparable!==false&&result?.analysis?.comparison?.comparable!==false&&(!result?.law?.id||result.law.id===law.id)&&(!result?.status||result.status==='completed');
 const scope=lawPotentialScope(law),recorded=new Set((recordedAllowed?result?.visual?.recordedBuildingIds||[]:[]).map(String));
 return buildings.filter(b=>recorded.has(String(b.id))||[b.kind,b.institutionType,b.amenity,b.tags?.amenity,b.tags?.building,b.shop].some(kind=>scope.buildingKinds.includes(kind))).map(b=>({id:String(b.id),name:b.name||`${b.kind||'Institution'} · ${b.id}`,kind:b.kind||'institution',recorded:recorded.has(String(b.id))}));
}
export function buildLawImpact({law,result=null,building=null}={}){
 if(!law)return null;
 const completed=(!result?.law?.id||result.law.id===law.id)&&result?.status==='completed'&&result?.supported!==false&&result?.comparable!==false&&result?.analysis?.comparison?.comparable!==false;
 const profile=law.impactProfile||SPECIFIC[law.number]||PROFILES[law.category]||{benefit:'The intended recipients may benefit if the proposal is implemented.',cost:'Implementation and funding requirements need assessment.',timing:'Implementation timing is unavailable.'};
 const manifest=result?.manifest,local=(result?.visual?.records||[]).find(row=>building&&String(row.buildingId)===String(building.id));
 const distribution=completed?result?.analysis?.distribution:null;
 const groups=distribution?['winners','losers','mixed','unchanged','unmatched','unavailable'].map(id=>({id,label:({winners:'Better financial signals',losers:'Worse financial signals',mixed:'Mixed financial signals',unchanged:'Unchanged',unmatched:'Unmatched',unavailable:'Unavailable'})[id],count:Array.isArray(distribution[id])?distribution[id].length:null})):[];
 const metrics=completed?(result.scorecard||[]).filter(row=>finite(row.baseline)&&finite(row.current??row.selected)&&finite(row.delta)).map(row=>({id:row.id,label:row.label||row.id,baseline:row.baseline,selected:row.current??row.selected,delta:row.delta,unit:row.unit||''})):[];
 const horizon=manifest?.months!==undefined?`${manifest.months} modeled months`:manifest?.minutes!==undefined?`${manifest.minutes.toLocaleString()} modeled minutes`:null;
 return{lawId:law.id,title:law.text,completed,profile,groups,metrics,horizon,seed:manifest?.seed,
  institutions:law.institutions||[],
  timing:completed?`Comparison endpoint: ${horizon||'recorded endpoint'}. This does not identify when a benefit first occurred.`:'Run a comparison to inspect its recorded horizon. No onset date is estimated.',
  distributionNote:distribution?.rule||'No matched household distribution is available. Aggregate results do not identify who benefits or who pays.',
  place:building?{id:String(building.id),name:building.name||String(building.id),recorded:completed&&Boolean(local),changes:completed&&local?(local.changes||[]).map(change=>`${change.kind}: ${(change.changedFields||[]).join(', ')}`):[],occupancy:completed&&local&&finite(local.baseline)&&finite(local.selected)?{baseline:local.baseline,selected:local.selected}:null}:null,
  unknowns:[...new Set(['Direct legislative and administrative costs, tax incidence and a complete fiscal cost-benefit balance are unavailable.','Household financial signals are not a welfare score. Health, fairness and real-resident outcomes cannot be inferred from them.',...(law.limitations||[]),...(result?.limitations||[])])]
 };
}

export function mountLawImpact(container,{onSelectPlace,showMetrics=true}={}){
 const doc=container.ownerDocument,sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./impact.css',import.meta.url).href;doc.head.append(sheet);const root=doc.createElement('section');root.className='law-impact';root.dataset.testid='law-impact';root.hidden=true;root.setAttribute('aria-label','Who benefits—and who pays?');container.append(root);
 let state={},selectedId=null;
 const el=(tag,text,parent=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const fmt=value=>value.toLocaleString(undefined,{maximumFractionDigits:3});
 function render(){
  const restoreFocus=root.contains(doc.activeElement)&&doc.activeElement.tagName==='SELECT';
  const places=impactPlaces(state.law,state.result,state.buildings),building=places.find(row=>row.id===selectedId),report=buildLawImpact({...state,building});
  root.replaceChildren();root.hidden=!report;if(!report)return;
  el('h2','Who benefits—and who pays?');el('p',report.title);el('p',report.completed?'Recorded model comparison + possible policy tradeoffs':'Policy questions · no completed comparison');
  const grid=el('div');grid.className='law-impact-grid';
  for(const [title,value]of [['Who could benefit?',report.profile.benefit],['Who could face costs?',report.profile.cost],['When could it happen?',report.profile.timing]]){const card=el('div',undefined,grid);el('h3',title,card);el('p',value,card);}
  el('p','These are conditional considerations, not measured benefits or cost estimates.');
  const actual=el('details');actual.open=true;el('summary','What this comparison actually shows',actual);el('p',report.timing+(report.seed!==undefined?` Paired seed: ${report.seed}.`:''),actual);
  if(report.groups.length){const counts=el('div',undefined,actual);counts.className='law-impact-counts';for(const group of report.groups)el('p',`${group.label}: ${group.count??'unavailable'} households`,counts);}
  el('p',report.distributionNote,actual);
  const treasury=report.metrics.find(row=>row.id==='balance');if(treasury)el('p',`Recorded treasury balance change: ${fmt(treasury.delta)} ${treasury.unit}. This stock difference is not a complete implementation cost.`,actual);
  if(showMetrics&&report.metrics.length){const measurements=el('details',undefined,actual);el('summary',`Recorded metrics (${report.metrics.length})`,measurements);const table=el('table',undefined,measurements);table.setAttribute('aria-label','Recorded impact metrics');const head=el('thead',undefined,table),tr=el('tr',undefined,head);for(const title of ['Metric','Without law','With law','Change'])el('th',title,tr);const body=el('tbody',undefined,table);for(const metric of report.metrics){const row=el('tr',undefined,body);for(const value of [metric.label+(metric.unit?` (${metric.unit})`:''),fmt(metric.baseline),fmt(metric.selected),fmt(metric.delta)])el('td',value,row);}}
  const label=el('label','Inspect an institution'),select=el('select',undefined,label);select.setAttribute('aria-label','Inspect an institution');const option=el('option','Choose a highlighted place',select);option.value='';for(const place of places){const opt=el('option',`${place.name} · ${place.recorded?'modeled change':'relevant scope'}`,select);opt.value=place.id;}select.value=building?.id||'';
  select.addEventListener('change',()=>{selectedId=select.value;render();if(selectedId)onSelectPlace?.(selectedId);});
  if(!places.length)el('p','No matching institution or recorded building change is available for this selection.');
  if(report.place){const box=el('div');box.className='law-impact-place';box.dataset.testid='law-impact-place';el('h3',report.place.name,box);el('p',report.place.recorded?'This map anchor has a recorded synthetic model change.':'Relevant institution only. No local outcome has been recorded for this place.',box);for(const change of report.place.changes)el('p',change,box);if(report.place.occupancy)el('p',`Synthetic occupancy: ${report.place.occupancy.baseline} without → ${report.place.occupancy.selected} with.`,box);el('p','Household counts and aggregate metrics above describe the whole modeled comparison. They are not assigned to residents of this building.',box);}
  const unknown=el('details');el('summary','What remains unknown',unknown);const notes=el('ul',undefined,unknown);for(const note of report.unknowns)el('li',note,notes);
  if(restoreFocus)select.focus({preventScroll:true});
 }
 return{update(next){state=next;if(!impactPlaces(state.law,state.result,state.buildings).some(row=>row.id===selectedId))selectedId=null;render();},selectPlace(id){if(!impactPlaces(state.law,state.result,state.buildings).some(row=>row.id===String(id)))return false;selectedId=String(id);render();return true;},destroy(){root.remove();sheet.remove();}};
}
