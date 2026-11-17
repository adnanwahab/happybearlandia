import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`opt-in, denial, keyboard and fallback ${mobile?'mobile reduced motion':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});
 await page.emulateMedia({reducedMotion:mobile?'reduce':'no-preference'});
 await page.addInitScript(()=>{window.arRequests=0;Object.defineProperty(navigator,'xr',{value:{requestSession:async()=>{window.arRequests++;throw new Error('Permission denied test fixture');}},configurable:true});});
 await page.goto('/world/ar-tabletop/');
 await expect(page.locator('#map rect')).toHaveCount(4);expect(await page.evaluate(()=>window.arRequests)).toBe(0);
 await page.locator('#start').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#status')).toContainText('Permission denied test fixture');
 expect(await page.evaluate(()=>window.arRequests)).toBe(1);
 await page.locator('#scale').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#size')).toHaveText('0.60 m city width');
 await expect(page.locator('#provenance')).toContainText('tabletop-geometry/1');
 await expect(page.locator('#map')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('missing WebXR reports unavailability without losing the city',async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,'xr',{value:undefined}));await page.goto('/world/ar-tabletop/');await page.locator('#start').click();await expect(page.locator('#status')).toContainText('WebXR AR unavailable');await expect(page.locator('#map')).toBeVisible();});
test('world normal entry offers AR link',async({request})=>{const response=await request.get('/world');expect(response.ok()).toBe(true);expect(await response.text()).toContain('href="/world/ar-tabletop/"');});
