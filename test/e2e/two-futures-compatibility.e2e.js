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
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('120');await slider.dispatchEvent('input');
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
test('all graphics contexts unavailable preserves recorded comparison controls without page errors',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('120');await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('inventory-fallback');
 await page.getByRole('button',{name:/building-project-policy-1-0.*schematic/}).last().click();await expect(page.getByTestId('future-machine-why')).toContainText('PROJECT_COMPLETE');
 expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);expect(errors).toEqual([]);
});
test('configured seed remains distinct until real rerun and survives exact shared refresh',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 const original=await page.evaluate(()=>({id:window.futureMachine.history.experimentId,hash:window.futureMachine.history.initialHash}));
 const seed=page.getByTestId('future-machine-seed');await seed.fill('0');
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('16');await slider.dispatchEvent('input');
 await expect(seed).toHaveValue('0');await expect(page.getByLabel('Simulation provenance')).toContainText('SEED 42');
 expect(await page.evaluate(()=>window.futureMachine.history.experimentId)).toBe(original.id);
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('ready');
 expect(await page.evaluate(()=>window.futureMachine.history.seed)).toBe(0);expect(await page.evaluate(()=>window.futureMachine.history.initialHash)).not.toBe(original.hash);
 await slider.fill('120');await slider.dispatchEvent('input');expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');await expect(seed).toHaveValue('0');
 await seed.fill('42');await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('ready');
 expect(await page.evaluate(()=>window.futureMachine.history.initialHash)).toBe(original.hash);
});

test('mobile power saving changes display cost and preserves recorded results and receipts',async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:640});
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByRole('button',{name:'Play Demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('120');await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 const snapshot=()=>page.evaluate(async()=>{
   const fm=window.futureMachine;
   const {createEvidenceReport}=await import('/world/future-machine/share/index.js');
   const {compareFrame}=await import('/world/future-machine/diff/index.js');
   const {getFrame}=await import('/world/future-machine/data/index.js');
   return {history:fm.history,month:fm.state.month,report:createEvidenceReport(fm.history,{month:fm.state.month,diff:compareFrame(getFrame(fm.history,fm.state.month))}),metrics:document.querySelector('[data-testid="future-machine-metrics"]').textContent,camera:fm.stats.scene.camera,objects:fm.stats.scene.objects};
 });
 const before=await snapshot();
 const canvas=page.getByTestId('future-machine-stage').locator('canvas');
 const originalWidth=await canvas.evaluate(n=>n.width);
 const quality=page.getByRole('combobox',{name:'Rendering quality',exact:true});
 await expect(quality).toBeVisible();await quality.selectOption('power-saving');
 expect(await snapshot()).toEqual(before);
 expect(await canvas.evaluate(n=>n.width)).toBeLessThan(originalWidth);
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.quality)).toBe('power-saving');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('mobile-power-saving.png'),fullPage:true});
 await quality.selectOption('standard');expect(await snapshot()).toEqual(before);
 expect(await canvas.evaluate(n=>n.width)).toBe(originalWidth);
});
