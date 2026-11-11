import {test,expect} from '@playwright/test';
test('World falls back to real Canvas2D, Activity responds, facts and provenance resolve',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
 await page.goto('/world/?demo=1&synthetic=1&people=30&renderer=webgl');
 await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:60000}).toBe(true);
 await expect(page.locator('#view canvas')).toHaveAttribute('data-renderer','canvas2d');
 await expect(page.locator('#world-playback-facts')).toContainText(/Mood: \d+ \/ 100 · Seed: .+/);
 await expect.poll(()=>page.evaluate(()=>window.hblSimulationModel?.status)).toBe('ready');
 await page.getByRole('button',{name:'Activity dashboard',exact:true}).click();
 const dashboard=page.locator('.activity-dashboard');await expect(dashboard).toBeVisible();
 await expect(dashboard.locator('[role=status]')).not.toContainText('Loading recorded history');
 await page.screenshot({path:testInfo.outputPath('world-canvas-activity.png')});
 await page.keyboard.press('Escape');await expect(dashboard).toBeHidden();
 await page.getByRole('button',{name:'Activity dashboard',exact:true}).click();await expect(dashboard).toBeVisible();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start here',exact:true}).click();await page.getByTestId('quick-demo').click();
 await expect.poll(()=>page.evaluate(()=>window.hblVisualPass.getState().status),{timeout:60000}).toBe('completed');
 await page.screenshot({path:testInfo.outputPath('world-canvas-real-week.png')});
 expect(errors).toEqual([]);
});
test('experience counts derive from actual registry and gallery',async({page})=>{
 await page.goto('/');const count=(await import('../../world/universe/registry.js')).EXPERIENCES.length;
 await expect(page.locator('#experience-count')).toHaveText(`${count} Interactive Worlds & Experiments`);
 await expect(page.locator('.gallery-card')).toHaveCount(count);
 const {EXPERIENCES}=await import('../../world/universe/registry.js');
 await expect(page.locator('.universe-kicker')).toContainText(`${EXPERIENCES.length} connected experiences`);
});
test('Reality nonpassing outcomes and disabled prerequisites are explicit in actual worker UI',async({page},testInfo)=>{
 await page.goto('/reality-compiler?lat=29.7286&lng=-95.4746&renderer=webgl');
 const ui=page.getByTestId('reality-studio');await expect(ui).toBeVisible();
 await ui.locator('[data-r-proposal]').fill('Make public transit free.');await ui.locator('[data-r-compile]').click();
 await ui.locator('[data-r-runs]').fill('3');await ui.locator('[data-r-horizon]').fill('1');
 await ui.getByText('Exact test definitions',{exact:true}).click();
 await ui.locator('[data-r-test-json]').fill(JSON.stringify([{id:'impossible',metric:'employmentRate',comparison:'treatment',operator:'<',threshold:-1,unit:'fraction'}]));
 await ui.locator('[data-r-apply-tests]').click();await ui.locator('[data-r-run]').click();
 await expect(ui.locator('[data-r-summary]')).toContainText('0/3 completed pairs passed all declared policy tests');
 await expect(ui.locator('[data-r-summary]')).toContainText('0 execution errors');
 await page.screenshot({path:testInfo.outputPath('reality-nonpassing-explained.png'),fullPage:true});
 await ui.locator('[data-r-proposal]').fill('Teach the moon to sing.');await ui.locator('[data-r-compile]').click();
 await expect(ui.locator('[data-r-run]')).toBeDisabled();await expect(ui.locator('[data-r-run]')).toHaveAttribute('aria-description',/supported executable mechanism/);
});
test('320px Canvas comparison retains timeline, metrics and WHY without overflow',async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:640});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Play Demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 const slider=page.getByRole('slider');await slider.fill('120');await slider.dispatchEvent('input');
 await page.getByRole('button',{name:'Difference-only',exact:true}).click();
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('24 homes');
 await page.screenshot({path:testInfo.outputPath('mobile-320-canvas-why.png'),fullPage:true});
});
test('homepage Play Demo starts the real fixed-seed comparison with no configuration',async({page})=>{
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 await expect(page.getByTestId('future-machine-stage')).toBeVisible();await expect(page.getByTestId('future-machine-metrics')).toBeVisible();
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 expect(await page.evaluate(()=>JSON.stringify(window.futureMachine.history.baseline[0].state)===JSON.stringify(window.futureMachine.history.plan[0].state))).toBe(true);
 expect(await page.evaluate(()=>window.futureMachine.history.seed)).toBe(42);
});
test('stalled GPU initialization cannot stall provenance or usable fallback',async({page})=>{
 // Failure injection replaces only graphics startup, never model or outcome data.
 await page.route('**/world/world-gpu.js',route=>route.fulfill({contentType:'text/javascript',body:'export async function createWorldGPU(){return new Promise(()=>{});}'}));
 await page.goto('/world/?demo=1&synthetic=1&people=30');
 await expect.poll(()=>page.evaluate(()=>window.hblSimulationModel?.status),{timeout:5000}).toBe('definitions-ready');
 await expect(page.locator('#simulationModelMetadata')).toContainText('Model definitions loaded');
 await page.locator('#top > summary').click();await expect(page.locator('#world-control-readiness')).toContainText('Waiting for the city scene');
 await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.hblSimulationModel?.status)).toBe('ready');
 expect(await page.evaluate(()=>window.hblWorldStartup.graphicsFallback)).toContain('WebGPU unavailable');
 await page.setViewportSize({width:390,height:844});await page.locator('#top > summary').click();
 const overlap=await page.evaluate(()=>{const a=document.querySelector('#world-quick-toolbar').getBoundingClientRect(),b=document.querySelector('#top > summary').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
 expect(overlap).toBe(false);
});
