import { test, expect } from '@playwright/test';
for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]])test(`${name} immutable diagnostic fixture`,async({page},info)=>{
 await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/city-xray/fixtures/preview.html');await page.waitForFunction(()=>window.diagnostic?.ready);
 await expect(page.locator('#status')).toContainText('Seed 0');
 expect(await page.evaluate(()=>window.diagnostic.hash)).toBe('b059a741820f11e8fc22d8b26f0aad6fc29a629fd8a0c24313ef7a3481fa030e');
 expect(await page.evaluate(()=>Object.isFrozen(window.diagnostic.frame.entities[0].position))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true});
 expect(errors).toEqual([]);
});
