import {test,expect} from '@playwright/test';
test('ID-only mystery, evidence, reveal, saved reload and private source boundary',async({page,request})=>{
 await page.goto('/world/future-machine.html');await page.getByRole('link',{name:'Play Detective of Futures'}).click();
 await page.getByRole('button',{name:'Open new case'}).click();await expect(page.locator('#outcome')).toContainText('homes');expect(page.url()).not.toContain('fm=');expect(page.url()).toContain('experiment=');
 await page.getByRole('button',{name:'Compare home inventory'}).click();await expect(page.locator('#count')).toHaveText('1 distinct evidence steps');
 await page.getByRole('button',{name:'Follow anchored evidence trail'}).click();await expect(page.locator('#count')).toHaveText('2 distinct evidence steps');
 await page.getByRole('radio',{name:'Authorize 24 homes in district d1 for $1,000,000',exact:true}).check();await page.getByRole('button',{name:'Submit and reveal'}).click();await expect(page.locator('#reveal')).toContainText('Correct');await expect(page.locator('#download')).toBeVisible();
 await page.reload();await expect(page.locator('#reveal')).toContainText('Correct');
 expect((await request.get('/ops/detective/api.js')).status()).toBe(404);
 const metrics=await (await request.get('/api/detective')).json();expect(metrics.completedWithTwoEvidenceSteps).toBe(1);
});
