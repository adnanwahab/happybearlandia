import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
test('real World toggles SSGI and preserves paused simulation, resize, and direct rendering',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGPU|SSGI|shader|pipeline/i.test(m.text()))errors.push(m.text());});
 await page.setViewportSize({width:800,height:600});
 await page.goto('/world?demo=1&synthetic=1&people=16&quality=LOW');
 await page.waitForFunction(()=>window.hblGlobalIllumination&&window.hblWorldStartup?.readyMs);
 const gi=page.locator('#global-illumination-button');await expect(gi).toHaveText('GLOBAL ILLUMINATION');
 expect(await page.evaluate(()=>window.hblGlobalIllumination.getState().supported)).toBe(true);
 await page.evaluate(()=>window.hblSimulationPlayback.pause());
 const before=await page.evaluate(()=>window.hblWorldActivity.getSnapshot());
 await page.waitForTimeout(500);
 const off=await page.locator('#view canvas').screenshot();
 await gi.click();await expect(gi).toHaveAttribute('aria-pressed','true');
 await page.waitForTimeout(1500);
 const on=await page.locator('#view canvas').screenshot();
 expect(createHash('sha256').update(on).digest('hex')).not.toBe(createHash('sha256').update(off).digest('hex'));
 expect(await page.evaluate(()=>window.hblWorldActivity.getSnapshot())).toEqual(before);
 await page.screenshot({path:'/private/tmp/hbl-gi-on.png'});
 await page.setViewportSize({width:320,height:640});await page.waitForTimeout(500);
 await expect(gi).toHaveAttribute('aria-pressed','true');
 expect(await gi.evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
 await gi.click();await expect(gi).toHaveAttribute('aria-pressed','false');
 await page.waitForTimeout(300);await page.screenshot({path:'/private/tmp/hbl-gi-off.png'});
 expect(errors).toEqual([]);
});
test('WebGL World shows honest unavailable control and remains usable',async({page})=>{
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>window.hblGlobalIllumination&&window.hblWorldStartup?.readyMs);
 const gi=page.locator('#global-illumination-button');await expect(gi).toBeDisabled();await expect(gi).toHaveAttribute('data-state','UNAVAILABLE');
 await expect(gi).toHaveAttribute('title',/Requires WebGPU/);
 await expect(page.locator('#view canvas')).toBeVisible();
});

test('Canvas2D keeps the control explicitly unavailable',async({page})=>{
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=canvas2d');
 const gi=page.locator('#global-illumination-button');await expect(gi).toBeDisabled();await expect(gi).toHaveAttribute('data-state','UNAVAILABLE');await expect(gi).toHaveAttribute('title',/Requires WebGPU/);await expect(page.locator('#view canvas')).toBeVisible();
});
