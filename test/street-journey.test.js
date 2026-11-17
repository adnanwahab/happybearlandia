import {test,expect} from 'bun:test';
import {planStreetJourney,journeyPose} from '../world/street-journey.js';
const bounds={minX:0,maxX:100,minZ:0,maxZ:100},road={pts:[[0,0],[80,0],[80,100]]};
test('all interpolated camera positions stay bounded and above roofs along street segments',()=>{
 const plan=planStreetJourney(road,bounds,[{height:90}]);
 for(let i=0;i<=1000;i++){const {position:p}=journeyPose(plan,i/1000);expect(p.x>=0&&p.x<=100&&p.z>=0&&p.z<=100).toBe(true);expect(p.x===80||p.z===0).toBe(true);expect(p.y).toBe(102);}
 expect(journeyPose(plan,1).position).toEqual({x:80,y:102,z:100});
});
test('missing, unsupported, over-limit and unsafe geometry fail closed',()=>{
 for(const r of [null,{pts:[]},{pts:[[0,0],[NaN,1]]},{pts:[[0,0],[101,0]]},{pts:[[0,0],[0,0]]},{pts:Array(2049).fill([0,0])}])expect(planStreetJourney(r,bounds)).toBeNull();
 expect(planStreetJourney(road,null)).toBeNull();expect(planStreetJourney(road,bounds,[{height:1200}])).toBeNull();expect(planStreetJourney(road,bounds,[{}])).toBeNull();
});

import {mountStreetJourney} from '../world/street-journey.js';
import * as THREE from 'three';
function component(){
 const doc=new EventTarget();doc.defaultView=new EventTarget();
 const node=()=>Object.assign(new EventTarget(),{ownerDocument:doc,dataset:{},style:{},children:[],append(n){this.children.push(n);},remove(){this.removed=true;}});
 const select=node(),buttons=[node(),node(),node()],status=node(),root=node();select.value='0';root.querySelector=t=>t==='select'?select:status;root.querySelectorAll=()=>buttons;doc.createElement=t=>t==='details'?root:node();
 const canvas=node(),camera={position:new THREE.Vector3(50,80,50)},controls=new THREE.EventDispatcher();controls.target=new THREE.Vector3(50,0,50);controls.update=()=>{};
 const data={source:'osm',roads:[road],bounds,buildings:[]};let reduce=false;
 const journey=mountStreetJourney({container:node(),canvas,camera,controls,getData:()=>data,reducedMotion:()=>reduce});
 return {journey,buttons,status,data,camera,canvas,doc,reduce:()=>{reduce=true;}};
}
test('skip and back restore view, cancellation persists and data remains read-only',()=>{
 const f=component(),before=JSON.stringify(f.data);f.buttons[0].onclick();f.journey.update(0);f.journey.update(2000);expect(f.camera.position.x).toBe(80);f.buttons[1].onclick();expect(f.camera.position.z).toBe(100);f.buttons[2].onclick();expect(f.camera.position.toArray()).toEqual([50,80,50]);
 f.buttons[0].onclick();f.canvas.dispatchEvent(new Event('pointerdown'));const pose=f.camera.position.toArray();f.journey.update(4000);expect(f.camera.position.toArray()).toEqual(pose);expect(f.status.textContent).toContain('interrupted');expect(JSON.stringify(f.data)).toBe(before);f.journey.dispose();
});
test('reduced motion cuts, unavailable geometry fails closed and changed bounds cancel',()=>{
 const f=component();f.reduce();f.buttons[0].onclick();expect(f.camera.position.z).toBe(100);expect(f.buttons[1].disabled).toBe(true);f.data.roads=[];f.buttons[0].onclick();expect(f.status.textContent).toContain('unavailable');f.journey.dispose();
 const g=component();g.buttons[0].onclick();g.journey.update(0);g.data.bounds={...bounds,maxX:40};const pose=g.camera.position.toArray();g.journey.update(1000);expect(g.camera.position.toArray()).toEqual(pose);expect(g.status.textContent).toContain('changed');g.journey.dispose();
});
