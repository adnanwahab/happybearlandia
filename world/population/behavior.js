import {employmentScheduleAt,recordEmploymentInterval,consumeEmploymentPay,employmentIncomeFraction,employmentCalendar} from './employment.js';
import {recordJournalInterval,recordJournalMoment,populationJournalActivity} from '../journals/model.js';
import { ACTIVITIES, MODES, draw, clamp, recordTrace, recordEvent } from "./contracts.js";
import { seededChoice } from "../behavior/core/choice.js";
import {childScheduleAt,parentCareConstraint,nextFamilyBoundary,childModePermission,recordFamilyActivityInterval,recordChildTripDeparture,parentWorkFraction,consumeChildcareCosts} from './children.js';
import { getBehaviorCoefficients } from "../behavior/coefficients/registry.js";
import { recordActivity, recordHistoryEvent } from "../activity-history.js";
const modeCoefficients=getBehaviorCoefficients("mode-choice-v1");
const housingCoefficients=getBehaviorCoefficients("housing-choice-v1");
export const POPULATION_WEATHER_ASSUMPTIONS=Object.freeze({source:'analyst-assumption; uncalibrated',comfortUtilityWeight:2,serviceAccessUtilityWeight:.5,interpretation:'Weather changes feasible inputs and seeded choice utilities, never offsets a final outcome.'});
export const NEUTRAL_WEATHER_EFFECTS=Object.freeze({walkComfort:1,bikeComfort:1,parkComfort:1,electricityDemandMultiplier:1,roadAvailability:1,transitAvailability:1,serviceAvailability:1});
const weatherInput=model=>model.weatherEffects||model.weather?.effects||NEUTRAL_WEATHER_EFFECTS;


/** Illustrative activity meters, not measured wellbeing. All four are0–100 and
 * high means satisfied; hunger is fullness. Rates are NET points per simulated
 * minute, including background decay. No wall-clock timer or inspector mutation.
 */
export function personNeedEffects(model,i,options={}){const p=model.people,absolute=options.minute??model.minute,minute=((absolute%1440)+1440)%1440,activity=ACTIVITIES[options.activity??p.activity[i]],childPlan=childScheduleAt(model,i,absolute),sleeping=activity==="HOME"&&(childPlan?childPlan.sleep||p.restingUntil?.[i]>absolute:minute<420||minute>=1320||p.restingUntil?.[i]>absolute),meal=activity==="HOME"&&(childPlan?childPlan.eat||p.eatingUntil?.[i]>absolute:(minute>=420&&minute<480)||(minute>=720&&minute<780)||(minute>=1080&&minute<1140)||p.eatingUntil?.[i]>absolute);const rates={hunger:-.055,energy:-.035,fun:-.025,social:-.02};
 if(sleeping)rates.energy+=.24;
 if(meal)rates.hunger+=.45;
 if(activity==="HOME"&&!sleeping){rates.fun+=.015;if(model.households.size[p.household[i]]>1)rates.social+=.03;}
 if(activity==="DINING"){rates.hunger+=.5;rates.social+=.08;}
 if(activity==="RECREATION"){rates.fun+=.18;rates.social+=.1;}
 if(activity==="WORK"||activity==="SCHOOL"){rates.energy-=.035;rates.fun-=.015;rates.social+=.035;}
 if(activity==="TRANSIT")rates.energy-=.015;
 if(activity==="SHOPPING"){rates.fun+=.025;rates.energy-=.015;}
 if(activity==="HEALTHCARE")rates.energy+=.04;
 for(const key of Object.keys(rates))if((p[key][i]>=100&&rates[key]>0)||(p[key][i]<=0&&rates[key]<0))rates[key]=0;
 return{needRates:rates,needActivity:sleeping?"HOME sleeping":meal?"HOME meal":activity,needsSource:"Illustrative activity model; not measured wellbeing"};}
export function stepPersonNeeds(model,i,minutes,options){const effects=personNeedEffects(model,i,options);for(const key of["hunger","energy","fun","social"])model.people[key][i]=clamp(model.people[key][i]+effects.needRates[key]*minutes,0,100);}

