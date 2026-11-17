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

for(const mobile of [false,true])test(`cinematic presets preserve selection and return; ${mobile?'touch':'keyboard'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.route('**/OrbitControls.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nconst presetUpdate=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...args){globalThis.__presetControls=this;return presetUpdate.apply(this,args);};'});});
 await page.goto('/world?synthetic=1&people=16');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.__presetControls);
 const sample=()=>page.evaluate(()=>({position:__presetControls.object.position.toArray(),target:__presetControls.target.toArray()}));
 await page.locator('#launch-navigation [data-launch="tools"]').click();
 await expect(page.locator('#top')).toBeVisible();
 const picker=page.getByTestId('camera-presets');await picker.locator('summary').click();
 await expect(picker.getByRole('button',{name:'Return',exact:true})).toBeDisabled();
 await picker.getByRole('button',{name:'Follow',exact:true}).click();await expect(picker.getByRole('status')).toContainText('unavailable');
 const original=await sample();
 for(const name of ['Street','Rooftop','Skyline']){await picker.getByRole('button',{name,exact:true}).click();await expect(picker.getByRole('status')).toContainText(`${name} view`);const pose=await sample();expect(pose.position[1]).toBeGreaterThanOrEqual(3);}
 await picker.getByRole('button',{name:'Return',exact:true}).click();
 const restored=await sample();for(const key of ['position','target'])restored[key].forEach((n,i)=>expect(n).toBeCloseTo(original[key][i],5));
 await page.evaluate(()=>window.hblGuidedActions.resident());
 // Stop existing follow before measuring selection; preset controls never select.
 await page.locator('#launch-navigation [data-launch="tools"]').click();
 await expect(page.locator('#top')).toBeVisible();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const selected=await page.locator('#inspect').innerText();
 await picker.getByRole('button',{name:'Follow',exact:true}).click();await expect(picker.getByRole('status')).toContainText('Reduced motion');
 expect(await page.locator('#inspect').innerText()).toBe(selected);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const followButton=picker.getByRole('button',{name:'Follow',exact:true});
 await followButton.focus();await page.keyboard.press('Enter');await expect(picker.getByRole('status')).toContainText('Following selected');
 if(mobile)await page.locator('canvas').first().dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',clientX:350,clientY:500});else await page.keyboard.press('ArrowLeft');
 await expect(picker.getByRole('status')).toContainText('interrupted');
 await page.screenshot({path:`.mini-symphony-evidence/SHE-474-after-${mobile?'mobile':'desktop'}-camera.png`});
});

test('World exposes bounded street preview with reduced-motion cut and Back',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?synthetic=1&people=16');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 await page.locator('#top').evaluate(node=>node.open=true);
 const panel=page.getByTestId('street-journey');await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Journey',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(panel.getByRole('status')).toContainText('Reduced motion: camera cut');
 await panel.getByRole('button',{name:'Back',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('Returned');
 await page.screenshot({path:test.info().outputPath('world-street-journey.png')});
});
