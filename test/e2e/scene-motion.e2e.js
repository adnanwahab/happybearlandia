import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`World still context and selection: ${mobile?'mobile touch':'desktop keyboard'}`,async({browser},info)=>{
 const context=await browser.newContext({reducedMotion:'reduce',viewport:mobile?{width:390,height:844}:{width:1200,height:800},hasTouch:mobile,isMobile:mobile});
 const page=await context.newPage();
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?synthetic=1&people=16&arrival=1');
 await page.locator('#top').evaluate(n=>n.open=true);
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 const card=page.locator('[data-scene-context]'),check=card.getByRole('checkbox');
 await expect(check).toBeVisible();await expect(check).toBeChecked();await expect(card.getByRole('status')).toContainText('Still view');
 await check.focus();await page.keyboard.press('Space');await expect(check).toBeChecked();await expect(check).toBeFocused();
 await page.evaluate(()=>window.hblGuidedActions.resident());
 await expect(page.locator('#inspect')).toContainText('Follow');
 await expect(page.locator('#inspect')).not.toContainText('Following');
 await page.locator('#top').evaluate(n=>n.open=true);
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(check).not.toBeChecked();
 if(mobile)await check.tap();else{await check.focus();await page.keyboard.press('Space');}
 await expect(check).toBeChecked();await expect(check).toBeFocused();
 await page.screenshot({path:info.outputPath(`still-${mobile?'mobile':'desktop'}.png`)});
 await context.close();
});
test('World with unavailable media query keeps usable still controls',async({page})=>{
 await page.addInitScript(()=>{window.matchMedia=undefined;});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?synthetic=1&people=16&arrival=1');
 await expect(page.locator('[data-scene-context]').getByRole('checkbox')).toBeChecked();
 await expect(page.locator('[data-scene-context]').getByRole('status')).toContainText('Still view');
});