export function eventEffects(model,minute){const weather=weatherInput(model),effects=model.districts.map(()=>({rent:1,jobs:1,roads:weather.roadAvailability??1,transit:weather.transitAvailability??1,services:weather.serviceAvailability??1,demand:1}));for(const event of model.config.events){const elapsed=minute-event.startMinute;if(elapsed<0)continue;const tail=elapsed-event.durationMinutes;const strength=tail<=0?event.magnitude:event.recoveryMinutes>0?event.magnitude*Math.exp(-tail/event.recoveryMinutes):0;if(strength<1e-5)continue;for(let d=0;d<effects.length;d++){if(event.districtId&&model.districts[d].id!==event.districtId)continue;const e=effects[d];if(event.type==="rent-increase")e.rent*=1+strength;if(["recession","employer-closes"].includes(event.type))e.jobs*=1-strength;if(event.type==="employer-opens")e.jobs*=1+strength;if(["road-closure","storm"].includes(event.type))e.roads*=Math.max(0,1-strength);if(["transit-outage","storm"].includes(event.type))e.transit*=Math.max(0,1-strength);if(event.type==="transit-opening")e.transit*=1+strength;if(event.type==="festival")e.demand*=1+strength;if(event.type==="storm")e.services*=1-strength*.7;}}return effects;}

export function modeAlternatives(model,i,destination,effects,anchor){const p=model.people,c=model.config,hh=p.household[i],from=model.districts[p.current[i]],to=model.districts[destination],km=Math.max(.15,Math.hypot((anchor?.[0]??to.x)-p.x[i],(anchor?.[1]??to.z)-p.z[i])/1000),awareness=from.awareness;
  const roadOpen=effects[p.current[i]].roads>0&&effects[destination].roads>0,carAccess=model.households.vehicles[hh]>0&&roadOpen,transitAccess=Math.min(from.transit,to.transit)*c.transitService*effects[destination].transit;
  return [{id:"walk",speed:c.walkingSpeedKmh,cost:0,available:km<=3},{id:"bike",speed:14,cost:.05*km,available:p.age[i]!==2&&km<=12},{id:"car",speed:30/Math.max(1,to.congestion),cost:km*c.carCostPerKm+1,available:carAccess},{id:"bus",speed:20/Math.max(1,to.congestion*.7),cost:c.transitFare,available:transitAccess>.05&&roadOpen},{id:"rail",speed:38,cost:c.transitFare*1.2,available:transitAccess>.3&&awareness>.25}].map(mode=>{const minutes=km/mode.speed*60+(mode.id==="bus"?8/Math.max(.1,transitAccess):mode.id==="rail"?5/Math.max(.1,transitAccess):0);const reliability=mode.id==="car"?.1:mode.id==="bus"?.15:mode.id==="rail"?.05:0;const components={time:minutes*modeCoefficients.coefficients.travelTime,cost:mode.cost*modeCoefficients.coefficients.monetaryCost,habit:p.habit?.[i]===MODES.indexOf(mode.id)?modeCoefficients.coefficients.habit:0,experiencedTime:p.habit?.[i]===MODES.indexOf(mode.id)?Math.max(0,p.experiencedTime[i]-minutes)*modeCoefficients.coefficients.travelTime*.2:0,reliability:-reliability,crowding:["bus","rail"].includes(mode.id)?-to.transitCrowding*.1:0,weatherComfort:["walk","bike"].includes(mode.id)?-POPULATION_WEATHER_ASSUMPTIONS.comfortUtilityWeight*(1-(weatherInput(model)[mode.id==="walk"?"walkComfort":"bikeComfort"]??1)):0};const permission=childModePermission(model,i,mode.id);mode.available=mode.available&&permission.available;const affordable=mode.cost<=Math.max(0,model.households.income[hh]/365*.15-model.households.transport[hh]);return{id:mode.id,available:mode.available&&affordable,minutes,cost:mode.cost,score:mode.available?Object.values(components).reduce((s,v)=>s+v,0):-1e9,components,rejectedReason:!permission.available?permission.reason:!affordable?"PRICE_EXCEEDS_MAX_BUDGET":mode.available?null:"Access, vehicle, awareness, closure or distance constraint",route:{kind:"district-straight-line approximation",from:from.id,to:to.id,distanceKm:km}};});}


