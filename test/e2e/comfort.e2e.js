import {test,expect} from '@playwright/test';
test('directory comfort persists to main routes and respects native reduction',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/routes');
 const panel=page.locator('[data-comfort-studio]');await panel.locator('summary').focus();await page.keyboard.press('Enter');
 const camera=panel.locator('[data-comfort=cameraEasing]');await camera.uncheck();
 await panel.locator('[data-comfort=confetti]').uncheck();
 await page.reload();await panel.locator('summary').click();await expect(camera).not.toBeChecked();
 await page.emulateMedia({reducedMotion:'reduce'});await expect(camera).toBeDisabled();
 await panel.getByRole('button',{name:'Reset to system defaults'}).click();await expect(camera).not.toBeChecked();
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(camera).toBeChecked();
 await expect(panel.locator('[data-comfort=ambientSound]')).not.toBeChecked();
 await page.screenshot({path:info.outputPath('comfort-mobile.png'),fullPage:true});
 for(const route of ['/','/world/future-machine.html?renderer=canvas','/world/decision.html']){await page.goto(route);await expect(page.locator('[data-comfort-studio]')).toBeVisible();}
});
