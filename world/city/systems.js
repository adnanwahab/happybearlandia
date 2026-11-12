import {VERSION, clamp, housingProjectBuildingId, sum} from './contracts.js';
const pack=(id,dependencies,resolve,{cadence=1,proposeStep=()=>({})}={})=>({id,version:VERSION,cadence,dependencies,
  initialize(s){s.systems[id]||={schemaVersion:'SystemState.v1',modelVersion:VERSION};},proposeStep,
  resolve,commit(s,result){s.systems[id]={schemaVersion:'SystemState.v1',modelVersion:VERSION,...result};},
  observe(s){const rows=Object.entries(s.systems[id]).filter(([,v])=>typeof v==='number').map(([metricId,value])=>({metricId:`${id}.${metricId}`,value}));
    if(id==='housing')for(const d of s.districts){const units=s.units.filter(u=>u.districtId===d.id);for(const [metricId,value]of Object.entries({housingPressure:d.housingPressure||0,available:units.filter(u=>u.status==='available').length,meanRent:units.length?sum(units,u=>u.rent)/units.length:0}))rows.push({geographyType:'district',geographyId:d.id,metricId:`housing.${metricId}`,value});}
    return rows;}});
const local=(rows,id)=>rows.filter(r=>r.districtId===id);
function releaseJob(s,j) {const w=s.workers.find(w=>w.id===j.workerId);if(w)w.jobId=null;j.workerId=null;}
function vacate(s,u) {const h=s.households.find(h=>h.id===u.householdId);if(h)h.unitId=null;u.householdId=null;u.status='available';}
export function createSystemPacks() {return [
  pack('environment',[],(old,p,s,c)=>{
    let damage=0;
    s.activeShocks=old.shocks.filter(x=>c.time>=x.start&&c.time<x.start+x.duration);
    for(const shock of s.activeShocks) {
      const d=s.districts.find(d=>d.id===shock.districtId),severity=shock.severity*(1-(d.resilience||0));
      if(shock.type==='flood'&&c.time===shock.start) {
        const units=local(s.units,d.id).filter(u=>c.random(shock.id,u.id)<severity*(d.floodRisk??.1));
        for(const u of units){vacate(s,u);u.status='under renovation';u.repairUntil=c.time+shock.duration+2;damage+=u.rent*12*severity;}
        c.event('environment','FLOOD_DAMAGE',d.id,{units:units.length,damage,shockId:shock.id},severity);
      }
      c.event('environment',`${shock.type.toUpperCase()}_ACTIVE`,d.id,{duration:shock.duration,shockId:shock.id},severity);
    }
    for(const u of s.units)if(u.status==='under renovation'&&c.time>=u.repairUntil)u.status='available';
    return {damage,activeHazards:s.activeShocks.length};
  }),
  pack('governance',['environment'],(old,p,s,c)=>{
    let delayed=0;
    for(const policy of [...s.policies].sort((a,b)=>a.id.localeCompare(b.id))) {
      if(policy.stage==='ACTIVE')continue;
      if(policy.delay>0){policy.delay--;delayed++;continue;}
      if(!c.registry.reserve({resource:'administration',time:c.time},1)){c.event('governance','IMPLEMENTATION_DELAY',policy.districtId,{policyId:policy.id,reason:'staffing'});delayed++;continue;}
      if(policy.stage==='PROPOSED'){policy.stage='APPROVED';continue;}
      if(policy.stage==='APPROVED') {
        const shortfall=Math.max(0,policy.cost-Math.max(0,s.finance.balance));
        if(shortfall&&(!s.finance.allowDebt||s.finance.debt+shortfall>s.finance.maxDebt)){c.event('finance','CAPITAL_PROJECT_DELAYED',policy.districtId,{policyId:policy.id,cost:policy.cost});delayed++;continue;}
        s.finance.debt+=shortfall;s.finance.balance+=shortfall-policy.cost;s.finance.capitalExpense+=policy.cost;
        c.flow('money','city',policy.id,policy.cost,'governance');policy.stage='FUNDED';continue;
      }
      if(policy.stage==='FUNDED') {
        policy.stage='IMPLEMENTING';
        if(['housing','utility','transit','school','resilience'].includes(policy.type)) {
          const units=policy.type==='housing'?Math.floor(policy.amount*policy.compliance):0;
          s.projects.push({id:`project-${policy.id}`,policyId:policy.id,districtId:policy.districtId,type:policy.type,utility:policy.utility,amount:policy.amount*policy.compliance,units,stage:'financing',progress:0,duration:policy.type==='housing'?12:6,cost:policy.cost,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});
        } else {
          for(const parcel of local(s.parcels,policy.districtId)){parcel.capacity+=Math.floor(policy.amount);parcel.far=Math.min(20,parcel.far+policy.amount/1000);}
          policy.stage='ACTIVE';policy.adoption=policy.compliance;
        }
      }
      if(policy.stage==='IMPLEMENTING'&&s.projects.some(x=>x.policyId===policy.id&&x.stage==='completion')){policy.stage='ACTIVE';policy.adoption=policy.compliance;}
    }
    return {delayed,active:s.policies.filter(p=>p.stage==='ACTIVE').length};
  }),
  pack('utilities',['governance'],(old,p,s,c)=>{
    let failures=0;
    for(const u of s.utilities) {
      const homes=local(s.households,u.districtId).length,businesses=local(s.businesses,u.districtId).filter(b=>b.status==='open').length;
      const flood=s.activeShocks.filter(x=>x.type==='flood'&&x.districtId===u.districtId).reduce((n,x)=>Math.max(n,x.severity),0);
      const heat=s.activeShocks.filter(x=>x.type==='heat'&&x.districtId===u.districtId).reduce((n,x)=>Math.max(n,x.severity),0);
      u.effectiveCapacity=u.capacity*(1-flood*.7);u.demand=(homes+businesses*2)*(u.type==='electric'?1+heat*.5:1);u.reserve=u.effectiveCapacity-u.demand;u.serviceLevel=u.demand?Math.min(1,u.effectiveCapacity/u.demand):1;
      c.registry.register({resource:u.type,districtId:u.districtId,time:c.time,capacity:Math.max(0,u.reserve)});
      c.flow('utility demand',u.districtId,u.id,u.demand,'utilities');
      if(u.serviceLevel<1){failures++;c.event('utilities','UTILITY_CAPACITY_FAILURE',u.districtId,{utility:u.type,demand:u.demand,capacity:u.effectiveCapacity});}
    }
    return {failures};
  }),
  pack('development',['utilities'],(old,opportunities,s,c)=>{
    let builds=0;
    for(const opportunity of opportunities) {
      const parcel=s.parcels.find(x=>x.id===opportunity.parcelId);
      if(s.projects.some(x=>x.parcelId===parcel.id&&!['completion','abandoned'].includes(x.stage)))continue;
      const decision=opportunity.value>0?'BUILD':opportunity.value> -100000?'REDESIGN': 'WAIT';
      c.decision('development',parcel.id,'development',decision,`Illustrative residual value ${Math.round(opportunity.value)}`,[{id:'BUILD',eligible:opportunity.value>0,utility:opportunity.value},{id:'WAIT',eligible:true,utility:0}]);
      if(decision!=='BUILD')continue;
      const id=`development-${parcel.id}-${c.time}`;
      s.projects.push({id,parcelId:parcel.id,districtId:parcel.districtId,type:'housing',units:opportunity.units,amount:opportunity.units,stage:'proposal',progress:0,duration:12,cost:opportunity.cost,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});builds++;
    }
    return {builds,opportunities:opportunities.length};
  },{cadence:3,proposeStep(s){return s.parcels.map(parcel=>{
    const existing=local(s.units,parcel.districtId),rent=existing.length?sum(existing,u=>u.rent)/existing.length:1000;
    const units=Math.min(100,Math.max(0,parcel.capacity-existing.length));
    const cost=units*s.parameters.constructionCost+parcel.landValue;
    const rate=s.parameters.interestRate+sum((s.shocks||[]).filter(x=>x.type==='rate'&&s.month+1>=x.start&&s.month+1<x.start+x.duration),x=>x.severity*.1);
    return {parcelId:parcel.id,units,cost,value:rent*12*units*15-cost*(1+rate+0.1)};
  }).filter(x=>x.units>0);}}),
  pack('construction',['development'],(old,p,s,c)=>{
    let completed=0,delays=0;
    const priority=[...s.projects].sort((a,b)=>Number(b.type==='utility')-Number(a.type==='utility')||a.id.localeCompare(b.id));
    for(const x of priority) {
      if(x.stage==='completion'||x.stage==='abandoned')continue;
      if(x.stage==='proposal'){x.stage='financing';continue;}
      if(x.stage==='financing') {
        const rate=s.parameters.interestRate+sum(s.activeShocks.filter(h=>h.type==='rate'),h=>h.severity*.1);
        if(!x.policyId&&rate>.12){c.event('construction','CAPACITY_DELAY',x.districtId,{projectId:x.id,reason:'financing'});delays++;continue;}
        x.stage='permit';c.event('construction','PROJECT_FINANCED',x.districtId,{projectId:x.id});c.event('construction','PERMIT_SUBMITTED',x.districtId,{projectId:x.id});continue;
      }
      if(x.stage==='permit') {
        if(!c.registry.reserve({resource:'permits',time:c.time},1)){delays++;c.event('construction','CAPACITY_DELAY',x.districtId,{projectId:x.id,reason:'permit delay'});continue;}
        x.stage='construction';c.event('construction','PERMIT_GRANTED',x.districtId,{projectId:x.id});c.event('construction','CONSTRUCTION_STARTED',x.districtId,{projectId:x.id});
        if(x.parcelId) {
          const buildings=s.buildings.filter(b=>b.parcelId===x.parcelId),ids=new Set(buildings.map(b=>b.id));
          for(const u of s.units.filter(u=>ids.has(u.buildingId))){x.displacedUnits.push(u.id);vacate(s,u);u.status='under construction';}
          for(const b of s.businesses.filter(b=>ids.has(b.buildingId)&&b.status==='open')){b.status='closed';x.displacedBusinesses.push(b.id);for(const j of s.jobs.filter(j=>j.businessId===b.id))releaseJob(s,j);s.jobs=s.jobs.filter(j=>j.businessId!==b.id);}
        }
        continue;
      }
      const load=Math.max(1,(x.units||10)/x.duration);
      const materialShock=sum(s.activeShocks.filter(h=>h.type==='materials'),h=>h.severity);
      const demands=['contractors','labor','materials','equipment'].map(resource=>({resource,time:c.time,amount:load*(resource==='materials'?1+materialShock:1)}));
      const fraction=Math.min(1,...demands.map(({amount,...q})=>(c.registry.query(q)?.available||0)/amount));
      const bottleneck=demands.reduce((a,b)=>(c.registry.query(a)?.available||0)/a.amount<(c.registry.query(b)?.available||0)/b.amount?a:b);
      const weather=s.activeShocks.some(h=>h.type==='flood'&&h.districtId===x.districtId&&h.severity>.6);
      if(fraction<1||weather) {
        delays++;x.costOverrun+=load*s.parameters.constructionCost*.005*(weather?1:1-fraction);
        c.event('construction',bottleneck.resource==='materials'&&!weather?'MATERIAL_DELAY':'CAPACITY_DELAY',x.districtId,{projectId:x.id,reason:weather?'weather':bottleneck.resource,progressFraction:weather?0:fraction,costOverrun:x.costOverrun});
      }
      if(fraction<=0||weather)continue;
      // Utility headroom is atomically reserved when housing is ready to complete.
      if(x.type==='housing'&&x.progress+fraction>=x.duration-1e-9) {
        const utilityDemands=['electric','water','sewer','stormwater'].map(resource=>({resource,districtId:x.districtId,time:c.time,amount:x.units}));
        if(!c.registry.reserveAll(utilityDemands)){delays++;c.event('construction','CAPACITY_DELAY',x.districtId,{projectId:x.id,reason:'utility capacity'});continue;}
      }
      c.registry.reserveAll(demands.map(q=>({...q,amount:q.amount*fraction})));
      const previousProgress=x.progress;x.progress=Math.min(x.duration,x.progress+fraction);
      if(previousProgress<x.duration*.7&&x.progress>=x.duration*.7)c.event('construction','TOPPED_OUT',x.districtId,{projectId:x.id});
      if(x.progress<x.duration-1e-9)continue;
      x.stage='completion';completed++;
      c.record?.({system:'construction',type:'PROJECT_COMPLETED',entity:['projects',x.id],inputs:{policyId:x.policyId??null,previousProgress,fraction,duration:x.duration,demands,utilityHeadroom:x.type==='housing'?['electric','water','sewer','stormwater'].map(resource=>c.registry.query({resource,districtId:x.districtId,time:c.time})):[]},outputs:{stage:x.stage,progress:x.progress}});
      const d=s.districts.find(d=>d.id===x.districtId);
      if(x.type==='housing') {
        s.units=s.units.filter(u=>!x.displacedUnits.includes(u.id));
        const buildingId=housingProjectBuildingId(x.id);s.buildings.push({id:buildingId,districtId:x.districtId,parcelId:x.parcelId||null,floors:Math.ceil(x.units/10)});
        const rents=local(old.units,x.districtId),rent=rents.length?sum(rents,u=>u.rent)/rents.length:1000;
        for(let i=0;i<x.units;i++)s.units.push({id:`${x.id}-unit-${i}`,buildingId,districtId:x.districtId,bedrooms:1+i%3,floorArea:70,quality:1,rent,tenure:'rental',status:'available',householdId:null,daysVacant:0});
        c.flow('housing units',x.id,x.districtId,x.units,'construction');
      }
      if(x.type==='utility')for(const u of local(s.utilities,x.districtId))if(u.type===x.utility)u.capacity+=x.amount;
      if(x.type==='transit'){for(const l of s.links.filter(l=>l.mode==='transit'&&(l.from===x.districtId||l.to===x.districtId))){l.capacity+=x.amount;l.freeTime=Math.max(3,l.freeTime*.8);}d.transitOperatingCost=(d.transitOperatingCost||0)+x.amount*20;}
      if(x.type==='school')s.facilities.push({id:`facility-${x.id}`,districtId:x.districtId,type:'school',capacity:x.amount,demand:0,utilization:0});
      if(x.type==='resilience')d.resilience=clamp((d.resilience||0)+x.amount,0,.95);
      c.event('construction','PROJECT_COMPLETE',x.districtId,{projectId:x.id,type:x.type,units:x.units,displacedUnits:x.displacedUnits,displacedBusinesses:x.displacedBusinesses});
    }
    return {completed,delays,queued:s.projects.filter(x=>x.stage!=='completion').length};
  }),
  pack('transport',['construction'],(old,p,s,c)=>{
    for(const l of s.links){const previousClosed=l.closed??false;l.flow=0;l.closed=s.activeShocks.some(x=>x.type==='flood'&&x.districtId===l.from&&x.severity>.6);l.travelTime=l.closed?240:l.freeTime;if(previousClosed!==l.closed)c.record?.({system:'transport',type:'LINK_AVAILABILITY_CHANGED',entity:['links',l.id],inputs:{previousClosed,from:l.from,activeFloods:s.activeShocks.filter(x=>x.type==='flood'&&x.districtId===l.from)},outputs:{closed:l.closed}});}
    // Bounded all-pairs shortest paths; district OD demand, not microscopic traffic.
    const paths=(origin,destination,mode)=>{
      if(origin===destination)return {minutes:8,links:[]};
      const distance=new Map(s.districts.map(d=>[d.id,Infinity])),routes=new Map(),pending=new Set(distance.keys());distance.set(origin,0);routes.set(origin,[]);
      while(pending.size){const id=[...pending].sort((a,b)=>distance.get(a)-distance.get(b)||a.localeCompare(b))[0];pending.delete(id);if(id===destination)break;
        for(const l of s.links.filter(l=>l.from===id&&l.mode===mode&&!l.closed&&pending.has(l.to))){const n=distance.get(id)+l.travelTime;if(n<distance.get(l.to)){distance.set(l.to,n);routes.set(l.to,[...(routes.get(id)||[]),l.id]);}}}
      return {minutes:distance.get(destination),links:routes.get(destination)||[]};
    };
    const planned=[];
    for(const w of s.workers.filter(w=>w.jobId)) {
      const j=s.jobs.find(j=>j.id===w.jobId),road=paths(w.districtId,j.districtId,'road'),transit=paths(w.districtId,j.districtId,'transit');
      const parking=s.districts.find(d=>d.id===j.districtId)?.parkingPrice||0;
      const mode=transit.minutes+5<road.minutes+parking*2?'transit':'road',route=mode==='road'?road:transit;
      if(!Number.isFinite(route.minutes)){c.event('transport','UNREACHABLE_JOB',w.districtId,{workerId:w.id});continue;}
      for(const id of route.links)s.links.find(l=>l.id===id).flow++;
      planned.push({personId:w.id,originId:w.districtId,destinationId:j.districtId,mode,plannedMinutes:route.minutes,route:route.links});
    }
    let denied=0;
    for(const l of s.links) {
      const ratio=l.flow/Math.max(1,l.capacity);
      l.travelTime=l.closed?240:Math.min(240,l.freeTime*(1+.15*Math.min(5,ratio)**4)+(l.mode==='transit'?Math.max(0,ratio-1)*10:0));
      if(l.mode==='transit'&&ratio>1){denied+=l.flow-l.capacity;c.event('transport','DENIED_BOARDING',l.from,{linkId:l.id,denied:l.flow-l.capacity});}
      c.flow('traffic',l.from,l.to,l.flow,'transport');
    }
    for(const t of planned){t.experiencedMinutes=t.route.length?sum(t.route,id=>s.links.find(l=>l.id===id).travelTime):8;t.delayMinutes=Math.max(0,t.experiencedMinutes-t.plannedMinutes);c.trips.push(t);}
    s.accessibility=[];
    for(const d of s.districts) {
      let reachable=0;
      for(const target of s.districts){const minutes=Math.min(paths(d.id,target.id,'road').minutes,paths(d.id,target.id,'transit').minutes);s.accessibility.push({from:d.id,to:target.id,minutes:Number.isFinite(minutes)?minutes:999});if(minutes<=45)reachable+=local(s.jobs,target.id).length;}
      d.accessibility=reachable/Math.max(1,s.jobs.length);d.reachableJobs=reachable;d.footTraffic=local(s.households,d.id).length+sum(s.links.filter(l=>l.mode==='transit'&&l.to===d.id),l=>l.flow);
    }
    return {deniedBoarding:denied,trips:planned.length,meanMinutes:planned.length?sum(planned,t=>t.experiencedMinutes)/planned.length:0};
  }),
  pack('businesses',['transport'],(old,p,s,c)=>{
    let opened=0,closed=0;
    for(const b of s.businesses.filter(b=>b.status==='open')) {
      const d=s.districts.find(d=>d.id===b.districtId),homes=local(s.households,b.districtId),competitors=local(s.businesses,b.districtId).filter(b=>b.status==='open').length;
      const recession=1-Math.max(0,...s.activeShocks.filter(x=>x.type==='recession').map(x=>x.severity));
      const flood=1-Math.max(0,...s.activeShocks.filter(x=>x.type==='flood'&&x.districtId===b.districtId).map(x=>x.severity*.8));
      const utilityService=Math.min(1,...local(s.utilities,b.districtId).map(u=>u.serviceLevel));
      b.demand=(sum(homes,h=>h.income)*.4+d.footTraffic*20)*recession*flood*utilityService/Math.max(1,competitors);
      const workers=s.jobs.filter(j=>j.businessId===b.id&&j.workerId);b.employees=workers.length;
      b.cost=b.commercialRent+b.operatingCost+sum(workers,j=>j.wage)+local(s.utilities,b.districtId).length*100;
      b.viability=b.demand-b.cost;b.badMonths=b.viability<0?b.badMonths+1:0;
      if(c.time%3===0&&b.badMonths>=6){b.status='closed';closed++;for(const j of s.jobs.filter(j=>j.businessId===b.id))releaseJob(s,j);s.jobs=s.jobs.filter(j=>j.businessId!==b.id);c.event('businesses','BUSINESS_CLOSED',b.districtId,{businessId:b.id,viability:b.viability});}
    }
    if(c.time%3===0)for(const d of s.districts) {
      const open=local(s.businesses,d.id).filter(b=>b.status==='open');
      const potential=sum(local(s.households,d.id),h=>h.income)*.4;
      if(potential>sum(open,b=>Math.max(0,b.cost||0))*1.5&&open.length<Math.max(1,local(s.households,d.id).length/10)) {
        const id=`business-${d.id}-${c.time}`;s.businesses.push({id,districtId:d.id,type:'retail',status:'open',badMonths:0,commercialRent:1000,operatingCost:1000,viability:0,demand:0});
        for(let i=0;i<3;i++)s.jobs.push({id:`job-${id}-${i}`,businessId:id,districtId:d.id,occupation:'general',wage:3500,workerId:null});
        opened++;c.event('businesses','BUSINESS_OPENED',d.id,{businessId:id,jobs:3});
      }
      d.commercialVacancy=local(s.businesses,d.id).filter(b=>b.status==='closed').length*100;
    }
    return {opened,closed,open:s.businesses.filter(b=>b.status==='open').length};
  }),
  pack('jobs',['businesses'],(old,p,s,c)=>{
    let matches=0;
    const seekers=s.workers.filter(w=>!w.jobId&&w.available).sort((a,b)=>a.id.localeCompare(b.id));
    for(const j of s.jobs.filter(j=>!j.workerId).sort((a,b)=>a.id.localeCompare(b.id))) {
      const eligible=seekers.filter(w=>!w.jobId&&w.occupation===j.occupation&&(s.accessibility.find(a=>a.from===w.districtId&&a.to===j.districtId)?.minutes??999)<=60);
      eligible.sort((a,b)=>c.random(j.id,a.id)-c.random(j.id,b.id)||a.id.localeCompare(b.id));
      const w=eligible[0];if(w){c.record?.({system:'jobs',type:'EMPLOYMENT_MATCHED',entity:['workers',w.id],inputs:{jobId:j.id,occupation:w.occupation,eligibleWorkerIds:eligible.map(w=>w.id),commuteMinutes:s.accessibility.find(a=>a.from===w.districtId&&a.to===j.districtId)?.minutes??999,seed:s.seed},outputs:{jobId:j.id}});w.jobId=j.id;j.workerId=w.id;matches++;c.decision('jobs',w.id,'job-match',j.id,'Eligible occupation and commute; seeded vacancy allocation');c.flow('jobs',j.id,w.id,1,'jobs');}
    }
    const unemployment=s.workers.filter(w=>w.available&&!w.jobId).length/Math.max(1,s.workers.filter(w=>w.available).length),vacancy=s.jobs.filter(j=>!j.workerId).length/Math.max(1,s.jobs.length);
    for(const j of s.jobs)j.wage=clamp(j.wage*(1+clamp((vacancy-unemployment)*.02,-.02,.02)),500,50000);
    for(const h of s.households)h.income=h.otherIncome+sum(s.workers.filter(w=>w.householdId===h.id&&w.jobId),w=>s.jobs.find(j=>j.id===w.jobId)?.wage||0);
    return {matches,unemployment,vacancy};
  }),
  pack('housing',['jobs'],(old,searchers,s,c)=>{
    let matches=0,failed=0,applications=0;
    // Listing eligibility uses the resolved hazard/construction inventory, with simultaneous ranked applications.
    const listings=s.units.filter(u=>u.status==='available'),byUnit=new Map(),reasons=new Map(),searchCounts={};
    for(const h of searchers.map(id=>s.households.find(h=>h.id===id)).filter(Boolean)) {
      searchCounts[h.districtId]=(searchCounts[h.districtId]||0)+1;
      const alternatives=listings.map(u=>({id:u.id,eligible:u.rent<=h.income*.4&&u.bedrooms>=h.bedrooms,rejectionReason:u.rent>h.income*.4?'budget too low':u.bedrooms<h.bedrooms?'bedroom requirement failed':null,utility:(s.districts.find(d=>d.id===u.districtId)?.accessibility||0)*2-u.rent/Math.max(1,h.income)+(u.districtId===h.districtId?.2:0)}));
      const eligible=alternatives.filter(a=>a.eligible).sort((a,b)=>b.utility-a.utility||a.id.localeCompare(b.id));
      reasons.set(h.id,{alternatives,eligible});
      for(const a of eligible){if(!byUnit.has(a.id))byUnit.set(a.id,[]);byUnit.get(a.id).push({householdId:h.id,utility:a.utility});applications++;}
    }
    const bids=[...byUnit.entries()].flatMap(([unitId,bids])=>bids.map(b=>({...b,unitId,tie:c.random(unitId,b.householdId)}))).sort((a,b)=>b.utility-a.utility||a.tie-b.tie||a.unitId.localeCompare(b.unitId)||a.householdId.localeCompare(b.householdId));
    const assigned=new Set(),taken=new Set();
    for(const b of bids) {
      if(assigned.has(b.householdId)||taken.has(b.unitId))continue;
      const h=s.households.find(h=>h.id===b.householdId),u=s.units.find(u=>u.id===b.unitId),previous=s.units.find(u=>u.id===h.unitId),origin=h.districtId;
      if(previous)vacate(s,previous);
      u.householdId=h.id;u.status='occupied';u.daysVacant=0;h.unitId=u.id;h.districtId=u.districtId;h.leaseUntil=c.time+12;
      for(const w of s.workers.filter(w=>w.householdId===h.id))w.districtId=h.districtId;
      assigned.add(h.id);taken.add(u.id);matches++;
      c.record?.({system:'housing',type:'HOUSEHOLD_RELOCATED',entity:['households',h.id],inputs:{previousUnitId:previous?.id??null,originDistrict:origin,income:h.income,bedrooms:h.bedrooms,alternatives:reasons.get(h.id).alternatives,seed:s.seed},outputs:{unitId:u.id,districtId:h.districtId,rent:u.rent}});
      c.moves.push({householdId:h.id,simulationTime:c.time,originDistrict:origin,destinationDistrict:h.districtId,previousCost:previous?.rent||0,newCost:u.rent,modeledDisplacement:!previous,primaryReason:previous?'lease turnover':'unhoused search'});
      c.decision('housing',h.id,'housing-match',u.id,'Utility ranking and seeded conflict resolution',reasons.get(h.id).alternatives);
      c.flow('people',origin,h.districtId,h.size,'housing');
    }
    for(const [id,r] of reasons)if(!assigned.has(id)) {
      failed++;const h=s.households.find(h=>h.id===id);
      const reason=!listings.length?'no local vacancies':r.eligible.length?'application lost':r.alternatives.some(a=>a.rejectionReason==='budget too low')?'budget too low':'bedroom requirement failed';
      c.decision('housing',id,'housing-search','stay',reason,r.alternatives);if(h.unitId)h.leaseUntil=c.time+3;
    }
    for(const d of s.districts) {
      const units=local(s.units,d.id),available=units.filter(u=>u.status==='available').length,vacancy=available/Math.max(1,units.length),pressure=(searchCounts[d.id]||0)/Math.max(1,available);
      d.housingPressure=pressure;
      const adjustment=clamp((.08-vacancy)*.1+Math.min(5,pressure)*.002,-.03,.03);
      for(const u of units){if(u.status==='available'){u.daysVacant+=30;u.rent=clamp(u.rent*(1+adjustment),100,50000);}else if(u.householdId&&s.households.find(h=>h.id===u.householdId)?.leaseUntil===c.time)u.rent=clamp(u.rent*(1+adjustment),100,50000);}
    }
    for(const h of s.households){const rent=s.units.find(u=>u.id===h.unitId)?.rent||0;h.savings=clamp(h.savings+h.income*.65-rent,-1000000,100000000);h.housingBurden=rent/Math.max(1,h.income);if(h.housingBurden>.6)c.event('housing','HOUSEHOLD_BUDGET_STRESS',h.districtId,{householdId:h.id,rent,income:h.income,savings:h.savings});}
    return {listings:listings.length,applications,matches,failedSearches:failed,daysVacant:sum(s.units,u=>u.daysVacant||0)};
  },{proposeStep(s,{time}){return s.households.filter(h=>!h.unitId||h.leaseUntil<=time).map(h=>h.id);}}),
  pack('services',['housing'],(old,p,s,c)=>{
    let overloaded=0;
    const types={school:'SCHOOL_OVER_CAPACITY',park:'PARK_OVERCROWDING',healthcare:'HEALTHCARE_CAPACITY_STRESS',emergency:'EMERGENCY_RESPONSE_DEGRADED',library:'COMMUNITY_SERVICE_STRESS'};
    for(const f of s.facilities) {
      const homes=local(s.households,f.districtId),population=sum(homes,h=>h.size),peers=local(s.facilities,f.districtId).filter(x=>x.type===f.type);
      const capacity=sum(peers,x=>x.capacity);
      const heat=1+Math.max(0,...s.activeShocks.filter(x=>x.type==='heat'&&x.districtId===f.districtId).map(x=>x.severity*.5));
      const total=f.type==='school'?sum(homes,h=>h.children):population*(f.type==='healthcare'?heat:1);
      f.demand=capacity?total*f.capacity/capacity:total/peers.length;f.utilization=f.capacity?f.demand/f.capacity:f.demand?999:0;
      c.registry.register({resource:`service-${f.id}`,districtId:f.districtId,time:c.time,capacity:f.capacity});
      if(f.utilization>1){overloaded++;c.event('services',types[f.type],f.districtId,{facilityId:f.id,demand:f.demand,capacity:f.capacity});}
      f.accessibility=capacity?Math.min(1,capacity/Math.max(1,total)):0;
    }
    return {overloaded,coverage:s.facilities.length?sum(s.facilities,f=>f.accessibility)/s.facilities.length:0};
  }),
  pack('demographics',['services'],(old,p,s,c)=>{
    let formed=0,merged=0;
    for(const w of s.workers){w.age++;if(w.age>=67&&w.jobId){const j=s.jobs.find(j=>j.id===w.jobId);if(j)releaseJob(s,j);}w.available=w.age<67;}
    for(const h of s.households)h.age++;
    const jobVacancy=s.jobs.filter(j=>!j.workerId).length/Math.max(1,s.jobs.length),vacancy=s.units.filter(u=>u.status==='available').length/Math.max(1,s.units.length);
    const growth=clamp(s.parameters.annualGrowth+(jobVacancy-.1)*.02+(vacancy-.1)*.02,-.03,.05);
    const count=Math.round(s.households.length*Math.abs(growth));
    if(growth>=0)for(let i=0;i<count&&s.households.length<100000;i++) {
      const d=s.districts[i%s.districts.length],id=`household-new-${c.time}-${i}`;
      s.households.push({id,districtId:d.id,unitId:null,size:2,children:0,income:2000,otherIncome:1000,bedrooms:1,leaseUntil:c.time,age:25,savings:6000});
      s.workers.push({id:`worker-${id}`,householdId:id,districtId:d.id,occupation:'general',jobId:null,available:true,age:25});formed++;
    }
    else for(const h of [...s.households].sort((a,b)=>Number(Boolean(a.unitId))-Number(Boolean(b.unitId))||a.id.localeCompare(b.id)).slice(0,Math.min(count,s.households.length-1))) {
      const u=s.units.find(u=>u.id===h.unitId);if(u)vacate(s,u);
      for(const w of s.workers.filter(w=>w.householdId===h.id)){const j=s.jobs.find(j=>j.id===w.jobId);if(j)releaseJob(s,j);}
      s.workers=s.workers.filter(w=>w.householdId!==h.id);s.households=s.households.filter(x=>x.id!==h.id);merged++;
    }
    c.event('demographics','ANNUAL_POPULATION_UPDATE',null,{formed,departed:merged,growth});return {formed,departed:merged,growth};
  },{cadence:12}),
  pack('finance',['demographics'],(old,p,s,c)=>{
    const property=sum(s.units,u=>u.rent)*.08,activity=sum(s.businesses.filter(b=>b.status==='open'),b=>Math.max(0,b.demand||0))*.03,fees=s.projects.filter(p=>p.stage==='permit').length*200;
    const revenue=property+activity+fees+50000;
    const services=sum(s.facilities,f=>f.capacity*(f.type==='school'?50:5)),transport=sum(s.districts,d=>d.transitOperatingCost||0)+s.links.length*100;
    const operatingExpense=services+transport+sum(s.utilities,u=>u.capacity*2)+10000+s.finance.debt*s.parameters.interestRate/12;
    const capitalExpense=s.finance.capitalExpense||0;
    s.finance.balance+=revenue-operatingExpense;s.finance.revenue=revenue;s.finance.operatingExpense=operatingExpense;s.finance.capitalExpense=0;
    if(s.finance.balance<0)c.event('finance','BUDGET_DEFICIT',null,{balance:s.finance.balance});
    if(s.finance.debt>revenue*60)c.event('finance','DEBT_PRESSURE',null,{debt:s.finance.debt});
    c.flow('money','economy','city',revenue,'finance');c.flow('money','city','operations',operatingExpense,'finance');
    return {revenue,operatingExpense,capitalExpense,balance:s.finance.balance,debt:s.finance.debt,publicCost:operatingExpense+capitalExpense};
  })
];}
