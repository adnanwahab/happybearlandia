import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createCityWalk} from '../world/vr/city-walk.js';
import {streetStops,nearestStop,snapDirection} from '../world/vr/locomotion.js';
import {readFileSync} from 'node:fs';
const town={roads:[{pts:[[0,0],[40,0]]}],buildings:[{id:'same-building',poly:[[15,-2],[25,-2],[25,2],[15,2]]}]};
function fixture(extra={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.01,1000);scene.add(camera);camera.position.set(6,50,9);
 const controls={target:new THREE.Vector3(0,0,0),enabled:true},original=()=>{},renderer={xr:{enabled:false},loop:original,renders:0,getAnimationLoop(){return this.loop;},async setAnimationLoop(value){this.loop=value;},render(){this.renders++;}};
 let paused=false,released=0;const walk=createCityWalk({scene,camera,controls,town,renderer,eligible:()=>true,pause:()=>{paused=true;return()=>{paused=false;released++;};},...extra});return{scene,camera,controls,renderer,walk,original,get paused(){return paused;},get released(){return released;}};
}
test('street stops are deterministic, bounded, finite and exclude supplied interiors',()=>{
 expect(streetStops(town)).toEqual(streetStops(town));expect(streetStops(town).map(s=>s.x)).toEqual([0,8,32,40]);expect(streetStops({})).toEqual([]);
 expect(streetStops({roads:[{pts:[[NaN,0],[10,0]]},{pts:[[0,0],[100000,0]]}]})).toEqual([]);
 expect(streetStops({roads:[{pts:[[0,0],[5000,0]]}]})).toHaveLength(512);
 expect(nearestStop(streetStops(town),{x:100,z:100},4)).toBe(null);
});
test('snap turn requires release; invalid axes cannot rotate',()=>{
 expect(snapDirection(.9,false)).toEqual({direction:1,latched:true});expect(snapDirection(-.9,true).direction).toBe(0);expect(snapDirection(.1,true).latched).toBe(false);expect(snapDirection(-.9,false).direction).toBe(-1);expect(snapDirection(NaN,false).direction).toBe(0);
});
test('desktop entry freezes, manual teleport and snap preserve viewer height and scene identities; exit restores',async()=>{
 const f=fixture(),before=f.scene.children.slice(),json=JSON.stringify(town),position=f.camera.position.clone();
 f.walk.enterDesktop();expect(f.walk.active).toBe(true);expect(f.paused).toBe(true);expect(f.controls.enabled).toBe(false);
 expect(f.walk.teleport({x:999,z:999})).toBe(false);expect(f.walk.teleport(f.walk.stops[1])).toBe(true);
 f.scene.updateMatrixWorld(true);const head=f.camera.getWorldPosition(new THREE.Vector3());expect(head.toArray()).toEqual([8,1.65,0]);f.walk.turn(1);f.scene.updateMatrixWorld(true);expect(f.camera.getWorldPosition(new THREE.Vector3()).distanceTo(head)).toBeLessThan(1e-9);
 f.walk.draw();expect(f.renderer.renders).toBe(1);expect(JSON.stringify(town)).toBe(json);
 await f.walk.exit();expect(f.scene.children).toEqual(before);expect(f.camera.position.equals(position)).toBe(true);expect(f.controls.enabled).toBe(true);expect(f.paused).toBe(false);expect(f.renderer.loop).toBe(f.original);expect(f.released).toBe(1);
 await f.walk.exit();expect(f.released).toBe(1);f.walk.destroy();
});
test('missing saved admission or road geometry never pauses or acquires an XR session',async()=>{
 let requests=0;const xr={requestSession(){requests++;throw Error('unexpected');}};
 for(const extra of [{eligible:()=>false},{town:{roads:[]}}]){const f=fixture({...extra,xr,secure:true});f.walk.enterDesktop();expect(f.walk.active).toBe(false);await f.walk.enterVR();expect(f.walk.active).toBe(false);expect(f.released).toBe(0);expect(f.paused).toBe(false);f.walk.destroy();}expect(requests).toBe(0);
});
test('access denial stays inactive and keeps desktop fallback usable',async()=>{
 const f=fixture({secure:true,xr:{requestSession:async()=>{throw Error('NotAllowedError');}}});await f.walk.enterVR();expect(f.walk.state().error).toContain('NotAllowedError');expect(f.walk.active).toBe(false);expect(f.paused).toBe(false);f.walk.enterDesktop();expect(f.walk.active).toBe(true);f.walk.destroy();expect(f.paused).toBe(false);
});
test('late headset acquisition after disposal is ended without touching the scene',async()=>{
 let resolve,ended=0;const f=fixture({secure:true,xr:{requestSession:()=>new Promise(r=>resolve=r)}});const entry=f.walk.enterVR();f.walk.destroy();resolve({end:async()=>ended++});await entry;expect(ended).toBe(1);expect(f.walk.active).toBe(false);expect(f.released).toBe(0);
});
test('renderer attachment failure ends session and restores prior camera and playback',async()=>{
 const session=new EventTarget();let ended=0;session.end=async()=>{ended++;session.dispatchEvent(new Event('end'));};const f=fixture({secure:true,xr:{requestSession:async()=>session}});f.renderer.xr.setReferenceSpaceType=()=>{};f.renderer.xr.setSession=async()=>{throw Error('WebGPU XR unsupported');};const original=f.camera.position.clone();await f.walk.enterVR();expect(ended).toBe(1);expect(f.walk.active).toBe(false);expect(f.camera.position.equals(original)).toBe(true);expect(f.paused).toBe(false);expect(f.renderer.loop).toBe(f.original);f.walk.destroy();
});
test('normal entry gates admission on checkpoint restoration and bypasses all normal frame work',()=>{
 const src=readFileSync(new URL('../world/render.js',import.meta.url),'utf8');expect(src).toContain('Boolean(loadedExperiment&&experimentRestored)');expect(src.indexOf('cityWalk=mountCityWalk')).toBeGreaterThan(src.indexOf('experimentRestored=true;'));
 const frame=src.slice(src.indexOf('function frame(now) {'));expect(frame.indexOf('if(cityWalk?.active)')).toBeLessThan(frame.indexOf('playback.update(now)'));expect(frame).toContain('if(!cityWalk.immersive)cityWalk.draw();');
});
test('successful XR owns one loop, controller pointers, snap release and end cleanup over repeated sessions',async()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const sessions=[],requests=[],controllers=[new THREE.Group(),new THREE.Group()];let ended=0;
  const f=fixture({secure:true,xr:{requestSession:async(mode,options)=>{requests.push([mode,options]);const s=new EventTarget();s.inputSources=[{gamepad:{axes:[0,0,.9,0]}}];s.end=async()=>{ended++;s.dispatchEvent(new Event('end'));};sessions.push(s);return s;}}});
  Object.assign(f.renderer.xr,{setReferenceSpaceType(type){expect(type).toBe('local-floor');},async setSession(){},getController:i=>controllers[i]});
  const before=f.scene.children.slice();
  for(let run=0;run<3;run++){
   await f.walk.enterVR();expect(f.walk.immersive).toBe(true);expect(f.renderer.loop).toBe(f.walk.draw);expect(controllers[0].children).toHaveLength(1);expect(f.camera.near).toBe(.01);
   const rig=f.camera.parent;f.walk.draw();const angle=rig.rotation.y;f.walk.draw();expect(rig.rotation.y).toBe(angle);sessions.at(-1).inputSources[0].gamepad.axes[2]=0;f.walk.draw();sessions.at(-1).inputSources[0].gamepad.axes[2]=-.9;f.walk.draw();expect(Math.abs(rig.rotation.y)).toBeLessThan(1e-9);
   await f.walk.exit();await Promise.resolve();expect(f.scene.children).toEqual(before);expect(controllers[0].children).toHaveLength(0);expect(controllers[0]._listeners.select).toHaveLength(0);expect(f.renderer.loop).toBe(f.original);expect(f.walk.active).toBe(false);
  }
  expect(ended).toBe(3);expect(requests[0]).toEqual(['immersive-vr',{requiredFeatures:['local-floor','webgpu']}]);f.walk.destroy();
 }finally{globalThis.document=previous;}
});
test('controller rays select road teleport stops and headset comfort/exit buttons',async()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const session=new EventTarget();session.inputSources=[];session.end=async()=>session.dispatchEvent(new Event('end'));
  const controllers=[new THREE.Group(),new THREE.Group()],f=fixture({secure:true,xr:{requestSession:async()=>session}});
  Object.assign(f.renderer.xr,{setReferenceSpaceType(){},async setSession(){},getController:i=>controllers[i]});await f.walk.enterVR();f.camera.position.y=1.65;
  const c=controllers[0];c.position.set(0,1.5,0);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(8,-1.5,0).normalize());f.scene.updateMatrixWorld(true);c.dispatchEvent({type:'select'});expect(f.camera.getWorldPosition(new THREE.Vector3()).x).toBe(8);
  const hud=f.camera.children.find(o=>o.isGroup),comfortButton=hud.children[2],exitButton=hud.children[3];
  function aim(button){f.scene.updateMatrixWorld(true);const target=button.getWorldPosition(new THREE.Vector3()),origin=c.getWorldPosition(new THREE.Vector3());c.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),target.sub(origin).normalize());f.scene.updateMatrixWorld(true);c.dispatchEvent({type:'select'});}
  aim(comfortButton);expect(f.walk.state().vignette).toBe(false);aim(exitButton);await Promise.resolve();await Promise.resolve();expect(f.walk.active).toBe(false);expect(f.paused).toBe(false);f.walk.destroy();
 }finally{globalThis.document=previous;}
});
