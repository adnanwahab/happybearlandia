import {test,expect} from '@playwright/test';
import {openEditableHouse} from './house-edit-fixture.js';
test('keyboard request acknowledges, tick completion is separate, and reduced motion retains readable responses',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openEditableHouse(page);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-547-house-before.png'});
 await page.locator('[data-person-requests]').focus();await page.keyboard.press('Enter');
 const menu=page.getByRole('dialog',{name:'Household requests'});await menu.getByRole('combobox',{name:'Request timing'}).selectOption('queue');
 for(let i=0;i<12&&!await menu.getByRole('button',{name:'Read',exact:true}).isVisible();i++)await menu.locator('[data-menu-more]').click();
 const read=menu.getByRole('button',{name:'Read',exact:true});await read.focus();await page.keyboard.press('Enter');
 const responses=page.getByRole('log',{name:'Household action responses'});
 await expect(responses.locator('[data-state=accepted]')).toContainText('read · Accepted');
 await expect(responses.locator('[data-state=completed]')).toHaveCount(0);
 expect(await responses.locator('.house-action-character').first().evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
 await page.evaluate(async()=>{const s=hblHouseSession,r=s.getRuntime();r.pause();for(let i=0;i<60;i++)await r.advance();await s.refresh();});
 await expect(responses.locator('[data-state=completed]').first()).toContainText('Completed at modeled minute');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-547-house-after.png'});
});
