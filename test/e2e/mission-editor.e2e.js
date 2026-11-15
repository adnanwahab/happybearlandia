import {test,expect} from '@playwright/test';
test('author, refuse invalid criteria, export and reopen a same-seed mission',async({page,browser})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/challenges.html');
 const editor=page.locator('#mission-authoring'),status=editor.locator('[data-challenge-status]');
 await expect(editor.locator('[data-challenge-reference] input')).toHaveCount(3);
 await page.screenshot({path:'.mini-symphony-evidence/SHE-570-editor-before-desktop.png',fullPage:true});
 await editor.locator('[data-challenge-objective]:checked').uncheck();
 await editor.locator('[data-challenge-freeze]').click();await expect(status).toContainText('registered');
 await editor.locator('[data-challenge-objective][value="employmentRate"]').focus();await page.keyboard.press('Space');
 await editor.locator('[data-challenge-freeze]').click();await expect(status).toContainText('Verified:');
 const link=await editor.locator('[data-challenge-link]').inputValue();expect(link).toContain('/world/challenges.html#city-challenge=');
 const details=await editor.locator('[data-challenge-details]').textContent();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-570-editor-after-desktop.png',fullPage:true});
 const clean=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{const other=await clean.newPage();await other.goto(link);await expect(other.locator('[data-challenge-details]')).toHaveText(details);
 await other.locator('[data-challenge-verify]').click();await expect(other.locator('[data-challenge-status]')).toContainText('Verified:');
 expect(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await other.screenshot({path:'.mini-symphony-evidence/SHE-570-editor-after-mobile.png',fullPage:true});
 }finally{await clean.close();}
});
test('malformed imports and unavailable worker never claim results',async({page})=>{
 await page.addInitScript(()=>{window.Worker=undefined;});
 await page.goto('/world/challenges.html#city-challenge=invalid');
 const editor=page.locator('#mission-authoring'),status=editor.locator('[data-challenge-status]');
 await expect(status).toContainText('Invalid challenge link');
 await page.locator('#mission-checkpoint').selectOption('city-small-73.v1');
 await editor.locator('[data-challenge-freeze]').click();await expect(status).toContainText('Worker replay unavailable');
 await expect(editor.locator('[data-challenge-result]')).toBeEmpty();await expect(editor.locator('[data-challenge-link]')).not.toHaveValue('');
});
