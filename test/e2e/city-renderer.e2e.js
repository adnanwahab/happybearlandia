import {test,expect} from '@playwright/test';
test('WebGL2 fallback exposes quality, cutaway, feature toggles and benchmark stats',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world?demo=1&renderer=webgl&people=20');
 await page.waitForFunction(()=>window.hblCityRenderer?.getPerformanceStats().frames>3,null,{timeout:90000});
 await page.keyboard.press('F3');await expect(page.getByTestId('render-performance')).toBeVisible();
 await expect(page.getByLabel('Scene lighting',{exact:true})).toHaveValue('14');
 await page.getByLabel('Scene lighting',{exact:true}).selectOption('simulation');
 expect(await page.evaluate(()=>window.hblCityRenderer.timeOfDay)).toBeUndefined();
 await page.getByLabel('Scene lighting',{exact:true}).selectOption('14');
 const result=await page.evaluate(()=>{const api=window.hblCityRenderer;api.setQuality('LOW');api.setWeather('rain');api.setTimeOfDay(22);api.setFeature('traffic',false);api.setCutaway(true);api.focusBuilding(0);return api.getPerformanceStats();});
 expect(result.backend).toBe('webgl2');expect(result.quality).toBe('LOW');expect(result.features.traffic).toBe(false);
 await page.getByLabel('Geometry detail',{exact:true}).selectOption('HIGH');
 await page.getByLabel('Geometry debug',{exact:true}).selectOption('lod');
 await page.getByText('Wireframe selected',{exact:false}).click();
 expect(await page.evaluate(()=>window.hblCityRenderer.getGeometryStats().bytes)).toBeGreaterThan(0);
 await page.waitForTimeout(1000);expect(errors).toEqual([]);
});
