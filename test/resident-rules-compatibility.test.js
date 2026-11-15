import {test,expect} from 'bun:test';
import {buildTown} from '../world/gen.js';
import {createWorld,WALK_M_PER_MIN} from '../world/sim.js';
import {captureLegacyCheckpoint,restoreLegacyCheckpoint} from '../world/legacy-checkpoint.js';
import {captureSimulationState,restoreSimulationState} from '../world/simulation-state.js';
import {createPopulationModel,restorePopulation,serializePopulation,snapshotPopulation} from '../world/population/model.js';
import {createPopulationCheckpoint,readPopulationCheckpoint} from '../world/population/checkpoint.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {POPULATION_RESIDENT_RULES,LEGACY_RESIDENT_RULES} from '../world/resident-rules.js';
import {humanGait} from '../world/render/people/human-renderer.js';
import {updatePopulationFollowControl} from '../world/population/world-view.js';
const legacy=()=>createWorld(buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:6}),{recordHistory:true,startMinute:720,parameters:{minimumTransitDistanceMeters:10000}});
test('older rainy Legacy checkpoints retain generalized walking choice cost while sidewalk rules retain physical time',()=>{
 for(const old of[true,false]){const world=legacy(),saved=captureLegacyCheckpoint(world);if(old)delete saved.world.residentRules;restoreLegacyCheckpoint(world,saved);world.weather.configure({automatic:false,rainIntensity:1});const p=world.people[0];p.x=1000;p.z=1000;p.mode='idle';p.action=null;p.needs={hunger:20,energy:80,fun:40,social:50};p.money=10000;world.step(1);
  expect(world.weatherEffects.walkComfort).toBeLessThan(1);expect(p.mode).toBe('moving');expect(p.travelMode).toBe('walk');const choice=p.lastDecision.alternatives.find(row=>row.activity===p.action&&row.buildingId===world.buildings[p.target].id);expect(choice).toBeDefined();const physical=p.tripDistanceMeters/WALK_M_PER_MIN;expect(choice.plannedTravelMinutes).toBeCloseTo(old?physical/world.weatherEffects.walkComfort:physical,8);if(old)expect(choice.plannedTravelMinutes).toBeGreaterThan(physical);
 }
});
test('unknown resident rule versions reject atomically in Legacy full and representative restores',()=>{
 const world=legacy();world.step(1);const before=captureLegacyCheckpoint(world),representative=captureSimulationState(world);
 for(const rules of[{...LEGACY_RESIDENT_RULES,pedestrian:'sidewalks.v99'},{...LEGACY_RESIDENT_RULES,encounters:'resident-encounters.v1'},{...LEGACY_RESIDENT_RULES,extra:true}]){
  const saved=structuredClone(before);saved.world.residentRules=rules;expect(()=>restoreLegacyCheckpoint(world,saved)).toThrow('resident rules');expect(captureLegacyCheckpoint(world)).toEqual(before);
  const state=structuredClone(representative);state.residentRules=rules;expect(()=>restoreSimulationState(world,state)).toThrow('resident rules');expect(captureLegacyCheckpoint(world)).toEqual(before);
 }
 for(const rules of[undefined,null]){const saved=structuredClone(before);saved.world.residentRules=rules;expect(()=>restoreLegacyCheckpoint(world,saved)).not.toThrow();expect(world.residentRules??null).toBeNull();}
});
test('Population restore and checkpoint codec reject unknown rules before touching source or live state',async()=>{
 const model=createPopulationModel({population:12}),state=serializePopulation(model),before=serializePopulation(model),runtime=createPopulationRuntime({config:{population:12}});
 try{await runtime.ready;runtime.pause();const liveBefore=await runtime.exportCheckpoint();for(const rules of[{...POPULATION_RESIDENT_RULES,encounters:'resident-encounters.v99'},{...POPULATION_RESIDENT_RULES,pedestrian:'sidewalks.v99'}]){
   const invalid=structuredClone(state);invalid.residentRules=rules;expect(()=>restorePopulation(invalid)).toThrow('resident rules');expect(serializePopulation(model)).toEqual(before);
   const decoded=readPopulationCheckpoint(liveBefore);decoded.model.residentRules=rules;const bad=createPopulationCheckpoint(decoded);expect(()=>readPopulationCheckpoint(bad)).toThrow('resident rules');let error;try{await runtime.restoreCheckpoint(bad);}catch(value){error=value;}expect(error?.message).toContain('resident rules');expect(await runtime.exportCheckpoint()).toEqual(liveBefore);
  }
  for(const rules of[undefined,null]){const saved=structuredClone(state);saved.residentRules=rules;expect(snapshotPopulation(restorePopulation(saved)).residentRules).toBeNull();}
 }finally{runtime.destroy();}
});
test('read snapshots, future recipes, replay and inspection keep the selected resident subrules',async()=>{
 for(const rules of[POPULATION_RESIDENT_RULES,null]){const runtime=createPopulationRuntime({config:{population:12,seed:42},residentRules:rules,workerCount:1});try{await runtime.ready;runtime.pause();expect(runtime.getSnapshot().residentRules).toEqual(rules);const future=await runtime.runExperiments({runs:1,horizonDays:1}).ready;expect(future.manifest.residentRules).toEqual(rules);expect(future.rows[0].summary.residentRules).toEqual(rules);await runtime.replayFuture(future.rows[0],future.manifest);expect(runtime.getSnapshot().residentRules).toEqual(rules);expect(runtime.getSnapshot().metrics).toEqual(future.rows[0].summary.metrics);const personId=runtime.getSnapshot().visibleAgents[0].id,inspected=await runtime.inspectFutureEntity(future.rows[0],future.manifest,{kind:'person',id:personId});expect(inspected.id).toBe(personId);
   const before=await runtime.exportCheckpoint();let error;try{await runtime.replayFuture(future.rows[0],{...future.manifest,residentRules:{...POPULATION_RESIDENT_RULES,pedestrian:'v99'}});}catch(value){error=value;}expect(error?.message).toContain('resident rules');expect(await runtime.exportCheckpoint()).toEqual(before);
   if(rules===null){const older={...future.manifest};delete older.residentRules;await runtime.replayFuture(future.rows[0],older);expect(runtime.getSnapshot().residentRules).toBeNull();}
  }finally{runtime.destroy();}}
});
test('Follow pressed state and label stay idempotent for repeated follow and reset requests',()=>{
 const attributes=new Map(),button={textContent:'',setAttribute:(key,value)=>attributes.set(key,value)};
 expect(updatePopulationFollowControl(button,false)).toBe(false);expect(attributes.get('aria-pressed')).toBe('false');expect(button.textContent).toBe('Follow person');
 for(const value of[true,true]){expect(updatePopulationFollowControl(button,value)).toBe(true);expect(attributes.get('aria-pressed')).toBe('true');expect(button.textContent).toBe('Stop following');}
 expect(updatePopulationFollowControl(button,false)).toBe(false);expect(attributes.get('aria-pressed')).toBe('false');expect(button.textContent).toBe('Follow person');
});

test('Population senior age band receives the same older gait variation as Legacy',()=>{expect(humanGait(.2,{ageBand:'senior'})).toEqual(humanGait(.2,{ageBand:'older'}));expect(humanGait(.2,{ageBand:'senior'})).not.toEqual(humanGait(.2,{ageBand:'adult'}));});
