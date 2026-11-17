import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// Real DOM + installed Three scene, with an explicit fake XR/device boundary.
// This is not hardware or canonical saved-checkpoint acceptance evidence.
const fixture=`<!doctype html><html><head><script type="importmap">{"imports":{"three":"/vendor/three/three.webgpu.js"}}</script></head><body><button id="outside">Other camera action</button><main id="controls"></main><script type="module">
import * as THREE from 'three';import {mountCityWalk} from '/world/vr/city-walk.js';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,1,5000);scene.add(camera);camera.position.set(10,90,20);const controls={enabled:true,target:new THREE.Vector3()};let paused=false,loop=null;
const controllers=[new THREE.Group(),new THREE.Group()];const renderer={xr:{enabled:false,setReferenceSpaceType(){},async setSession(){},getController:i=>controllers[i]},getAnimationLoop:()=>loop,async setAnimationLoop(value){loop=value;},render(){}};
window.eligible=true;window.denied=false;window.session=null;window.outsideClicks=0;document.querySelector('#outside').onclick=()=>window.outsideClicks++;
const xr={async requestSession(){if(window.denied)throw Error('NotAllowedError');const session=new EventTarget();session.inputSources=[];session.end=async()=>session.dispatchEvent(new Event('end'));window.session=session;return session;}};
window.walk=mountCityWalk({container:document.querySelector('#controls'),scene,camera,controls,renderer,xr,secure:true,eligible:()=>window.eligible,town:{buildings:[],roads:[{pts:[[0,0],[24,0]]}]},pause:()=>{paused=true;return()=>paused=false;}});
window.inspect=()=>({active:walk.active,immersive:walk.immersive,paused,near:camera.near,position:camera.getWorldPosition(new THREE.Vector3()).toArray(),sceneChildren:scene.children.length,pointerChildren:controllers[0].children.length,loop:!!loop});window.ready=true;
</script></body></html>`;
async function open(page){
 if(process.env.HBL_VR_NO_SERVER==='1'){
  const modules={'/vendor/three/three.webgpu.js':'node_modules/three/build/three.webgpu.js','/vendor/three/three.core.js':'node_modules/three/build/three.core.js','/world/vr/city-walk.js':'world/vr/city-walk.js','/world/vr/locomotion.js':'world/vr/locomotion.js'};
  await page.route('**/*.js',async route=>{const path=modules[new URL(route.request().url()).pathname];if(!path)return route.abort();await route.fulfill({contentType:'text/javascript',body:await readFile(path,'utf8')});});
 }
await page.route('**/__city-walk-test',route=>route.fulfill({contentType:'text/html',body:fixture}));await page.goto('/__city-walk-test');await page.waitForFunction(()=>window.ready);await page.getByText('VR City Walk',{exact:true}).click();}
test('mobile/reduced-motion desktop controls, keyboard exit, denial and missing-save failure',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await page.getByRole('button',{name:'Street view',exact:true}).click();await expect.poll(()=>page.evaluate(()=>inspect().paused)).toBe(true);
 await page.getByLabel('Street teleport destination').selectOption('street-2');await page.getByRole('button',{name:'Teleport',exact:true}).click();expect((await page.evaluate(()=>inspect())).position).toEqual([16,1.65,0]);
 await page.getByRole('button',{name:'Turn left',exact:true}).focus();await page.keyboard.press('ArrowLeft');await page.getByRole('button',{name:'Comfort vignette',exact:true}).click();await expect(page.getByRole('button',{name:'Comfort vignette'})).toHaveAttribute('aria-pressed','false');
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>inspect())).toMatchObject({active:false,paused:false,near:1,position:[10,90,20],sceneChildren:1});
 await page.evaluate(()=>window.denied=true);await page.getByRole('button',{name:'Enter VR',exact:true}).click();await expect(page.getByRole('status')).toContainText('NotAllowedError');
 await page.evaluate(()=>window.eligible=false);await page.getByRole('button',{name:'Street view',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved scene');expect((await page.evaluate(()=>inspect())).active).toBe(false);
});
test('successful simulated session and system exit return pointers and scene resources',async({page})=>{
 await open(page);for(let i=0;i<3;i++){await page.getByRole('button',{name:'Enter VR',exact:true}).click();await expect.poll(()=>page.evaluate(()=>inspect().immersive)).toBe(true);expect(await page.evaluate(()=>inspect())).toMatchObject({paused:true,pointerChildren:1});await page.evaluate(()=>session.end());await expect.poll(()=>page.evaluate(()=>inspect().active)).toBe(false);expect(await page.evaluate(()=>inspect())).toMatchObject({paused:false,pointerChildren:0,sceneChildren:1,loop:false});}
});
