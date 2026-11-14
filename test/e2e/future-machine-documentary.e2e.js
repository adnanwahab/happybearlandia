import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`documentary ${width}px keyboard, rapid navigation, export and cleanup`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/future-machine.html');
 await page.screenshot({path:`.mini-symphony-evidence/SHE-511-before-future-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 const documentary=page.getByRole('region',{name:'One-minute Future Documentary'});
 await expect(documentary).toBeVisible({timeout:120000});
 await expect(documentary.getByRole('img').first()).toHaveAttribute('aria-label',/recorded building IDs/);
 const button=documentary.getByRole('button',{name:/Open documentary Month/}).last();
 await button.focus();await page.keyboard.press('Enter');
 for(let i=0;i<8;i++)await documentary.getByRole('button',{name:/Open documentary Month/}).nth(i%2).click();
 await expect(page.locator('body')).not.toHaveText(/TypeError/);
 const downloadPromise=page.waitForEvent('download');await documentary.getByRole('button',{name:'Export documentary recipe'}).click();
 const download=await downloadPromise;expect(download.suggestedFilename()).toBe('future-documentary.json');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await documentary.scrollIntoViewIfNeeded();await page.screenshot({path:`.mini-symphony-evidence/SHE-511-after-future-${width}.png`,fullPage:true});
 await page.evaluate(()=>window.futureMachine.dispose());await expect(documentary).toHaveCount(0);
});
