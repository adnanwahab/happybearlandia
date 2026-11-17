import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {projectAffordance} from '../world/render/anchored-affordance.js';
function setup(){const camera=new THREE.PerspectiveCamera(45,1,.1,1000);camera.position.set(0,2,20);camera.lookAt(0,2,0);camera.updateMatrixWorld();return {THREE,camera,position:{x:0,y:2,z:0},bounds:{left:20,top:30,width:320,height:568}};}
test('tracks sampled coordinates and clamps within offset small-phone bounds',()=>{const input=setup(),first=projectAffordance(input),next=projectAffordance({...input,position:{x:3,y:2,z:0}});expect(next.x).toBeGreaterThan(first.x);const edge=projectAffordance({...input,position:{x:8,y:2,z:0}});expect(edge.x+180).toBeLessThanOrEqual(332);expect(edge.y).toBeGreaterThanOrEqual(38);});
test('missing, invalid, behind-camera and outside-frustum targets have no affordance',()=>{const input=setup();for(const position of [null,{x:NaN,y:0,z:0},{x:0,y:2,z:30},{x:1000,y:2,z:0}])expect(projectAffordance({...input,position})).toBeNull();expect(projectAffordance({...input,bounds:{left:0,top:0,width:180,height:200}})).toBeNull();});
test('opaque geometry occludes; invisible, faded and transparent geometry do not',()=>{const input=setup(),wall=new THREE.Mesh(new THREE.BoxGeometry(10,10,1),new THREE.MeshBasicMaterial());wall.position.set(0,2,10);wall.updateMatrixWorld();const project=()=>projectAffordance({...input,occluders:[wall]});expect(project()).toBeNull();wall.visible=false;expect(project()).not.toBeNull();wall.visible=true;wall.userData.buildingDateFaded=true;expect(project()).not.toBeNull();wall.userData.buildingDateFaded=false;wall.material.transparent=true;wall.material.opacity=.1;expect(project()).not.toBeNull();wall.material.opacity=1;expect(projectAffordance({...input,occluders:[wall],exclude:wall})).not.toBeNull();wall.geometry.dispose();wall.material.dispose();});

test('stable DOM focus, stale activation rejection and cleanup',async()=>{
 const {mountAnchoredAffordance}=await import('../world/render/anchored-affordance.js');
 const input=setup(),doc={activeElement:null,defaultView:{innerWidth:320,innerHeight:568}};
 class Element {constructor(){this.ownerDocument=doc;this.dataset={};this.style={};this.listeners={};this.hidden=false;}append(child){this.child=child;}setAttribute(key,value){this[key]=value;}addEventListener(name,handler){this.listeners[name]=handler;}focus(){doc.activeElement=this;}remove(){this.removed=true;}getBoundingClientRect(){return {left:0,top:0,right:320,bottom:568,width:320,height:568};}}
 doc.createElement=()=>new Element();const container=new Element(),canvas=new Element();let count=0,target={key:'worker:revision1:p7',id:'p7',label:'resident',position:input.position,inspect:()=>count++};
 const overlay=mountAnchoredAffordance({container,canvas,THREE,camera:input.camera,resolve:()=>target}),button=container.child;
 overlay.update();expect(button.hidden).toBe(false);button.focus();target.position={x:2,y:2,z:0};overlay.update();expect(doc.activeElement).toBe(button);expect(container.child).toBe(button);button.listeners.click();expect(count).toBe(1);
 target={...target,key:'worker:revision2:p7'};button.listeners.click();expect(count).toBe(1);expect(button.hidden).toBe(true);expect(doc.activeElement).toBe(canvas);
 overlay.update();expect(button.hidden).toBe(false);target.available=false;button.listeners.click();expect(count).toBe(1);expect(button.hidden).toBe(true);target=null;overlay.update();overlay.destroy();expect(button.removed).toBe(true);
});
