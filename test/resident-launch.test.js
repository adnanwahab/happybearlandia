import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildPedestrianNetwork,pedestrianRoute,pointOnPedestrianRoute} from '../world/population/pedestrian-routes.js';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation,snapshotPopulation} from '../world/population/model.js';
import {modeAlternatives,eventEffects,stepActivities} from '../world/population/behavior.js';
import {prepareResidentEncounters,activeResidentEncounter} from '../world/population/resident-encounters.js';
import {currentTrip} from '../world/population/trip-display.js';
import {createHumanInstances,humanGait} from '../world/render/people/human-renderer.js';
import {createPopulationRenderer,interpolatePopulationPosition} from '../world/population/renderer.js';
const roads=[{pts:[[0,0],[100,0]]},{pts:[[100,0],[100,100]]}];
const context={roads,districts:[{id:'d',x:50,z:50,housingUnits:100,jobs:100}],buildings:[{id:'a',center:[10,6]},{id:'b',center:[94,90]}]};
function make(){return createPopulationModel({population:12,seed:42,employmentRate:0},context,{initialMinute:720});}
test('walking follows supplied sidewalk geometry; time reflects routed distance, not the diagonal',()=>{
 const m=make(),p=m.people;p.x[0]=10;p.z[0]=6;
 const walk=modeAlternatives(m,0,0,eventEffects(m,m.minute),[94,90]).find(row=>row.id==='walk');
 expect(walk.route.kind).toBe('mapped-sidewalk');expect(walk.route.distanceMetres).toBeGreaterThan(Math.hypot(84,84));expect(walk.minutes).toBeCloseTo(walk.route.distanceMetres/1000/m.config.walkingSpeedKmh*60,8);
 for(let n=0;n<=20;n++){const pos=pointOnPedestrianRoute(walk.route,n/20);expect(Math.min(Math.abs(pos.z-6),Math.abs(pos.x-94))).toBeLessThan(8);}
 expect(pointOnPedestrianRoute(walk.route,0)).toMatchObject({x:10,z:6});expect(pointOnPedestrianRoute(walk.route,1)).toMatchObject({x:94,z:90});
 const car=modeAlternatives(m,0,0,eventEffects(m,m.minute),[94,90]).find(row=>row.id==='car');expect(car.route.kind).toBe('district-straight-line approximation');
});
test('crossings use junction ends, rare jaywalking is explicit, and disconnected maps are labelled',()=>{
 const network=buildPedestrianNetwork([{pts:[[0,0],[100,0]]}]);const cross=pedestrianRoute(network,[40,6],[40,-6]);expect(cross.distanceMetres).toBeGreaterThan(12);expect(cross.jaywalk).toBe(false);
 const jaywalk=pedestrianRoute(network,[40,6],[40,-6],{jaywalk:true});expect(jaywalk.distanceMetres).toBeCloseTo(12);expect(jaywalk.jaywalk).toBe(true);
 const missing=pedestrianRoute(buildPedestrianNetwork([]),[0,0],[10,0]);expect(missing.reason).toContain('No mapped');
 const disconnected=pedestrianRoute(buildPedestrianNetwork([{pts:[[0,0],[100,0]]},{pts:[[500,500],[600,500]]}]),[20,6],[520,506]);expect(disconnected.kind).toBe('straight-line fallback');expect(disconnected.reason).toContain('disconnected');
});
test('mapped intersection splits support continuous walk positions and checkpoint continuation',()=>{
 const network=buildPedestrianNetwork([{pts:[[-100,0],[100,0]]},{pts:[[0,-100],[0,100]]}]);expect(pedestrianRoute(network,[-90,6],[6,90]).kind).toBe('mapped-sidewalk');
 const m=make(),p=m.people,route=pedestrianRoute(m.pedestrianNetwork,[10,6],[94,90]);p.mode[0]=1;p.remaining[0]=p.tripTotal[0]=route.distanceMetres/40;p.departureMinute[0]=720;p.fromX[0]=10;p.fromZ[0]=6;p.toX[0]=94;p.toZ[0]=90;p.from[0]=p.to[0]=0;p.plannedActivity[0]=9;p.plannedUntil[0]=760;p.x[0]=10;p.z[0]=6;m.walkingRoutes[0]=route;
 const restored=restorePopulation(serializePopulation(m));for(const model of[m,restored])stepPopulation(model,{minutes:1});expect(serializePopulation(m)).toEqual(serializePopulation(restored));
 const expected=pointOnPedestrianRoute(route,1/p.tripTotal[0]);expect(p.x[0]).toBeCloseTo(expected.x,4);expect(p.z[0]).toBeCloseTo(expected.z,4);expect(currentTrip(m,0).route.rulesVersion).toBe('sidewalks.v1');
 const previous={x:10,z:6,trip:{departureMinute:720,route,progress:0}},current={x:94,z:90,trip:{departureMinute:720,route,progress:1}};expect(interpolatePopulationPosition(previous,current,.5)).toEqual(pointOnPedestrianRoute(route,.5));
});
test('nearby awake residents stop, face one another, gain social need and retain replayable records',()=>{
 const m=make(),p=m.people;for(let i=0;i<12;i++){p.x[i]=1000+i*100;p.z[i]=1000;p.employed[i]=0;p.planUntil[i]=750;p.social[i]=30;}p.x[0]=10;p.z[0]=6;p.x[1]=12;p.z[1]=6;
 expect(prepareResidentEncounters(m)).toBe(1);expect(p.social[0]).toBe(38);expect(activeResidentEncounter(m,0).partnerId).toBe(m.prefix+'-p1');expect(activeResidentEncounter(m,0).heading).toBeCloseTo(Math.PI/2);expect(m.events.at(-1).type).toBe('RESIDENT_CONVERSATION');
 const before=serializePopulation(m),restored=restorePopulation(before);expect(snapshotPopulation(restored,{visibleLimit:12}).visibleAgents.find(row=>row.index===0).socialEncounter).toEqual(activeResidentEncounter(m,0));
 for(const model of[m,restored])stepPopulation(model,{minutes:1});expect(p.x[0]).toBe(10);expect(p.z[0]).toBe(6);expect(serializePopulation(m)).toEqual(serializePopulation(restored));expect(prepareResidentEncounters(m)).toBe(0);
 m.minute=724;expect(activeResidentEncounter(m,0)).toBeNull();
});
test('chat time delays a committed walk honestly; sleeping and distant residents never chat',()=>{
 const m=make(),p=m.people;for(let i=0;i<12;i++){p.x[i]=1000+i*100;p.z[i]=1000;p.employed[i]=0;p.planUntil[i]=750;}p.x[0]=10;p.z[0]=6;p.x[1]=12;p.z[1]=6;
 p.remaining[0]=p.tripTotal[0]=10;p.mode[0]=1;p.plannedActivity[0]=9;p.fromX[0]=10;p.fromZ[0]=6;p.toX[0]=50;p.toZ[0]=6;p.departureMinute[0]=720;
 expect(prepareResidentEncounters(m)).toBe(1);m.minute=721;stepActivities(m,1,eventEffects(m,720));expect(p.remaining[0]).toBe(10);expect(p.x[0]).toBe(10);expect(currentTrip(m,0).durationMinutes).toBe(11);expect(currentTrip(m,0).socialDelayMinutes).toBe(1);
 const night=make();night.minute=300;expect(prepareResidentEncounters(night)).toBe(0);const far=make();for(let i=0;i<12;i++)far.people.x[i]=i*100;expect(prepareResidentEncounters(far)).toBe(0);
});
test('actual GLB limbs swing in opposite phases, stop at rest, and stay in shared bounded meshes',async()=>{
 const bytes=await Bun.file(new URL('../world/assets/human-person.glb',import.meta.url)).arrayBuffer(),human=createHumanInstances({THREE,count:2,loadAsset:()=>new GLTFLoader().parseAsync(bytes,'')});await human.ready;
 try{expect(human.assetStatus).toBe('ready');expect(human.parts).toHaveLength(12);expect(human.parts.every(p=>p.isInstancedMesh&&p.count===2)).toBe(true);human.setPerson(0,{id:'a',x:0});human.setPerson(0,{id:'a',x:.2});human.commit();const left=new THREE.Matrix4(),right=new THREE.Matrix4();human.parts.find(p=>p.name==='Pants-left').getMatrixAt(0,left);human.parts.find(p=>p.name==='Pants-right').getMatrixAt(0,right);expect(left.elements[6]).not.toBe(0);expect(left.elements[6]).toBeCloseTo(-right.elements[6]);human.setPerson(0,{id:'a',x:.2});human.commit();human.parts.find(p=>p.name==='Pants-left').getMatrixAt(0,left);expect(left.elements[6]).toBe(0);expect(humanGait(.2,{ageBand:'child'}).bob).toBeGreaterThan(humanGait(.2).bob);}finally{human.destroy();}
});
test('conversation bubbles and wave are projected from snapshot evidence and freeze when paused',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,10,10);const visual=createPopulationRenderer({scene,camera,THREE,getViewDistance:()=>50});
 try{const frame={population:1,visibleAgents:[{id:'p',x:0,z:0,socialEncounter:{heading:1,untilMinute:723}}]};visual.setActive(true);visual.updateFrame(frame,0);visual.update(200);expect(scene.getObjectByName('resident-conversation-bubbles').count).toBe(1);visual.setPaused(true,200);const arms=scene.getObjectByName('TShirt-right'),before=Array.from(arms.instanceMatrix.array);visual.update(1000);expect(Array.from(arms.instanceMatrix.array)).toEqual(before);visual.reset();expect(scene.getObjectByName('resident-conversation-bubbles').count).toBe(0);}finally{visual.destroy();}
});

