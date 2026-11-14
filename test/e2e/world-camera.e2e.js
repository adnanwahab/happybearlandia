import {test,expect} from '@playwright/test';
test('normal World frame loop keeps rendering and accepts orbit, pan and zoom',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1200,height:800});
 // Capture the real controls for measurement only; no camera/input behavior is mocked.
 await page.route('**/OrbitControls.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst qaUpdate=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...args){globalThis.__qaCamera=this;globalThis.__qaCameraFrames=(globalThis.__qaCameraFrames||0)+1;return qaUpdate.apply(this,args);};'});});
 await page.route('**/render/city-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst qaMount=mountCityRenderer;mountCityRenderer=function(...args){const api=qaMount(...args);globalThis.__qaCityRenderer=api;return api;};'});});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.__qaCamera,{timeout:45000});
 const sample=()=>page.evaluate(()=>({position:__qaCamera.object.position.toArray(),target:__qaCamera.target.toArray(),distance:__qaCamera.object.position.distanceTo(__qaCamera.target),frames:__qaCameraFrames}));
 await expect.poll(()=>page.evaluate(()=>window.__qaCityRenderer?.timeOfDay)).toBe(14);
 await expect.poll(()=>page.evaluate(()=>window.__qaCityRenderer?.getPerformanceStats().lighting?.daylight??0)).toBeGreaterThan(.8);
 const first=await sample();await page.mouse.move(650,550);await page.mouse.down();await page.mouse.move(850,480,{steps:20});await page.mouse.up();
 await expect.poll(async()=>JSON.stringify((await sample()).position)).not.toBe(JSON.stringify(first.position));
 const rotated=await sample();await page.mouse.move(650,550);await page.mouse.down({button:'right'});await page.mouse.move(750,550,{steps:12});await page.mouse.up({button:'right'});
 await expect.poll(async()=>JSON.stringify((await sample()).target)).not.toBe(JSON.stringify(rotated.target));
 const panned=await sample();await page.mouse.wheel(0,-250);await expect.poll(async()=>(await sample()).distance).toBeLessThan(panned.distance);
 await expect.poll(async()=>(await sample()).frames).toBeGreaterThan(first.frames+20);
 await page.keyboard.press('F3');const lighting=page.getByLabel('Scene lighting');await expect(lighting).toHaveValue('14');
 await lighting.selectOption('22');await expect.poll(()=>page.evaluate(()=>window.__qaCityRenderer?.timeOfDay)).toBe(22);
 await lighting.selectOption('simulation');await expect.poll(()=>page.evaluate(()=>window.__qaCityRenderer?.timeOfDay??null)).toBeNull();
 await lighting.selectOption('14');
 expect(errors).toEqual([]);await page.screenshot({path:test.info().outputPath('camera-controls-fixed.png')});
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`outdoor atmosphere fallback and navigation ${viewport.width}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize(viewport);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.route('**/render/city-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst qaMount=mountCityRenderer;mountCityRenderer=function(options){const api=qaMount(options);globalThis.__qaOutdoor={api,scene:options.scene,sun:options.sun};return api;};'});});
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.__qaOutdoor,{timeout:45000});
 await page.keyboard.press('F3');await expect(page.getByLabel('Scene lighting')).toBeVisible();
 await page.getByLabel('Scene lighting').selectOption('6');
 await expect.poll(()=>page.evaluate(()=>__qaOutdoor.api.timeOfDay)).toBe(6);
 for(const quality of ['LOW','BALANCED','HIGH','ULTRA']){
  await page.getByLabel('Render quality',{exact:true}).selectOption(quality);
  await page.evaluate(async()=>{__qaOutdoor.api.setAdaptiveQuality(false);for(const hour of [0,5.99,6,6.01,12,19.49,19.5,20,23.99]){__qaOutdoor.api.setTimeOfDay(hour);__qaOutdoor.api.focusDistrict({x:hour*80,z:-hour*70});await new Promise(requestAnimationFrame);}__qaOutdoor.api.setTimeOfDay(19.5);});
  await expect.poll(()=>page.evaluate(()=>__qaOutdoor.api.getPerformanceStats().outdoor?.warm)).toBe(1);
  expect(await page.evaluate(()=>Number.isFinite(__qaOutdoor.scene.fog?.density))).toBe(true);
 }
 await page.screenshot({path:test.info().outputPath(`outdoor-twilight-${viewport.width}.png`)});
 await page.evaluate(()=>{__qaOutdoor.api.setFeature('atmosphere',false);});
 await expect.poll(()=>page.evaluate(()=>__qaOutdoor.scene.fog===null)).toBe(true);
 await page.evaluate(()=>{dispatchEvent(new Event('pagehide'));__qaOutdoor.api.destroy();});
 expect(await page.evaluate(()=>__qaOutdoor.scene.fog)).toBeNull();
 await page.goto('/');expect(errors).toEqual([]);
});
