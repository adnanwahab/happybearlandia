import { describe, test, expect } from 'bun:test';
import { createSimulationPlayback } from '../world/simulation-playback.js';

describe('simulation playback clock', () => {
  test('scales simulation milliseconds while leaving the supplied real clock untouched', () => {
    const clock = createSimulationPlayback({ initialSpeed: 10 });
    expect(clock.update(100).deltaMs).toBe(0);
    expect(clock.update(116)).toEqual({ simulationNow: 160, deltaMs: 160, paused: false, speed: 10 });
    expect(clock.update(132).simulationNow).toBe(320);
  });
  test('pause freezes visible simulation time and resume never catches up wall elapsed', () => {
    const clock = createSimulationPlayback({ initialSpeed: 5 });
    clock.update(0); clock.update(20);
    clock.pause();
    expect(clock.update(5000)).toEqual({ simulationNow: 100, deltaMs: 0, paused: true, speed: 5 });
    expect(clock.update(10000).simulationNow).toBe(100);
    clock.resume();
    expect(clock.update(20000).deltaMs).toBe(0);
    expect(clock.update(20020).simulationNow).toBe(200);
  });
  test('resume without paused frames reanchors and preserves a changed speed', () => {
    const clock = createSimulationPlayback({ initialSpeed: 2 });
    clock.update(0); clock.update(10); clock.pause(); clock.setSpeed(4); clock.resume();
    expect(clock.update(60000)).toEqual({ simulationNow: 20, deltaMs: 0, paused: false, speed: 4 });
    expect(clock.update(60010).simulationNow).toBe(60);
  });
  test('long frame gaps are bounded and never accumulated for later frames', () => {
    const clock = createSimulationPlayback({ initialSpeed: 1, maxFrameMs: 50 });
    clock.update(0);
    expect(clock.update(60000).deltaMs).toBe(50);
    expect(clock.update(60010).deltaMs).toBe(10);
    expect(clock.getState().simulationNow).toBe(60);
    expect(clock.update(100).deltaMs).toBe(0);
    expect(clock.update(110).simulationNow).toBe(70);
  });
  test('actual changes notify once so runtime/panel pause synchronization does not loop', () => {
    const changes = [], clock = createSimulationPlayback({ onChange: state => changes.push(state) });
    let calls = 0; const stop = clock.subscribe(() => calls++);
    clock.pause(); clock.pause(); clock.setSpeed(10); clock.update(10); clock.resume(); clock.resume();
    expect(changes.map(state => state.paused)).toEqual([true, false]);
    expect(calls).toBe(3);
    stop(); clock.pause(); expect(calls).toBe(3);
    clock.destroy(); expect(clock.update(99999).deltaMs).toBe(0);
  });
  test('invalid controls cannot create a negative or nonfinite simulation clock', () => {
    expect(() => createSimulationPlayback({ initialSpeed: 0 })).toThrow();
    const clock = createSimulationPlayback();
    for (const speed of [0, -1, Infinity, NaN, 101]) expect(() => clock.setSpeed(speed)).toThrow();
    expect(() => clock.update(NaN)).toThrow();
  });
});

// Use the actual World authority and the same whole-minute accumulator as RAF.
// Compare the complete checkpoint (including RNG, needs, history and submodels).
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
import {canonicalDigest} from '../world/replay/engine.js';
import {captureLegacyCheckpoint} from '../world/legacy-checkpoint.js';
test('fixed seed: 0.25×–8× and pause/resume preserve complete state digest and event count', async () => {
  const results=[];
  for(const speed of [.25,.5,1,2,4,8])for(const interrupt of [false,true]){
    const world=createWorld(buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:30}),{
      runSeed:'SHE-137-fixed-seed',startMinute:420,recordHistory:true,journalsEnabled:true,
    });
    const clock=createSimulationPlayback({initialSpeed:speed});
    let now=0,acc=0,minutes=0,held=false;
    clock.update(now);
    while(minutes<120){
      if(interrupt&&!held&&minutes>=40){
        const before=captureLegacyCheckpoint(world);
        clock.pause();clock.update(now+=60000);clock.setSpeed(8);clock.update(now+=60000);
        expect(captureLegacyCheckpoint(world)).toEqual(before);
        clock.setSpeed(speed);clock.resume();expect(clock.update(now+=60000).deltaMs).toBe(0);held=true;
      }
      acc+=clock.update(now+=100).deltaMs/1000;
      const steps=Math.min(Math.floor(acc),120-minutes);
      if(steps){world.step(steps);acc-=steps;minutes+=steps;}
    }
    results.push({speed,interrupt,digest:await canonicalDigest(captureLegacyCheckpoint(world)),events:world.events.length});
  }
  expect(new Set(results.map(row=>row.digest)).size).toBe(1);
  expect(new Set(results.map(row=>row.events)).size).toBe(1);
  expect(results[0].events).toBeGreaterThan(0);
  console.log('SHE-137 replay evidence',JSON.stringify(results));
});

import {createPopulationClock} from '../world/population/runtime.js';
import {createWorldRuntime} from '../world/runtime/world-runtime.js';
import {encodeCheckpointGraph} from '../world/population/checkpoint.js';
test('Living Population scheduler preserves fixed-seed state/events across fractional rates and pause',async()=>{
 const results=[];
 for(const speed of [.25,.5,1,2,4,8]){
  const runtime=createWorldRuntime({seed:42,population:{population:30},culture:false,weather:false});
  const clock=createPopulationClock({clockMode:'minutes-per-second',stepMinutes:1});clock.reset(0);
  let now=0,minutes=0,held=false;
  while(minutes<120){
   if(!held&&minutes>=40){
    const before=runtime.serialize();
    expect(clock.poll(now+=60000,{paused:true,speed})).toBe(0);
    expect(runtime.serialize()).toEqual(before);clock.reset(now);held=true;
   }
   const steps=Math.min(clock.poll(now+=100,{speed}),120-minutes);
   // Actual live worker schedules one fixed minute per request.
   for(let i=0;i<steps;i++)runtime.step(1,{visibleLimit:0});
   minutes+=steps;
  }
  results.push({speed,digest:await canonicalDigest(encodeCheckpointGraph(runtime.serialize())),events:runtime.eventsSince().cursor});runtime.destroy();
 }
 expect(new Set(results.map(row=>row.digest)).size).toBe(1);
 expect(new Set(results.map(row=>row.events)).size).toBe(1);
 expect(results[0].events).toBeGreaterThan(0);
 console.log('SHE-137 Population evidence',JSON.stringify(results));
});
