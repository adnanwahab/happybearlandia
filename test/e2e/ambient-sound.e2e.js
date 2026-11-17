import {test,expect} from '@playwright/test';
for (const mobile of [false,true]) test(`ambient normal entry ${mobile?'mobile':'desktop'}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/world/?demo=1&synthetic=1&people=16');
  const panel=page.locator('#ambient-sound');await expect(panel).toBeVisible();
  await panel.locator('summary').focus();await page.keyboard.press('Enter');
  const toggle=page.getByRole('checkbox',{name:'Enable cosmetic ambience'});
  await expect(toggle).not.toBeChecked();
  const volume=page.getByRole('slider',{name:'Sound volume'});await expect(volume).toHaveValue('0');
  await volume.focus();await page.keyboard.press('ArrowRight');await expect(volume).toHaveValue('0.05');
  await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toBeChecked();
  await page.keyboard.press('Space');await expect(toggle).not.toBeChecked();await expect(volume).toHaveValue('0.05');
  const bounds=await panel.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(mobile?390:1440);
  await page.screenshot({path:`.mini-symphony-evidence/SHE-516-after-${mobile?'mobile':'desktop'}.png`});
  await page.reload();await expect(page.locator('#ambient-sound')).toBeVisible();await page.locator('#ambient-sound summary').click();await expect(toggle).not.toBeChecked();
  await page.goto('/');await expect(page.locator('#ambient-sound')).toHaveCount(0);
});
