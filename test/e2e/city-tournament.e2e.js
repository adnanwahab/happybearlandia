import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`private tournament ${mobile?'mobile reduced motion':'desktop keyboard'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.emulateMedia({reducedMotion:mobile?'reduce':'no-preference'});
 await page.goto('/world/challenges.html');const panel=page.getByRole('region',{name:'City Builder Tournament'});
 await panel.getByRole('button',{name:'Submit plan'}).click();await expect(panel.getByRole('status')).toContainText('consent required');
 const consent=panel.getByLabel('I opt in');await consent.focus();await page.keyboard.press('Space');await panel.getByRole('button',{name:'Submit plan'}).focus();await page.keyboard.press('Enter');
 await consent.check();await panel.getByRole('button',{name:'Submit plan'}).click();await panel.getByRole('button',{name:'Run bracket',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Winner: plan-1');
 const first=await panel.locator('pre').textContent();await panel.getByRole('button',{name:'Rerun frozen bracket'}).click();await expect(panel.getByRole('status')).toContainText('Winner: plan-1');expect(await panel.locator('pre').textContent()).toBe(first);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.screenshot({path:`docs/reviews/SHE-775-${mobile?'mobile':'desktop'}.png`});
 await panel.getByRole('button',{name:'Delete bracket'}).click();await expect(panel.locator('ol li')).toHaveCount(0);await expect(panel.getByRole('status')).toContainText('deleted');
});
