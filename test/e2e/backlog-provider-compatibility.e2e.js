const {test,expect} = require(process.env.HBL_COMPAT_PLAYWRIGHT || '@playwright/test');
test('local provider preview and reject preserve world inputs',async({page})=>{
 await page.goto('/world/decision.html');
 await page.locator('#try-example').click();
 await page.locator('#auto-preview').uncheck();
 const before=await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.currentInput()));
 const tools=page.locator('.world-tools');
 await tools.locator('[data-action="edit-world"]').click();
 await tools.locator('[data-provider]').selectOption('demo');
 await tools.locator('[data-prompt]').fill('Make construction capacity 20% higher');
 await tools.locator('[data-action="request-edit"]').click();
 await expect(tools.locator('[data-preview]')).toBeVisible();
 await expect(tools.locator('[data-diff]')).toContainText('86400');
 await page.screenshot({path:'/private/tmp/hbl-compatibility-chromium.png'});
 await tools.locator('[data-action="reject"]').click();
 expect(await page.evaluate(()=>JSON.stringify(window.hblDecisionStudio.currentInput()))).toBe(before);
});
