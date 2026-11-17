import {test,expect} from 'bun:test';
import {planStreetSteps,clearStreetHop} from '../world/street-steps.js';
test('five short hops reuse sidewalk coordinates and leave input untouched',()=>{
 const roads=[{pts:[[0,0],[100,0]]}],before=JSON.stringify(roads),plan=planStreetSteps(roads,[0,0]);
 expect(plan.points.length).toBe(6);expect(plan.rulesVersion).toBe('sidewalks.v1');
 for(let i=1;i<6;i++){expect(Math.hypot(...plan.points[i].map((v,k)=>v-plan.points[i-1][k]))).toBeLessThanOrEqual(12.001);expect(Math.abs(plan.points[i][1])).toBe(6);}
 expect(JSON.stringify(roads)).toBe(before);
});
test('missing, distant and malformed geometry never fabricates a route',()=>{
 for(const roads of [[],[{pts:[[NaN,0],[100,0]]}],[{pts:[[1000,0],[1100,0]]}]])expect(planStreetSteps(roads,[0,0])).toBeNull();
});
test('entire segment blocks even when endpoints clear; parallel and boundary cases',()=>{
 const box={minX:4,maxX:6,minZ:-1,maxZ:1,top:10};
 expect(clearStreetHop([0,0],[10,0],[box])).toBe(false);
 expect(clearStreetHop([0,2],[10,2],[box])).toBe(true);
 expect(clearStreetHop([4,1],[4,1],[box])).toBe(false);
 expect(clearStreetHop([NaN,0],[0,0],[])).toBe(false);
});

import {mountStreetSteps} from '../world/street-steps.js';
import * as THREE from 'three';
function fixture(projectPoint=null){
 const doc=new EventTarget();const node=()=>Object.assign(new EventTarget(),{ownerDocument:doc,dataset:{},style:{},children:[],append(n){this.children.push(n);},replaceChildren(){this.children=[];},remove(){this.removed=true;}});
 const start=node(),skip=node(),row=node(),status=node(),root=node();root.querySelectorAll=()=>[start,skip];root.querySelector=s=>s==='div'?row:status;
 let first=true;doc.createElement=()=>{if(first){first=false;return root;}return node();};
 const camera={position:new THREE.Vector3()},controls=new THREE.EventDispatcher();controls.target=new THREE.Vector3();controls.update=()=>{};
 let roads=[{pts:[[0,0],[100,0]]}],reduce=false,fail=false,buildings=[];
 const resident={id:'unchanged',x:40,z:50},before=JSON.stringify(resident),canvas=node();
 const steps=mountStreetSteps({container:node(),camera,controls,canvas,projectPoint,getRoads:()=>{if(fail)throw Error();return roads;},getBuildings:()=>buildings,reducedMotion:()=>reduce});
 return {steps,start,skip,row,status,root,camera,controls,canvas,resident,before,setRoads:r=>roads=r,setReduce:r=>reduce=r,setFail:r=>fail=r,setBuildings:b=>buildings=b};
}
test('integrated five-hop camera, skip, reduced motion, pacing and cleanup never command residents',()=>{
 const f=fixture();f.start.onclick();
 for(let i=0;i<5;i++){f.row.children[i].onclick();f.steps.update(i*1000);f.steps.update(i*1000+16);if(i===0)f.skip.onclick();else f.steps.update(i*1000+500);}
 expect(f.status.textContent).toContain('5 of 5 complete');expect(f.steps.stats.frames).toBeGreaterThan(0);expect(f.camera.position.y).toBe(8);expect(JSON.stringify(f.resident)).toBe(f.before);
 f.controls.target.set(0,0,0);f.setReduce(true);f.start.onclick();f.row.children[0].onclick();expect(f.status.textContent).toContain('Step 1');
 f.steps.dispose();const pose=f.camera.position.clone();f.steps.update(99999);expect(f.camera.position.equals(pose)).toBe(true);expect(f.root.removed).toBe(true);
});
test('component reports missing and failed geometry and blocks changed clearance',()=>{
 const f=fixture();f.setRoads([]);f.start.onclick();expect(f.status.textContent).toContain('Unavailable');
 f.setFail(true);f.start.onclick();expect(f.status.textContent).toContain('Unable to read');f.setFail(false);f.setRoads([{pts:[[0,0],[100,0]]}]);f.start.onclick();
 f.setBuildings([{height:20,poly:[[0,-10],[100,-10],[100,10],[0,10]]}]);f.row.children[0].onclick();expect(f.status.textContent).toContain('unavailable');expect(f.row.children[0].disabled).toBe(true);
});

test('projected stones update at 10Hz and remove with the component',()=>{
 let calls=0;const f=fixture(()=>{calls++;return{x:50,y:60,visible:true};});f.start.onclick();f.steps.update(0);f.steps.update(50);f.steps.update(100);expect(calls).toBe(10);expect(f.steps.stats.overlayUpdates).toBe(2);f.steps.dispose();f.steps.update(200);expect(calls).toBe(10);
});
