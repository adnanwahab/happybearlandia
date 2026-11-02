import {test,expect} from 'bun:test';
import {recordEvent} from '../world/population/contracts.js';
import {createPopulationModel,stepPopulation} from '../world/population/model.js';
function model(count=100){return createPopulationModel({population:count,householdSize:1,employmentRate:0,seed:42},{districts:[{id:'district',x:0,z:0,transit:1,services:1}],buildings:[{id:'home',kind:'home',center:[0,0]},{id:'food',kind:'food',center:[100,0]}]});}
test('hunger and fatigue change feasible flexible choices without requiring an AI call',()=>{
 const hungry=model(),satisfied=model(),tired=model();
 for(const m of [hungry,satisfied,tired]){m.minute=720;for(let i=0;i<100;i++){m.people.energy[i]=90;m.people.hunger[i]=95;m.people.fun[i]=90;m.people.social[i]=90;m.people.x[i]=m.people.homeX[i];m.people.z[i]=m.people.homeZ[i];}}
 hungry.people.hunger.fill(5);tired.people.energy.fill(5);
 for(const m of [hungry,satisfied,tired])stepPopulation(m,{tick:1,minutes:15});
 const dining=m=>Array.from(m.people.activity).filter(a=>a===5).length;
 expect(dining(hungry)).toBeGreaterThan(dining(satisfied)+30);
 expect(tired.people.energy.reduce((sum,n)=>sum+n,0)/100).toBeGreaterThan(5);
 expect(hungry.activityHistory.totals.agentMinutes).toBeCloseTo(1500,6);
});
test('a fractional arrival allocates leftover time to the destination and records exact completed travel',()=>{
 const m=model(1),p=m.people;m.minute=720;
 Object.assign(m.totals,{trips:1,plannedTravelMinutes:2.5});m.totals.tripCountsByMode.car=1;
 p.x[0]=0;p.z[0]=0;p.fromX[0]=0;p.fromZ[0]=0;p.toX[0]=100;p.toZ[0]=0;p.from[0]=0;p.to[0]=0;p.mode[0]=3;p.activity[0]=8;p.remaining[0]=2.5;p.tripTotal[0]=2.5;p.departureMinute[0]=720;p.plannedActivity[0]=5;p.plannedUntil[0]=780;p.toLocation[0]=1;p.hunger[0]=50;
 stepPopulation(m,{tick:1,minutes:15});
 expect(m.totals.completedTrips).toBe(1);expect(m.totals.completedTravelMinutes).toBeCloseTo(2.5,6);
 expect(m.activityHistory.totals.activityMinutes.TRANSIT).toBeCloseTo(2.5,6);
 expect(m.activityHistory.totals.activityMinutes.DINING).toBeCloseTo(12.5,6);
 expect(m.activityHistory.totals.agentMinutes).toBe(15);expect(p.x[0]).toBe(100);
 expect(p.hunger[0]).toBeGreaterThan(50);
});

test('city and business events are not multiplied by synthetic cohort weights',()=>{
 const m=createPopulationModel({population:10,representedPopulation:100,seed:42});
 recordEvent(m,'STORM',{districtId:'district-0'});
 recordEvent(m,'BUSINESS_CLOSED',{businessId:'shop-0'});
 recordEvent(m,'TEST_PERSON',{personId:`${m.prefix}-p0`});
 recordEvent(m,'TEST_EXPLICIT',{weight:3});
 const t=m.activityHistory.totals;
 expect(t.representedEventCounts.STORM).toBe(1);
 expect(t.representedEventCounts.BUSINESS_CLOSED).toBe(1);
 expect(t.representedEventCounts.TEST_PERSON).toBe(10);
 expect(t.representedEventCounts.TEST_EXPLICIT).toBe(3);
});

test('critical food and fatigue needs permit actual onsite breaks during a weekday shift',()=>{
 const m=model(1),p=m.people;m.minute=600;p.age[0]=1;p.employed[0]=1;p.offset[0]=0;
 p.hunger[0]=2;p.energy[0]=2;p.current[0]=p.work[0];p.x[0]=p.workX[0];p.z[0]=p.workZ[0];p.currentLocation[0]=p.workLocation[0];p.activity[0]=1;
 stepPopulation(m,{tick:1,minutes:45});
 expect(p.hunger[0]).toBeGreaterThan(2);expect(p.energy[0]).toBeGreaterThan(2);
 expect(m.activityHistory.totals.activityMinutes.DINING).toBeGreaterThan(0);
 expect(m.activityHistory.totals.activityMinutes.HOME).toBeGreaterThan(0);
 expect(m.activityHistory.recentEvents.some(e=>e.reason==='Critical food need break')).toBe(true);
 expect(m.activityHistory.totals.agentMinutes).toBeCloseTo(45,6);
});
