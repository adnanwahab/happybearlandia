import {test,expect} from '@playwright/test';
test('World atlas sunlight changes projected shadows and releases DOM on exit',async({page})=>{
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world/?demo=1&synthetic=1&people=16&renderer=canvas');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs,{timeout:45000});
 await page.keyboard.press('F3');await page.getByText('Tree-Shadow Atlas',{exact:true}).click();
 const slider=page.getByLabel('Atlas sunlight hour');await expect(slider).toBeVisible();
 const svg=page.locator('[data-testid=shadow-atlas] svg');await expect(svg.locator('polygon').first()).toBeAttached();
 const before=await svg.innerHTML();await slider.fill('9');await slider.dispatchEvent('input');
 await expect.poll(()=>svg.innerHTML()).not.toBe(before);
 await expect(page.getByText('Tree map unavailable:',{exact:false})).toBeVisible();
 await slider.focus();await page.keyboard.press('ArrowRight');await expect(slider).toHaveValue('9.25');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-735-atlas.png'});
 await page.goto('/');await expect(slider).toHaveCount(0);
});
