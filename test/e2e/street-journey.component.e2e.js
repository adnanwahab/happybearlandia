import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/street-journey.js','utf8');
for(const mobile of [false,true])test(`street preview keyboard/touch, skip/back and missing geometry ${mobile}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});
 await page.route('https://journey.test/**',route=>route.fulfill({contentType:'text/html',body:'<main></main><canvas></canvas>'}));await page.goto('https://journey.test/');
 await page.evaluate(async source=>{const {mountStreetJourney}=await import('data:text/javascript;base64,'+btoa(source));const v=(x,y,z)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});window.camera={position:v(50,80,50)};const controls=new EventTarget();controls.target=v(50,0,50);controls.update=()=>{};window.data={source:'synthetic',roads:[{name:'Fixture street',pts:[[0,0],[100,0],[100,100]]}],bounds:{minX:0,maxX:100,minZ:0,maxZ:100},buildings:[]};window.journey=mountStreetJourney({container:document.querySelector('main'),canvas:document.querySelector('canvas'),camera,controls,getData:()=>data,reducedMotion:()=>matchMedia('(prefers-reduced-motion: reduce)').matches});},source);
 await page.locator('summary').click();const start=page.getByRole('button',{name:'Journey',exact:true}),status=page.getByRole('status');
 await start.focus();await page.keyboard.press('Enter');await expect(status).toContainText('Synthetic');await page.evaluate(()=>{journey.update(0);journey.update(2000);});
 expect(await page.evaluate(()=>[camera.position.x,camera.position.z])).toEqual([100,0]);
 await page.getByRole('button',{name:'Skip',exact:true}).click();expect(await page.evaluate(()=>camera.position.z)).toBe(100);
 await page.getByRole('button',{name:'Back',exact:true}).click();expect(await page.evaluate(()=>camera.position.y)).toBe(80);
 await start.click();if(mobile)await page.locator('canvas').dispatchEvent('pointerdown',{pointerType:'touch'});else await page.keyboard.press('Escape');await expect(status).toContainText('interrupted');
 await page.emulateMedia({reducedMotion:'reduce'});await start.click();await expect(status).toContainText('camera cut');await expect(page.getByRole('button',{name:'Skip',exact:true})).toBeDisabled();
 await page.evaluate(()=>data.roads=[]);await start.click();await expect(status).toContainText('unavailable');
 await page.screenshot({path:test.info().outputPath(`street-${mobile?'mobile':'desktop'}.png`)});await page.evaluate(()=>journey.dispose());await expect(page.locator('details')).toHaveCount(0);
});
