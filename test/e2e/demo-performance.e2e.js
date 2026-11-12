import {test,expect} from '@playwright/test';
for(const renderer of ['canvas2d','webgl'])test(`${renderer} cold homepage and warm button timing`,async({page},info)=>{
 await page.goto('/');
 await page.locator('.flagship-demo').evaluate((link,renderer)=>link.href+=`&renderer=${renderer}`,renderer);
 await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
 await page.getByTestId('future-machine-stage').scrollIntoViewIfNeeded();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.demoTiming)).not.toBeNull();
 const cold=await page.evaluate(()=>window.futureMachine.stats.demoTiming);
 expect(cold).toMatchObject({source:'homepage',renderer,state:'cold'});expect(cold.durationMs).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 await page.getByRole('button',{name:'Play Demo',exact:true}).click();
 await page.getByTestId('future-machine-stage').scrollIntoViewIfNeeded();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.demoTiming?.state)).toBe('warm');
 const warm=await page.evaluate(()=>window.futureMachine.stats.demoTiming);
 expect(warm.renderer).toBe(renderer);expect(warm.source).toBe('button');expect(warm.durationMs).toBeGreaterThanOrEqual(0);
 await info.attach('real-demo-timings',{body:JSON.stringify({cold,warm}),contentType:'application/json'});
});
