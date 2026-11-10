import {newCityMemory,validMemory,rememberPlan,memorySnapshot,reviewMonth,advanceMemory,repairMemory} from './city-memory.js';
// Household scenarios share the challenge sandbox's illustrative assumptions.
export const households = [
  {id:'rivera',name:'The Rivera family',members:'Maya, Luis, and their two children',bio:'Maya works at Maple Diner. Luis works in the employment district. They need a two-bedroom home.',income:4000,rent:1800,expenses:1800,savings:2400,commute:38,happiness:58,job:'Maya: diner cook · Luis: warehouse associate',floodRisk:1},
  {id:'chen',name:'The Chen household',members:'Alex and their mother, June',bio:'Alex runs Maple Diner and supports June. Reliable transport and a stable business matter most.',income:4800,rent:1650,expenses:2350,savings:5200,commute:42,happiness:61,job:'Alex: diner owner',floodRisk:0.5},
  {id:'brooks',name:'The Brooks family',members:'Sam, Jordan, and their daughter',bio:'Two local workers renting near the river. They want a safer home and more time together.',income:5200,rent:2100,expenses:2500,savings:3600,commute:46,happiness:55,job:'Sam: nurse · Jordan: warehouse associate',floodRisk:1}
];
export function projectHousehold(family, plans={}) {
  const state={...family};const stories=[];
  const has=(id,i)=>Array.isArray(plans[id])&&plans[id].includes(i);
  if(has('affordability',0)){state.rent-=family.income*0.09;stories.push('New apartments near transit ease rent pressure.');}
  if(has('affordability',1)){state.rent-=family.income*0.05;stories.push('Community housing lowers the household’s housing costs.');}
  if(has('affordability',2)){
    state.rent-=family.income*0.15;
    if(family.id!=='chen'){state.income-=1600;state.job=family.id==='rivera'?'Maya: diner cook · Luis: job displaced':'Sam: nurse · Jordan: job displaced';state.happiness-=12;stories.push('Rent falls, but the employment conversion displaces a warehouse job.');}
  }
  if(Array.isArray(plans.restaurant)){
    const profit=-6000+(has('restaurant',0)?3000:0)+(has('restaurant',1)?4000:0)+(has('restaurant',2)?1000:0);
    if(profit<0&&family.id!=='brooks'){state.income-=family.id==='chen'?2000:1200;state.job=family.id==='chen'?'Alex: diner at risk of closure':state.job.replace('Maya: diner cook','Maya: diner job at risk');state.happiness-=10;stories.push('The diner is still losing money; household earnings are reduced in this scenario.');}
    else if(profit>=0&&family.id!=='brooks'){state.happiness+=5;stories.push('The diner breaks even, helping protect the household’s livelihood.');}
  }
  const minutes=(has('commute',0)?9:0)+(has('commute',1)?5:0)+(has('commute',2)?17:0)+(has('happiness',1)?3:0);
  state.commute=Math.max(5,state.commute-minutes);
  if(minutes){state.happiness+=Math.min(8,Math.round(minutes/3));stories.push(`Better connections save ${family.commute-state.commute} minutes on the commute.`);}
  if(has('happiness',0)){state.happiness+=7;stories.push('A new community park gives the family somewhere to unwind.');}
  if(has('happiness',1))state.happiness+=6;
  if(has('happiness',2)){state.happiness+=18;state.income-=Math.round(family.income*0.03);stories.push('Expanded services improve daily life, while the tax increase reduces take-home pay.');}
  const protection=(has('flooding',0)?4000:0)+(has('flooding',1)?3500:0)+(has('flooding',2)?6000:0);
  state.floodRisk=Math.max(0,family.floodRisk*(1-Math.min(1,protection/10000)));
  if(protection){state.happiness+=Math.round(5*(1-state.floodRisk));stories.push('Flood defenses reduce the household’s exposure to storm damage.');}
  state.housing='Current rental';
  if(family.id==='rivera'){
    if(has('family',0)){state.rent-=350;state.housing='Two-bedroom community home';stories.push('The Riveras secure a suitable two-bedroom community home.');}
    if(has('family',1)){state.rent-=300;stories.push('A housing voucher reduces the Riveras’ monthly rent.');}
    if(has('family',2))stories.push('The studio is too small for the Riveras, so they keep their existing home.');
  }
  state.rent=Math.max(0,Math.round(state.rent));state.income=Math.max(0,Math.round(state.income));
  state.balance=state.income-state.rent-state.expenses;
  if(state.balance<0){state.happiness-=5;stories.push('Monthly costs exceed income; the family is drawing down savings.');}
  else stories.push(`After rent and everyday expenses, the household can save $${state.balance.toLocaleString()} this month.`);
  state.happiness=Math.max(0,Math.min(100,state.happiness));
  return {...state,stories};
}
// Forecasts use projectHousehold; the campaign uses only benefits delivered by its clock.
export function projectRememberedHousehold(family,plans,memory,month,paidStormCost){
  const clock=memorySnapshot(memory,plans,month);
  const state=projectHousehold(family,clock.effectivePlans);
  state.stories.pop(); // Replace the forecast budget summary with this month's actual balance.
  if(state.balance<0)state.happiness+=5;
  if(clock.partialRent){
    state.rent=Math.max(0,state.rent-Math.round(family.income*clock.partialRent));
    state.stories.push('Apartments are opening in phases; rents ease gradually before the project is complete.');
  }
  if(clock.construction){
    state.commute+=Math.min(12,clock.construction*4);
    if(family.id!=='brooks')state.income=Math.max(0,state.income-(family.id==='chen'?250:100)*clock.construction);
    state.happiness-=3;
    state.stories.push('Transport construction adds travel time'+(family.id!=='brooks'?' and disrupts diner earnings':'')+'. These disruptions end when the works finish.');
  }
  state.floodRisk=family.floodRisk*(1-clock.protection/10000);
  if(clock.neglected){state.happiness-=3;state.stories.push('Neglected flood defenses offer less protection. Fund upkeep before the next storm.');}
  state.stormCost=clock.storm?(Number.isFinite(paidStormCost)?paidStormCost:Math.round(1200*state.floodRisk)):0;
  if(state.stormCost)state.happiness-=Math.round(6*state.stormCost/1200);
  if(clock.storm)state.stories.push(state.stormCost?`The storm caused $${state.stormCost.toLocaleString()} in repair costs, charged to savings this month.`:'Working flood defenses kept the household safe during the storm.');
  state.balance=state.income-state.rent-state.expenses;
  if(state.balance<0){state.happiness-=5;state.stories.push('Monthly costs exceed income; the family is drawing down savings.');}
  else state.stories.push(`After rent and everyday expenses, the household can save $${state.balance.toLocaleString()} this month.`);
  state.happiness=Math.max(0,Math.min(100,state.happiness));
  return state;
}
const key='hbl-follow-family-v1';
function read(){try{const v=JSON.parse(localStorage.getItem(key));if(v&&typeof v==='object'&&!Array.isArray(v))return {family:households.some(h=>h.id===v.family)?v.family:'rivera',plans:v.plans&&typeof v.plans==='object'?v.plans:{},memory:v.memory,stormLosses:v.stormLosses&&typeof v.stormLosses==='object'?v.stormLosses:{},history:Array.isArray(v.history)?v.history.filter(e=>e&&Number.isFinite(e.savings)&&Number.isFinite(e.month)&&typeof e.text==='string').slice(-120):[],month:Number.isInteger(v.month)&&v.month>=0?v.month:0,savings:v.savings&&typeof v.savings==='object'?v.savings:{}};}catch{}return {family:'rivera',plans:{},history:[],month:0,savings:{}};}
let campaign;
const money=n=>'$'+Math.round(n).toLocaleString();
function persist(){try{localStorage.setItem(key,JSON.stringify(campaign));}catch{}}
export function getFamilyPlans(){return structuredClone(campaign?.plans||{});}
export function getFamilyReviewMonth(id,choices){return reviewMonth(campaign.memory,id,choices,campaign.month);}
export function getCurrentHouseholds(){return Object.fromEntries(households.map(h=>[h.id,projectRememberedHousehold(h,campaign.plans,campaign.memory,campaign.month,campaign.stormLosses?.[h.id])]));}
export function recordFamilyPlan(id,choices){if(!campaign)return;rememberPlan(campaign.memory,id,choices,campaign.month);campaign.plans[id]=[...choices];persist();renderFamily();}
function renderFamily(){
  const root=document.querySelector('#follow-family');if(!root)return;
  const family=households.find(h=>h.id===campaign.family);const state=projectRememberedHousehold(family,campaign.plans,campaign.memory,campaign.month,campaign.stormLosses?.[family.id]);
  const savings=Number.isFinite(campaign.savings[family.id])?campaign.savings[family.id]:family.savings;
  root.innerHTML=`<div class="family-heading"><div><span class="tag">THE PEOPLE BEHIND THE NUMBERS</span><h2>Follow a family</h2></div><label>Household <select id="household">${households.map(h=>`<option value="${h.id}" ${h.id===family.id?'selected':''}>${h.name}</option>`).join('')}</select></label></div><p>${family.members}. ${family.bio}</p><p class="family-note">Run a challenge plan and adopt it at City Council Night to apply its policies here. Each run replaces that mission’s previous plan. The city timeline shows when benefits arrive and when upkeep is due. Advance a month to record income, disruptions, and storm costs; policies stay in effect across missions.</p><div class="family-metrics">${[['Monthly take-home',money(state.income)],['Monthly rent',money(state.rent)],['Commute',state.commute+' min'],['Savings',money(savings)],['Happiness',state.happiness+' / 100'],['Monthly balance',money(state.balance)]].map(([label,value])=>`<div class="metric"><span>${label}</span><b>${value}</b></div>`).join('')}</div><p><strong>Work:</strong> <span id="family-job">${state.job}</span><br><strong>Home:</strong> ${state.housing} · ${state.floodRisk===0?'Protected from the scenario flood':'Flood exposure: '+Math.round(state.floodRisk*100)+'% of baseline'}</p><div class="family-story" aria-live="polite"><h3>Life this month</h3><ul>${state.stories.map(s=>`<li>${s}</li>`).join('')}</ul></div><div class="actions"><button id="advance-month">Advance one month →</button><button id="reset-family" class="secondary">Start a new family timeline</button></div><h3 class="section-title">HOUSEHOLD JOURNAL · MONTH ${campaign.month}</h3><ol id="family-journal"></ol>`;
  renderMemory();
  const journal=root.querySelector('#family-journal');const entries=campaign.history.filter(e=>e.family===family.id).slice(-6).reverse();
  if(!entries.length){const li=document.createElement('li');li.textContent='Your story starts here. Run a plan, then advance a month to record its effects.';journal.append(li);}
  for(const e of entries){const li=document.createElement('li');li.textContent=`Month ${e.month} · Savings ${money(e.savings)}. ${e.text}`;journal.append(li);}
  root.querySelector('#household').onchange=e=>{campaign.family=e.target.value;persist();renderFamily()};
  root.querySelector('#advance-month').onclick=()=>{
    campaign.month++;
    advanceMemory(campaign.memory,campaign.plans,campaign.month);
    campaign.stormLosses={};
    for(const h of households){const s=projectRememberedHousehold(h,campaign.plans,campaign.memory,campaign.month);campaign.stormLosses[h.id]=s.stormCost;const previous=Number.isFinite(campaign.savings[h.id])?campaign.savings[h.id]:h.savings;campaign.savings[h.id]=previous+s.balance-s.stormCost;campaign.history.push({family:h.id,month:campaign.month,savings:campaign.savings[h.id],text:s.stories.join(' ')});}
    campaign.history=campaign.history.slice(-120);persist();renderFamily();window.dispatchEvent(new CustomEvent('family-month',{detail:{month:campaign.month,plans:getFamilyPlans(),households:getCurrentHouseholds()}}));
  };
  root.querySelector('#reset-family').onclick=()=>{campaign={family:campaign.family,plans:{},history:[],month:0,savings:{},memory:newCityMemory()};persist();renderFamily();window.dispatchEvent(new Event('family-reset'))};
}
export function initFamily(){campaign=read();campaign.memory=validMemory(campaign.memory,campaign.plans,campaign.month);persist();renderFamily();}

