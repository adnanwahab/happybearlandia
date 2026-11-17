import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('world/infrastructure-scanner.js','utf8');
for(const mobile of [false,true])test(`scanner source, gaps, failure, controls and cleanup ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://scanner.test/**',r=>r.fulfill({contentType:'text/html',body:'<main></main><canvas width="300" height="200"></canvas>'}));await page.goto('https://scanner.test');
 await page.evaluate(async source=>{const {mountInfrastructureScanner}=await import('data:text/javascript;base64,'+btoa(source));window.data={source:'osm',roads:[{sourceRef:'osm:way:42',nodeRefs:['osm:node:1','osm:node:2'],kind:'path',pts:[[0,0],[0,20]]}]};window.scanner=mountInfrastructureScanner({container:document.querySelector('main'),canvas:document.querySelector('canvas'),toGround:()=>({x:0,z:10}),getData:()=>{if(window.fail)throw Error('fixture');return window.data;}});},source);
 await page.locator('summary').click();const button=page.getByRole('button',{name:'Scan center'}),status=page.getByRole('status');await button.focus();await page.keyboard.press('Enter');await expect(status).toContainText('osm:way:42');await expect(status).toContainText('osm:node:2');expect(await button.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await page.evaluate(()=>{data.source='synthetic';});await button.click();await expect(status).toContainText('Unsupported');await expect(status).not.toContainText('osm:way:42');
 await page.evaluate(()=>{fail=true;});await button.click();await expect(status).toContainText('failed');expect(await status.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('repeating-linear-gradient');
 await page.evaluate(()=>{scanner.recordFrame(17);scanner.recordFrame(21);});expect(await page.evaluate(()=>scanner.getState())).toMatchObject({frames:2,maxFrameMs:21,scans:3});
 await button.focus();await page.keyboard.press('Escape');await expect(page.locator('details')).not.toHaveAttribute('open','');await expect(page.locator('summary')).toBeFocused();
 await page.evaluate(()=>scanner.destroy());await expect(page.locator('details')).toHaveCount(0);await page.locator('canvas').dispatchEvent('pointermove',{clientX:20,clientY:20});expect(await page.evaluate(()=>scanner.getState().scans)).toBe(3);
});
