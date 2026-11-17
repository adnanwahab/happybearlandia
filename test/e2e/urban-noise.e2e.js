import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`illustrative traffic ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 await page.locator('#ambient-sound summary').click();
 const field=page.getByRole('group',{name:'Urban Noise Playground'});
 await expect(field).toBeVisible();await expect(field).toContainText('not measured environmental noise');
 const toggle=field.getByRole('checkbox');await expect(toggle).not.toBeChecked();
 await page.getByRole('slider',{name:'Sound volume'}).fill('0.15');
 await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toBeChecked();
 await expect(field.getByRole('status')).toContainText('synthetic proximity strength');
 await page.keyboard.press('Space');await expect(toggle).not.toBeChecked();
 const bounds=await field.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(mobile?390:1440);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-738-after-${mobile?'mobile':'desktop'}.png`});
 await page.reload();await page.locator('#ambient-sound summary').click();await expect(toggle).not.toBeChecked();
});
