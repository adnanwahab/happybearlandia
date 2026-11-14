import {test,expect} from 'bun:test';
import {cameraObstacles,navigablePose,planCameraPreset} from '../world/camera-presets.js';
const place=(x,z,height)=>[{id:'fixture',height,poly:[[x-12,z-12],[x+12,z-12],[x+12,z+12],[x-12,z+12]]}];
for(const [name,x,z,h] of [['low-rise',0,0,14],['tower',240,-180,240],['edge',-390,370,45]])test(`four safe bounded poses at ${name}`,()=>{
 const buildings=place(x,z,h),before=JSON.stringify(buildings),boxes=cameraObstacles(buildings);
 for(const kind of ['street','rooftop','skyline','follow']){const pose=planCameraPreset(kind,{x,y:0,z},boxes);expect(pose).not.toBeNull();expect(navigablePose(pose.position,boxes)).toBe(true);expect(Math.hypot(pose.position.x-x,pose.position.z-z)).toBeLessThanOrEqual(660);expect(pose.target.x).toBe(x);}
 expect(JSON.stringify(buildings)).toBe(before);
});
test('invalid and completely occupied spaces do not invent safe poses',()=>{
 expect(planCameraPreset('street',{x:NaN,y:0,z:0},[])).toBeNull();
 expect(planCameraPreset('street',{x:0,y:0,z:0},[{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000,top:1500}])).toBeNull();
 expect(navigablePose({x:0,y:0,z:0},[])).toBe(false);
 expect(planCameraPreset('unknown',{x:0,y:0,z:0},[])).toBeNull();
});
test('empty geography remains navigable; parks do not become collision walls',()=>{
 expect(cameraObstacles([{kind:'park',...place(0,0,1)[0]}])).toEqual([]);
 expect(planCameraPreset('street',{x:0,y:0,z:0},[]).position.y).toBe(5);
});

import * as THREE from 'three';
import {mountCameraPresets} from '../world/camera-presets.js';
// Injected DOM follows the repository's panel-component test convention.
function component(){
 const doc=new EventTarget();doc.defaultView=new EventTarget();
 const node=()=>Object.assign(new EventTarget(),{ownerDocument:doc,dataset:{},style:{},children:[],append(child){this.children.push(child);},remove(){this.removed=true;}});
 doc.createElement=()=>{const root=node(),row=node(),status=node();root.querySelector=tag=>tag==='div'?row:status;return root;};
 const container=node(),canvas=node(),camera=new THREE.PerspectiveCamera(),controls=new THREE.EventDispatcher();controls.target=new THREE.Vector3();controls.update=()=>{};camera.position.set(320,125,450);
 let subject=null,reduced=false,buildings=[];
 const picker=mountCameraPresets({container,camera,controls,canvas,getBuildings:()=>buildings,getSubject:()=>subject,reducedMotion:()=>reduced});
 return {picker,camera,controls,canvas,doc,status:picker.element.querySelector('p'),setSubject:p=>subject=p,setReduced:v=>reduced=v,setBuildings:v=>buildings=v};
}
test('component keeps first return pose across presets and never writes the subject',()=>{
 const f=component(),subject={key:'legacy:7',position:{x:20,y:0,z:30}};f.setSubject(subject);const before=JSON.stringify(subject);
 expect(f.picker.choose('street')).toBe(true);expect(f.picker.choose('skyline')).toBe(true);expect(f.picker.choose('return')).toBe(true);
 expect(f.camera.position.toArray()).toEqual([320,125,450]);expect(f.controls.target.toArray()).toEqual([0,0,0]);expect(JSON.stringify(subject)).toBe(before);expect(f.picker.choose('return')).toBe(false);
});
test('follow cancellation is persistent across manual pointer, wheel, pan, controls and keyboard',()=>{
 for(const input of ['pointerdown','wheel','pan','start','Escape']){
 const f=component(),subject={key:'living:7',position:{x:0,y:0,z:0}};f.setSubject(subject);f.picker.choose('follow');subject.position.x=10;f.picker.update(10);expect(f.controls.target.x).toBe(10);
 if(input==='start')f.controls.dispatchEvent({type:'start'});else if(input==='pan')f.doc.defaultView.dispatchEvent(new Event('world:local-pan'));else if(input==='Escape'){const event=new Event('keydown');event.key='Escape';f.doc.dispatchEvent(event);}else f.canvas.dispatchEvent(new Event(input));
 subject.position.x=100;f.picker.update(20);expect(f.controls.target.x).toBe(10);f.picker.dispose();
 }
});
test('unavailable, changed identity, reduced motion and disposal never steal camera control',()=>{
 const f=component();expect(f.picker.choose('follow')).toBe(false);expect(f.camera.position.x).toBe(320);
 const subject={key:'legacy:1',position:{x:10,y:0,z:0}};f.setSubject(subject);f.picker.choose('follow');subject.key='living:1';subject.position.x=20;f.picker.update(2);expect(f.controls.target.x).toBe(10);
 f.setReduced(true);f.picker.choose('follow');subject.position.x=30;f.picker.update(3);expect(f.controls.target.x).toBe(20);
 f.setReduced(false);f.picker.choose('follow');f.setSubject(null);f.picker.update(4);expect(f.status.textContent).toContain('stopped');
 f.picker.dispose();expect(f.picker.choose('street')).toBe(false);expect(f.picker.element.removed).toBe(true);
});
test('return revalidates changed geometry and active reduced-motion changes stop pursuit',()=>{
 const f=component();f.picker.choose('street');const street=f.camera.position.toArray();
 f.setBuildings(place(320,450,200));expect(f.picker.choose('return')).toBe(false);expect(f.camera.position.toArray()).toEqual(street);expect(f.status.textContent).toContain('obstructed');
 f.setBuildings([]);f.setSubject({key:'fixture',position:{x:0,y:0,z:0}});f.picker.choose('follow');f.setReduced(true);f.picker.update(100);expect(f.status.textContent).toContain('Reduced motion');
});
