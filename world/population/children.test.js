import {test,expect} from 'bun:test';
import {createPopulationModel,serializePopulation,restorePopulation,inspectPerson,stepPopulation} from './model.js';
import {normalizePopulationConfig,POPULATION_VERSION} from './contracts.js';
import {personNeedEffects} from './behavior.js';
import {childScheduleAt,prepareChildrenInterval,parentCareConstraint,childModePermission,recordFamilyActivityInterval,finalizeChildrenDay,parentWorkFraction,consumeChildcareCosts,inspectChild} from './children.js';
const context={districts:[{id:'home',x:0,z:0}],buildings:[{id:'house',kind:'home',center:[0,0]},{id:'school',kind:'school',center:[0,0]}]};
function family(config={}){const model=createPopulationModel({population:80,householdSize:4,seed:42,calendarStartEpochDay:20458,...config},context),i=model.children.indices[0],p=model.people,h=p.household[i];for(let k=0;k<model.households.size[h];k++){const adult=model.households.start[h]+k;if(p.age[adult]!==0){p.employed[adult]=1;p.income[adult]=60000;p.offset[adult]=0;}}model.households.savings[h]=100000;return{model,i,h,p};}

test('actual generated children have bounded ages, same-household guardians and reciprocal bounded peers',()=>{
 const {model}=family(),p=model.people;expect(model.children.indices.length).toBeGreaterThan(0);
 for(const i of model.children.indices){expect(p.ageYears[i]).toBeGreaterThanOrEqual(0);expect(p.ageYears[i]).toBeLessThan(18);expect(p.parent1[i]).toBeGreaterThanOrEqual(0);for(const parent of [p.parent1[i],p.parent2[i]].filter(i=>i>=0)){expect(p.household[parent]).toBe(p.household[i]);expect(p.ageYears[parent]-p.ageYears[i]).toBeGreaterThanOrEqual(18);}expect(model.children.friends[i].length).toBeLessThanOrEqual(4);for(const friend of model.children.friends[i]){expect(model.children.friends[friend]).toContain(i);expect(Math.abs(p.ageYears[friend]-p.ageYears[i])).toBeLessThanOrEqual(2);}}
});

test('later teen start changes real sleep/school deadlines; minors never drive household cars',()=>{
 const {model,i,p}=family({teenSchoolStartMinute:600});p.ageYears[i]=15;
 expect(childScheduleAt(model,i,500)).toMatchObject({childKind:'sleep',until:540});
 expect(childScheduleAt(model,i,590)).toMatchObject({childKind:'school',activity:2});
 expect(childModePermission(model,i,'car').available).toBe(false);expect(childModePermission(model,i,'bus').available).toBe(true);
 p.ageYears[i]=5;expect(childModePermission(model,i,'walk').available).toBe(false);
});

test('only actual school/site intervals count attendance; travel never becomes instruction',()=>{
 const {model,i,p}=family();p.ageYears[i]=10;p.current[i]=model.children.schoolDistrict[i];p.currentLocation[i]=model.children.schoolLocation[i];p.remaining[i]=0;
 prepareChildrenInterval(model,510,15,[{services:1}]);
 recordFamilyActivityInterval(model,i,8,510,10);recordFamilyActivityInterval(model,i,2,520,5);
 expect(model.children.expectedInstructionMinutes[i]).toBe(15);expect(model.children.instructionMinutes[i]).toBe(5);expect(model.children.attendanceMinutes[i]).toBe(5);
 recordFamilyActivityInterval(model,i,6,660,20);expect(model.children.recessMinutes[i]).toBe(20);expect(model.children.academicProxy[i]).toBeLessThan(1);
});

