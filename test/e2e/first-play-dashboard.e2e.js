import {test,expect} from '@playwright/test';
test('dashboard shows unavailable, fixture counts and rejects malformed exports',async({page})=>{
 await page.goto('/tools/first-play/index.html');
 await expect(page.getByRole('status')).toContainText('Unavailable');
 const payload={schemaVersion:'first-play-export.v1',kind:'synthetic-fixture',source:'Browser fixture',observationStart:'2026-11-12T00:00:00Z',observationEnd:'2026-11-13T00:00:00Z',events:['landing','start','choice','first_change','share','return'].map((type,i)=>({id:String(i),sessionId:'one',type,bot:false,timestamp:`2026-11-12T00:0${i}:00Z`}))};
 await page.locator('#file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
 await expect(page.getByRole('status')).toContainText('SYNTHETIC TEST FIXTURE');
 await expect(page.locator('table').first().locator('tr')).toHaveCount(7);
 await expect(page.locator('table').first().locator('tr').last()).toHaveText('return11100.0%');
 await expect(page.locator('#result')).toContainText('D1 / D7 retention: Unavailable');
 await page.screenshot({path:'output/first-play-dashboard.png',fullPage:true});
 await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.getByRole('status')).toContainText('Unavailable');
 await expect(page.locator('table')).toHaveCount(0);
});
