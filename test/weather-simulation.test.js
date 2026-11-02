import {test,expect} from 'bun:test';
import {createWeatherSimulation,weatherEffects,DEFAULT_WEATHER_PARAMETERS} from '../world/weather/weather-simulation.js';
import {createWorldRuntime,restoreWorldRuntime} from '../world/runtime/world-runtime.js';
test('weather uses only seed and absolute model time; step partitions, snapshots and restored continuation agree',()=>{
 const a=createWeatherSimulation({seed:42,initialMinute:360}),b=createWeatherSimulation({seed:42,initialMinute:360});
 const initial=a.serialize();for(let i=0;i<10;i++)a.snapshot();expect(a.serialize()).toEqual(initial);a.stepTo(2880);for(let minute=375;minute<=2880;minute+=15)b.stepTo(minute);expect(a.serialize()).toEqual(b.serialize());expect(a.snapshot()).toEqual(b.snapshot());
 const restored=createWeatherSimulation();restored.restore(a.serialize());a.stepTo(5000);restored.stepTo(5000);expect(restored.snapshot()).toEqual(a.snapshot());expect(createWeatherSimulation({seed:43}).snapshot()).not.toEqual(createWeatherSimulation({seed:42}).snapshot());
});
test('manual rain, heat and storms expose monotone mechanism inputs without downstream outcome assertions',()=>{
 const neutral=weatherEffects(),rain=weatherEffects({rainIntensity:1}),heat=weatherEffects({temperatureC:40}),storm=weatherEffects({stormIntensity:1});
 expect(rain.walkComfort).toBeLessThan(neutral.walkComfort);expect(rain.bikeComfort).toBeLessThan(neutral.bikeComfort);expect(heat.parkComfort).toBeLessThan(neutral.parkComfort);expect(heat.electricityDemandMultiplier).toBeGreaterThan(neutral.electricityDemandMultiplier);
 for(const key of['roadAvailability','transitAvailability','serviceAvailability'])expect(storm[key]).toBeLessThan(neutral[key]);
 for(const result of[neutral,rain,heat,storm])expect(Object.values(result).every(value=>Number.isFinite(value)&&value>0)).toBe(true);
 const simulation=createWeatherSimulation();const minute=simulation.snapshot().minute;simulation.configure({temperatureC:39,rainIntensity:.8});expect(simulation.snapshot().parameters.automatic).toBe(false);expect(simulation.snapshot().temperatureC).toBe(39);expect(simulation.snapshot().rainIntensity).toBe(.8);expect(simulation.snapshot().minute).toBe(minute);simulation.stepTo(2000);expect(simulation.snapshot().temperatureC).toBe(39);simulation.configure({automatic:true});expect(simulation.snapshot().parameters.automatic).toBe(true);
});
test('weather configuration and restore validate atomically; snapshots and serialized parameters are detached',()=>{
 const simulation=createWeatherSimulation({parameters:{automatic:false}}),before=simulation.serialize();
 for(const patch of[{automatic:'false'},{temperatureC:56},{temperatureC:NaN},{rainIntensity:-.1},{stormIntensity:2},{humidity:1},null]){expect(()=>simulation.configure(patch)).toThrow();expect(simulation.serialize()).toEqual(before);}
 expect(()=>simulation.stepTo(359)).toThrow();expect(()=>simulation.stepTo(Infinity)).toThrow();expect(()=>simulation.restore({...before,schemaVersion:'future'})).toThrow();expect(()=>simulation.restore({...before,minute:0})).toThrow();expect(simulation.serialize()).toEqual(before);
 const detached=simulation.snapshot();detached.parameters.temperatureC=55;detached.effects.walkComfort=0;expect(simulation.snapshot().parameters).toEqual({...DEFAULT_WEATHER_PARAMETERS,automatic:false});expect(simulation.snapshot().effects.walkComfort).toBe(1);
});
test('canonical weather is one clocked subsystem, snapshots are observational and checkpoints restore its exact inputs',()=>{
 const r=createWorldRuntime({population:{population:30},culture:false,weather:{parameters:{automatic:false}}});
 try{
  expect(r.weather.minute).toBe(360);expect(r.ownership.domains.weather).toBe('weather');expect(r.population.weather.minute).toBe(360);expect(r.population.weatherEffects).toBe(r.population.weather.effects);
  const facade=r.getWeatherSimulation();expect(r.getWeather()).toBe(facade);expect(facade.stepTo).toBeUndefined();const before=r.serialize();r.snapshot();r.observe();facade.snapshot();expect(r.serialize()).toEqual(before);
  facade.configure({temperatureC:40,rainIntensity:.7,stormIntensity:.5});expect(r.clock.minute).toBe(360);expect(r.population.weather.effects.parkComfort).toBeLessThan(1);expect(r.population.weather.effects.electricityDemandMultiplier).toBeGreaterThan(1);
  r.pause();r.step(15);expect(r.weather.minute).toBe(360);r.resume();r.step(15,{visibleLimit:0});expect(r.weather.minute).toBe(r.clock.minute);expect(r.population.weather.minute).toBe(r.clock.minute);expect(r.economy).toBe(r.population.economy);
  const restored=restoreWorldRuntime(r.serialize());try{r.step(90,{visibleLimit:0});restored.step(90,{visibleLimit:0});expect(restored.serialize()).toEqual(r.serialize());}finally{restored.destroy();}
  expect(r.snapshot({visibleLimit:0}).environment.weather).toEqual(r.snapshot({visibleLimit:0}).weather);
 }finally{r.destroy();}
});
test('canonical restore rejects mismatched environment clocks without changing the active world',()=>{
 const runtime=createWorldRuntime({population:{population:10},culture:false});
 try{const before=runtime.serialize(),bad=structuredClone(before);bad.core.subsystems.find(system=>system.id==='weather').state.minute+=1;expect(()=>runtime.restore(bad)).toThrow('clock');expect(runtime.serialize()).toEqual(before);}finally{runtime.destroy();}
});