import {buildTown} from '../world/gen.js';
import {createWorld,WALK_M_PER_MIN} from '../world/sim.js';
import {captureLegacyCheckpoint,restoreLegacyCheckpoint} from '../world/legacy-checkpoint.js';
import {advanceLegacyResidentEncounters} from '../world/legacy-resident-encounters.js';
function legacy(){const town=buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:6});town.roads=roads;return createWorld(town,{recordHistory:true,startMinute:720});}
test('default Legacy World ground walk uses sidewalks and the actual route distance at 40m/min',()=>{
 const world=legacy(),p=world.people[0];p.x=10;p.z=6;const command=world.commandPerson(p.id,{type:'walk',destination:{x:94,z:90}});
 expect(command.distanceMeters).toBeGreaterThan(Math.hypot(84,84));expect(p.path).toContainEqual([93.5,6]);world.step(1);expect(p.x).toBeCloseTo(50);expect(p.z).toBe(6);
 for(let n=0;n<10&&p.userCommand;n++)world.step(1);expect(p.userCommand).toBeUndefined();expect(p.x).toBe(94);expect(p.z).toBe(90);expect(p.lastTrip.travelMinutes).toBeCloseTo(command.distanceMeters/WALK_M_PER_MIN,6);
});
test('default Legacy World conversations pause travel and replay from full checkpoint including outcomes',()=>{
 const world=legacy();for(let i=0;i<world.people.length;i++){const p=world.people[i];p.x=1000+i*100;p.z=1000;p.mode='idle';p.action=null;p.job=null;p.needs.social=30;}
 const [a,b]=world.people;a.x=10;a.z=6;b.x=12;b.z=6;b.home=a.home;
 a.mode='moving';a.travelMode='walk';a.path=[[90,6]];a.pathI=0;a.tx=90;a.tz=6;a.tripTravelMinutes=0;a.tripSocialDelayMinutes=0;
 expect(advanceLegacyResidentEncounters(world)).toBe(1);expect(a.needs.social).toBe(38);expect(a.socialEncounter.partnerId).toBe(String(b.id));const saved=captureLegacyCheckpoint(world),restored=legacy();restoreLegacyCheckpoint(restored,saved);
 world.step(1);restored.step(1);expect(a.x).toBe(10);expect(a.tripSocialDelayMinutes).toBe(1);expect(captureLegacyCheckpoint(restored)).toEqual(captureLegacyCheckpoint(world));expect(world.social.residentEncounters).toHaveLength(1);expect(world.events[0].kind).toBe('conversation');
});

