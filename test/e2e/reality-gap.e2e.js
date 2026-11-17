import {test,expect} from '@playwright/test';
test('research hub import, shared chart, missing observations and persistent human triage',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/research/index.html');await page.getByRole('link',{name:/Open the Reality Gap Explorer/}).click();
 await expect(page.locator('#result')).toBeHidden();
 const record={schemaVersion:'reality-gap.v1',id:'browser-test',metric:'test metric',unit:'test units',geography:'synthetic place',source:'Synthetic browser fixture',synthetic:true,runId:'test-run',modelVersion:'test.v1',rulesVersion:'test.v1',cutoff:'2020-01-01',seed:42,parameters:{},threshold:10,observed:[{date:'2021-01-01',availableAt:'2021-02-01',value:100,lower:90,upper:110}],simulated:[{date:'2021-01-01',value:120,lower:110,upper:130},{date:'2022-01-01',value:130,lower:120,upper:140}]};
 await page.locator('#record').fill(JSON.stringify(record));await page.getByRole('button',{name:'Compare history'}).click();
 await expect(page.locator('#chart svg')).toHaveCount(1);await expect(page.locator('#rows tr')).toHaveCount(2);await expect(page.locator('#rows tr').last()).toContainText('missing');await expect(page.locator('#provenance')).toContainText('SYNTHETIC');
 await page.getByRole('button',{name:'Draft research issue'}).click();await page.getByRole('button',{name:'Draft research issue'}).click();await expect(page.locator('#queue article')).toHaveCount(1);
 await page.reload();await expect(page.locator('#queue')).toContainText('Human review required');await expect(page.locator('#queue article')).toHaveCount(1);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export triage JSON'}).click();const download=await pending;let json='';for await(const part of await download.createReadStream())json+=part;const drafts=JSON.parse(json);expect(drafts[0].status).toBe('triage');expect(drafts[0].evidence.gap.absoluteError).toBe(20);
 await page.locator('#record').fill('{}');await page.getByRole('button',{name:'Compare history'}).click();await expect(page.locator('#status')).toContainText('blocked');await expect(page.locator('#result')).toBeHidden();expect(errors).toEqual([]);
});
