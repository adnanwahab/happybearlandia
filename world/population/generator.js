import { normalizePopulationConfig, hash, draw, clamp } from "./contracts.js";

export function deriveDistricts(config,context={}) {
  if(Array.isArray(context.districts)&&context.districts.length){
    if(context.districts.length>32)throw new Error("At most32 districts supported.");
    return context.districts.map((d,i)=>{if(!d.id||![d.x,d.z].every(Number.isFinite))throw new Error("Districts require id and actual numeric x/z coordinates.");return district(d,i,config,context.districts.length);});
  }
  const buildings=(context.buildings||context.town?.buildings||[]).filter(b=>Array.isArray(b.center)&&b.center.length===2&&b.center.every(Number.isFinite));
  if(!buildings.length)return[district({id:"synthetic-center",label:"Explicit synthetic location",x:0,z:0,locationSource:"synthetic"},0,config,1)];
  const minX=Math.min(...buildings.map(b=>b.center[0])),maxX=Math.max(...buildings.map(b=>b.center[0]));
  const minZ=Math.min(...buildings.map(b=>b.center[1])),maxZ=Math.max(...buildings.map(b=>b.center[1]));
  const groups=new Map();
  for(const b of buildings){const ix=Math.min(2,Math.floor((b.center[0]-minX)/Math.max(1,maxX-minX)*3)),iz=Math.min(2,Math.floor((b.center[1]-minZ)/Math.max(1,maxZ-minZ)*3)),key=`district-${ix}-${iz}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([id,rows],i)=>district({id,label:`Map district ${i+1}`,x:rows.reduce((s,b)=>s+b.center[0],0)/rows.length,z:rows.reduce((s,b)=>s+b.center[1],0)/rows.length,buildingIds:rows.map(b=>String(b.id)),locationSource:"town-building-centroids"},i,config,groups.size));
}
function district(d,i,c,count){const numeric=(key,value,min,max)=>{if(d[key]!==undefined&&(!Number.isFinite(d[key])||d[key]<min||d[key]>max))throw new Error(`Invalid district ${key}`);return d[key]??value;};return{...d,id:String(d.id),label:d.label||String(d.id),rent:numeric("rent",c.baseRent*(.75+draw(c.seed,i,0,1)*.5),1,100000),housingUnits:Math.round(numeric("housingUnits",Math.ceil(c.population/c.householdSize/count*1.07),0,1e7)),jobs:Math.round(numeric("jobs",Math.ceil(c.population*.65*c.employmentRate/count*1.1),0,1e7)),transit:numeric("transit",.3+draw(c.seed,i,0,2)*.6,0,1),services:numeric("services",.4+draw(c.seed,i,0,3)*.5,0,1),environment:numeric("environment",.5+draw(c.seed,i,0,4)*.4,0,1),population:0,households:0,workers:0,visitors:0,congestion:1,transitCrowding:0,movesIn:0,movesOut:0,displaced:0,housingStress:0,awareness:.2,popularity:0,locationSource:d.locationSource||"supplied-coordinates",assumptionSource:"synthetic unless supplied/provenanced",roadDemand:0,transitDemand:0};}
export function generatePopulation(input={},worldContext={}) {
  const config=normalizePopulationConfig(input),n=config.population,h=Math.ceil(n/config.householdSize),districts=deriveDistricts(config,worldContext);
  if(new Set(districts.map(d=>d.id)).size!==districts.length)throw new Error("District IDs must be unique.");
  const seed=hash(`${config.snapshotId}:${config.seed}`),prefix=`synthetic-${seed.toString(16)}`;
  const people={household:new Uint32Array(n),age:new Uint8Array(n),employed:new Uint8Array(n),home:new Uint16Array(n),work:new Uint16Array(n),current:new Uint16Array(n),activity:new Uint8Array(n),mode:new Uint8Array(n),x:new Float32Array(n),z:new Float32Array(n),from:new Uint16Array(n),to:new Uint16Array(n),remaining:new Float32Array(n),tripTotal:new Float32Array(n),commute:new Float32Array(n),income:new Float64Array(n),offset:new Int16Array(n),utility:new Float32Array(n)};
  const households={start:new Uint32Array(h),size:new Uint8Array(h),home:new Uint16Array(h),income:new Float64Array(h),baseIncome:new Float64Array(h),rent:new Float64Array(h),savings:new Float64Array(h),stress:new Float32Array(h),vehicles:new Uint8Array(h),moves:new Uint16Array(h),displaced:new Uint8Array(h),transport:new Float64Array(h),spending:new Float64Array(h)};
  let cursor=0;
  const incomes=new Float64Array(h);
  for(let j=0;j<h;j++){const u=Math.max(1e-9,draw(seed,j,0,11)),v=draw(seed,j,0,12);incomes[j]=Math.exp(Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*config.incomeSpread);}
  const sorted=incomes.slice().sort(),median=h%2?sorted[Math.floor(h/2)]:(sorted[h/2-1]+sorted[h/2])/2;
  for(let j=0;j<h;j++){
    const size=Math.floor(n/h)+(j<n%h?1:0),home=Math.floor(draw(seed,j,0,13)*districts.length),d=districts[home];
    households.start[j]=cursor;households.size[j]=size;households.home[j]=home;households.baseIncome[j]=incomes[j]/median*config.medianIncome;households.income[j]=households.baseIncome[j];households.rent[j]=d.rent*config.rentMultiplier;households.savings[j]=households.income[j]/12*config.initialBufferMonths;households.vehicles[j]=draw(seed,j,0,14)<.7?1:0;d.households++;d.population+=size;
    for(let k=0;k<size;k++,cursor++){people.household[cursor]=j;const age=draw(seed,cursor,0,15);people.age[cursor]=k===0?1:age<.3?0:age>.88?2:1;people.employed[cursor]=people.age[cursor]===1&&draw(seed,cursor,0,16)<config.employmentRate?1:0;people.home[cursor]=home;people.current[cursor]=home;people.work[cursor]=Math.floor(draw(seed,cursor,0,17)*districts.length);people.from[cursor]=home;people.to[cursor]=home;people.x[cursor]=d.x;people.z[cursor]=d.z;people.offset[cursor]=Math.round((draw(seed,cursor,0,18)-.5)*60);people.utility[cursor]=.5;}
    const workers=Array.from({length:size},(_,k)=>households.start[j]+k).filter(i=>people.employed[i]);
    // Household nonwage resources remain explicit, not invented job earnings.
    for(const i of workers)people.income[i]=households.baseIncome[j]*.85/workers.length;
  }
  const model={schemaVersion:"population-state.v1",modelVersion:"1.0.0",config,seed,prefix,people,households,districts,tick:0,minute:0,events:[],eventCounts:{},traces:new Map(),timeSeries:[],metrics:{},economy:null,validation:null,provenance:{synthetic:true,demographics:config.provenance,locationSource:districts.every(d=>d.locationSource!=="synthetic")?"town/supplied locations only":"synthetic location",snapshotId:config.snapshotId,seed:config.seed},totals:{trips:0,moves:0,displacements:0,layoffs:0,hires:0,spending:0},lastDay:0,lastEffects:null};
  model.validation=validateSyntheticTargets(model);
  return model;
}
export function validateSyntheticTargets(model){const h=model.households.income.length,p=model.people;const income=model.households.income.slice().sort();let adults=0,workers=0;for(let i=0;i<p.age.length;i++){adults+=p.age[i]===1;workers+=p.employed[i];}const actual={population:p.age.length,householdSize:p.age.length/h,medianIncome:h%2?income[Math.floor(h/2)]:(income[h/2-1]+income[h/2])/2,employmentRate:workers/Math.max(1,adults)};const targets={population:model.config.population,householdSize:model.config.householdSize,medianIncome:model.config.medianIncome,employmentRate:model.config.employmentRate,...model.config.targets};return{targets,actual,errors:Object.fromEntries(Object.entries(actual).map(([id,v])=>[id,{absolute:v-(targets[id]??v),relative:targets[id]?(v-targets[id])/targets[id]:null}])),source:model.config.provenance,synthetic:true,calibrated:false,notes:["Generated targets are assumption checks, not independent empirical validation.","Household sizes use adjacent integer sizes; full joint demographic distributions are not fitted."]};}