function scheduleAt(model, i, minute) {
  const child=childScheduleAt(model,i,minute);if(child)return child;
  const care=parentCareConstraint(model,i,minute);if(care)return care;
  const p=model.people,base=Math.floor(minute/1440)*1440,employment=employmentScheduleAt(model,i,minute);
  if(employment?.mandatory){
    if(employment.activity===1&&p.hunger[i]<12)return{activity:5,until:Math.min(employment.until,minute+30),mandatory:true,onsite:true,reason:'Critical food need break'};
    if(employment.activity===1&&p.energy[i]<8)return{activity:0,until:Math.min(employment.until,minute+30),mandatory:true,onsite:true,rest:true,reason:'Critical fatigue rest break'};
    return employment;
  }
  if(model.dailyRoutines){
    if(minute>=base+420&&minute<base+450)return{activity:0,until:base+450,mandatory:true,eat:true,reason:'Breakfast at home'};
    if(minute>=base+1140&&minute<base+1170)return{activity:0,until:base+1170,mandatory:true,eat:true,reason:'Dinner at home'};
  }
  const night=minute<base+420||minute>=base+1320;
  if(night)return{activity:0,until:minute<base+420?base+420:base+1440+420,mandatory:true,sleep:true,reason:"Night rest schedule"};
  return{mandatory:false,until:Math.min(employment?.until??Infinity,base+1320,base+1440)};
}
function activityDestination(model,i,activity,effects){
 const p=model.people,home=p.home[i];if(activity===0)return home;if(activity===1||activity===2)return p.work[i];
 let best=home,score=-Infinity;for(let d=0;d<model.districts.length;d++){if(activity===6&&model.parkLocations?.some(row=>row.length)&&!model.parkLocations[d]?.length)continue;const row=model.districts[d],distance=Math.hypot(row.x-p.x[i],row.z-p.z[i])/1000,value=row.services*effects[d].services-distance*.15+(activity===6?row.environment:0);if(value>score){score=value;best=d;}}return best;
}
function destinationFor(model,i,activity,effects,onsite=false){
 const p=model.people;if(onsite)return{district:p.current[i],x:p.x[i],z:p.z[i],location:p.currentLocation[i]};
 const district=activityDestination(model,i,activity,effects),d=model.districts[district];
 if(activity===0)return{district,x:p.homeX[i],z:p.homeZ[i],location:p.homeLocation[i]};
 if(activity===1||activity===2)return{district,x:p.workX[i],z:p.workZ[i],location:p.workLocation[i]};
 if(activity===6&&model.parkLocations?.[district]?.length){const locations=model.parkLocations[district],location=locations[Math.floor(draw(model.seed,i,activity,55)*locations.length)],point=model.locations[location];return{district,x:point.x,z:point.z,location};}
 const index=Math.floor(draw(model.seed,i,activity,55)*d.anchors.length),anchor=d.anchors[index];
 return{district,x:anchor[0],z:anchor[1],location:d.anchorLocations[index]};
}
function chooseActivity(model,i,minute,effects){
 const p=model.people,c=model.config,schedule=scheduleAt(model,i,minute);
 if(schedule.mandatory)return{...schedule,until:Math.min(schedule.until,nextFamilyBoundary(model,i,minute)),destination:schedule.destination??destinationFor(model,i,schedule.activity,effects,schedule.onsite)};
 // A committed destination/activity survives substeps and tick endpoints.
 if(p.planUntil[i]>minute&&p.activity[i]!==8&&!(p.activity[i]===6&&(weatherInput(model).parkComfort??1)<=.1))return{activity:p.activity[i],until:Math.min(p.planUntil[i],schedule.until),destination:{district:p.current[i],x:p.x[i],z:p.z[i],location:p.currentLocation[i]},committed:true};
 const fatigue=(100-p.energy[i])/100,hunger=(100-p.hunger[i])/100,leisure=(200-p.fun[i]-p.social[i])/200;
 const hh=p.household[i],resources=model.households.income[hh]/365*.2,threshold=c.needDecisionThreshold;
 const alternatives=[
  {id:"HOME",activity:0,available:true,score:.2+fatigue*.9,components:{rest:fatigue*.9,inertia:.2}},
  {id:"DINING",activity:5,available:resources>=2,score:hunger*1.8-.15,components:{food:hunger*1.8,expense:-.15},rejectedReason:resources>=2?null:"Meal affordability constraint"},
  {id:"RECREATION",activity:6,available:p.energy[i]>=15&&(weatherInput(model).parkComfort??1)>.05,score:leisure*1.6-fatigue*.5-POPULATION_WEATHER_ASSUMPTIONS.comfortUtilityWeight*(1-(weatherInput(model).parkComfort??1)),components:{funAndSocial:leisure*1.6,fatigue:-fatigue*.5,weatherComfort:-POPULATION_WEATHER_ASSUMPTIONS.comfortUtilityWeight*(1-(weatherInput(model).parkComfort??1))},rejectedReason:(weatherInput(model).parkComfort??1)<=.05?"WEATHER_PARK_COMFORT_TOO_LOW":p.energy[i]>=15?null:"Too fatigued for an outing"},
  {id:"SHOPPING",activity:3,available:resources>=5&&p.energy[i]>=25,score:.05+draw(model.seed,i,Math.floor(minute/1440),61)*.15,components:{routine:.05},rejectedReason:resources>=5?null:"Discretionary spending constraint"}
 ];
 if(model.dailyRoutines){
  const local=minute%1440,day=Math.floor(minute/1440);
  if(local>=1020&&local<1140)alternatives[2].score+=.8;
  if(local>=960&&local<1080&&day%3===i%3)alternatives[3].score+=1.2;
  if(local>=720&&local<780)alternatives[1].score+=1;
  // A stable minority try an unexpected outing; needs, budget, travel and shifts still gate it.
  if(local>=780&&local<1260&&draw(model.seed,i,day,93)<.08){const surprise=1+Math.floor(draw(model.seed,i,day,94)*3);alternatives[surprise].score+=.9;alternatives[surprise].unusual=true;}
 }
 // Strong unsatisfied needs make relevant utilities more urgent; still seeded,
 // subject to hard constraints and schedule-limited available time.
 if(p.hunger[i]<threshold)alternatives[1].score+=1;
 if(p.energy[i]<threshold)alternatives[0].score+=1;
 if(p.fun[i]<threshold||p.social[i]<threshold)alternatives[2].score+=.7;
 for(const row of alternatives){row.destination=destinationFor(model,i,row.activity,effects);if(row.activity!==0){const service=effects[row.destination.district].services;row.components.serviceAccess=(service-1)*POPULATION_WEATHER_ASSUMPTIONS.serviceAccessUtilityWeight;row.score+=row.components.serviceAccess;if(service<=0){row.available=false;row.rejectedReason="SERVICE_ACCESS_UNAVAILABLE";}}const distance=Math.hypot(row.destination.x-p.x[i],row.destination.z-p.z[i])/1000;
   if(row.activity!==0&&distance/Math.max(1,c.walkingSpeedKmh)*60+15>schedule.until-minute){row.available=false;row.rejectedReason="Insufficient time before next mandatory schedule";}}
 const decision=seededChoice(alternatives,{draw:draw(model.seed,i,Math.floor(minute*1000),62),temperature:.18});
 const selected=alternatives.find(row=>row.id===decision.chosen)||alternatives[0];
 model.decisionCounts.ACTIVITY_CHOICE=(model.decisionCounts.ACTIVITY_CHOICE||0)+1;
 if(i%97===0||model.selectedIndex===i)recordTrace(model,"person",i,{tick:model.tick,minute,type:"ACTIVITY_CHOICE",inputs:{needs:{hunger:p.hunger[i],energy:p.energy[i],fun:p.fun[i],social:p.social[i]},availableMinutes:schedule.until-minute,resources,weather:structuredClone(weatherInput(model))},alternatives:decision.alternatives,chosen:selected.id,randomDraw:decision.randomDraw,reasonCodes:["SEEDED_UTILITY_CHOICE"],reason:"Need utilities, activity commitment, budget and next mandatory schedule"});
 if(selected.unusual&&model.journals){model.unusualDays??={};const day=Math.floor(minute/1440);if(model.unusualDays[i]!==day){model.unusualDays[i]=day;recordJournalMoment(model.journals,`${model.prefix}-p${i}`,`Resident ${i+1}`,minute,`I decided to break my usual routine and try ${selected.id==='RECREATION'?'a spontaneous outing':selected.id==='DINING'?'an unplanned meal out':'an unexpected shopping trip'}.`);}}
 const until=Math.min(schedule.until,minute+c.flexibleActivityMinutes);
 return{activity:selected.activity,until,destination:selected.destination,rest:selected.activity===0&&p.energy[i]<threshold,eat:selected.activity===0&&p.hunger[i]<threshold};
}
function semanticEvent(model,i,type,minute,detail){const personId=`${model.prefix}-p${i}`;model.eventCounts[type]=(model.eventCounts[type]||0)+1;if(model.activityHistory)recordHistoryEvent(model.activityHistory,{type,minute,personId,householdId:`${model.prefix}-h${model.people.household[i]}`,districtId:model.districts[model.people.current[i]].id,weight:model.weight,...detail});}
function applyInterval(model,i,activity,start,duration){
 if(!(duration>0))return;const p=model.people;
 if(model.journals)recordJournalInterval(model.journals,`${model.prefix}-p${i}`,`Resident ${i+1}`,populationJournalActivity(model,i,ACTIVITIES[activity],start),start,start+duration);
 recordFamilyActivityInterval(model,i,activity,start,duration);recordEmploymentInterval(model,i,activity,start,duration);
 const rates=personNeedEffects(model,i,{minute:start,activity}).needRates,means={};
 for(const key of["hunger","energy","fun","social"]){const before=p[key][i],rate=rates[key],after=clamp(before+rate*duration,0,100),active=rate===0?duration:Math.min(duration,Math.max(0,((rate>0?100:0)-before)/rate));means[key]=((before+(before+rate*active))/2*active+after*(duration-active))/duration;p[key][i]=after;}
 model.activityMinutes[ACTIVITIES[activity]]=(model.activityMinutes[ACTIVITIES[activity]]||0)+duration;
 if(model.activityHistory)recordActivity(model.activityHistory,{id:`${model.prefix}-p${i}`,householdId:`${model.prefix}-h${p.household[i]}`,activity:ACTIVITIES[activity],startMinute:start,endMinute:start+duration,weight:model.weight,districtId:model.districts[p.current[i]].id,needs:means});
}
export function stepActivities(model,minutes,effects){
 const p=model.people,end=model.minute,start=end-minutes;
 model.activityMinutes||={};
 for(const d of model.districts){d.workers=0;d.visitors=0;d.roadDemand=0;d.transitDemand=0;}
 for(let i=0;i<p.age.length;i++){
  let time=start,iterations=0;
  while(time<end-1e-9){
   if(++iterations>32)throw new Error("Activity interval exceeded bounded transitions; no time was silently discarded.");
   if(p.remaining[i]>1e-9){
    if([3,4].includes(p.mode[i])&&(!effects[p.from[i]].roads||!effects[p.to[i]].roads)){
      semanticEvent(model,i,"TRIP_CANCELLED",time,{mode:MODES[p.mode[i]],reason:"Road access closed",elapsedMinutes:time-p.departureMinute[i]});
      p.remaining[i]=0;p.activity[i]=9;p.planUntil[i]=time;model.totals.cancelledTrips=(model.totals.cancelledTrips||0)+1;model.totals.rerouted=(model.totals.rerouted||0)+1;
    }else{
      const used=Math.min(end-time,p.remaining[i]);applyInterval(model,i,8,time,used);p.remaining[i]-=used;time+=used;
      const progress=1-p.remaining[i]/p.tripTotal[i];p.x[i]=p.fromX[i]+(p.toX[i]-p.fromX[i])*progress;p.z[i]=p.fromZ[i]+(p.toZ[i]-p.fromZ[i])*progress;
      if(p.remaining[i]<=1e-9){p.remaining[i]=0;p.x[i]=p.toX[i];p.z[i]=p.toZ[i];p.current[i]=p.to[i];p.currentLocation[i]=p.toLocation[i];
        const experienced=time-p.departureMinute[i];model.totals.completedTrips++;model.totals.completedTravelMinutes+=experienced;p.experiencedTime[i]=.8*p.experiencedTime[i]+.2*experienced;p.habit[i]=p.mode[i];
        const mode=MODES[p.mode[i]];p.activity[i]=p.plannedActivity[i];p.planUntil[i]=p.plannedUntil[i];p.mode[i]=0;
        semanticEvent(model,i,"TRIP_COMPLETED",time,{mode,travelMinutes:experienced,durationMinutes:experienced,to:model.districts[p.current[i]].id,activity:ACTIVITIES[p.activity[i]]});
      }else break;
      continue;
    }
   }
   const plan=chooseActivity(model,i,time,effects),destination=plan.destination;
   if(destination.district!==p.current[i]||Math.hypot(destination.x-p.x[i],destination.z-p.z[i])>1e-4){
     const alternatives=modeAlternatives(model,i,destination.district,effects,[destination.x,destination.z]);
     for(const row of alternatives)if(["bus","rail"].includes(row.id)&&model.districts[destination.district].transitDemand>=model.config.transitCapacity*model.config.transitService*effects[destination.district].transit){row.available=false;row.rejectedReason="TRANSIT_DENIED_BOARDING";}
     const choice=seededChoice(alternatives,{draw:draw(model.seed,i,Math.floor(time*1000),56),temperature:.7}),best=alternatives.find(row=>row.id===choice.chosen);
     model.decisionCounts.MODE_CHOICE=(model.decisionCounts.MODE_CHOICE||0)+1;
     if(i%97===0||model.selectedIndex===i)recordTrace(model,"person",i,{tick:model.tick,minute:time,type:"MODE_CHOICE",inputs:{from:model.districts[p.current[i]].id,to:model.districts[destination.district].id,transitService:model.config.transitService,weather:structuredClone(weatherInput(model))},alternatives:choice.alternatives,randomDraw:choice.randomDraw,chosen:choice.chosen,reasonCodes:best?["SEEDED_UTILITY_CHOICE"]:["NO_FEASIBLE_ALTERNATIVE"],reason:best?"Seeded feasible mode utility":"No accessible affordable route before reconsideration"});
     if(best){if(p.habit[i]&&p.habit[i]!==MODES.indexOf(best.id))p.modeSwitches[i]=Math.min(65535,p.modeSwitches[i]+1);
       p.mode[i]=MODES.indexOf(best.id);p.from[i]=p.current[i];p.to[i]=destination.district;p.fromX[i]=p.x[i];p.fromZ[i]=p.z[i];p.toX[i]=destination.x;p.toZ[i]=destination.z;p.toLocation[i]=destination.location;
       p.remaining[i]=p.tripTotal[i]=best.minutes;p.departureMinute[i]=time;p.commute[i]=best.minutes;p.activity[i]=8;p.plannedActivity[i]=plan.activity;
       p.plannedUntil[i]=plan.mandatory?plan.until:Math.max(plan.until,time+best.minutes+15);p.planUntil[i]=0;
       recordChildTripDeparture(model,i,time,best.id,plan);model.households.transport[p.household[i]]+=best.cost;model.totals.trips++;model.totals.plannedTravelMinutes+=best.minutes;model.totals.tripCountsByMode[best.id]=(model.totals.tripCountsByMode[best.id]||0)+1;
       semanticEvent(model,i,"TRIP_STARTED",time,{from:model.districts[p.from[i]].id,to:model.districts[p.to[i]].id,mode:best.id,plannedMinutes:best.minutes,activity:ACTIVITIES[plan.activity]});
       continue;
     }
     // No teleport and no fictitious destination activity: wait locally, retry
     // at the next substep rather than repeatedly consuming zero simulation time.
     p.activity[i]=9;p.mode[i]=0;applyInterval(model,i,9,time,end-time);time=end;break;
   }
   if(p.activity[i]!==plan.activity)semanticEvent(model,i,"ACTIVITY_STARTED",time,{from:ACTIVITIES[p.activity[i]],activity:ACTIVITIES[plan.activity],...(plan.reason?{reason:plan.reason}:{})});
   p.activity[i]=plan.activity;p.mode[i]=0;p.planUntil[i]=plan.until;if(destination.location!==undefined)p.currentLocation[i]=destination.location;
   if(plan.sleep||plan.rest)p.restingUntil[i]=plan.until;else if(plan.activity!==0)p.restingUntil[i]=0;
   if(plan.eat)p.eatingUntil[i]=plan.until;
   // Split at schedule/meal/need-rate boundaries, not just tick endpoints.
   const day=Math.floor(time/1440),boundaries=[420,480,720,780,1080,1140,1320,1440].map(m=>day*1440+m).filter(m=>m>time+1e-9);
   const stop=Math.min(end,plan.until,nextFamilyBoundary(model,i,time),...boundaries);
   if(stop<=time+1e-9){p.planUntil[i]=time;applyInterval(model,i,p.activity[i],time,end-time);time=end;break;}
   applyInterval(model,i,p.activity[i],time,stop-time);time=stop;
  }
  const d=model.districts[p.current[i]];
  if(p.remaining[i]>0){const to=model.districts[p.to[i]];if(p.mode[i]===3)to.roadDemand++;else if(p.mode[i]>=4)to.transitDemand++;}
  else {if(p.activity[i]===1)d.workers++;if([3,4,5,6,7].includes(p.activity[i]))d.visitors++;}
  const hh=p.household[i],home=model.districts[p.home[i]],burden=model.households.rent[hh]*12/Math.max(1,model.households.income[hh]);p.utility[i]=clamp(1-burden*.7-p.commute[i]/180+home.services*.15+home.environment*.1,0,1);
 }
 for(let d=0;d<model.districts.length;d++){const row=model.districts[d];row.congestion=clamp(1+.15*(row.roadDemand/Math.max(1,model.config.roadCapacity*effects[d].roads*(1-model.config.constructionDisruption)))**2,1,5);row.transitCrowding=row.transitDemand/Math.max(1,model.config.transitCapacity*model.config.transitService*effects[d].transit);row.awareness=clamp(row.awareness+(1-row.awareness)*model.config.awarenessRate*minutes/1440,0,1);}
}

