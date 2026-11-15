import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
test('before evidence from original directory source',async({page})=>{
 const original=execFileSync('git',['show','cdb773a19acb5f68cd949dab2b8af148a0e1aefe:routes.html'],{encoding:'utf8'});
 await page.route('**/routes',route=>route.fulfill({body:original,contentType:'text/html'}));
 await page.goto('/routes');await expect(page.locator('.routes article').first()).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-585-before-routes-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.mini-symphony-evidence/SHE-585-before-routes-mobile.png',fullPage:true});
});
test('directory empty and unavailable states, owner controls, responsive keyboard access',async({page})=>{
 await page.goto('/routes');await expect(page.locator('[data-showcase-status]')).toContainText('No journeys are on display yet');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-585-after-routes-desktop.png',fullPage:true});
 await page.getByText('Submit or withdraw your own shared experiment',{exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');await expect(page.getByRole('textbox',{name:'Share ID',exact:true})).toBeFocused();
 await page.getByRole('textbox',{name:'Share ID',exact:true}).fill('Showcase0001');await page.locator('[name=ownerKey]').fill('x'.repeat(43));await page.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.locator('[data-owner-status]')).toContainText('Confirm ownership');await expect(page.locator('[name=consent]')).toBeFocused();
 await page.getByRole('button',{name:'Withdraw from showcase',exact:true}).click();await expect(page.locator('[data-owner-status]')).toContainText('not found or expired');
 await page.route('**/api/reality-showcase',route=>route.fulfill({status:503,body:'unavailable'}));await page.getByRole('button',{name:'Refresh showcase',exact:true}).click();await expect(page.locator('[data-showcase-status]')).toContainText('unavailable');await expect(page.locator('.routes article').first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.mini-symphony-evidence/SHE-585-after-routes-mobile.png',fullPage:true});
});
test('disposable preview links to the exact source and clears on refresh after withdrawal',async({page})=>{
 let visible=true;const id='Showcase0001',token='x'.repeat(43);
 await page.route('**/api/reality-showcase',route=>route.fulfill({json:{cards:visible?[{id,title:'Disposable synthetic fixture',summary:'Test-only authored preview.',url:'/r/'+id,preview:{engine:'city',horizon:1,unit:'months',seed:42},notice:'Synthetic model assumptions.'}]:[]}}));
 await page.route('**/api/reality-shares/*/showcase',async route=>{expect(route.request().headers().authorization).toBe('Bearer '+token);expect(route.request().postDataJSON()).toEqual({consent:false});visible=false;await route.fulfill({json:{enabled:false,revision:2}});});
 await page.goto('/routes#showcase-owner='+id+':'+token);expect(page.url()).not.toContain(token);await expect(page.getByRole('link',{name:'Open source experiment: Disposable synthetic fixture',exact:true})).toHaveAttribute('href','/r/'+id);await expect(page.locator('[name=shareId]')).toHaveValue(id);await expect(page.locator('[name=ownerKey]')).toHaveValue(token);
 await page.getByRole('button',{name:'Withdraw from showcase',exact:true}).click();await expect(page.locator('[data-owner-status]')).toContainText('Withdrawn');await expect(page.locator('[data-showcase-cards] article')).toHaveCount(0);
});
