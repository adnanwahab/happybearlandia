import {houseActivityLabel,houseScreenActivity} from '../house/model.js';
import {employmentCalendar,employmentWorkWindow} from './employment.js';
/** Child agents v1: synthetic ages/guardians/peers, bounded routines and care.
 * Integration contract (behavior/economy own all money and job writes):
 * initializeChildren(model,worldContext) once after generation;
 * prepareChildrenInterval(model,start,minutes,effects) before activities;
 * childScheduleAt(model,i,minute) -> mandatory activity/until/onsite/sleep,
 *   childKind/source. Null for adults; all schedule reads are observational.
 * parentCareConstraint(model,i,minute) -> mandatory HOME constraint or null;
 * childModePermission(model,i,mode) -> {available,reason} (no minor drivers).
 * recordFamilyActivityInterval(model,i,activity,start,duration) FROM actual
 *   committed activity intervals, including travel. Never infer attendance from
 *   the final activity of a15-minute step. Call for children AND parents.
 * finalizeChildrenDay(model,day) BEFORE the existing daily income settlement.
 * parentWorkFraction(model,i) is its care-related available wage fraction;
 * consumeChildcareCosts(model,h) drains pending costs for that same existing
 *   household outflow ledger. This module NEVER writes wages/savings/jobs.
 */
import {draw,clamp,recordEvent,recordTrace} from './contracts.js';
export const CHILDREN_VERSION='children.v1';
export const CHILD_KINDS=Object.freeze(['home','sleep','school','recess','meal','screens','after-school','care','camp']);
const NONE=4294967295;
const CHILD_COUNTERS=['attendanceMinutes','instructionMinutes','expectedInstructionMinutes','expectedSchoolMinutes','engagedInstructionMinutes','recessMinutes','screenMinutes','careMinutes','campMinutes','sleepMinutes','unsupervisedMinutes','observedMinutes','fatiguePointMinutes','familyCareCost','subsidyExposure'];
const dayAt=minute=>Math.floor(minute/1440),mod=(a,b)=>((a%b)+b)%b;
const personId=(model,i)=>`${model.prefix}-p${i}`;
export const CHILDREN_ASSUMPTIONS=Object.freeze({source:'Declared synthetic child/guardian routines; not real family records or measured education/health outcomes.',peers:'At most4 reciprocal same-district peers within2 years; seeded contacts, not observed friendships.',care:'One household guardian can supervise its children. Prefer a nonemployed guardian, otherwise the lowest annual-wage guardian. No fictional childcare worker is hired.',academic:'Actual instructional exposure weighted by the declared fatigue proxy / expected instructional minutes; not grades, achievement or an empirical educational effect.',fatigue:'Accumulated activity/rest exposure,0–100; separate from needs and never a happiness offset.',capacity:'Care/camp seats count represented children; household bills remain the existing synthetic-household ledger units.',locations:'Use actual supplied school/care/camp IDs when available; otherwise explicit home-district service proxies. No school footprint is invented.',escort:'No modeled guardian co-travel or licenses. Permissions never let a child drive a household car. Unescorted travel is age-gated.',subsidy:'Accrued subsidy exposure is disclosed separately; this population model has no government subsidy funding ledger.'});

