import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const routeSource=readFileSync('world/camera-route.js','utf8');
const source=readFileSync('world/camera-presets.js','utf8').replace('./camera-route.js','data:text/javascript;base64,'+Buffer.from(routeSource).toString('base64'));
test('native component handles return, selection, interruption, reduced motion and cleanup',async({page})=>{
 await page.route('https://camera.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main><canvas width="600" height="400"></canvas>'}));
 await page.goto('https://camera.test/');
 await page.evaluate(async source=>{
 const {mountCameraPresets}=await import('data:text/javascript;base64,'+btoa(source));
 const vector=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
 const controls=new EventTarget();controls.target=vector(0,0,0);controls.update=()=>{};
 window.camera={position:vector(320,125,450)};window.controls=controls;
 window.subject=null;window.reduce=false;
 window.picker=mountCameraPresets({container:document.querySelector('main'),canvas:document.querySelector('canvas'),camera,controls,getBuildings:()=>[],getSubject:()=>subject,reducedMotion:()=>reduce});
 },source);
 await page.locator('summary').click();const status=page.getByRole('status');
 await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(status).toContainText('unavailable');
 await page.getByRole('button',{name:'Street',exact:true}).focus();await page.keyboard.press('Enter');await expect(status).toContainText('Street view');
 await page.getByRole('button',{name:'Skyline',exact:true}).click();await page.getByRole('button',{name:'Return',exact:true}).click();
 expect(await page.evaluate(()=>[camera.position.x,camera.position.y,camera.position.z])).toEqual([320,125,450]);
 await page.evaluate(()=>{subject={key:'fixture-7',position:{x:20,y:0,z:10}};});
 await page.getByRole('button',{name:'Follow',exact:true}).click();
 await page.evaluate(()=>{subject.position.x=50;picker.update(1);});expect(await page.evaluate(()=>controls.target.x)).toBe(50);
 await page.keyboard.press('Escape');await expect(status).toContainText('interrupted');
 await page.evaluate(()=>{subject.position.x=90;picker.update(2);});expect(await page.evaluate(()=>controls.target.x)).toBe(50);
 await page.getByRole('button',{name:'Follow',exact:true}).click();await page.locator('canvas').dispatchEvent('pointerdown',{pointerType:'touch'});await expect(status).toContainText('interrupted');
 await page.getByRole('button',{name:'Follow',exact:true}).click();await page.evaluate(()=>{subject.key='another-resident';picker.update(3);});await expect(status).toContainText('selection or position changed');
 await page.evaluate(()=>{reduce=true;});await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(status).toContainText('Reduced motion');
 await page.evaluate(()=>{subject.position.x=120;picker.update(4);});expect(await page.evaluate(()=>controls.target.x)).toBe(90);
 expect(await page.evaluate(()=>subject.key)).toBe('another-resident');
 await page.evaluate(()=>picker.dispose());await expect(page.locator('details')).toHaveCount(0);
});

test('cinematic motion cancels on keyboard and touch, and reduced motion cuts',async({page})=>{
 await page.route('https://camera.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main><canvas></canvas>'}));
 await page.goto('https://camera.test/');
 await page.evaluate(async source=>{
  const {mountCameraPresets}=await import('data:text/javascript;base64,'+btoa(source));
  const vector=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
  const controls=new EventTarget();controls.target=vector(0,0,0);controls.update=()=>{};
  window.camera={position:vector(320,125,450)};window.reduce=false;
  window.picker=mountCameraPresets({cinematic:true,container:document.querySelector('main'),canvas:document.querySelector('canvas'),camera,controls,getBuildings:()=>[{height:100,poly:[[50,50],[150,50],[150,150],[50,150]]}],getSubject:()=>null,reducedMotion:()=>reduce});
  window.tick=()=>picker.update(performance.now()+200);
 },source);
 await page.locator('summary').click();
 const sample=()=>page.evaluate(()=>({...camera.position,set:undefined}));
 const initial=await sample();
 await page.getByRole('button',{name:'Street',exact:true}).focus();await page.keyboard.press('Enter');await page.evaluate(()=>tick());
 expect(await sample()).not.toEqual(initial);
 await page.keyboard.press('ArrowUp');const stopped=await sample();await page.evaluate(()=>tick());expect(await sample()).toEqual(stopped);
 await page.getByRole('button',{name:'Skyline',exact:true}).click();await page.locator('canvas').dispatchEvent('pointerdown',{pointerType:'touch'});const touched=await sample();await page.evaluate(()=>tick());expect(await sample()).toEqual(touched);
 await page.evaluate(()=>reduce=true);await page.getByRole('button',{name:'Street',exact:true}).click();const cut=await sample();expect(cut.y).toBe(5);await page.evaluate(()=>tick());expect(await sample()).toEqual(cut);
 await page.screenshot({path:test.info().outputPath('cinematic-input.png')});
});
