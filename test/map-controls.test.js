import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {cameraGroundFootprint,translateMapView,mountMapControls,isMapPanTypingTarget} from '../world/map-controls.js';
import {createFrameMeter,mountFpsMeter} from '../world/fps-meter.js';

class Target {
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type,event={}){event.type=type;event.preventDefault||=()=>{event.defaultPrevented=true;};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
}
class Element extends Target {
  constructor(doc,tag){super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.hidden=false;}
  append(...children){this.children.push(...children);for(const child of children)child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  setAttribute(key,value){this.attributes[key]=value;}
  closest(){if(['INPUT','TEXTAREA','SELECT','FORM'].includes(this.tagName)||this.isContentEditable)return this;return this.parent?.closest?.()||null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector==='button'&&child.tagName==='BUTTON'?[child]:[]),...child.querySelectorAll(selector)]);}
  dispatchEvent(event){this.fire(event.type,event);}
}
function setup({buttons=false}={}){
 const win=new Target();win.CustomEvent=class{constructor(type,options){this.type=type;Object.assign(this,options);}};
 const doc=new Target();doc.defaultView=win;doc.visibilityState='visible';doc.createElement=tag=>new Element(doc,tag);
 const container=new Element(doc,'div');doc.activeElement=container;
 const camera=new THREE.PerspectiveCamera(60,2,.1,1000);camera.position.set(0,100,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const controls={target:new THREE.Vector3(),enabled:true,update(){}};const moves=[];
 const api=mountMapControls({container,camera,controls,THREE,buttons,onPan:move=>moves.push(move),screensPerSecond:1});
 return{doc,win,container,camera,controls,api,moves};
}
test('one-screen cardinal pans derive current frustum dimensions and preserve camera-target pose/zoom',()=>{
 const {api,camera,controls,moves}=setup();const footprint=api.getScreenFootprint();
 expect(footprint.width).toBeCloseTo(4*100*Math.tan(Math.PI/6),6);expect(footprint.depth).toBeCloseTo(2*100*Math.tan(Math.PI/6),6);
 const offset=camera.position.clone().sub(controls.target),quaternion=camera.quaternion.clone(),zoom=camera.zoom;
 api.panScreen('east');expect(controls.target.x).toBeCloseTo(footprint.width,6);expect(camera.position.clone().sub(controls.target).distanceTo(offset)).toBeLessThan(1e-8);expect(camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-8);expect(camera.zoom).toBe(zoom);expect(moves[0]).toMatchObject({kind:'localPan',source:'screen',direction:'east'});
 camera.zoom=2;camera.updateProjectionMatrix();const zoomed=api.getScreenFootprint();expect(zoomed.width).toBeCloseTo(footprint.width/2,6);api.panScreen('north');expect(controls.target.z).toBeCloseTo(-zoomed.depth,6);api.destroy();
});
test('near-horizon ground footprint is finite and orthographic zoom is respected',()=>{
 const {camera,controls}=setup();camera.position.set(0,10,100);camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.far=500;camera.updateProjectionMatrix();
 const ground=cameraGroundFootprint({camera,controls,THREE});expect(ground.source).toBe('clipped-camera-ground-frustum');expect(Number.isFinite(ground.width)&&Number.isFinite(ground.depth)).toBe(true);
 const ortho=new THREE.OrthographicCamera(-100,100,50,-50,.1,1000);ortho.position.set(0,100,0);ortho.up.set(0,0,-1);ortho.lookAt(0,0,0);ortho.zoom=2;ortho.updateProjectionMatrix();const flat=cameraGroundFootprint({camera:ortho,controls,THREE});expect(flat.width).toBeCloseTo(100,5);expect(flat.depth).toBeCloseTo(50,5);
});
test('held arrows pan at time-based speed across frame rates and normalize diagonals',()=>{
 function run(hz,keys){const s=setup();s.api.update(0);for(const key of keys)s.win.fire('keydown',{key,target:s.container});for(let i=1;i<=hz;i++)s.api.update(i*1000/hz);return s;}
 const a=run(60,['ArrowRight']),b=run(10,['ArrowRight']);expect(a.controls.target.x).toBeCloseTo(b.controls.target.x,6);
 const diagonal=run(20,['ArrowRight','ArrowUp']),screen=diagonal.api.getScreenFootprint();expect(Math.hypot(diagonal.controls.target.x/screen.width,diagonal.controls.target.z/screen.depth)).toBeCloseTo(1,6);
});
test('forms, contenteditable, modifiers, blur, visibility and destruction prevent keyboard capture/movement',()=>{
 const s=setup();s.api.update(0);const input=s.doc.createElement('input');s.doc.activeElement=input;const event=s.win.fire('keydown',{key:'ArrowRight',target:input});s.api.update(100);expect(event.defaultPrevented).not.toBe(true);expect(s.controls.target.x).toBe(0);
 s.doc.activeElement=s.container;const modified=s.win.fire('keydown',{key:'ArrowRight',ctrlKey:true,target:s.container});s.api.update(200);expect(modified.defaultPrevented).not.toBe(true);
 s.win.fire('keydown',{key:'ArrowRight',target:s.container});s.api.update(250);expect(s.controls.target.x).toBeGreaterThan(0);const before=s.controls.target.x;s.win.fire('blur');s.api.update(350);expect(s.controls.target.x).toBe(before);
 s.win.fire('keydown',{key:'ArrowRight',target:s.container});s.doc.visibilityState='hidden';s.doc.fire('visibilitychange');s.doc.visibilityState='visible';s.api.update(400);expect(s.controls.target.x).toBe(before);
 const editable=s.doc.createElement('div');editable.isContentEditable=true;expect(isMapPanTypingTarget(editable)).toBe(true);
 s.api.destroy();s.win.fire('keydown',{key:'ArrowRight',target:s.container});s.api.update(500);expect(s.controls.target.x).toBe(before);expect(s.container.children).toHaveLength(0);
});
test('accessible button pad pans locally and disabled controls cannot move',()=>{
 const s=setup({buttons:true});const buttons=s.container.querySelectorAll('button');expect(buttons).toHaveLength(4);expect(buttons.map(b=>b.attributes['aria-label'])).toContain('Pan map north one screen');buttons.find(b=>b.dataset.panDirection==='east').fire('click');expect(s.controls.target.x).toBeGreaterThan(0);s.api.setEnabled(false);const before=s.camera.position.clone();expect(s.api.panScreen('north')).toBe(false);expect(s.camera.position.equals(before)).toBe(true);
});
test('FPS uses actual rolling timestamps, resets after pauses, and mount has no independent loop',()=>{
 const meter=createFrameMeter();expect(meter.update(0)).toBeNull();let sample;for(let i=1;i<=60;i++)sample=meter.update(i*1000/60);expect(sample.fps).toBeCloseTo(60,6);expect(sample.frameMs).toBeCloseTo(1000/60,6);expect(meter.update(5000)).toBeNull();expect(meter.update(5050).fps).toBeCloseTo(20,6);
 const s=setup();const fps=mountFpsMeter({container:s.container,refreshMs:0});fps.update(0);fps.update(20);const root=s.container.children.find(child=>child.dataset.testid==='world-fps-meter');expect(root.dataset.fps).toBe('50.0');fps.setVisible(false);expect(root.children[0].hidden).toBe(true);fps.destroy();expect(s.doc.listeners.get('visibilitychange')?.size).toBe(1); // only map-controls listener remains
});
test('screen buttons, direct pans and every held-arrow movement notify the same geometry-streaming hook and event',()=>{
 const s=setup(),events=[];
 const root=s.container.children.find(element=>element.dataset.testid==='map-pan-controls');
 root.addEventListener('world:local-pan',event=>events.push(event));
 s.api.panScreen('east');s.api.pan('north',10);
 s.api.update(0);s.win.fire('keydown',{key:'ArrowRight',target:s.container});s.api.update(16);s.api.update(32);
 expect(s.moves.map(move=>move.source)).toEqual(['screen','button','keyboard','keyboard']);
 expect(events.map(event=>event.detail.source)).toEqual(['screen','button','keyboard','keyboard']);
 expect(events.every(event=>event.bubbles&&event.detail.kind==='localPan'&&Number.isFinite(event.detail.dx)&&Number.isFinite(event.detail.dz))).toBe(true);
 // Business form buttons are guarded too, not only text entry fields.
 const form=s.doc.createElement('form'),button=s.doc.createElement('button');form.append(button);s.doc.activeElement=button;s.doc.fire('focusin',{target:button});
 const count=s.moves.length;s.win.fire('keydown',{key:'ArrowUp',target:button});s.api.update(48);expect(s.moves).toHaveLength(count);expect(events).toHaveLength(count);
});
test('pan distance stays target-centered and independent of far/horizon bounds',()=>{
 const s=setup();s.camera.position.set(0,10,100);s.camera.up.set(0,1,0);s.camera.lookAt(s.controls.target);s.camera.far=5000;s.camera.updateProjectionMatrix();
 const local=s.api.getPanFootprint(),distant=s.api.getScreenFootprint();
 expect(local.source).toBe('target-depth-local-viewport');expect(local.center).toEqual({x:0,z:0});expect(local.depth).toBeCloseTo(2*Math.hypot(10,100)*Math.tan(Math.PI/6),6);expect(distant.depth).toBeGreaterThan(local.depth*10);
 const offset=s.camera.position.clone().sub(s.controls.target);s.api.panScreen('east');expect(s.controls.target.x).toBeCloseTo(local.width,6);expect(s.camera.position.clone().sub(s.controls.target).distanceTo(offset)).toBeLessThan(1e-8);
 s.camera.far=50000;s.camera.updateProjectionMatrix();expect(s.api.getPanFootprint().width).toBeCloseTo(local.width,6);expect(s.api.getPanFootprint().depth).toBeCloseTo(local.depth,6);expect(s.api.getPanFootprint().center.x).toBeCloseTo(s.controls.target.x,6);
 s.api.update(0);s.win.fire('keydown',{key:'ArrowUp',target:s.container});for(let i=1;i<=4;i++)s.api.update(i*250);expect(s.controls.target.z).toBeCloseTo(-local.depth,6);expect(s.moves.at(-1).footprint.source).toBe('target-depth-local-viewport');
});

test('camera speed scales real-time keyboard motion',()=>{
 const distances=[];
 for(const speed of [.25,1,8]){
  const {api,win,controls}=setup();api.setSpeed(speed);
  win.fire('keydown',{key:'ArrowRight'});api.update(0);api.update(100);
  distances.push(controls.target.x);
  for(const invalid of [0,-1,NaN,Infinity,9])expect(()=>api.setSpeed(invalid)).toThrow();
  api.destroy();
 }
 expect(distances[0]/distances[1]).toBeCloseTo(.25,10);
 expect(distances[2]/distances[1]).toBeCloseTo(8,10);
});
