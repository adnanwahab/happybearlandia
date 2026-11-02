import { expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { ACTIONS, createWorld } from "./sim.js";
import { captureSimulationState, restoreSimulationState } from "./simulation-state.js";
import { DEFAULT_SIMULATION_PARAMETERS, resolveSimulationParameters } from "./simulation-parameters.js";

function fixture({cash=20,members=2,roads=[]}={}) {
  const buildings=[['home',[0,0]],['home',[20,0]],['work',[1000,0]],['food',[5,0]]].map(([kind,center],index)=>({id:`b${index}`,index,kind,center,area:100,name:`Place ${index}`,state:{open:true,stock:50,maxStock:50,fridge:10,cash:0,litter:0,visitors:0}}));
  return {seedKey:'realism-fixture',buildings,roads,people:Array.from({length:members},(_,id)=>({id,householdId:'family',name:`Person ${id}`,age:30,home:0,job:2,school:null,shiftStart:450,shiftLen:600,money:cash,needs:{hunger:100,energy:100,fun:100,social:100},trait:'saver',x:0,z:0,mode:'idle',action:null,target:null,until:0,doing:'waking up'}))};
}

test('wages and purchases use one shared wallet, and vouchers deposit once per household and period',()=>{
  const world=createWorld(fixture());
  expect(world.households[0].cash).toBe(40);
  expect(world.people[0].money).toBe(40);
  ACTIONS.eat_out.start(world.people[0],world.buildings[3],world);
  expect(world.people[1].money).toBe(28);
  for(const p of world.people)Object.assign(p,{mode:'doing',action:'work',target:2,until:1000});
  world.step(1);
  expect(world.households[0].cash).toBeCloseTo(28.6);
  world.voucherMonthly=50;
  expect(world.sampleVoucher('year:0')).toBe(1);
  expect(world.sampleVoucher('year:0')).toBe(0);
  expect(world.households[0].cash).toBeCloseTo(78.6);
  expect(world.stats.vouchers).toBe(50);
});

test('daily household expenses charge once and record shortfall without creating debt',()=>{
  const world=createWorld(fixture({cash:5}),{startMinute:1439});
  for(const p of world.people)Object.assign(p,{mode:'doing',action:'sleep',target:0,until:3000});
  world.step(1);
  expect(world.households[0]).toMatchObject({cash:0,lastDailyCost:35,lastShortfall:25,stressedDays:1,lastCostDay:1});
  world.step(1);
  expect(world.stats.householdCosts).toBe(10);
  expect(world.households[0].stressedDays).toBe(1);
});

test('cloning people with compatibility cash aliases does not multiply household wealth',()=>{
  const first=createWorld(fixture());
  first.households[0].cash=123;
  const clonedTown=JSON.parse(JSON.stringify({seedKey:first.seedKey,buildings:first.buildings,roads:first.roads,people:first.people}));
  const second=createWorld(clonedTown);
  expect(second.households[0].cash).toBe(123);
  expect(second.people[0].moneyScope).toBe('household');
});

test('transit follows actual road path and records affordable fare, wait and ride separately',()=>{
  const town=fixture({members:1,roads:[{pts:[[0,0],[0,1000],[1000,1000],[1000,0]]}]});
  const world=createWorld(town,{startMinute:450,parameters:{transitHeadwayMinutes:0}});
  world.step(1);
  const p=world.people[0];
  expect(p.travelMode).toBe('transit');
  expect(p.tripDistanceMeters).toBe(3000);
  expect(world.stats.fares).toBe(2);
  world.step(12);
  expect(p.lastTrip).toMatchObject({mode:'transit',distanceMeters:3000,travelMinutes:12,transitMinutes:12,walkMinutes:0,transitWaitMinutes:0});
  expect(p.today.travelMinutes).toBe(p.today.walkMinutes+p.today.transitMinutes+p.today.transitWaitMinutes);
});

test('unaffordable transit falls back to physical 40m/min even with a service boost',()=>{
  const world=createWorld(fixture({members:1,cash:0}),{startMinute:450});
  world.speedMult=4;
  world.step(1);
  const p=world.people[0];expect(p.travelMode).toBe('walk');
  world.step(1);
  expect(p.x).toBe(40);
  expect(p.today.walkMinutes).toBe(1);
  expect(world.stats.fares).toBe(0);
});

test('counter-seeded waits repeat independently of behavioral RNG and decline with service',()=>{
  function departure(service,extraDraws){const world=createWorld(fixture({members:1,roads:[{pts:[[0,0],[0,1000],[1000,1000],[1000,0]]}]}),{startMinute:450,runSeed:'paired',year:3});world.speedMult=service;for(let i=0;i<extraDraws;i++)world.rand();world.step(1);return world;}
  const a=departure(1,0),b=departure(1,7),fast=departure(2,0);
  const wait=a.people[0].transitWaitMinutesRemaining;
  expect(wait).toBeGreaterThan(0);
  expect(b.people[0].transitWaitMinutesRemaining).toBe(wait);
  expect(fast.people[0].transitWaitMinutesRemaining).toBeCloseTo(wait/2);
  a.step(Math.ceil(wait)+5);
  expect(a.people[0].today.transitWaitMinutes).toBeCloseTo(wait);
  expect(a.people[0].today.travelMinutes).toBeCloseTo(a.people[0].today.transitWaitMinutes+a.people[0].today.transitMinutes);
});

test('longitudinal snapshots carry homes, needs, wallet stress, inventories and relative activity timers',()=>{
  const first=createWorld(fixture(),{startMinute:450,recordHistory:true});
  first.step(3);
  first.households[0].cash=10000;first.households[0].stressedDays=4;
  const p=first.people[0];Object.assign(p,{home:1,mode:'doing',action:'sleep',target:1,until:first.t+30});p.needs.hunger=23;p.walkHistory=[1,2,3];
  first.buildings[1].state.fridge=17;first.buildings[1].state.flooded=true;
  const saved=captureSimulationState(first);
  const carried=createWorld(fixture(),{startMinute:360,longitudinalState:saved,runSeed:'next-year',recordHistory:true});
  expect(carried.t).toBe(360);
  expect(carried.people[0]).toMatchObject({home:1,until:390,needs:{hunger:23},walkHistory:[1,2,3]});
  expect(carried.households[0]).toMatchObject({cash:10000,stressedDays:4});
  expect(carried.people[1].money).toBe(10000);
  expect(carried.buildings[1].state).toMatchObject({fridge:17,flooded:false});
  expect(carried.culture.snapshot().minute).toBe(360);
  expect(carried.activityHistory).not.toBe(first.activityHistory);
  const fresh=createWorld(fixture(),{startMinute:360,runSeed:'next-year'});
  carried.step(1);fresh.step(1);
  expect(carried.households[0].cash).toBeGreaterThan(fresh.households[0].cash+9000);
  saved.households[0].cash=1;expect(carried.people[0].money).toBe(10000);
  restoreSimulationState(carried,captureSimulationState(first));expect(carried.t).toBe(first.t);
  const mismatch=fixture();mismatch.buildings[0].center=[999,999];
  expect(()=>createWorld(mismatch,{state:saved})).toThrow('topology mismatch');
  const invalid=captureSimulationState(first);invalid.people[1].id=invalid.people[0].id;
  expect(()=>carried.restoreState(invalid)).toThrow('IDs mismatch');
});

test('snapshots omit renderer callbacks, random generators, and global history; rejected state leaves cash alone',()=>{
  const world=createWorld(fixture());
  world.people[0].rendererCallback=()=>{};world.buildings[0].mesh={dispose(){}};
  const state=world.captureState();
  expect(()=>structuredClone(state)).not.toThrow();
  expect(state.people[0].rendererCallback).toBeUndefined();
  expect(state.rand).toBeUndefined();expect(state.activityHistory).toBeUndefined();
  state.households[0].cash=-1;
  expect(()=>world.restoreState(state)).toThrow('household state');
  expect(world.households[0].cash).toBe(40);
});

test('parameter assumptions are bounded and samples remain five modeled days by default',()=>{
  expect(DEFAULT_SIMULATION_PARAMETERS.sampleDays).toBe(5);
  expect(()=>resolveSimulationParameters({walkMetersPerMinute:55})).toThrow();
  expect(()=>resolveSimulationParameters({sampleDays:1.5})).toThrow();
});

const weatherFactory=effects=>({initialMinute})=>{
  let minute=initialMinute;
  const snapshot=()=>({minute,effects:{walkComfort:1,bikeComfort:1,parkComfort:1,electricityDemandMultiplier:1,roadAvailability:1,transitAvailability:1,serviceAvailability:1,...effects}});
  return{snapshot,stepTo:value=>{minute=value;return snapshot();}};
};
test('rain changes actual trip choice through comfort cost, with no money grant or faster footsteps',()=>{
  function departure(walkComfort){const world=createWorld(fixture({members:1}),{startMinute:450,runSeed:'rain-check',parameters:{transitHeadwayMinutes:120,transitWaitWeight:4},createWeatherSimulation:weatherFactory({walkComfort})});world.step(1);return world;}
  const dry=departure(1),rain=departure(.1);
  expect(dry.people[0].travelMode).toBe('walk');
  expect(rain.people[0].travelMode).toBe('transit');
  dry.step(1);expect(dry.people[0].x).toBe(40);
  expect(rain.households[0].cash).toBe(18);
  expect(rain.weatherSnapshot.minute).toBe(rain.t);
});
test('heat reduces actual park activity choice and increases load against explicit assumed electricity capacity',()=>{
  function choice(parkComfort){const town=fixture({members:1});town.people[0].job=null;town.people[0].trait='outdoorsy';town.people[0].needs.fun=0;town.people[0].needs.social=0;town.buildings[3].kind='park';const world=createWorld(town,{startMinute:600,createWeatherSimulation:weatherFactory({parkComfort}),parameters:{electricityCapacityKwPerHousehold:10}});world.step(1);return world;}
  expect(choice(1).people[0].action).toBe('play_park');
  expect(choice(0).people[0].action).toBe('relax_home');
  const hot=createWorld(fixture(),{createWeatherSimulation:weatherFactory({electricityDemandMultiplier:3})});
  expect(hot.actualElectricityDemand).toBeCloseTo(3.6);
  expect(hot.electricity.assumedCapacityKw).toBe(2);
  expect(hot.electricity.shortfallKw).toBeCloseTo(1.6);
  expect(hot.weatherEffects.serviceAvailability).toBeCloseTo(2/3.6);
  expect(hot.households[0].cash).toBe(40);
});
test('storm access restrictions close services and prevent new trips while shelter activities remain available',()=>{
  const world=createWorld(fixture({members:1}),{startMinute:450,createWeatherSimulation:weatherFactory({roadAvailability:0,transitAvailability:0,serviceAvailability:0})});
  expect(world.isOpen(world.buildings[3])).toBe(false);
  world.step(1);
  expect(world.people[0].target).toBe(0);
  expect(world.people[0].travelMode).toBe('walk');
  expect(world.stats.fares).toBe(0);
});

test('real weather engine changes rain trip choice, responds to heat configuration, and restores at a new sample clock',()=>{
  const clear={automatic:false,temperatureC:22,rainIntensity:0,stormIntensity:0};
  function departure(rainIntensity){const world=createWorld(fixture({members:1}),{startMinute:450,runSeed:'rain-check',parameters:{transitHeadwayMinutes:60,transitWaitWeight:2},weatherParameters:{...clear,rainIntensity}});world.step(1);return world;}
  const dry=departure(0),wet=departure(1);
  expect(dry.people[0].travelMode).toBe('walk');
  expect(wet.people[0].travelMode).toBe('transit');
  const minute=wet.t;
  wet.weather.configure({temperatureC:55});
  expect(wet.t).toBe(minute);
  expect(wet.actualElectricityDemand).toBeGreaterThan(wet.electricity.assumedCapacityKw);
  const state=wet.captureState();
  const carried=createWorld(fixture({members:1}),{startMinute:0,state});
  expect(carried.weatherSnapshot.minute).toBe(0);
  expect(carried.weatherSnapshot.temperatureC).toBe(55);
  expect(carried.weatherSnapshot.rainIntensity).toBe(1);
  expect(carried.actualElectricityDemand).toBeCloseTo(wet.actualElectricityDemand);
  carried.step(1);
  expect(carried.weatherSnapshot.minute).toBe(carried.t);
});

test("legacy culture advances once per committed minute, independent of people and step batching", () => {
  const town = buildTown({ lat: 35.6595, lng: 139.7005 }, null, { maxPeople: 12 });
  const minutes = [];
  let supplied;
  const culture = { stepTo: minute => { minutes.push(minute); return { minute }; } };
  const world = createWorld(town, {
    runSeed: "culture-test",
    createCultureSimulation: options => { supplied = options; return culture; },
  });
  expect(world.culture).toBe(culture);
  expect(supplied).toEqual({ seed: "culture-test", initialMinute: 360, context: { buildings: town.buildings }, population: town.people });
  expect(minutes).toEqual([]);
  world.step(0);
  expect(minutes).toEqual([]);
  world.step(2);
  world.step(1);
  expect(minutes).toEqual([361, 362, 363]);
  expect(world.t).toBe(363);
  expect(() => world.step(0.5)).toThrow();
  expect(minutes).toEqual([361, 362, 363]);
});

test("legacy worlds create the real culture engine at 6am and advance it deterministically", () => {
  const world = createWorld(buildTown({ lat: 35.6595, lng: 139.7005 }, null, { maxPeople: 1 }));
  expect(world.culture.snapshot().minute).toBe(360);
  const event = world.culture.scheduleEvent({ type: "farmers-market", startMinute: 361 });
  world.step(1);
  expect(world.t).toBe(361);
  expect(world.culture.snapshot().minute).toBe(361);
  expect(world.culture.snapshot().activeEvents.some(row => row.id === event.id)).toBe(true);
});
