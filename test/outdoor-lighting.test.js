import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {outdoorLighting,updateOutdoorShadow,disposeOutdoorShadow} from '../world/render/environment/outdoor-lighting.js';
import {simulationLighting} from '../world/render/environment/sim-lighting.js';
import {QualityManager,PRESETS} from '../world/render/renderer/quality-manager.js';
test('solar sweep stays bounded and continuous including dawn, dusk and midnight',()=>{
 let previous;
 for(let minute=0;minute<=1440;minute++){
  const light=simulationLighting(minute),out=outdoorLighting(light.daylight,light.twilight);
  for(const value of Object.values(out))expect(Number.isFinite(value)).toBe(true);
  expect(out.exposure).toBeGreaterThanOrEqual(.78);expect(out.exposure).toBeLessThanOrEqual(.85);
  if(previous)for(const key of Object.keys(out))expect(Math.abs(out[key]-previous[key])).toBeLessThan(.03);
  previous=out;
 }
 expect(outdoorLighting()).toEqual(outdoorLighting(NaN,Infinity));
 expect(outdoorLighting(.5,0,'rain').fogDensity).toBeGreaterThan(outdoorLighting(.5).fogDensity);
});
test('shadow region follows rapid camera changes on every tier without changing sun direction',()=>{
 const sun=new THREE.DirectionalLight();sun.position.set(800,1000,400);
 for(const preset of Object.keys(PRESETS)){
  const q=new QualityManager(preset);
  for(const target of [new THREE.Vector3(),new THREE.Vector3(2000,20,-1000),new THREE.Vector3(-8000,0,5000)]){
   updateOutdoorShadow(sun,target,q.settings,1);
   expect(sun.position.clone().sub(sun.target.position).toArray()).toEqual([800,1000,400]);
   expect(sun.target.position.toArray()).toEqual([target.x,0,target.z]);
   expect(sun.shadow.camera.right).toBeLessThanOrEqual(400);
  }
  q.level=5;updateOutdoorShadow(sun,new THREE.Vector3(),q.settings,1);expect(sun.castShadow).toBe(false);
 }
 updateOutdoorShadow(sun,new THREE.Vector3(),new QualityManager().settings,0);expect(sun.castShadow).toBe(false);
 updateOutdoorShadow(sun,new THREE.Vector3(),new QualityManager().settings,1,false);expect(sun.castShadow).toBe(false);
});

test('quality changes and repeated teardown release both shadow targets once',()=>{
 const sun=new THREE.DirectionalLight();let disposed=0;
 sun.shadow.map={dispose(){disposed++;}};sun.shadow.mapPass={dispose(){disposed++;}};
 disposeOutdoorShadow(sun);disposeOutdoorShadow(sun);
 expect(disposed).toBe(2);expect(sun.shadow.map).toBeNull();expect(sun.shadow.mapPass).toBeNull();
});
