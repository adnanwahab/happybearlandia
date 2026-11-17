import {test,expect} from '@playwright/test';
for(const mode of ['canvas','canvas2d'])for(const mobile of [false,true])test(`season decorations ${mode} ${mobile?'mobile reduced motion':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 if(mobile)await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world/?demo=1&synthetic=1&people=16&renderer='+mode);
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs,{timeout:45000});
 if(mode==='canvas2d')await page.getByText('Illustrative seasons',{exact:true}).first().click();else await page.keyboard.press('F3');
 const select=page.getByLabel('Season decorations');await expect(select).toBeVisible();
 await select.selectOption('winter');await expect(select).toHaveValue('winter');
 await expect(page.getByText('Illustrative decorations only.',{exact:false})).toBeVisible();
 await select.focus();await page.keyboard.press('ArrowUp');await expect(select).toHaveValue('autumn');
 for(const season of ['spring','winter','summer','autumn','off','auto'])await select.selectOption(season);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-513-after-${mode}-${mobile?'mobile':'desktop'}-controls.png`});
 if(mode==='canvas2d')await page.locator('details').filter({has:select}).locator('summary').click();else await page.keyboard.press('F3');await page.mouse.move(200,300);await page.mouse.wheel(0,-100);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-513-after-${mode}-${mobile?'mobile':'desktop'}-world.png`});
 await page.goto('/');await expect(select).toHaveCount(0);
});