export function scoreHousing(model,h,d,effects){const hh=model.households,c=model.config,row=model.districts[d],home=hh.home[h],head=hh.start[h],work=model.districts[model.people.work[head]],income=hh.income[h];const rent=row.rent*c.rentMultiplier*effects[d].rent,burden=rent*12/Math.max(1,income),commute=(()=>{let total=0,count=0;for(let k=0;k<hh.size[h];k++){const i=hh.start[h]+k;if(!model.people.employed[i])continue;const job=model.districts[model.people.work[i]];total+=Math.hypot(row.x-job.x,row.z-job.z)/1000/25*60;count++;}return total/Math.max(1,count);})();const components={affordability:(1-burden)*housingCoefficients.coefficients.affordability,commute:commute*housingCoefficients.coefficients.commute,space:Math.min(1,row.housingUnits*c.housingCapacityMultiplier/Math.max(1,row.households))*.15,services:row.services*.2,transit:row.transit*c.transitService*.1,preference:draw(model.seed,h,d,32)*.08,movingCost:d===home?0:-c.movingCost/Math.max(1,income/12)*.1};return{id:row.id,districtIndex:d,rent,burden,commute,available:d===home||((row.households+1)*model.weight<=row.housingUnits*c.housingCapacityMultiplier&&burden<=Math.max(c.burdenThreshold,.5)&&row.services>0),score:Object.values(components).reduce((s,v)=>s+v,0),components,rejectedReason:d!==home&&((row.households+1)*model.weight>row.housingUnits*c.housingCapacityMultiplier||burden>Math.max(c.burdenThreshold,.5))?"CAPACITY_FULL or PRICE_EXCEEDS_MAX_BUDGET":null};}
export function householdDecisions(model,effects){const hh=model.households,c=model.config,p=model.people;for(let h=0;h<hh.size.length;h++){
  const home=hh.home[h],row=model.districts[home];hh.rent[h]=row.rent*c.rentMultiplier*effects[home].rent;let wages=0;for(let k=0;k<hh.size[h];k++)wages+=p.income[hh.start[h]+k]*(p.employed[hh.start[h]+k]?employmentIncomeFraction(model,hh.start[h]+k):.35);hh.income[h]=Math.max(0,hh.nonWage[h]+wages)*c.wageMultiplier;
  const monthlyIncome=hh.income[h]/12,food=180+hh.size[h]*140,utilities=150,other=monthlyIncome*.12,transport=hh.transport[h];const care=consumeChildcareCosts(model,h),outflow=(hh.rent[h]+food+utilities+other)/30+transport+care.householdCost;hh.lastChildcareCost??=new Float64Array(hh.size.length);hh.childcarePaidTotal??=new Float64Array(hh.size.length);hh.lastChildcareCost[h]=care.householdCost;hh.childcarePaidTotal[h]+=care.householdCost;
  const earned=consumeEmploymentPay(model,h),dailyIncome=hh.nonWage[h]*c.wageMultiplier/employmentCalendar(model,model.minute-1).daysInYear+earned.wages+earned.benefits;hh.savings[h]+=dailyIncome-outflow;hh.spending[h]+=outflow;hh.transport[h]=0;model.totals.spending+=outflow;
  const burden=hh.rent[h]/Math.max(1,monthlyIncome);hh.stress[h]=clamp(hh.stress[h]+Math.max(0,burden-c.burdenThreshold)*.1-(burden<c.burdenThreshold?.01:0),0,1);
  if(Math.floor(model.minute/1440)%30!==h%30)continue;if(!(hh.stress[h]>.08||hh.savings[h]<0||draw(model.seed,h,Math.floor(model.minute/1440),33)<.002))continue;
  const alternatives=model.districts.map((_,d)=>scoreHousing(model,h,d,effects)),stay=alternatives[home];for(const row of alternatives)if(row.districtIndex!==home&&(row.score-stay.score<=c.moveThreshold||hh.savings[h]<c.movingCost)){row.available=false;row.rejectedReason="Move threshold or savings constraint";}const choice=seededChoice(alternatives,{draw:draw(model.seed,h,Math.floor(model.minute/1440),57),temperature:.2}),best=alternatives.find(row=>row.id===choice.chosen);model.decisionCounts.HOUSING_SEARCH=(model.decisionCounts.HOUSING_SEARCH||0)+1;
  const affordableLocal=alternatives.some(v=>v.available&&v.burden<=c.burdenThreshold);const forced=burden>c.displacementThreshold&&!affordableLocal&&hh.savings[h]<=0;
  const move=best&&best.districtIndex!==home&&best.score-stay.score>c.moveThreshold&&hh.savings[h]>=c.movingCost;
  recordTrace(model,"household",h,{tick:model.tick,minute:model.minute,type:"HOUSING_SEARCH",inputs:{income:hh.income[h],rent:hh.rent[h],burden,stress:hh.stress[h],savings:hh.savings[h],moveThreshold:c.moveThreshold},alternatives:choice.alternatives,randomDraw:choice.randomDraw,reasonCodes:["SEEDED_UTILITY_CHOICE",...(burden>c.burdenThreshold?["HOUSING_COST_BURDEN"]:[])],chosen:move?best.id:stay.id,reason:move?"Candidate utility exceeds stay plus moving threshold":forced?"Severe burden, no affordable local alternative and exhausted savings: displacement risk state":"Stay: gain, affordability or savings constraint"});
  if(forced&&!hh.displaced[h]){hh.displaced[h]=1;row.displaced++;model.totals.displacements++;recordEvent(model,"HOUSEHOLD_DISPLACEMENT_RISK",{householdId:`${model.prefix}-h${h}`,districtId:row.id,definition:"Severe burden + no affordable available local district + nonpositive savings; no fictional destination assigned"});}
  if(move){row.households--;row.population-=hh.size[h];row.movesOut++;const to=model.districts[best.districtIndex];to.households++;to.population+=hh.size[h];to.movesIn++;hh.home[h]=best.districtIndex;hh.rent[h]=best.rent;hh.savings[h]-=c.movingCost;hh.moves[h]++;model.totals.moves++;const anchor=to.anchors[Math.floor(draw(model.seed,h,Math.floor(model.minute),58)*to.anchors.length)];for(let k=0;k<hh.size[h];k++){const i=hh.start[h]+k;p.home[i]=best.districtIndex;p.homeX[i]=anchor[0];p.homeZ[i]=anchor[1];p.homeLocation[i]=to.anchorLocations[Math.floor(draw(model.seed,h,Math.floor(model.minute),58)*to.anchors.length)];}recordEvent(model,"HOUSEHOLD_MOVED",{householdId:`${model.prefix}-h${h}`,from:row.id,to:to.id,previousRent:stay.rent,newRent:best.rent,previousCommute:stay.commute,newCommute:best.commute,utilityGain:best.score-stay.score,reason:"Scored voluntary housing choice",displacement:false});}
 }}
