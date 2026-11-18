import {test,expect} from '@playwright/test';
for (const width of [390,1440]) test(`local opt-in, keyboard, deletion and reduced motion ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844}); await page.emulateMedia({reducedMotion:'reduce'});
 // Local dry-run only: shipped enrollment stays disabled.
 await page.route('**/world?*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('id="playfulness" data-enabled="false"','id="playfulness" data-enabled="true"')});});
 await page.goto('/world?demo=1&synthetic=1&people=16');
 await page.locator('#top > summary').click();
 await page.locator('#playfulness > summary').click();
 const checkbox=page.locator('#playfulness input');
 await expect(checkbox).not.toBeChecked(); await checkbox.focus(); await page.keyboard.press('Space'); await expect(checkbox).toBeChecked();
 await page.getByRole('button',{name:'I inspected a result and its assumption',exact:true}).click();
 await page.getByRole('button',{name:'I reran it with a changed assumption and inspected the difference',exact:true}).click();
 await expect(page.locator('#playfulness [role=status]')).toContainText('"numerator":1');
 await checkbox.uncheck(); await expect(page.locator('#playfulness [data-actions]')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('hbl.playfulness.v1'))).toBeNull();
 await expect(page.locator('#playfulness [role=status]')).toContainText('withdrawn');
});
test('storage denied stays inactive',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied')}}));
 await page.goto('/world?demo=1&synthetic=1&people=16');
 await expect(page.locator('#playfulness input')).toBeDisabled();
});
