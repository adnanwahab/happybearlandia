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
function district(d,i,c,count){const numeric=(key,value,min,max)=>{if(d[key]!==undefined&&(!Number.isFinite(d[key])||d[key]<min||d[key]>max))throw new Error(`Invalid district ${key}`);return d[key]??value;};return{...d,id:String(d.id),label:d.label||String(d.id),rent:numeric("rent",c.baseRent*(.75+draw(c.seed,i,0,1)*.5),1,100000),housingUnits:Math.round(numeric("housingUnits",Math.ceil(c.population/c.householdSize/count*1.07)*((c.representedPopulation||c.population)/c.population),0,1e7)),jobs:Math.round(numeric("jobs",Math.ceil(c.population*.85*c.employmentRate/count*1.1)*((c.representedPopulation||c.population)/c.population),0,1e7)),transit:numeric("transit",.3+draw(c.seed,i,0,2)*.6,0,1),services:numeric("services",.4+draw(c.seed,i,0,3)*.5,0,1),environment:numeric("environment",.5+draw(c.seed,i,0,4)*.4,0,1),population:0,households:0,workers:0,visitors:0,congestion:1,transitCrowding:0,movesIn:0,movesOut:0,displaced:0,housingStress:0,awareness:.2,popularity:0,locationSource:d.locationSource||"supplied-coordinates",assumptionSource:"synthetic unless supplied/provenanced",roadDemand:0,transitDemand:0};}
export function generatePopulation(input={},worldContext={}) {
  const config=normalizePopulationConfig(input),n=config.population,h=Math.ceil(n/config.householdSize),districts=deriveDistricts(config,worldContext);
  const weight=(config.representedPopulation||n)/n;
  if(districts.reduce((sum,d)=>sum+Math.floor(d.housingUnits/weight),0)<h)throw new Error("Initial housing capacity is below generated household demand; provide more capacity or reduce represented population.");
  const accessPoint=b=>Array.isArray(b.accessPoint)&&b.accessPoint.length===2&&b.accessPoint.every(Number.isFinite)?b.accessPoint:b.center;
  const locations=(worldContext.buildings||worldContext.town?.buildings||[]).filter(b=>Array.isArray(b.center)&&b.center.every(Number.isFinite)).map(b=>({id:String(b.id),x:accessPoint(b)[0],z:accessPoint(b)[1]}));const locationIndex=new Map(locations.map((row,index)=>[row.id,index]));for(const d of districts){d.anchors=[];d.anchorLocations=[];}
  for(const building of worldContext.buildings||worldContext.town?.buildings||[]){if(!Array.isArray(building.center)||!building.center.every(Number.isFinite))continue;let best=0,distance=Infinity;for(let d=0;d<districts.length;d++){const dd=(districts[d].x-building.center[0])**2+(districts[d].z-building.center[1])**2;if(dd<distance){best=d;distance=dd;}}districts[best].anchors.push([...accessPoint(building)]);districts[best].anchorLocations.push(locationIndex.get(String(building.id)));}
  for(const d of districts)if(!d.anchors.length){d.anchors.push([d.x,d.z]);d.anchorLocations.push(4294967295);}
  if(new Set(districts.map(d=>d.id)).size!==districts.length)throw new Error("District IDs must be unique.");
  const seed=hash(`${config.snapshotId}:${config.seed}`),prefix=`synthetic-${seed.toString(16)}`;
  const people={household:new Uint32Array(n),age:new Uint8Array(n),employed:new Uint8Array(n),home:new Uint16Array(n),work:new Uint16Array(n),current:new Uint16Array(n),activity:new Uint8Array(n),mode:new Uint8Array(n),x:new Float32Array(n),z:new Float32Array(n),from:new Uint16Array(n),to:new Uint16Array(n),remaining:new Float32Array(n),tripTotal:new Float32Array(n),commute:new Float32Array(n),income:new Float64Array(n),offset:new Int16Array(n),utility:new Float32Array(n)};
  const households={start:new Uint32Array(h),size:new Uint8Array(h),home:new Uint16Array(h),income:new Float64Array(h),baseIncome:new Float64Array(h),rent:new Float64Array(h),savings:new Float64Array(h),stress:new Float32Array(h),vehicles:new Uint8Array(h),moves:new Uint16Array(h),displaced:new Uint8Array(h),transport:new Float64Array(h),spending:new Float64Array(h)};
  for(const key of["homeX","homeZ","workX","workZ","fromX","fromZ","toX","toZ","experiencedTime","departureMinute"])people[key]=new Float32Array(n);
  for(const key of["homeLocation","workLocation","currentLocation","toLocation"])people[key]=new Uint32Array(n).fill(4294967295);people.modeSwitches=new Uint16Array(n);people.habit=new Uint8Array(n);people.denied=new Uint16Array(n);households.nonWage=new Float64Array(h);
  let cursor=0;
  const incomes=new Float64Array(h);
  for(const key of["planUntil","plannedUntil","eatingUntil","restingUntil","activityStartedMinute"])people[key]=new Float64Array(n);
  people.plannedActivity=new Uint8Array(n);people.lastDecisionMinute=new Float64Array(n).fill(-1);
  // Timing balances use double precision so fractional arrival leftovers survive.
  people.remaining=new Float64Array(n);people.tripTotal=new Float64Array(n);people.departureMinute=new Float64Array(n);
  for(const key of["hunger","energy","fun","social"]){people[key]=new Float32Array(n);for(let i=0;i<n;i++)people[key][i]=40+draw(seed,i,0,{hunger:71,energy:72,fun:73,social:74}[key])*50;}
  for(let j=0;j<h;j++){const u=Math.max(1e-9,draw(seed,j,0,11)),v=draw(seed,j,0,12);incomes[j]=Math.exp(Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*config.incomeSpread);}
  const sorted=incomes.slice().sort(),median=h%2?sorted[Math.floor(h/2)]:(sorted[h/2-1]+sorted[h/2])/2;
  for(let j=0;j<h;j++){
    const size=Math.floor(n/h)+(j<n%h?1:0);let home=Math.floor(draw(seed,j,0,13)*districts.length);if((districts[home].households+1)*weight>districts[home].housingUnits)home=districts.findIndex(d=>(d.households+1)*weight<=d.housingUnits);const d=districts[home];
    households.start[j]=cursor;households.size[j]=size;households.home[j]=home;households.baseIncome[j]=incomes[j]/median*config.medianIncome;households.income[j]=households.baseIncome[j];households.rent[j]=d.rent*config.rentMultiplier;households.savings[j]=households.income[j]/12*config.initialBufferMonths;households.vehicles[j]=draw(seed,j,0,14)<.7?1:0;d.households++;d.population+=size;
    for(let k=0;k<size;k++,cursor++){people.household[cursor]=j;const age=draw(seed,cursor,0,15);people.age[cursor]=k===0?1:age<.3?0:age>.88?2:1;people.employed[cursor]=people.age[cursor]===1&&draw(seed,cursor,0,16)<config.employmentRate?1:0;people.home[cursor]=home;people.current[cursor]=home;people.work[cursor]=Math.floor(draw(seed,cursor,0,17)*districts.length);people.from[cursor]=home;people.to[cursor]=home;people.x[cursor]=d.x;people.z[cursor]=d.z;people.offset[cursor]=Math.round((draw(seed,cursor,0,18)-.5)*60);people.utility[cursor]=.5;}
    const workers=Array.from({length:size},(_,k)=>households.start[j]+k).filter(i=>people.employed[i]);
    // Household nonwage resources remain explicit, not invented job earnings.
    for(const i of workers)people.income[i]=households.baseIncome[j]*.85/workers.length;
    households.nonWage[j]=households.baseIncome[j]*(workers.length?.15:1);
    const anchorIndex=Math.floor(draw(seed,j,0,19)*d.anchors.length),anchor=d.anchors[anchorIndex];
    for(let k=0;k<size;k++){const i=households.start[j]+k,work=districts[people.work[i]],location=work.anchors[Math.floor(draw(seed,i,0,20)*work.anchors.length)];people.homeLocation[i]=people.currentLocation[i]=d.anchorLocations[anchorIndex];people.homeX[i]=people.x[i]=anchor[0];people.homeZ[i]=people.z[i]=anchor[1];people.workLocation[i]=work.anchorLocations[Math.floor(draw(seed,i,0,20)*work.anchors.length)];people.workX[i]=location[0];people.workZ[i]=location[1];}
  }
  // Fit the public adult-employment aggregate by a seeded rank, rather than
  // failing a tiny population because of Bernoulli sampling noise. Capacity
  // matching remains authoritative afterwards and can still fail validation.
  const adults=[],rank=new Float64Array(n);
  for(let i=0;i<n;i++){people.employed[i]=0;people.income[i]=0;if(people.age[i]===1){adults.push(i);rank[i]=draw(seed,i,0,75);}}
  adults.sort((a,b)=>rank[a]-rank[b]||a-b);
  const employedTarget=Math.round(adults.length*config.employmentRate);
  for(let k=0;k<employedTarget;k++)people.employed[adults[k]]=1;
  for(let j=0;j<h;j++){let workers=0;for(let k=0;k<households.size[j];k++)workers+=people.employed[households.start[j]+k];households.nonWage[j]=households.baseIncome[j]*(workers?.15:1);for(let k=0;k<households.size[j];k++){const i=households.start[j]+k;if(people.employed[i])people.income[i]=households.baseIncome[j]*.85/workers;}}
  const model={locations,schemaVersion:"population-state.v1",modelVersion:"1.1.0",config,seed,prefix,people,households,districts,tick:0,minute:0,events:[],eventCounts:{},traces:new Map(),timeSeries:[],metrics:{},economy:null,validation:null,provenance:{synthetic:true,demographics:config.provenance,locationSource:districts.every(d=>d.locationSource!=="synthetic")?"town/supplied locations only":"synthetic location",snapshotId:config.snapshotId,seed:config.seed},totals:{trips:0,moves:0,displacements:0,layoffs:0,hires:0,spending:0},lastDay:0,lastEffects:null};
  model.validation=validateSyntheticTargets(model);
  return model;
}
export function validateSyntheticTargets(model){const h=model.households.income.length,p=model.people;const income=model.households.baseIncome.slice().sort();let adults=0,workers=0;for(let i=0;i<p.age.length;i++){adults+=p.age[i]===1;workers+=p.employed[i];}const actual={population:p.age.length,householdSize:p.age.length/h,medianIncome:h%2?income[Math.floor(h/2)]:(income[h/2-1]+income[h/2])/2,employmentRate:workers/Math.max(1,adults)};const targets={population:model.config.population,householdSize:model.config.householdSize,medianIncome:model.config.medianIncome,employmentRate:model.config.employmentRate,...model.config.targets};const errors=Object.fromEntries(Object.entries(actual).map(([id,v])=>[id,{absolute:v-(targets[id]??v),relative:targets[id]?(v-targets[id])/targets[id]:null}]));const tolerances={population:0,householdSize:Math.max(.06,1/h),medianIncome:.02,employmentRate:Math.max(.05,2*Math.sqrt(targets.employmentRate*(1-targets.employmentRate)/Math.max(1,adults)))};const failed=Object.keys(actual).filter(id=>id==="employmentRate"?Math.abs(errors[id].absolute)>tolerances[id]:Math.abs(errors[id].relative||errors[id].absolute)>tolerances[id]);return{targets,actual,errors,tolerances,passed:!failed.length,gate:{accepted:!failed.length,reasons:failed.map(id=>`${id} exceeds the declared synthetic target tolerance`)},source:model.config.provenance,synthetic:true,calibrated:false,notes:["Generated targets are assumption checks, not independent empirical validation. Income targets validate baseline resources before policy wage multipliers.","Household sizes use adjacent integer sizes; full joint demographic distributions are not fitted."]};}
