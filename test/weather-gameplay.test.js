import {test,expect} from 'bun:test';
import {createWeatherSimulation,weatherEffects,WEATHER_VERSION} from '../world/weather/weather-simulation.js';
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
const DAY=1440;
const manual=(conditions={})=>({automatic:false,temperatureC:22,rainIntensity:0,stormIntensity:0,...conditions});

test('weather uses committed time with no paused change, detached observations and deterministic chunk-independent conditions',()=>{
 const a=createWeatherSimulation({seed:42}),b=createWeatherSimulation({seed:42});const before=a.serialize();for(let i=0;i<10;i++){a.stepTo(360);const snapshot=a.snapshot();snapshot.effects.walkComfort=999;snapshot.parameters.temperatureC=55;}expect(a.serialize()).toEqual(before);
 a.stepTo(20*DAY+17);for(let minute=497;minute<20*DAY+17;minute+=137)b.stepTo(minute);b.stepTo(20*DAY+17);expect(a.serialize()).toEqual(b.serialize());expect(a.snapshot()).toEqual(b.snapshot());expect(a.snapshot().retention.historyRecords).toBe(0);
});

test('weather serialized continuation preserves automatic conditions and explicit manual changes without advancing time',()=>{
 const a=createWeatherSimulation({seed:'weather-fixture'});a.stepTo(1701);const saved=a.serialize(),b=createWeatherSimulation({seed:3});b.restore(saved);a.stepTo(2001);b.stepTo(2001);expect(b.snapshot()).toEqual(a.snapshot());
 const minute=a.snapshot().minute;a.configure({rainIntensity:.8});expect(a.snapshot().parameters.automatic).toBe(false);expect(a.snapshot().minute).toBe(minute);expect(a.snapshot().rainIntensity).toBe(.8);saved.parameters.temperatureC=-40;expect(b.snapshot().parameters.temperatureC).not.toBe(-40);
});

test('rain, heat and storms produce bounded declared mechanism inputs with no invented electricity unit',()=>{
 const clear=weatherEffects(manual()),rain=weatherEffects(manual({rainIntensity:1})),heat=weatherEffects(manual({temperatureC:42})),storm=weatherEffects(manual({stormIntensity:1}));
 expect(rain.walkComfort).toBeLessThan(clear.walkComfort);expect(rain.bikeComfort).toBeLessThan(clear.bikeComfort);expect(heat.parkComfort).toBeLessThan(clear.parkComfort);expect(heat.electricityDemandMultiplier).toBeGreaterThan(clear.electricityDemandMultiplier);expect(storm.roadAvailability).toBeLessThan(clear.roadAvailability);expect(storm.transitAvailability).toBeLessThan(clear.transitAvailability);expect(storm.serviceAvailability).toBeLessThan(clear.serviceAvailability);
 for(const effects of [rain,heat,storm])for(const [key,value]of Object.entries(effects)){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThan(0);if(key!=='electricityDemandMultiplier')expect(value).toBeLessThanOrEqual(1);}
});

test('invalid weather clocks, conditions, seeds and restores fail without partial mutation',()=>{
 for(const seed of [-1,2**32,'',null,NaN])expect(()=>createWeatherSimulation({seed})).toThrow();
 const simulation=createWeatherSimulation(),before=simulation.serialize();for(const target of [359,-1,Infinity,NaN,52560001])expect(()=>simulation.stepTo(target)).toThrow();
 for(const patch of [{temperatureC:56},{rainIntensity:-1},{stormIntensity:2},{automatic:1},{unknown:true}])expect(()=>simulation.configure(patch)).toThrow();expect(simulation.serialize()).toEqual(before);
 expect(()=>simulation.restore({...before,schemaVersion:'wrong'})).toThrow();expect(()=>simulation.restore({...before,revision:-1})).toThrow();expect(()=>simulation.restore({...before,minute:0})).toThrow();expect(simulation.serialize()).toEqual(before);expect(before.schemaVersion).toBe(WEATHER_VERSION);
});

function legacy(conditions){const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:30});return createWorld(town,{runSeed:42,startMinute:720,recordHistory:true,createWeatherSimulation,weatherParameters:manual(conditions)});}

