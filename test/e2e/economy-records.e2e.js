import {test,expect} from '@playwright/test';
test('viewer lists, inspects, searches and exports a collected economic record',async({page,request})=>{
 const runId=`population_browser_${Date.now()}`,payload={runId,tick:48,minute:1440,modelVersion:'test',metrics:{employmentRate:.8},economy:{totalTax:12},people:[{id:'person-browser',income:42000,employmentStatus:'employed'}],businesses:[{id:'business-browser',revenue:120}],districts:[],events:[{id:'event-browser',type:'JOB_FOUND'}]};
 const result=await request.post('/api/economy-records',{data:payload});expect(result.ok()).toBeTruthy();const {id}=await result.json();
 await page.goto(`/world/economy-records?id=${id}`);await expect(page.locator('#title')).toHaveText('Day 1 · Tick 48');await expect(page.locator('#table')).toContainText('person-browser');
 await page.locator('#kind').selectOption('events');await expect(page.locator('#table')).toContainText('JOB_FOUND');await page.locator('#search').fill('no-match');await expect(page.locator('#table')).toContainText('No matching records');
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toContain(runId);
});