function renderMemory(){
 const root=document.querySelector('#city-memory');if(!root)return;
 const clock=memorySnapshot(campaign.memory,campaign.plans,campaign.month);
 root.innerHTML=`<div class="family-heading"><div><span class="tag">DECISIONS ECHO THROUGH TIME</span><h2>The city has a memory</h2></div><span class="badge">MONTH ${campaign.month}</span></div><p>Housing opens in phases. Roadworks disrupt travel and diner trade before connections improve. A major storm arrives every six months; completed defenses need upkeep after six months.</p><div class="memory-summary"><span>Next storm: <strong>month ${clock.nextStorm}</strong></span><span>Working flood protection: <strong>${Math.round(clock.protection).toLocaleString()} homes</strong></span></div><p class="family-note">Challenge results and council testimony are forecasts of a completed plan. Household numbers below show what is happening now. Storm repairs cost up to $1,200 per household, scaled by remaining flood exposure.</p><h3 class="section-title">WHAT’S COMING</h3><ol id="memory-upcoming"></ol><div class="actions"><button id="repair-defenses" ${!clock.neglected?'disabled':''}>Fund overdue upkeep · $200 per household</button></div><p class="family-note">Upkeep restores worn defenses for six months and immediately charges each household’s savings. You can prepare by building defenses before the next storm; repairs after a storm cannot undo damage already paid.</p><h3 class="section-title">CITY HISTORY</h3><ol id="memory-history"></ol>`;
 const upcoming=root.querySelector('#memory-upcoming');
 for(const event of [{month:clock.nextStorm,name:'Major storm',text:'Exposed households face repair costs.'},...clock.upcoming].sort((a,b)=>a.month-b.month)){
   const li=document.createElement('li');li.className=event.overdue?'memory-overdue':'';li.textContent=`${event.overdue?'Overdue since month':'Month'} ${event.month} · ${event.name}. ${event.text}`;upcoming.append(li);
 }
 const history=root.querySelector('#memory-history');
 for(const event of campaign.memory.events.slice(-12).reverse()){const li=document.createElement('li');li.textContent=`Month ${event.month} · ${event.text}`;history.append(li);}
 if(!history.children.length)history.textContent='Adopt a plan at City Council Night to start the city’s story.';
 root.querySelector('#repair-defenses').onclick=()=>{
   if(!repairMemory(campaign.memory,campaign.month))return;
   for(const h of households){const previous=Number.isFinite(campaign.savings[h.id])?campaign.savings[h.id]:h.savings;campaign.savings[h.id]=previous-200;campaign.history.push({family:h.id,month:campaign.month,savings:campaign.savings[h.id],text:'Contributed $200 to restore worn flood defenses.'});}
   campaign.history=campaign.history.slice(-120);persist();renderFamily();
 };
}
