import {test,expect} from '@playwright/test';
test('normal World entry displays independent budgets and aesthetics preserve full model hash',async({page},info)=>{
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));
 await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.goto('/world?demo=1&living=1&people=20&seed=42&renderer=webgl&quality=LOW&business_mode=true');
 await page.waitForFunction(()=>window.hblLivingWorld?.active&&window.hblLivingWorld.getSnapshot()?.runtime,null,{timeout:90000});
 await page.evaluate(async()=>{const r=window.hblLivingWorld.getRuntime();r.pause();await r.exportCheckpoint();await r.updateConfig({population:20,seed:42});await r.step({steps:2});});
 await page.getByRole('button',{name:'Open graphics settings'}).click();
 const panel=page.getByTestId('render-performance');await expect(panel.locator('pre')).toContainText('Resident states 20');
 await expect(panel.locator('pre')).toContainText('Frame callback CPU estimate');await expect(panel.locator('pre')).toContainText('Compute step CPU estimate');
 await expect(panel.locator('pre')).toContainText('Visual instances');
 await page.screenshot({path:info.outputPath('before-aesthetics.png')});
 const result=await page.evaluate(async()=>{
  const r=window.hblLivingWorld.getRuntime(),renderer=window.hblCityRenderer;
  const {readPopulationCheckpoint}=await import('/world/population/checkpoint.js');
  const hash=async()=>{const cp=readPopulationCheckpoint(await r.exportCheckpoint());const bytes=new TextEncoder().encode(JSON.stringify(cp.model));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');};
  const before=await hash();renderer.setFeature('grass',false);renderer.setFeature('shadows',false);renderer.setFeature('interiors',false);renderer.setQuality('BALANCED');renderer.setTimeOfDay(22);
  await new Promise(resolve=>setTimeout(resolve,600));
  return {before,after:await hash(),stats:renderer.getPerformanceStats(),userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight]};
 });
 expect(result.after).toBe(result.before);expect(result.stats.simulation.residentStates).toBe(20);expect(result.stats.simulation.seed).toBe(42);expect(result.stats.simulation.cpuStepEstimateMs).toBeGreaterThanOrEqual(0);expect(result.stats.backend).toBe('webgl2');
 await page.screenshot({path:info.outputPath('after-aesthetics.png')});await info.attach('measurement',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 await page.evaluate(()=>window.hblLivingWorld.setActive(false));await expect(panel.locator('pre')).toContainText('Living City inactive or not ready');
});
