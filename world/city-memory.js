// Deterministic scenario clock. All dates are campaign months, not wall-clock time.
export const policySchedule = {
  affordability: [
    {name:'Apartments near transit',delay:3},
    {name:'Community housing',delay:2},
    {name:'Employment district conversion',delay:1}
  ],
  restaurant: [
    {name:'Simpler diner menu',delay:1},
    {name:'Lunch catering',delay:2},
    {name:'Dining room renovation',delay:3}
  ],
  commute: [
    {name:'Rapid bus network',delay:3,works:true},
    {name:'Signals and bike connections',delay:1,works:true},
    {name:'Subway extension',delay:6,works:true}
  ],
  flooding: [
    {name:'Upstream wetlands',delay:2,protection:4000},
    {name:'Neighborhood drainage',delay:2,protection:3500},
    {name:'River flood barriers',delay:4,protection:6000}
  ],
  happiness: [
    {name:'Community parks',delay:1},
    {name:'Reliable bus service',delay:1},
    {name:'Expanded city services',delay:1}
  ],
  family: [
    {name:'Two-bedroom community home',delay:2},
    {name:'Housing voucher',delay:1},
    {name:'Studio offer',delay:0}
  ]
};
export function newCityMemory(){return {projects:{},events:[]};}
export function validMemory(value,plans,month){
  if(!value||typeof value!=='object'||!value.projects){
    // Preserve the effects of policies adopted before the city clock was introduced.
    const legacy=newCityMemory();
    for(const [id,choices] of Object.entries(plans))for(const i of Array.isArray(choices)?choices:[]){
      const policy=policySchedule[id]?.[i];if(policy)legacy.projects[`${id}:${i}`]={adopted:month-policy.delay};
    }
    return legacy;
  }
  const memory=newCityMemory();
  for(const [key,p] of Object.entries(value.projects)){
    const [id,index]=key.split(':');
    if(policySchedule[id]?.[index]&&plans[id]?.includes(+index)&&Number.isInteger(p?.adopted)&&p.adopted<=month){
      memory.projects[key]={adopted:p.adopted};
      if(Number.isInteger(p.repaired)&&p.repaired<=month)memory.projects[key].repaired=p.repaired;
    }
  }
  memory.events=Array.isArray(value.events)?value.events.filter(e=>Number.isInteger(e?.month)&&typeof e.text==='string').slice(-80):[];
  return memory;
}
export function rememberPlan(memory,id,choices,month){
  if(!policySchedule[id])return;
  const selected=new Set(choices);
  for(const key of Object.keys(memory.projects)){
    const [mission,index]=key.split(':');
    if(mission===id&&!selected.has(+index)){
      memory.events.push({month,text:`${policySchedule[id][index].name} withdrawn. Past costs and journal entries remain.`});
      delete memory.projects[key];
    }
  }
  for(const i of selected){
    const policy=policySchedule[id][i],key=`${id}:${i}`;if(!policy||memory.projects[key])continue;
    memory.projects[key]={adopted:month};
    memory.events.push({month,text:`${policy.name} adopted. ${policy.delay?`Full effects expected in month ${month+policy.delay}.`:'Available immediately.'}`});
  }
  memory.events=memory.events.slice(-80);
}
export function memorySnapshot(memory,plans,month){
  const effectivePlans={};const upcoming=[];let construction=0,partialRent=0,protection=0,neglected=0;
  for(const [id,choices] of Object.entries(plans)){
    effectivePlans[id]=[];
    for(const i of Array.isArray(choices)?choices:[]){
      const policy=policySchedule[id]?.[i],project=memory.projects[`${id}:${i}`];if(!policy||!project)continue;
      const age=month-project.adopted,due=project.adopted+policy.delay;
      if(age>=policy.delay){
        effectivePlans[id].push(i);
        if(policy.protection){
          const maintained=Math.max(due,project.repaired??due),worn=month-maintained>=6;
          protection+=policy.protection*(worn?0.6:1);if(worn)neglected++;
          upcoming.push({month:maintained+6,name:policy.name,text:worn?'Overdue upkeep · protection reduced by 40%.':'Upkeep due · protection falls by 40% if neglected.',overdue:worn});
        }
      }else{
        upcoming.push({month:due,name:policy.name,text:'Full benefits arrive.',overdue:false});
        if(policy.works)construction++;
        if(id==='affordability'&&i===0)partialRent=0.09*Math.max(0,age)/policy.delay;
      }
    }
  }
  return {effectivePlans,upcoming:upcoming.sort((a,b)=>a.month-b.month),construction,partialRent,protection:Math.min(10000,protection),neglected,storm:month>0&&month%6===0,nextStorm:Math.floor(month/6+1)*6};
}
export function reviewMonth(memory,id,choices,month){
  return Math.max(month+1,...choices.map(i=>(memory.projects[`${id}:${i}`]?.adopted??month)+(policySchedule[id]?.[i]?.delay??0)));
}
export function advanceMemory(memory,plans,month){
  for(const [key,p] of Object.entries(memory.projects)){
    const [id,i]=key.split(':'),policy=policySchedule[id]?.[i];if(!policy)continue;
    if(p.adopted+policy.delay===month)memory.events.push({month,text:`${policy.name} completed. Its full household benefits are now active.`});
    if(policy.protection&&Math.max(p.adopted+policy.delay,p.repaired??0)+6===month)memory.events.push({month,text:`${policy.name} needs upkeep. Protection is now 40% lower until repaired.`});
  }
  const snapshot=memorySnapshot(memory,plans,month);
  if(snapshot.storm)memory.events.push({month,text:`A major storm arrived. Working defenses protected ${Math.round(snapshot.protection).toLocaleString()} homes; exposed households paid repair costs.`});
  memory.events=memory.events.slice(-80);return snapshot;
}
export function repairMemory(memory,month){
  let count=0;
  for(const [key,p] of Object.entries(memory.projects)){
    const [id,i]=key.split(':'),policy=policySchedule[id]?.[i];
    if(policy?.protection&&month-Math.max(p.adopted+policy.delay,p.repaired??0)>=6){p.repaired=month;count++;}
  }
  if(count)memory.events.push({month,text:`Flood defense upkeep funded: $200 from each household’s savings. ${count} defense project(s) restored for six months.`});
  memory.events=memory.events.slice(-80);return count;
}
