import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {crossingAreas,crossingGroups} from '../world/population/crossings.js';
import {createPopulationRenderer} from '../world/population/renderer.js';
const roads=[{pts:[[-20,0],[0,0],[20,0]]},{pts:[[0,-20],[0,0],[0,20]]}];
const walker={id:'a',x:1,z:1,mode:'walk',trip:{from:{x:0,z:0},to:{x:20,z:0},departureMinute:480,durationMinutes:10,remainingMinutes:5}};
test('shared vertices and recorded walkers only, no duplicate or aggregate people',()=>{
 const areas=crossingAreas(roads),rows=[walker,walker,{...walker,id:'b',mode:'car'},{...walker,id:'c',trip:null},{...walker,id:'d',trip:{...walker.trip,remainingMinutes:0}}],before=structuredClone(rows);
 expect(areas).toHaveLength(1);expect(crossingGroups(rows,[...areas,...areas])[0].count).toBe(1);expect(rows).toEqual(before);
 expect(crossingGroups([walker],[])).toEqual([]);expect(crossingGroups([],areas)).toEqual([]);expect(crossingAreas([{pts:[[0,0],[0,0]]}])).toEqual([]);
 expect(crossingGroups([{...walker,trip:{...walker.trip,remainingMinutes:NaN}}],areas)).toEqual([]);
});
test('timeline replacement, filtering, camera fallback, reset and disposal conserve actors',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();let distance=100;camera.position.set(0,20,20);
 const view=createPopulationRenderer({scene,camera,THREE,worldContext:{roads},getViewDistance:()=>distance});view.setActive(true);
 const frame={population:1,visibleAgents:[walker]},before=structuredClone(frame);
 for(let i=0;i<20;i++){view.updateFrame(frame,i*200);view.update(i*200+200);expect(view.getStats().crossingSampleCount).toBe(1);expect(view.getStats().drawnIndividuals).toBe(1);distance=1000;view.update(i*200+201);expect(view.getStats().crossingSampleCount).toBe(0);distance=100;}
 view.setFilterIds([]);view.update(5000);expect(view.getStats().crossingSampleCount).toBe(0);
 view.setFilter('all');view.updateFrame({population:1,visibleAgents:[]},5100);view.update(5300);expect(view.getStats().crossingSampleCount).toBe(0);
 expect(frame).toEqual(before);view.reset();view.destroy();expect(scene.children).toHaveLength(0);
});
