import {test,expect} from '@playwright/test';
test('normal World graphics slider supports keyboard, mobile and reduced motion',async({page})=>{
 await page.goto('/world?demo=1&renderer=webgl&synthetic=1&people=10');
 await page.waitForFunction(()=>window.hblCityRenderer?.getStyleState().supported,null,{timeout:90000});
 await page.keyboard.press('F3');const slider=page.getByRole('slider',{name:'City blueprint style'});
 await slider.focus();await page.keyboard.press('End');
 await expect.poll(()=>page.evaluate(()=>window.hblCityRenderer.getStyleState().value)).toBe(1);
 await page.screenshot({path:'/tmp/SHE-612-blueprint.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Home');
 expect(await page.evaluate(()=>window.hblCityRenderer.getStyleState())).toMatchObject({target:0,immediate:true});
 await page.setViewportSize({width:390,height:844});await slider.tap({force:true});
 await page.evaluate(()=>{window.hblCityRenderer.setQuality('LOW');window.hblCityRenderer.setStyle(1);});
 expect(await page.evaluate(()=>window.hblCityRenderer.getStyleState())).toMatchObject({value:1,target:1,immediate:true});
});