test('unavailable care constrains an actual guardian and records a care-related wage availability fraction',()=>{
 const {model,i,h,p}=family({childcareCapacity:0});p.ageYears[i]=3;
 prepareChildrenInterval(model,600,60,[{services:1}]);const guardian=model.children.guardianByHousehold[h];
 expect(parentCareConstraint(model,guardian,600)).toMatchObject({activity:0,mandatory:true,childKind:'parent-care'});
 expect(p.laborAvailability[guardian]).toBe(0);
 const before=model.households.savings[h];recordFamilyActivityInterval(model,guardian,0,600,60);finalizeChildrenDay(model,0);
 expect(parentWorkFraction(model,guardian)).toBeCloseTo(1-60/510);expect(model.households.savings[h]).toBe(before);
});

test('attended paid care queues one existing-ledger charge, with subsidy separately disclosed',()=>{
 const {model,i,h,p}=family({childcareCapacity:10000,childcareHourlyCost:6,childcareSubsidyFraction:.5});p.ageYears[i]=3;
 prepareChildrenInterval(model,600,60,[{services:1}]);expect(model.children.careEnrollment[i]).toBe(1);
 p.current[i]=p.home[i];p.currentLocation[i]=model.children.careLocation[i];p.remaining[i]=0;
 const savings=model.households.savings[h];recordFamilyActivityInterval(model,i,2,600,60);
 expect(model.households.savings[h]).toBe(savings);
  expect(inspectChild(model,i).counters.familyCareCost).toBe(3);expect(inspectChild(model,i).counters.subsidyExposure).toBe(3);
 expect(consumeChildcareCosts(model,h)).toEqual({householdCost:3,subsidyExposure:3});expect(consumeChildcareCosts(model,h)).toEqual({householdCost:0,subsidyExposure:0});
});

test('screens are permission-limited and summer camp is an actual seeded capacity-limited routine',()=>{
 const {model,i,p}=family({childScreenMinutesPerDay:30,summerCampCapacity:10000,summerCampEnabled:1});p.ageYears[i]=10;p.current[i]=p.home[i];p.currentLocation[i]=p.homeLocation[i];p.remaining[i]=0;
 recordFamilyActivityInterval(model,i,0,1110,60);expect(model.children.dailyScreenMinutes[i]).toBe(30);
 const summer=175*1440+600;prepareChildrenInterval(model,summer,15,[{services:1}]);expect(model.children.campEnrollment[i]).toBe(1);expect(childScheduleAt(model,i,summer).childKind).toBe('camp');
});

test('children serialize with the authoritative model and incompatible older behavior versions reject',()=>{
 const {model,i}=family();prepareChildrenInterval(model,0,15,[{services:1}]);const saved=serializePopulation(model),restored=restorePopulation(saved);
 expect(restored.modelVersion).toBe(POPULATION_VERSION);expect(restored.people.ageYears).toEqual(model.people.ageYears);expect(inspectChild(restored,i)).toEqual(inspectChild(model,i));
 saved.modelVersion='1.1.0';expect(()=>restorePopulation(saved)).toThrow('version');
 const before=JSON.stringify(serializePopulation(model));inspectPerson(model,i,{track:false});expect(JSON.stringify(serializePopulation(model))).toBe(before);
});

test('child parameter validation rejects impossible clocks, fractional permissions and invalid summer windows',()=>{
 expect(()=>normalizePopulationConfig({teenSchoolStartMinute:900})).toThrow();expect(()=>normalizePopulationConfig({summerCampEnabled:.5})).toThrow();expect(()=>normalizePopulationConfig({summerStartDay:300,summerEndDay:200})).toThrow();
});