export function initializeChildren(model,context={}){
 if(model.children?.schemaVersion===CHILDREN_VERSION)return model.children;
 const p=model.people,n=p.age.length,hh=model.households;
 p.ageYears=new Uint8Array(n);p.parent1=new Int32Array(n).fill(-1);p.parent2=new Int32Array(n).fill(-1);p.laborAvailability=new Float32Array(n).fill(1);p.childcareDailyWorkFraction=new Float32Array(n).fill(1);
 const children={schemaVersion:CHILDREN_VERSION,indices:[],friends:Array.from({length:n},()=>[]),schoolDistrict:new Uint16Array(n),schoolLocation:new Uint32Array(n).fill(NONE),schoolX:new Float32Array(n),schoolZ:new Float32Array(n),careDistrict:new Uint16Array(n),careLocation:new Uint32Array(n).fill(NONE),careX:new Float32Array(n),careZ:new Float32Array(n),campDistrict:new Uint16Array(n),campLocation:new Uint32Array(n).fill(NONE),campX:new Float32Array(n),campZ:new Float32Array(n),careEnrollment:new Uint8Array(n),campEnrollment:new Uint8Array(n),guardianByHousehold:new Int32Array(hh.size.length).fill(-1),hasChildrenHousehold:new Uint8Array(hh.size.length),schoolBoundTransitTripsByHour:new Uint32Array(24),schoolBoundTripsByMode:{},fatigue:new Float32Array(n).fill(20),academicProxy:new Float32Array(n),workLostMinutes:new Float64Array(n),dailyDay:new Int32Array(n).fill(-1),dailyScreenMinutes:new Float64Array(n),enrollmentKey:null,lastFinalizedDay:-1,effects:null,totals:{familyCareCost:0,subsidyExposure:0,paidCareMinutes:0,parentCareLostWorkMinutes:0,parentObservedWorkMinutes:0,schoolBoundTransitTrips:0},assumptions:CHILDREN_ASSUMPTIONS};
 for(const field of CHILD_COUNTERS)children[field]=new Float64Array(n);
 for(const field of ['childcareAccrued','childcareSubsidyAccrued'])hh[field]=new Float64Array(hh.size.length);
 for(let i=0;i<n;i++)p.ageYears[i]=p.age[i]===0?Math.floor(draw(model.seed,i,0,101)*18):p.age[i]===2?65+Math.floor(draw(model.seed,i,0,102)*26):20+Math.floor(draw(model.seed,i,0,103)*45);
 for(let h=0;h<hh.size.length;h++){
  const members=Array.from({length:hh.size[h]},(_,k)=>hh.start[h]+k),adults=members.filter(i=>p.age[i]!==0),kids=members.filter(i=>p.age[i]===0);
  for(const i of kids){children.indices.push(i);children.hasChildrenHousehold[h]=1;for(const [slot,parent]of adults.slice(0,2).entries()){p.ageYears[parent]=Math.max(p.ageYears[parent],p.ageYears[i]+18);p[slot?'parent2':'parent1'][i]=parent;}}
 }
 const supplied=context.buildings??context.town?.buildings??model.locations,locations=new Map(model.locations.map((row,i)=>[row.id,i]));
 const venues={school:[],care:[],camp:[]};
 for(const b of supplied){const location=locations.get(String(b.id));if(location===undefined)continue;const types=[b.kind,b.amenity,b.tags?.amenity];if(types.some(type=>['school','kindergarten'].includes(type)))venues.school.push(location);if(types.some(type=>['childcare','daycare','kindergarten'].includes(type)))venues.care.push(location);if(types.some(type=>['camp','summer_camp'].includes(type)))venues.camp.push(location);}
 function nearestVenue(list,i){let best=NONE,distance=Infinity;for(const location of list){const v=model.locations[location],d=(v.x-p.homeX[i])**2+(v.z-p.homeZ[i])**2;if(d<distance){distance=d;best=location;}}return best;}
 for(const i of children.indices){
  for(const [kind,list]of Object.entries(venues)){const location=nearestVenue(list,i),point=location===NONE?model.districts[p.home[i]]:model.locations[location];children[`${kind==='school'?'school':kind}Location`][i]=location;children[`${kind}X`][i]=point.x;children[`${kind}Z`][i]=point.z;}
  let district=p.home[i];if(children.schoolLocation[i]!==NONE){let distance=Infinity;for(let d=0;d<model.districts.length;d++){const row=model.districts[d],value=(row.x-children.schoolX[i])**2+(row.z-children.schoolZ[i])**2;if(value<distance){distance=value;district=d;}}}
  children.schoolDistrict[i]=district;for(const kind of ['care','camp']){let target=p.home[i],distance=Infinity;if(children[kind+'Location'][i]!==NONE)for(let d=0;d<model.districts.length;d++){const row=model.districts[d],value=(row.x-children[kind+'X'][i])**2+(row.z-children[kind+'Z'][i])**2;if(value<distance){distance=value;target=d;}}children[kind+'District'][i]=target;}p.work[i]=district;p.workLocation[i]=children.schoolLocation[i];p.workX[i]=children.schoolX[i];p.workZ[i]=children.schoolZ[i];
 }
 // Bounded candidate draws avoid an all-pairs friendship construction.
 const buckets=new Map();for(const i of children.indices){const key=`${p.home[i]}:${p.ageYears[i]}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
 for(const i of children.indices)for(let attempt=0;attempt<24&&children.friends[i].length<4;attempt++){const age=clamp(p.ageYears[i]+Math.floor(draw(model.seed,i,attempt,104)*5)-2,0,17),pool=buckets.get(`${p.home[i]}:${age}`);if(!pool?.length)continue;const j=pool[Math.floor(draw(model.seed,i,attempt,105)*pool.length)];if(j===i||children.friends[i].includes(j)||children.friends[j].length>=4)continue;children.friends[i].push(j);children.friends[j].push(i);}
 children.indices=Uint32Array.from(children.indices);model.children=children;return children;
}
const summer=(model,day)=>{const dayOfYear=employmentCalendar(model,day*1440).dayOfYear;return dayOfYear>=model.config.summerStartDay&&dayOfYear<model.config.summerEndDay;};
function calendar(model,i,absolute){const c=model.config,day=dayAt(absolute),base=day*1440,age=model.people.ageYears[i],weekend=employmentCalendar(model,absolute).dayOfWeek>=5,summerBreak=summer(model,day),schoolDay=age>=5&&!weekend&&!summerBreak,start=base+(age>=13?c.teenSchoolStartMinute:c.schoolStartMinute),end=start+c.schoolDayMinutes;return{day,base,age,weekend,summerBreak,schoolDay,start,end};}
const service=(model,d)=>clamp(model.children.effects?.[d]?.services??model.weatherEffects?.serviceAvailability??1,0,1);
function atSite(model,i,location,district){return model.people.remaining[i]<=0&&(location===NONE?model.people.current[i]===district:model.people.currentLocation[i]===location);}
function resetDaily(model,i,day){const children=model.children;if(children.dailyDay[i]!==day){children.dailyDay[i]=day;children.dailyScreenMinutes[i]=0;}}

export function childScheduleAt(model,i,absolute=model.minute){
 if(model.people.age[i]!==0||!model.children)return null;
 const p=model.people,k=model.children,c=model.config,t=calendar(model,i,absolute),m=absolute-t.base,schoolOpen=service(model,k.schoolDistrict[i])>0,home=p.home[i];
 const homeDestination={district:home,x:p.homeX[i],z:p.homeZ[i],location:p.homeLocation[i],source:'actual household home access point'};
 const result=(childKind,activity,until,extra={})=>({childKind,activity,until,mandatory:true,reason:`Child ${childKind} routine`,destination:homeDestination,...extra});
 const wake=t.weekend||t.summerBreak?(t.age>=13?540:480):t.age>=5?(t.age>=13?c.teenSchoolStartMinute:c.schoolStartMinute)-60:420,bed=t.age>=13?1320:t.age>=6?1260:1230;
 if(m<wake||m>=bed)return result('sleep',0,m<wake?t.base+wake:t.base+1440+wake,{sleep:true});
 if(t.schoolDay&&schoolOpen&&absolute>=t.start-30&&absolute<t.end){
  const destination={district:k.schoolDistrict[i],x:k.schoolX[i],z:k.schoolZ[i],location:k.schoolLocation[i],source:k.schoolLocation[i]===NONE?'explicit synthetic district school proxy':'supplied school access point'};
  const recessStart=t.start+150,recessEnd=recessStart+c.schoolRecessMinutes,lunchEnd=recessEnd+30;
  if(absolute<recessStart)return result('school',2,recessStart,{destination});
  if(absolute<recessEnd)return result('recess',6,recessEnd,{destination,onsite:true});
  if(absolute<lunchEnd)return result('meal',5,lunchEnd,{destination,onsite:true,eat:true});
  return result('school',2,t.end,{destination});
 }
 if(!t.weekend&&k.campEnrollment[i]&&t.summerBreak&&m>=540&&m<1020)return result('camp',6,t.base+1020,{destination:{district:k.campDistrict[i],x:k.campX[i],z:k.campZ[i],location:k.campLocation[i],source:k.campLocation[i]===NONE?'explicit district camp proxy':'supplied camp access point'}});
 const careStart=t.age<5?t.base+480:t.end;
 if(!t.weekend&&k.careEnrollment[i]&&absolute>=careStart&&m<1080)return result('care',2,t.base+1080,{destination:{district:k.careDistrict[i],x:k.careX[i],z:k.careZ[i],location:k.careLocation[i],source:k.careLocation[i]===NONE?'explicit district care proxy':'supplied care access point'}});
 const used=k.dailyDay[i]===t.day?k.dailyScreenMinutes[i]:0,screenLimit=t.age<2?0:c.childScreenMinutesPerDay;
 if(m>=1110&&m<Math.min(bed,1110+screenLimit)&&used<screenLimit)return result('screens',0,Math.min(t.base+1110+screenLimit,absolute+screenLimit-used,t.base+bed));
 if((m>=wake&&m<wake+30)||(m>=1080&&m<1110))return result('meal',0,t.base+(m<1080?wake+30:1110),{eat:true});
 const next=[wake+30,t.schoolDay&&schoolOpen?(t.start-t.base-30):null,!t.weekend&&k.campEnrollment[i]?540:null,!t.weekend&&k.careEnrollment[i]?(careStart-t.base):null,1080,1110,Math.min(bed,1110+screenLimit),bed].filter(value=>Number.isFinite(value)&&value>m+1e-8);
 return result('after-school',0,t.base+Math.min(...next,bed));
}
function needsSupervision(model,i,minute){if(model.people.age[i]!==0||model.people.ageYears[i]>=model.config.childSupervisionAge)return false;const k=model.children,p=model.people,plan=childScheduleAt(model,i,minute),t=calendar(model,i,minute);if(plan.sleep)return false;if(t.schoolDay&&minute>=t.start&&minute<t.end&&['school','recess','meal'].includes(plan.childKind)&&atSite(model,i,k.schoolLocation[i],k.schoolDistrict[i]))return false;if(plan.childKind==='care'&&atSite(model,i,k.careLocation[i],k.careDistrict[i]))return false;if(plan.childKind==='camp'&&atSite(model,i,k.campLocation[i],k.campDistrict[i]))return false;return true;}
function guardianFor(model,h){const p=model.people,hh=model.households;let best=-1;for(let k=0;k<hh.size[h];k++){const i=hh.start[h]+k;if(p.age[i]===0)continue;const rank=index=>!p.employed[index]||[2,3].includes(model.employment?.leaveKind[index])?0:1;if(best<0||rank(i)<rank(best)||rank(i)===rank(best)&&p.income[i]<p.income[best])best=i;}return best;}
export function prepareChildrenInterval(model,start,minutes,effects){
 const k=model.children;if(!k)return;const p=model.people,c=model.config,hh=model.households,day=dayAt(start);k.effects=effects??null;
 const key=JSON.stringify([day,c.childcareCapacity,c.childcareHourlyCost,c.childcareSubsidyFraction,c.summerCampEnabled,c.summerCampCapacity,c.summerCampDailyCost,c.schoolStartMinute,c.teenSchoolStartMinute,c.schoolDayMinutes,c.summerStartDay,c.summerEndDay,(effects??[]).map(e=>e.services)]);
 if(k.enrollmentKey!==key){
  k.enrollmentKey=key;k.careEnrollment.fill(0);k.campEnrollment.fill(0);
  const budgets=Float64Array.from(hh.savings,(s,h)=>Math.max(0,Math.max(0,s)+Math.max(0,hh.income[h]/365-hh.rent[h]/30-(330+hh.size[h]*140)/30)-(hh.childcareAccrued[h]||0)));
  const ordered=[...k.indices].sort((a,b)=>draw(model.seed,a,day,106)-draw(model.seed,b,day,106)||a-b);let care=0,camp=0;
  for(const i of ordered){if(p.age[i]!==0)continue;const t=calendar(model,i,start),h=p.household[i],guard=guardianFor(model,h);if(t.weekend||guard<0)continue;
   const weight=model.weight??1,available=service(model,p.home[i]);
   const campWanted=t.summerBreak&&t.age>=5&&c.summerCampEnabled&&(p.employed[guard]||draw(model.seed,i,day,107)<.5),campCost=c.summerCampDailyCost*(1-c.childcareSubsidyFraction);
   if(campWanted&&camp+weight<=c.summerCampCapacity*available&&budgets[h]>=campCost){k.campEnrollment[i]=1;camp+=weight;budgets[h]-=campCost;continue;}
   const hours=t.age<5?10:Math.max(0,1080-(t.end-t.base))/60,cost=hours*c.childcareHourlyCost*(1-c.childcareSubsidyFraction);
   const searching=p.age[guard]===1&&c.hiringRate>0;
   if(hours>0&&(t.age<5||!t.summerBreak)&&t.age<c.childSupervisionAge&&(p.employed[guard]||searching)&&care+weight<=c.childcareCapacity*available&&budgets[h]>=cost){k.careEnrollment[i]=1;care+=weight;budgets[h]-=cost;}
  }
 }
 p.laborAvailability.fill(1);for(let h=0;h<hh.size.length;h++)k.guardianByHousehold[h]=guardianFor(model,h);
 for(const i of k.indices)if(needsSupervision(model,i,start)){const guardian=k.guardianByHousehold[p.household[i]];if(guardian>=0)p.laborAvailability[guardian]=0;}
}
export function parentCareConstraint(model,i,minute=model.minute){
 if(!model.children||model.people.age[i]===0||!model.children.hasChildrenHousehold[model.people.household[i]])return null;const p=model.people,h=p.household[i],hh=model.households;if(model.children.guardianByHousehold[h]!==i)return null;
 let until=Infinity;const children=[];for(let offset=0;offset<hh.size[h];offset++){const child=hh.start[h]+offset;if(p.age[child]!==0||!needsSupervision(model,child,minute))continue;children.push(personId(model,child));until=Math.min(until,childScheduleAt(model,child,minute).until);}
 if(!children.length)return null;
 return{activity:0,mandatory:true,until,childKind:'parent-care',reason:'Household child supervision constraint',reasonCodes:['CHILDCARE_UNAVAILABLE'],children,destination:{district:p.home[i],x:p.homeX[i],z:p.homeZ[i],location:p.homeLocation[i],source:'actual household home access point'}};
}
export function nextFamilyBoundary(model,i,minute=model.minute){const p=model.people,hh=model.households;if(!model.children||!model.children.hasChildrenHousehold[p.household[i]])return Infinity;const h=p.household[i];let until=(dayAt(minute)+1)*1440;for(let offset=0;offset<hh.size[h];offset++){const child=hh.start[h]+offset;if(p.age[child]!==0)continue;const plan=childScheduleAt(model,child,minute),t=calendar(model,child,minute);until=Math.min(until,plan.until,t.start>minute?t.start:Infinity,t.end>minute?t.end:Infinity);}return until;}
export function childModePermission(model,i,mode){
 const p=model.people;if(p.age[i]!==0)return{available:true,reason:null};const age=p.ageYears[i],c=model.config;
 const available=mode==='walk'?age>=c.childIndependentWalkAge:mode==='bike'?age>=Math.max(10,c.childIndependentWalkAge):['bus','rail'].includes(mode)?age>=c.childIndependentTransitAge:false;
 return{available,reason:available?null:mode==='car'?'MINOR_CANNOT_DRIVE_NO_ESCORT_MODEL':'GUARDIAN_UNESCORTED_TRAVEL_PERMISSION'};
}
export function recordFamilyActivityInterval(model,i,activity,start,duration){
 if(!(duration>0)||!model.children)return;const k=model.children,p=model.people,end=start+duration;
 if(p.age[i]!==0){if(!k.hasChildrenHousehold[p.household[i]])return;const initialWindow=employmentWorkWindow(model,i,start);if(end<=(dayAt(start)+1)*1440&&(!initialWindow.scheduled||end<=initialWindow.start||start>=initialWindow.end))return;let minute=start;while(minute<end-1e-8){const care=parentCareConstraint(model,i,minute),base=dayAt(minute)*1440,window=employmentWorkWindow(model,i,minute),stop=Math.min(end,nextFamilyBoundary(model,i,minute),base+1440),workMinutes=window.scheduled?Math.max(0,Math.max(0,Math.min(stop,window.end)-Math.max(minute,window.start))-Math.max(0,Math.min(stop,window.mealEnd)-Math.max(minute,window.mealStart))):0;if(p.employed[i]&&k.hasChildrenHousehold[p.household[i]])k.totals.parentObservedWorkMinutes+=workMinutes;if(care&&p.employed[i]&&activity!==1){k.workLostMinutes[i]+=workMinutes;k.totals.parentCareLostWorkMinutes+=workMinutes;}minute=stop;}return;}
 let minute=start;
 while(minute<end-1e-8){const plan=childScheduleAt(model,i,minute),t=calendar(model,i,minute),stop=Math.min(end,plan.until,t.start>minute?t.start:Infinity,t.base+1440),dt=stop-minute;if(!(dt>0))break;resetDaily(model,i,t.day);
  const school=atSite(model,i,k.schoolLocation[i],k.schoolDistrict[i]),home=atSite(model,i,p.homeLocation[i],p.home[i]),inClass=plan.childKind==='school'&&minute>=t.start;
  if(t.schoolDay&&minute>=t.start&&minute<t.end){k.expectedSchoolMinutes[i]+=dt;if(inClass)k.expectedInstructionMinutes[i]+=dt;if(school&&[2,5,6].includes(activity)){k.attendanceMinutes[i]+=dt;if(inClass&&activity===2){k.instructionMinutes[i]+=dt;k.engagedInstructionMinutes[i]+=dt*Math.max(.25,1-k.fatigue[i]/125);}}}
  if(plan.childKind==='recess'&&activity===6&&school)k.recessMinutes[i]+=dt;
  const houseLabel=houseActivityLabel(model,i,minute),screen=houseScreenActivity(model,i,minute)||!houseLabel&&plan.childKind==='screens';if(screen&&activity===0&&home){k.screenMinutes[i]+=dt;k.dailyScreenMinutes[i]+=dt;}
  const sleeping=plan.sleep&&activity===0&&home&&(!houseLabel||houseLabel==='HOUSE rest');if(sleeping)k.sleepMinutes[i]+=dt;
  const care=plan.childKind==='care'&&activity===2&&atSite(model,i,k.careLocation[i],k.careDistrict[i]),camp=plan.childKind==='camp'&&activity===6&&atSite(model,i,k.campLocation[i],k.campDistrict[i]);
  if(care||camp){const h=p.household[i],gross=dt*(camp?model.config.summerCampDailyCost/480:model.config.childcareHourlyCost/60),subsidy=gross*model.config.childcareSubsidyFraction;model.households.childcareAccrued[h]+=gross-subsidy;model.households.childcareSubsidyAccrued[h]+=subsidy;k.familyCareCost[i]+=gross-subsidy;k.subsidyExposure[i]+=subsidy;k.totals.familyCareCost+=gross-subsidy;k.totals.subsidyExposure+=subsidy;k.totals.paidCareMinutes+=dt;k[camp?'campMinutes':'careMinutes'][i]+=dt;}
  if(needsSupervision(model,i,minute)){const parent=k.guardianByHousehold[p.household[i]];if(parent<0||!atSite(model,parent,p.homeLocation[i],p.home[i]))k.unsupervisedMinutes[i]+=dt;}
  const before=k.fatigue[i],rate=sleeping?-.12:activity===8?.045:screen?.025:activity===2?.03:.015,after=clamp(before+dt*rate,0,100),active=Math.min(dt,Math.max(0,((rate>0?100:0)-before)/rate));
  k.fatiguePointMinutes[i]+=(before+(before+rate*active))/2*active+after*(dt-active);k.observedMinutes[i]+=dt;k.fatigue[i]=after;
  k.academicProxy[i]=k.expectedInstructionMinutes[i]?clamp(k.engagedInstructionMinutes[i]/k.expectedInstructionMinutes[i],0,1):0;minute=stop;
 }
}
export function finalizeChildrenDay(model,day){const k=model.children;if(!k||day<=k.lastFinalizedDay)return;k.lastFinalizedDay=day;for(let i=0;i<model.people.age.length;i++){const lost=k.workLostMinutes[i],expected=model.employment?.expectedPaidMinutes[i]||employmentWorkWindow(model,i,model.minute-1).paidMinutes,fraction=expected?clamp(1-lost/expected,0,1):1;model.people.childcareDailyWorkFraction[i]=fraction;if(lost>0){const event={personId:personId(model,i),householdId:`${model.prefix}-h${model.people.household[i]}`,day,lostWorkMinutes:lost,availableWorkFraction:fraction,reasonCodes:['CHILDCARE_UNAVAILABLE']};recordEvent(model,'PARENT_CARE_WORK_AVAILABILITY',event);if(i%97===0||model.selectedIndex===i)recordTrace(model,'person',i,{...event,type:'PARENT_CARE_WORK_AVAILABILITY',minute:model.minute,chosen:'care-constrained work availability',reason:'Committed care-related absence during scheduled work; actual work/leave pay is settled once by the employment ledger.'});}k.workLostMinutes[i]=0;}}
export function parentWorkFraction(model,i){return model.people.childcareDailyWorkFraction?.[i]??1;}
export function recordChildTripDeparture(model,i,minute,mode,plan){const k=model.children;if(!k||model.people.age[i]!==0||!['school','recess','meal'].includes(plan.childKind)||plan.activity===0)return;k.schoolBoundTripsByMode[mode]=(k.schoolBoundTripsByMode[mode]||0)+1;if(['bus','rail'].includes(mode)){k.totals.schoolBoundTransitTrips++;k.schoolBoundTransitTripsByHour[Math.floor(mod(minute,1440)/60)]++;}}
/** Prospective next-workday availability only gates existing job-search odds;
 * actual paid income still uses the committed prior-day care loss above. */
export function parentHiringAvailability(model,i,day=dayAt(model.minute)){
 if(!model.children||model.people.age[i]===0)return 1;const p=model.people,h=p.household[i],hh=model.households;
 if(guardianFor(model,h)!==i)return 1;
 const work=employmentWorkWindow(model,i,day*1440);let available=0,total=0;for(let minute=work.start;minute<work.end;minute+=15){if(minute>=work.mealStart&&minute<work.mealEnd)continue;let needed=false;for(let k=0;k<hh.size[h];k++){const child=hh.start[h]+k;if(p.age[child]!==0||p.ageYears[child]>=model.config.childSupervisionAge)continue;const plan=childScheduleAt(model,child,minute);if(!plan.sleep&&!['school','recess','care','camp'].includes(plan.childKind)&&!(plan.childKind==='meal'&&plan.activity===5)){needed=true;break;}}total+=15;if(!needed)available+=15;}return total?available/total:1;
}
export function consumeChildcareCosts(model,h){const hh=model.households,result={householdCost:hh.childcareAccrued?.[h]??0,subsidyExposure:hh.childcareSubsidyAccrued?.[h]??0};if(hh.childcareAccrued)hh.childcareAccrued[h]=0;if(hh.childcareSubsidyAccrued)hh.childcareSubsidyAccrued[h]=0;return result;}
export function inspectChild(model,i){if(model.people.age[i]!==0||!model.children)return null;const p=model.people,k=model.children;return{schemaVersion:CHILDREN_VERSION,ageYears:p.ageYears[i],parentIds:[p.parent1[i],p.parent2[i]].filter(index=>index>=0).map(index=>personId(model,index)),friendIds:k.friends[i].map(index=>personId(model,index)),schoolDistrictId:model.districts[k.schoolDistrict[i]].id,schoolLocationId:k.schoolLocation[i]===NONE?null:model.locations[k.schoolLocation[i]].id,schoolLocationSource:k.schoolLocation[i]===NONE?'synthetic district school proxy':'supplied school access point',careEnrolled:!!k.careEnrollment[i],campEnrolled:!!k.campEnrollment[i],permissions:Object.fromEntries(['walk','bike','car','bus','rail'].map(mode=>[mode,childModePermission(model,i,mode)])),counters:Object.fromEntries(CHILD_COUNTERS.map(field=>[field,k[field][i]])),fatigueProxy:k.fatigue[i],academicExposureProxy:k.academicProxy[i],currentSchedule:childScheduleAt(model,i,model.minute),assumptions:CHILDREN_ASSUMPTIONS};}
export function childrenSnapshot(model){
 const k=model.children;if(!k)return{schemaVersion:CHILDREN_VERSION,available:false};const m=childrenMetrics(model);
 return{schemaVersion:CHILDREN_VERSION,available:true,children:m.childCount,representedChildren:m.representedChildren,attendanceMinutes:m.childAttendanceMinutes,instructionMinutes:m.childInstructionMinutes,expectedInstructionMinutes:m.childExpectedInstructionMinutes,recessMinutes:m.childRecessMinutes,screenMinutes:m.childScreenMinutes,careMinutes:m.childCareMinutes,campMinutes:m.childCampMinutes,unsupervisedMinutes:m.childUnsupervisedMinutes,meanFatigueProxy:m.meanChildFatigueProxy,fatigueObservedChildMinutes:m.childObservedMinutes,meanAcademicExposureProxy:m.childAcademicExposureRatio,totals:{...k.totals},units:'Raw modeled child-minutes. Fatigue uses observed child-time; academic exposure uses expected instruction-time. Represented equivalents are separate.',assumptions:CHILDREN_ASSUMPTIONS};
}
export const CHILD_METRIC_UNITS=Object.freeze({childCount:'people',representedChildren:'represented people',childSleepMinutes:'child-minutes',teenSleepMinutes:'teen-minutes',childAttendanceMinutes:'child-minutes',childInstructionMinutes:'child-minutes',childExpectedInstructionMinutes:'child-minutes',childRecessMinutes:'child-minutes',childScreenMinutes:'child-minutes',childCampMinutes:'child-minutes',childCareMinutes:'child-minutes',childUnsupervisedMinutes:'child-minutes',childObservedMinutes:'child-minutes',childFatiguePointMinutes:'proxy-point-minutes',meanChildFatigueProxy:'proxy points',childAcademicExposureRatio:'fraction',parentCareLostWorkMinutes:'adult-minutes',parentObservedWorkMinutes:'adult-minutes',childcareAccruedCost:'USD',childcarePaidCost:'USD',childcareSubsidyExposure:'USD exposure',representedChildSleepMinutes:'represented child-minutes',representedChildAttendanceMinutes:'represented child-minutes',representedParentCareLostWorkMinutes:'represented adult-minutes',schoolBoundTransitTrips:'trips',...Object.fromEntries(Array.from({length:24},(_,h)=>[`schoolBoundTransitTripsHour${String(h).padStart(2,'0')}`,'trips']))});
export function childrenMetrics(model){
 const k=model.children;if(!k)return{};const indices=[...k.indices].filter(i=>model.people.age[i]===0),total=field=>indices.reduce((sum,i)=>sum+k[field][i],0),weight=model.weight??1;
 const childSleepMinutes=total('sleepMinutes'),childAttendanceMinutes=total('attendanceMinutes'),childObservedMinutes=total('observedMinutes'),childFatiguePointMinutes=total('fatiguePointMinutes'),expected=total('expectedInstructionMinutes');
 return{childCount:indices.length,representedChildren:indices.length*weight,childSleepMinutes,teenSleepMinutes:indices.filter(i=>model.people.ageYears[i]>=13).reduce((sum,i)=>sum+k.sleepMinutes[i],0),childAttendanceMinutes,childInstructionMinutes:total('instructionMinutes'),childExpectedInstructionMinutes:expected,childRecessMinutes:total('recessMinutes'),childScreenMinutes:total('screenMinutes'),childCampMinutes:total('campMinutes'),childCareMinutes:total('careMinutes'),childUnsupervisedMinutes:total('unsupervisedMinutes'),childObservedMinutes,childFatiguePointMinutes,meanChildFatigueProxy:childObservedMinutes?childFatiguePointMinutes/childObservedMinutes:null,childAcademicExposureRatio:expected?total('engagedInstructionMinutes')/expected:null,parentCareLostWorkMinutes:k.totals.parentCareLostWorkMinutes,parentObservedWorkMinutes:k.totals.parentObservedWorkMinutes,childcareAccruedCost:k.totals.familyCareCost,childcarePaidCost:model.households.childcarePaidTotal?.reduce((a,b)=>a+b,0)??0,childcareSubsidyExposure:k.totals.subsidyExposure,representedChildSleepMinutes:childSleepMinutes*weight,representedChildAttendanceMinutes:childAttendanceMinutes*weight,representedParentCareLostWorkMinutes:k.totals.parentCareLostWorkMinutes*weight,schoolBoundTransitTrips:k.totals.schoolBoundTransitTrips,...Object.fromEntries([...k.schoolBoundTransitTripsByHour].map((n,h)=>[`schoolBoundTransitTripsHour${String(h).padStart(2,'0')}`,n]))};
}
