import {test,expect} from '@playwright/test';

for(const failWorker of [false,true])test(`ordinary World defers Population allocation and ${failWorker?'reports worker failure':'starts on demand'}`,async({page})=>{
 await page.addInitScript(fail=>{
  window.__populationWorkers=0;
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   constructor(url,options){
    if(String(url).includes('population.worker')){
     window.__populationWorkers++;
     if(fail)throw new Error('Injected Population allocation failure');
    }
    super(url,options);
   }
  };
 },failWorker);
 await page.goto('/world?people=20&seed=42&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>window.hblLivingWorld&&window.hblWorldStartup?.firstFrameMs!=null);
 // Exercise a normal exploration action before requesting the dense model.
 await page.locator('#speeds button').first().click();
 expect(await page.evaluate(()=>({workers:window.__populationWorkers,runtime:!!window.hblLivingWorld.getRuntime()}))).toEqual({workers:0,runtime:false});
 await page.getByTestId('add-population').click();
 if(failWorker){
  await expect(page.locator('[data-lc-error]')).toContainText('Living City could not start');
  await expect(page.getByTestId('add-population')).toBeEnabled();
 }else{
  await page.waitForFunction(()=>window.hblLivingWorld.getSnapshot()?.config.population===10000);
  const state=await page.evaluate(()=>{const runtime=window.hblLivingWorld.getRuntime();runtime.pause();const s=runtime.getSnapshot();return{seed:s.config.seed,population:s.config.population,visible:s.visibleAgents.length};});
  expect(state.seed).toBe(42);expect(state.population).toBe(10000);expect(state.visible).toBeLessThanOrEqual(500);
 }
});