test('actual full-day care restores parental work income and charges the existing household ledger once',()=>{
 function run(capacity){const state=family({childcareCapacity:capacity,childcareHourlyCost:2,layoffRate:0,hiringRate:0}),{model,i,h,p}=state;for(let k=0;k<model.households.size[h];k++){const j=model.households.start[h]+k;if(p.age[j]===0)p.ageYears[j]=j===i?3:17;else p.ageYears[j]=40;}stepPopulation(model,{minutes:1440});return state;}
 const blocked=run(0),served=run(10000),h=served.h;
 expect(blocked.model.children.totals.parentCareLostWorkMinutes).toBeGreaterThan(served.model.children.totals.parentCareLostWorkMinutes);
 expect(served.model.households.income[h]-blocked.model.households.income[h]).toBeCloseTo(60000);
 expect(served.model.households.lastChildcareCost[h]).toBe(20);expect(served.model.households.childcarePaidTotal[h]).toBe(20);expect(served.model.households.childcareAccrued[h]).toBe(0);
 expect(served.model.metrics.childCareMinutes).toBeGreaterThan(0);expect(served.model.metrics.childcarePaidCost).toBeGreaterThan(0);
 expect(blocked.model.eventCounts.PARENT_CARE_WORK_AVAILABILITY).toBeGreaterThan(0);
});

test('later teen school start changes actual sleep energy and recorded fatigue, with no fixed utility bonus',()=>{
 function run(start){const {model,i,p}=family({teenSchoolStartMinute:start});p.ageYears[i]=15;stepPopulation(model,{minutes:420});p.energy[i]=30;stepPopulation(model,{minutes:120});return{model,i};}
 const early=run(510),late=run(600);
 expect(personNeedEffects(late.model,late.i,{minute:500,activity:0}).needRates.energy).toBeGreaterThan(0);
 expect(late.model.people.energy[late.i]).toBeGreaterThan(early.model.people.energy[early.i]);
 expect(late.model.children.sleepMinutes[late.i]-early.model.children.sleepMinutes[early.i]).toBe(90);
 expect(late.model.children.fatigue[late.i]).toBeLessThan(early.model.children.fatigue[early.i]);
 expect(late.model.metrics.teenSleepMinutes).toBeGreaterThan(early.model.metrics.teenSleepMinutes);
 expect(late.model.metrics.childObservedMinutes).toBeGreaterThan(0);
});

test('school-bound transit counts actual permitted bus/rail departures at their committed model hour',()=>{
 function run(start){const model=createPopulationModel({population:200,teenSchoolStartMinute:start,transitService:4,transitFare:0},{districts:[{id:'home',x:0,z:0,housingUnits:1000,jobs:1000,transit:1},{id:'school-district',x:4000,z:0,housingUnits:1000,jobs:1000,transit:1}],buildings:[{id:'house',kind:'home',center:[0,0]},{id:'school',kind:'school',center:[4000,0]}]});for(const d of model.districts)d.awareness=1;for(const i of model.children.indices){model.people.ageYears[i]=15;model.people.home[i]=model.people.current[i]=0;model.people.homeX[i]=model.people.x[i]=0;model.people.homeZ[i]=model.people.z[i]=0;model.people.homeLocation[i]=model.people.currentLocation[i]=0;}stepPopulation(model,{minutes:660});return model;}
 const early=run(510),late=run(600);
 expect(early.metrics.schoolBoundTransitTripsHour08).toBeGreaterThan(0);expect(late.metrics.schoolBoundTransitTripsHour09).toBeGreaterThan(0);expect(late.metrics.schoolBoundTransitTripsHour08).toBe(0);
 expect(early.children.schoolBoundTransitTripsByHour.reduce((a,b)=>a+b,0)).toBe(early.metrics.schoolBoundTransitTrips);
 expect(early.children.schoolBoundTripsByMode.car??0).toBe(0);
});

test('care availability gates the existing seeded hiring path instead of creating a separate job ledger',()=>{
 function run(capacity){const {model,i,h,p}=family({childcareCapacity:capacity,childcareHourlyCost:0,hiringRate:.5,layoffRate:0});for(let k=0;k<model.households.size[h];k++){const j=model.households.start[h]+k;if(p.age[j]===0)p.ageYears[j]=3;}const guardian=model.households.start[h];p.employed[guardian]=0;stepPopulation(model,{minutes:1440});return{model,guardian};}
 const blocked=run(0),served=run(10000);expect(blocked.model.people.employed[blocked.guardian]).toBe(0);expect(served.model.people.employed[served.guardian]).toBe(1);expect(served.model.economy.day).toBe(1);
});
