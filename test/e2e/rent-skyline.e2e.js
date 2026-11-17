import {test,expect} from '@playwright/test';
test('normal entry skyline reconciles, selects exact runs and walks on mobile',async({page})=>{
 await page.goto('/world/decision.html');
 const stage=page.getByTestId('rent-skyline');
 await page.locator('#try-example').click();await page.locator('#auto-preview').uncheck();await page.locator('#run-count').selectOption('10');await page.locator('#run-experiment').click();
 await expect(stage.locator('[data-skyline-status]')).toContainText('10 completed samples',{timeout:60000});
 await expect(stage.locator('[data-bin]')).toHaveCount(8);
 // Every bin remains keyboard accessible, including empty bins.
 await stage.locator('[data-bin]').first().focus();await page.keyboard.press('Enter');
 const index=await stage.locator('[data-bin]').evaluateAll(nodes=>nodes.findIndex(n=>!n.textContent.endsWith(': 0')));
 await stage.locator('[data-bin]').nth(index).click();
 const member=stage.locator('[data-skyline-run]').first(),id=await member.getAttribute('data-skyline-run');await member.click();
 await expect(page.locator('[data-run-summary]')).toContainText(id);
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await stage.getByRole('button',{name:'Step right',exact:true}).click();
 await stage.getByRole('slider',{name:'Walk inside skyline'}).fill('100');
 await expect(stage.locator('.rent-bars')).toHaveCSS('transform',/matrix3d/);
 expect(await stage.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await stage.screenshot({path:'.mini-symphony-evidence/SHE-740-skyline-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await stage.screenshot({path:'.mini-symphony-evidence/SHE-740-skyline-desktop.png'});
});
