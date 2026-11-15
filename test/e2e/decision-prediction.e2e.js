import {test,expect} from '@playwright/test';
for(const mobile of [false,true]) test(`prediction normal entry ${mobile?'touch':'keyboard'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/decision.html');
 await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await page.locator('#policy-prediction').screenshot({path:`.mini-symphony-evidence/SHE-484-prediction-before-${mobile?'mobile':'desktop'}.png`});
 await page.locator('#try-example').click();await page.locator('#auto-preview').uncheck();await page.locator('#run-count').selectOption('10');
 const lock=page.getByRole('button',{name:'Lock prediction'});
 await lock.click();await expect(page.locator('[data-prediction-status]')).toContainText('Choose an alternative');
 await page.getByLabel('Predicted housing supply direction').selectOption('up');
 await lock.focus();await lock.press('Enter');
 await expect(lock).toBeDisabled();
 await page.locator('#run-experiment').click();
 await expect(page.locator('[data-prediction-status]')).toContainText('Modeled result:',{timeout:60000});
 const result=await page.locator('[data-prediction-status]').textContent();
 await page.locator('#policy-prediction').screenshot({path:`.mini-symphony-evidence/SHE-484-prediction-after-${mobile?'mobile':'desktop'}.png`});
 await expect(page.locator('#run-experiment')).toBeEnabled();await page.locator('#run-experiment').click();
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio.state.busy)).toBe(false);
 await expect(page.locator('[data-prediction-status]')).toHaveText(result);
});
test('component unavailable without a policy',async({page})=>{
 await page.goto('/world/decision.html');
 await page.evaluate(async()=>{const {mountPrediction}=await import('/world/decision/prediction.js');const div=document.createElement('div');div.id='empty-prediction';document.body.append(div);mountPrediction(div,{getInput:()=>({scenarios:[]})});});
 await expect(page.locator('#empty-prediction')).toContainText('Prediction unavailable');
 await expect(page.locator('#empty-prediction button')).toBeDisabled();
});