test('actual legacy heat raises modeled electricity load and storm reduces available service access without a clock tick',()=>{
 const clear=legacy({}),heat=legacy({temperatureC:42}),storm=legacy({stormIntensity:1});
 expect(heat.electricity.demandKw).toBeGreaterThan(clear.electricity.demandKw);expect(heat.electricity.unit).toBe('kW');expect(heat.weatherEffects.parkComfort).toBeLessThan(clear.weatherEffects.parkComfort);
 const available=world=>world.buildings.filter(b=>world.isServiceAvailable(b)).length;expect(available(storm)).toBeLessThan(available(clear));expect(storm.weatherEffects.roadAvailability).toBeLessThan(clear.weatherEffects.roadAvailability);
 expect(clear.t).toBe(720);expect(heat.t).toBe(720);expect(storm.t).toBe(720);
});

test('legacy heat changes an actual park decision rather than only displaying a weather multiplier',()=>{
 const choose=temperatureC=>{const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:3});for(const p of town.people){p.job=null;p.school=null;p.needs={hunger:100,energy:100,fun:0,social:100};}const world=createWorld(town,{runSeed:42,startMinute:720,recordHistory:true,createWeatherSimulation,weatherParameters:manual({temperatureC})});world.step(1);return world.people[0].lastDecision;};
 const clear=choose(22),heat=choose(42);expect(clear.chosen).toBe('play_park');expect(heat.chosen).toBe('relax_home');const clearPark=clear.alternatives.find(row=>row.activity==='play_park'),hotPark=heat.alternatives.find(row=>row.buildingId===clearPark.buildingId&&row.activity==='play_park');expect(hotPark.score).toBeLessThan(clearPark.score);
});

test('rain changes population transport scores and actual same-seed mode choices; heat changes real electricity observations',async()=>{
 const {createPopulationModel,stepPopulation,setPopulationWeather,populationWeatherSnapshot}=await import('../world/population/model.js');
 const {eventEffects,modeAlternatives}=await import('../world/population/behavior.js');
 const fixture=conditions=>{const model=createPopulationModel({population:100,householdSize:1,employmentRate:1,seed:42},{districts:[{id:'home',x:0,z:0,transit:1,services:1},{id:'work',x:1200,z:0,transit:1,services:1}]});model.minute=480;const p=model.people;for(let i=0;i<100;i++){p.age[i]=1;p.employed[i]=1;p.offset[i]=0;p.home[i]=0;p.work[i]=1;p.current[i]=0;p.x[i]=0;p.z[i]=0;p.homeX[i]=0;p.homeZ[i]=0;p.workX[i]=1200;p.workZ[i]=0;p.planUntil[i]=0;p.activity[i]=0;p.hunger[i]=100;p.energy[i]=100;p.fun[i]=100;p.social[i]=100;}model.households.vehicles.fill(0);setPopulationWeather(model,createWeatherSimulation({seed:42,initialMinute:480,parameters:manual(conditions)}).snapshot());return model;};
 const clear=fixture({}),rain=fixture({rainIntensity:1}),hot=fixture({temperatureC:42}),storm=fixture({stormIntensity:1});
 const alternatives=model=>modeAlternatives(model,0,1,eventEffects(model,model.minute),[1200,0]);
 expect(alternatives(rain).find(row=>row.id==='walk').score).toBeLessThan(alternatives(clear).find(row=>row.id==='walk').score);
 expect(alternatives(rain).find(row=>row.id==='bike').components.weatherComfort).toBeLessThan(0);
 expect(populationWeatherSnapshot(hot).electricity.demandKw).toBeGreaterThan(populationWeatherSnapshot(clear).electricity.demandKw);
 expect(eventEffects(storm,480)[1].services).toBeLessThan(eventEffects(clear,480)[1].services);expect(eventEffects(storm,480)[1].transit).toBeLessThan(eventEffects(clear,480)[1].transit);
 for(const model of [clear,rain])stepPopulation(model,{minutes:15});expect(clear.totals.trips).toBeGreaterThan(0);expect(rain.totals.trips).toBeGreaterThan(0);expect(rain.totals.tripCountsByMode).not.toEqual(clear.totals.tripCountsByMode);
});
