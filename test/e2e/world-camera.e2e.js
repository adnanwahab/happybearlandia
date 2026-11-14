import {test,expect} from '@playwright/test';
test('normal World frame loop keeps rendering and accepts orbit, pan and zoom',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1200,height:800});
 // Capture the real controls for measurement only; no camera/input behavior is mocked.
 await page.route('**/OrbitControls.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst qaUpdate=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...args){globalThis.__qaCamera=this;globalThis.__qaCameraFrames=(globalThis.__qaCameraFrames||0)+1;return qaUpdate.apply(this,args);};'});});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.__qaCamera,{timeout:45000});
 const sample=()=>page.evaluate(()=>({position:__qaCamera.object.position.toArray(),target:__qaCamera.target.toArray(),distance:__qaCamera.object.position.distanceTo(__qaCamera.target),frames:__qaCameraFrames}));
 const first=await sample();await page.mouse.move(650,550);await page.mouse.down();await page.mouse.move(850,480,{steps:20});await page.mouse.up();
 await expect.poll(async()=>JSON.stringify((await sample()).position)).not.toBe(JSON.stringify(first.position));
 const rotated=await sample();await page.mouse.move(650,550);await page.mouse.down({button:'right'});await page.mouse.move(750,550,{steps:12});await page.mouse.up({button:'right'});
 await expect.poll(async()=>JSON.stringify((await sample()).target)).not.toBe(JSON.stringify(rotated.target));
 const panned=await sample();await page.mouse.wheel(0,-250);await expect.poll(async()=>(await sample()).distance).toBeLessThan(panned.distance);
 await expect.poll(async()=>(await sample()).frames).toBeGreaterThan(first.frames+20);
 expect(errors).toEqual([]);await page.screenshot({path:test.info().outputPath('camera-controls-fixed.png')});
});
