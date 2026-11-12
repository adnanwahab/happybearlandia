import {createPopulationModel, stepPopulation} from '../population/model.js';

import {PROJECTS,COMPARISON_CONFIG,validateProject} from './catalog.js';
export {PROJECTS,COMPARISON_CONFIG,validateProject} from './catalog.js';

// Apply only AFTER generation: adding an anchor before generation would change
// household locations and confound the paired comparison.
export function applyProject(model, project) {
  let district=0;
  model.districts.forEach((d,i)=>{if(Math.hypot(d.x-project.x,d.z-project.z)<Math.hypot(model.districts[district].x-project.x,model.districts[district].z-project.z))district=i;});
  const d=model.districts[district];
  if(project.kind==='housing') { d.housingUnits+=40; d.rent*=.95; }
  if(project.kind==='transit')d.transit=Math.min(1,d.transit+.2);
  if(project.kind==='park'||project.kind==='grocery') {
    const location=model.locations.length;
    model.locations.push({id:'what-if-addition',x:project.x,z:project.z,kind:project.kind==='park'?'park':'shop'});
    d.anchors.push([project.x,project.z]);d.anchorLocations.push(location);
    if(project.kind==='park'){model.parkLocations[district].push(location);d.environment=Math.min(1,d.environment+.15);}
    else d.services=Math.min(1,d.services+.15);
  }
  return d.id;
}

// Diagnostic, not a promise of service: fraction of the two daily destinations
// (grocery + park) within a 10-minute straight-line walk at 2.4 km/h.
export function dailyAccess(model, i) {
  const p=model.people;
  return ['shop','park'].reduce((sum,kind)=>sum+Number(model.locations.some(l=>l.kind===kind&&Math.hypot(l.x-p.homeX[i],l.z-p.homeZ[i])<=400)),0)/2;
}
function observations(model) {return {sum:new Float64Array(model.people.age.length),count:new Uint32Array(model.people.age.length)};}
function observe(model, record) {
  // Drain actual departure events rather than polling a person's last trip:
  // short trips completed inside a fixed step are included too.
  if(model.activityHistory.retention.droppedEventRecords)throw Error('Comparison event budget exceeded; no incomplete commute result was published.');
  for(const event of model.activityHistory.recentEvents)if(event.type==='TRIP_STARTED'&&event.activity==='WORK'){
    const i=Number(event.personId.slice(`${model.prefix}-p`.length));
    if(Number.isInteger(i)&&i>=0&&i<record.sum.length&&Number.isFinite(event.plannedMinutes)){record.sum[i]+=event.plannedMinutes;record.count[i]++;}
  }
  model.activityHistory.recentEvents.length=0;
}
function outcome(model, record) {
  const p=model.people,hh=model.households;
  const residents=Array.from({length:p.age.length},(_,i)=>({id:`${model.prefix}-p${i}`,x:p.homeX[i],z:p.homeZ[i],districtId:model.districts[p.home[i]].id,district:model.districts[p.home[i]].label,commute:record.count[i]?record.sum[i]/record.count[i]:null,burden:hh.rent[p.household[i]]*12/Math.max(1,hh.income[p.household[i]]),access:dailyAccess(model,i)}));
  const trips=record.count.reduce((sum,n)=>sum+n,0);
  return {commute:trips?record.sum.reduce((sum,n)=>sum+n,0)/trips:null,commuteTrips:trips,burden:model.metrics.meanHousingBurden,access:residents.reduce((sum,r)=>sum+r.access,0)/residents.length,residents};
}
export async function compareNeighborhood({context,project,config=COMPARISON_CONFIG}, {onProgress=()=>{},yieldControl=()=>Promise.resolve(),isCancelled=()=>false}={}) {
  project=validateProject(project,context);
  if(!Number.isInteger(config.population)||config.population<1||config.population>500||!Number.isInteger(config.seed)||config.seed<0||config.seed>4294967295)throw Error('Use 1–500 synthetic people and a uint32 seed.');
  // Fresh, equal origins and demographics, with no live-run commands or weather.
  const options={...config,representedPopulation:0,maxLogEntries:2000},world={...structuredClone(context),journalsEnabled:false};
  const baseline=createPopulationModel(options,world),changed=createPopulationModel(options,world);
  const initialHomes=Array.from(baseline.people.homeX, (x,i)=>({x,z:baseline.people.homeZ[i]}));
  const districtId=applyProject(changed,project),records=[observations(baseline),observations(changed)];
  for(let tick=0;tick<96;tick++) {
    if(isCancelled())throw Error('Comparison cancelled.');
    stepPopulation(baseline,{minutes:15});observe(baseline,records[0]);
    stepPopulation(changed,{minutes:15});observe(changed,records[1]);
    if(tick%4===3){onProgress({completed:tick+1,total:96});await yieldControl();}
  }
  const before=outcome(baseline,records[0]),after=outcome(changed,records[1]);
  const residents=before.residents.map((b,i)=>{const a=after.residents[i];return {id:b.id,home:initialHomes[i],before:b,after:a,delta:{commute:b.commute===null||a.commute===null?null:a.commute-b.commute,burden:a.burden-b.burden,access:a.access-b.access}};});
  delete before.residents;delete after.residents;
  return {version:'neighborhood-what-if.v1',modelVersion:baseline.modelVersion,project,districtId,seed:config.seed,population:config.population,minutes:1440,before,after,residents,assumption:PROJECTS[project.kind].assumption};
}
