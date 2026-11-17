import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const model=readFileSync('world/measure/model.js','utf8');
const panel=readFileSync('world/measure/panel.js','utf8').replace("'./model.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(model).toString('base64')));
for(const mobile of [false,true])test(`tape success, missing, failure, reset and cleanup mobile=${mobile}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://tape.test/**',r=>r.fulfill({contentType:'text/html',body:'<main></main><canvas tabindex="0" width="300" height="300"></canvas>'}));await page.goto('https://tape.test/');
 await page.evaluate(async source=>{const {mountTapeMeasure}=await import('data:text/javascript;base64,'+btoa(source));window.mode='success';window.n=0;window.clears=0;window.tape=mountTapeMeasure({container:document.querySelector('main'),canvas:document.querySelector('canvas'),clear:()=>clears++,pick:()=>{if(mode==='missing')return null;if(mode==='failure')throw Error();return {point:n++%2?{x:3,y:12,z:4}:{x:0,y:0,z:0},tag:'fixture shell',area:12};}});},panel);
 await page.locator('summary').click();const start=page.getByRole('button',{name:'Start measuring'}),status=page.getByRole('status');await start.click();
 const canvas=page.locator('canvas');await canvas.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(status).toContainText('Distance 13.00 m');await expect(status).toContainText('Height 12.00 m');
 await page.getByLabel('Tape units').selectOption('ft');await expect(status).toContainText('42.65 ft');
 await page.getByRole('button',{name:'Reset tape'}).dispatchEvent('click',{pointerType:'touch'});await expect(status).toContainText('reset');
 await start.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');await expect(start).toBeFocused();await expect(status).toContainText('reset');
 await start.click();await page.evaluate(()=>mode='missing');await canvas.click();await expect(status).toContainText('Unsupported');
 await page.evaluate(()=>mode='failure');await canvas.click();await expect(status).toContainText('failed');
 expect(await page.evaluate(()=>tape.getStats().failures)).toBe(1);await page.evaluate(()=>tape.dispose());await expect(page.locator('details')).toHaveCount(0);expect(await page.evaluate(()=>tape.getStats().disposed)).toBe(true);
});
