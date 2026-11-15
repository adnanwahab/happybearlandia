import {test,expect} from '@playwright/test';
test('game sound starts only after a gesture and releases its context and timer when disabled',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world?demo=1&people=30&quality=LOW',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#launch-playback')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.hblCityRenderer?.getPerformanceStats()?.backend),{timeout:60000}).toBe('webgpu');
 expect(await page.evaluate(()=>window.hblWorldSound?.getState()??{enabled:false,contextState:'closed',timerActive:false})).toEqual({enabled:false,contextState:'closed',timerActive:false});
 await page.locator('[data-launch=sound]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblWorldSound?.getState())).toEqual({enabled:true,contextState:'running',timerActive:true});
 await page.locator('[data-launch=sound]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblWorldSound?.getState())).toEqual({enabled:false,contextState:'closed',timerActive:false});
 await page.locator('[data-launch=sound]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblWorldSound?.getState().enabled)).toBe(true);
 await page.evaluate(()=>window.hblWorldSound.dispose());
 await expect(page.locator('[data-world-sound]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.hblWorldSound?.getState())).toEqual({enabled:false,contextState:'closed',timerActive:false});expect(errors).toEqual([]);
});
