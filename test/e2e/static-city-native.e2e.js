import {test,expect} from '@playwright/test';
test('native WebGPU still opens the full game and consumes the preflight renderer once',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__adapterRequests=0;const gpu=navigator.gpu;if(gpu){const request=gpu.requestAdapter.bind(gpu);gpu.requestAdapter=(...args)=>{window.__adapterRequests++;return request(...args);};}});
 await page.goto('/world?demo=1&people=30&quality=LOW');
 await expect.poll(()=>page.evaluate(()=>window.hblCityRenderer?.getPerformanceStats()?.backend),{timeout:90000}).toBe('webgpu');
 expect(new URL(page.url()).pathname).toBe('/world');expect(await page.evaluate(()=>window.__adapterRequests)).toBe(1);expect(await page.evaluate(()=>typeof window.hblPreparedWorldGraphics)).toBe('undefined');expect(await page.evaluate(()=>typeof window.hblWorldActivity?.getSnapshot)).toBe('function');expect(errors).toEqual([]);
});