test('numeric legacy diagnostic seed matches original RNG initialization and is restored without exposing coordinate strings',()=>{
 const a=legacy(),b=legacy();expect(a.simulationSeed).toBeNumber();expect(a.simulationSeed).toBe(b.simulationSeed);expect(()=>{a.simulationSeed=1;}).toThrow();const saved=captureLegacyCheckpoint(a),other=createWorld(buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:6}),{recordHistory:true,startMinute:720,runSeed:'different'});other.roads=roads;expect(other.simulationSeed).not.toBe(a.simulationSeed);restoreLegacyCheckpoint(other,saved);expect(other.simulationSeed).toBe(a.simulationSeed);
});

test('compatible older checkpoints keep earlier routing and spontaneous-social rules on restore',()=>{
 const p=make(),saved=serializePopulation(p);delete saved.residentRules;delete saved.pedestrianNetwork;delete saved.walkingRoutes;const old=restorePopulation(saved);expect(prepareResidentEncounters(old)).toBe(0);const walk=modeAlternatives(old,0,0,eventEffects(old,old.minute),[94,90]).find(row=>row.id==='walk');expect(walk.route.kind).toBe('district-straight-line approximation');
 const l=legacy(),checkpoint=captureLegacyCheckpoint(l);delete checkpoint.world.residentRules;restoreLegacyCheckpoint(l,checkpoint);expect(advanceLegacyResidentEncounters(l)).toBe(0);expect(l.residentRules).toBeUndefined();
});

