import {test,expect} from '@playwright/test';
test('declared factorial uses selected stored future through Studio',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/decision.html');
 await page.locator('#try-example').click();
 await page.locator('#auto-preview').uncheck();
 await page.locator('#run-experiment').click();
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state?.experiment?.status),{timeout:60000}).toBe('completed');
 const section=page.locator('[data-di-section="dependence"]');await section.locator('summary').click();
 await section.getByLabel('Declared factorial levels').fill('[{"id":"construction_capacity","levels":[1000,2000]},{"id":"permitting_months","levels":[6,12]}]');
 await section.getByRole('button',{name:'Execute declared factorial design'}).click();
 await expect(section).toContainText('Total variance:');
 await expect(section).toContainText('4/4 evaluations');
 await page.screenshot({path:'/tmp/hbl-backlog-integrated-statistics.png',fullPage:true});
 expect(errors).toEqual([]);
});
