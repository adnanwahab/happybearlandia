import {test,expect} from '@playwright/test';
test('private circle normal entry, mobile, keyboard and reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/city-lab.html');
 await page.getByLabel('Futures per plan').fill('1');await page.getByLabel('Months',{exact:true}).fill('1');await page.getByLabel('Households',{exact:true}).fill('3');
 await page.locator('#run').click();await expect(page.locator('#status')).toContainText('complete');
 await page.locator('#circle-consent').check();await page.locator('#circle-create').click();await expect(page.getByLabel('Opt-in join key (copy privately; retain owner key for deletion)')).toBeVisible();
 const invite=await page.getByLabel('Opt-in join key (copy privately; retain owner key for deletion)').inputValue();
 await page.locator('#circle-key').fill(invite);await page.locator('#circle-join').focus();await page.keyboard.press('Enter');await expect(page.locator('#circle-content')).toContainText('1 participants');
 await page.locator('#circle textarea').fill('What assumptions matter?');await page.getByRole('button',{name:'Add contribution',exact:true}).click();await expect(page.locator('#circle article')).toContainText('What assumptions matter?');
 await page.getByRole('button',{name:'support',exact:true}).click();await expect(page.locator('#circle-content')).toContainText('support 1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/SHE-773-circle-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Withdraw consent and delete my content'}).click();await expect(page.locator('#circle-status')).toContainText('deleted');
 await page.locator('#circle-read').click();await expect(page.locator('#circle-status')).toContainText('Access denied');
});