test('help glyph is instanced and appears only for an explicitly supplied actual need signal',async()=>{
 const human=createHumanInstances({THREE,count:2,loadAsset:async()=>{throw Error('fixture fallback');}});await human.ready;try{const bar=human.root.getObjectByName('resident-help-markers');expect(bar.isInstancedMesh).toBe(true);expect(bar.visible).toBe(false);human.setPerson(0,{quest:true});human.commit();expect(bar.visible).toBe(true);human.setPerson(0,{quest:false});human.commit();expect(bar.visible).toBe(false);}finally{human.destroy();}
});

test('ordinary worker snapshots retain routed trip and active encounter metadata for the real renderer',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');const runtime=createPopulationRuntime({config:{population:40,seed:42,employmentRate:0},worldContext:context,initialMinute:720,stepMinutes:1,clockMode:'minutes-per-second'});
 try{await runtime.ready;runtime.pause();const person=runtime.getSnapshot().visibleAgents[0],destination=person.x<50?{x:94,z:90}:{x:10,z:6};await runtime.walkPerson(person.id,destination);const walking=runtime.getSnapshot().visibleAgents.find(row=>row.id===person.id);expect(walking.trip.route.kind).toBe('mapped-sidewalk');expect(walking.trip.progress).toBe(0);await runtime.step();const frame=runtime.getSnapshot();expect(frame.eventCounts.RESIDENT_CONVERSATION).toBeGreaterThan(0);expect(frame.visibleAgents.some(row=>row.socialEncounter?.rulesVersion==='resident-encounters.v1')).toBe(true);}finally{runtime.destroy();}
});

test('a player command visibly interrupts an active legacy conversation without moving either actor at command time',()=>{
 const world=legacy(),[a,b]=world.people;for(const [index,p]of world.people.entries()){p.x=1000+index*100;p.z=1000;p.action=null;p.mode='idle';p.job=null;}a.x=10;a.z=6;b.x=12;b.z=6;b.home=a.home;advanceLegacyResidentEncounters(world);expect(a.socialEncounter).toBeDefined();world.commandPerson(a.id,{type:'walk',destination:{x:90,z:6}});expect(a.socialEncounter).toBeUndefined();expect(b.socialEncounter).toBeUndefined();expect(a.x).toBe(10);world.step(1);expect(a.x).toBeGreaterThan(10);
});
