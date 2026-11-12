import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createInterior} from './interior.js';
import {houseViewRecords} from '../house-renderer.js';
import {createPopulationModel,inspectHousehold} from '../../population/model.js';
const data=()=>{const m=createPopulationModel({population:8,householdSize:4,seed:42}),h=inspectHousehold(m,0);return houseViewRecords({household:h,home:h.house,members:h.house.members});};
const positions=view=>[...view.objects].map(([id,e])=>({id,x:e.x,z:e.z,seats:e.seats,position:e.group.position.toArray(),rotation:e.group.rotation.toArray()}));
test('progressive construction yields a visible shell and bounded furniture batches with identical final placement',async()=>{
 const records=data(),serial=createInterior(THREE,new THREE.Scene()),progressive=createInterior(THREE,new THREE.Scene()),stages=[];
 try{serial.build(records);let yields=0;await progressive.buildProgressively(records,{yieldFrame:async()=>{yields++;},onProgress:stage=>stages.push({...stage,objects:progressive.objects.size,rooms:progressive.rooms.size})});
 expect(stages[0].objects).toBe(0);expect(stages[0].rooms).toBeGreaterThan(0);expect(yields).toBeGreaterThan(1);
 for(let i=1;i<stages.length;i++)expect(stages[i].objects-stages[i-1].objects).toBeLessThanOrEqual(3);
 expect(positions(progressive)).toEqual(positions(serial));expect(progressive.pickables.length).toBe(serial.pickables.length);
 }finally{serial.destroy();progressive.destroy();}
});
test('cancelled progressive construction stops before adding furniture',async()=>{const view=createInterior(THREE,new THREE.Scene());try{const done=await view.buildProgressively(data(),{yieldFrame:async()=>{},cancelled:()=>true});expect(done).toBe(false);expect(view.objects.size).toBe(0);}finally{view.destroy();}});
