import {test,expect} from '@playwright/test';
test('synthetic ribbons have readable fallback and exact crossing inspection',async({page})=>{
 await page.goto('/test/fixtures/housing-ribbons/preview.html');
 await expect(page.locator('svg polygon')).toHaveCount(3);
 await page.getByRole('button',{name:/Inspect crossing/}).click();
 await expect(page.getByRole('status')).toContainText('Linear interpolation, not a recorded event');
 await expect(page.getByRole('status')).toContainText('events[0].households=110');
 await expect(page.getByRole('status')).toContainText('months 12–24');
 await expect(page.locator('tbody tr').last()).toContainText('unavailable');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/SHE-743-ribbons-mobile.png',fullPage:true});
});
