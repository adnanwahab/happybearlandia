/** Read-only legacy observations. Missing total travel is never called zero walking.
 * Total travel covers all purposes, not an identified home-to-work-only commute.
 */
export const COMMUTE_COMPLAINT_MINUTES=60;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function totalTravelMinutes(day){
 if(finite(day?.travelMinutes))return day.travelMinutes;
 const components=['walkMinutes','transitMinutes','transitWaitMinutes'];
 return components.some(key=>finite(day?.[key]))?components.reduce((sum,key)=>sum+(finite(day?.[key])?day[key]:0),0):null;
}
export function commuteBurdenMinutes(person,{day=null,rolling=true}={}){
 if(rolling&&!day){for(const key of ['travelMinutesAvg3d','commuteMinutesAvg3d'])if(finite(person?.[key]))return person[key];}
 const source=day||person?.yesterday||person?.today;
 if(rolling&&!day&&finite(person?.walkMinutesAvg3d)&&!['travelMinutes','transitMinutes','transitWaitMinutes'].some(key=>finite(source?.[key])))return person.walkMinutesAvg3d;
 const recorded=totalTravelMinutes(source);
 if(recorded!==null)return recorded;
 return finite(person?.walkMinutesAvg3d)?person.walkMinutesAvg3d:null;
}
export function householdRows(world){const source=world?.households;return source instanceof Map?[...source.values()]:Array.isArray(source)?source:source&&typeof source==='object'?Object.values(source):[];}
const householdIndexes=new WeakMap();
export function householdForPerson(world,person){if(!world||typeof world!=='object')return null;const source=world.households,size=source instanceof Map?source.size:Array.isArray(source)?source.length:null;let cached=householdIndexes.get(world);if(!cached||cached.source!==source||cached.size!==size){cached={source,size,byId:new Map(householdRows(world).map(h=>[String(h.id),h]))};householdIndexes.set(world,cached);}return cached.byId.get(String(person?.householdId))||null;}
export function householdStress(person,household=null){
 const budget=household||person?.householdBudget||person?.moneyHousehold||person?.household;
 if(finite(budget?.lastShortfall))return budget.lastShortfall>0;
 if(typeof person?.householdBudgetStress==='boolean')return person.householdBudgetStress;
 if(typeof person?.budgetStressed==='boolean')return person.budgetStressed;
 return null;
}
export function createSimulationObservationCollector(){
 const totals={residentDays:0,travelObservedResidentDays:0,travelMinutes:0,walkMinutes:0,transitMinutes:0,transitWaitMinutes:0,transitResidentDays:0,walkOnlyResidentDays:0,overCommuteComplaintResidentDays:0,householdDays:0,budgetStressedHouseholdDays:0};const daily=[];
 return{sample(world){const day={residents:0,travelMinutes:0,households:0,budgetStressedHouseholds:0};for(const person of world.people||[]){totals.residentDays++;day.residents++;const source=person.yesterday||person.today,travel=totalTravelMinutes(source);if(travel!==null){totals.travelObservedResidentDays++;totals.travelMinutes+=travel;day.travelMinutes+=travel;if(travel>COMMUTE_COMPLAINT_MINUTES)totals.overCommuteComplaintResidentDays++;}for(const key of ['walkMinutes','transitMinutes','transitWaitMinutes'])if(finite(source?.[key]))totals[key]+=source[key];if((source?.transitMinutes||0)>0||(source?.transitWaitMinutes||0)>0)totals.transitResidentDays++;else if((source?.walkMinutes||0)>0)totals.walkOnlyResidentDays++;}
  for(const household of householdRows(world)){if(!finite(household.lastShortfall))continue;totals.householdDays++;day.households++;if(household.lastShortfall>0){totals.budgetStressedHouseholdDays++;day.budgetStressedHouseholds++;}}
  daily.push(day);
 },result(){const ratio=(a,b)=>b?a/b:null;return{avgCommuteMinutes:ratio(totals.travelMinutes,totals.travelObservedResidentDays),avgTravelMinutes:ratio(totals.travelMinutes,totals.travelObservedResidentDays),avgWalkMinutes:ratio(totals.walkMinutes,totals.residentDays),avgTransitMinutes:ratio(totals.transitMinutes,totals.residentDays),avgTransitWaitMinutes:ratio(totals.transitWaitMinutes,totals.residentDays),budgetStressRate:ratio(totals.budgetStressedHouseholdDays,totals.householdDays),overCommuteComplaintRate:ratio(totals.overCommuteComplaintResidentDays,totals.travelObservedResidentDays),transitUseShare:ratio(totals.transitResidentDays,totals.residentDays),walkOnlyResidentDayShare:ratio(totals.walkOnlyResidentDays,totals.residentDays),transitTimeShare:ratio(totals.transitMinutes+totals.transitWaitMinutes,totals.travelMinutes),observations:{schemaVersion:'legacy-simulation-observations.v1',sampleDays:daily.length,totals:{...totals},daily:structuredClone(daily),methods:{commute:'Mean recorded daily total travel (walk + ride + wait) over resident-days with travel observations; all purposes, not only work trips. No annualization.',budgetStress:'Household-days with recorded positive lastShortfall / household-days with a finite lastShortfall, each household counted once per sampled day.',transitUseShare:'Resident-days recording positive transit ride/wait minutes / sampled resident-days; not trip-mode share.',transitTimeShare:'Transit ride plus wait minutes / recorded total travel minutes.',walking:'Mean recorded walk minutes per sampled resident-day; legacy avgWalkMinutes remains a walking-only metric.'},limitations:['Annual periods are representative five-day samples; unmodeled days between samples do not accrue wages, expenses, travel or demographic change.','Travel and budget observations describe the legacy-authoritative model only. They do not write the canonical population economy.','No empirical calibration, health outcome or legal causal effect is claimed.']}};}};
}
