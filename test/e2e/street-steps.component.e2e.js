import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const files=Object.fromEntries(['street-steps.js','camera-presets.js','population/pedestrian-routes.js'].map(p=>[p,readFileSync('world/'+p,'utf8')]));
test('mobile five-hop block, unsupported, blocked, failure, skip, focus and cleanup',async({page})=>{
 await page.route('https://steps.test/**',route=>{const path=new URL(route.request().url()).pathname.slice(1);return route.fulfill({contentType:files[path]?'text/javascript':'text/html',body:files[path]??'<main></main><canvas></canvas>'});});
 await page.goto('https://steps.test/');
 await page.evaluate(async()=>{
 const {mountStreetSteps}=await import('/street-steps.js');const v=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}});
 window.camera={position:v()};window.controls=new EventTarget();controls.target=v();controls.update=()=>{};
 window.roads=[];window.buildings=[];window.reduce=true;window.fail=false;
 window.steps=mountStreetSteps({container:document.querySelector('main'),canvas:document.querySelector('canvas'),camera,controls,getRoads:()=>{if(fail)throw Error();return roads;},getBuildings:()=>buildings,reducedMotion:()=>reduce});
 });
 await page.locator('summary').tap();const start=page.getByRole('button',{name:'Find nearby sidewalk'}),status=page.getByRole('status');
 await start.tap();await expect(status).toContainText('Unavailable');
 await page.evaluate(()=>{roads=[{pts:[[0,0],[100,0]]}];});await start.tap();
 for(let i=1;i<=5;i++){const stone=page.getByRole('button',{name:`${i} → Step`,exact:true});await stone.focus();expect(await stone.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');await stone.tap();await expect(status).toContainText(`Step ${i} of 5`);}
 await page.evaluate(()=>{controls.target.set(0,0,0);reduce=false;});await start.tap();await page.getByRole('button',{name:'1 → Step',exact:true}).tap();await page.evaluate(()=>{steps.update(0);steps.update(16);});await page.getByRole('button',{name:'Skip animation'}).tap();await expect(status).toContainText('Step 1 of 5');
 expect(await page.evaluate(()=>steps.stats.frames)).toBe(2);
 await page.evaluate(()=>{buildings=[{height:20,poly:[[20,-8],[24,-8],[24,8],[20,8]]}];controls.target.set(0,0,0);});await start.tap();await expect(page.getByRole('button',{name:/Unavailable/}).first()).toBeDisabled();
 await page.evaluate(()=>{fail=true;});await start.tap();await expect(status).toContainText('Unable to read');
 await page.evaluate(()=>{fail=false;buildings=[];});await start.tap();await page.keyboard.press('Escape');await expect(status).toContainText('stopped');
 await page.evaluate(()=>steps.dispose());await expect(page.locator('details')).toHaveCount(0);
});
