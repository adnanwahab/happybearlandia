import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createPopulationModel,stepPopulation,snapshotPopulation} from '../world/population/model.js';
import {currentTrip,tripHeading,tripHoverText,tripVehicle} from '../world/population/trip-display.js';
import {createPopulationRenderer} from '../world/population/renderer.js';
test('trip projection uses committed fields and distinguishes missing and finished travel',()=>{
 const people={remaining:[7],tripTotal:[12],departureMinute:[480],plannedActivity:[1],fromX:[0],fromZ:[0],toX:[20],toZ:[0]};
 const model={people},before=structuredClone(model),trip=currentTrip(model,0),row={id:'p',name:'Maria',mode:'bus',trip};
 expect(trip.remainingMinutes).toBe(7);expect(tripHeading(row)).toBe(Math.PI/2);expect(tripHoverText(row)).toContain('Maria · heading to work · 12 min planned trip');expect(tripHoverText(row)).toContain('passenger marker');expect(tripVehicle({...row,trip:null})).toBeNull();expect(model).toEqual(before);people.remaining[0]=0;expect(currentTrip(model,0)).toBeNull();
});
test('500 mode markers conserve sampled people, pause and dispose without changing evidence',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,20,20);
 const view=createPopulationRenderer({scene,camera,THREE,getViewDistance:()=>100});
 const frame={population:500,visibleAgents:Array.from({length:500},(_,i)=>({id:String(i),x:i/10,z:0,mode:i%2?'car':'bus',trip:{from:{x:0,z:0},to:{x:50,z:0}}}))},before=structuredClone(frame);
 view.setActive(true);view.updateFrame(frame,0);view.update(200);expect(view.getStats().vehicles).toBe(500);expect(view.getStats().drawnIndividuals).toBe(500);
 const mesh=scene.getObjectByName('commuting-vehicle-markers');expect(mesh.count).toBe(500);expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
 view.setPaused(true,200);view.update(1000);expect(frame).toEqual(before);view.reset();expect(mesh.count).toBe(0);view.destroy();expect(scene.children).toHaveLength(0);
});

test('real seeded trips export the same positions and metadata after deterministic replay',()=>{
 const context={districts:[{id:'a',x:0,z:0,housingUnits:1000,jobs:1000},{id:'b',x:5000,z:0,housingUnits:1000,jobs:1000}]};
 const a=createPopulationModel({population:100,seed:42},context),b=createPopulationModel({population:100,seed:42},context);
 for(const model of [a,b])stepPopulation(model,{minutes:480});
 const frame=snapshotPopulation(a,{visibleLimit:100});expect(frame).toEqual(snapshotPopulation(b,{visibleLimit:100}));
 const traveling=frame.visibleAgents.filter(row=>row.trip);expect(traveling.length).toBeGreaterThan(0);
 for(const row of traveling){const t=row.trip,p=a.people,i=row.index;expect(t.remainingMinutes).toBe(p.remaining[i]);expect(t.departureMinute).toBe(p.departureMinute[i]);expect(row.x).toBe(p.x[i]);expect(row.z).toBe(p.z[i]);expect(t.geometry).toBe('straight-line model approximation');}
});
test('default-distance clusters retain moving trip dots and truthful separate counts',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,100,500);
 const view=createPopulationRenderer({scene,camera,THREE,getViewDistance:()=>550});
 view.setActive(true);view.updateFrame({population:3,visibleAgents:[{id:'trip',x:0,z:0,mode:'walk',trip:{from:{x:0,z:0},to:{x:20,z:0}}},{id:'home',x:1,z:0},{id:'home2',x:2,z:0}]},0);view.update(200);
 expect(view.getStats().drawnIndividuals).toBe(1);expect(view.getStats().drawnClusters).toBe(1);view.setHovered('trip');view.update(201);expect(view.getStats().hoveredId).toBe('trip');view.setLayer('income');view.update(202);expect(view.getStats().drawnIndividuals).toBe(3);expect(view.getStats().drawnClusters).toBe(0);view.destroy();
});
