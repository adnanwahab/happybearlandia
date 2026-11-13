import {test,expect} from '@playwright/test';
test('normal dashboard route reads real local sources and keeps unmeasured history honest at desktop/mobile',async({page,request},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await request.get('/api/mini-symphony');expect(response.status()).toBe(200);const data=await response.json();expect(data.projects.length).toBeGreaterThan(0);
 await page.goto('/mini-symphony');await expect(page.getByRole('heading',{name:'Can it code for 25 hours?'})).toBeVisible();
 await expect(page.locator('#project-select')).toBeEnabled();await expect(page.locator('#freshness')).not.toContainText('Connecting');
 if(!data.projects[0].sessions.length){await expect(page.locator('#goal-verdict')).toHaveText('Not measured yet');await expect(page.locator('#download-log')).toHaveAttribute('aria-disabled','true');}
 await page.screenshot({path:testInfo.outputPath('dashboard-desktop.png'),fullPage:true});
 if(data.projects.some(p=>p.id==='dear-congress')){await page.locator('#project-select').selectOption('dear-congress');await expect(page.locator('#project-select')).toHaveValue('dear-congress');}
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Can it code for 25 hours?'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('dashboard-mobile.png'),fullPage:true});expect(errors).toEqual([]);
});
test('synthetic API fixture distinguishes 25h idle runtime from coding and survives a failed refresh',async({page})=>{
 let fail=false;
 const id='11111111-1111-4111-8111-111111111111';
 await page.route('**/api/mini-symphony',async route=>{if(fail)return route.fulfill({status:503,body:'Unavailable'});return route.fulfill({json:{generatedAt:new Date().toISOString(),targetHours:25,projects:[{id:'fixture',name:'Synthetic test fixture',queue:{runnable:0,disabled:0,terminal:0,priorAttempts:0,running:0},legacy:{tasks:0,prCreated:0,noChanges:0,failed:0},sessions:[{id,metrics:{hasStart:true,status:'waiting',phase:'waiting',startedAt:new Date(Date.now()-90000000).toISOString(),lastSeenAt:new Date().toISOString(),targetMs:90000000,elapsedMs:90000000,continuousObservedMs:90000000,currentContinuousObservedMs:90000000,codingMs:0,publishingMs:0,waitingMs:90000000,unknownMs:0,reachedRuntimeTarget:true,prsCreated:0,tasksFinished:0,failed:0,noChanges:0,interventions:0,utilization:0,timeline:[{phase:'waiting',durationMs:90000000,observed:true}]},events:[{type:'heartbeat',phase:'waiting',at:new Date().toISOString(),elapsedMs:90000000,message:'Synthetic heartbeat fixture'}]}]}]}});});
 await page.goto('/mini-symphony');await expect(page.locator('#goal-verdict')).toHaveText('Runtime only · no coding');await expect(page.locator('#coding-time')).toHaveText('0s');await expect(page.locator('#pr-count')).toHaveText('0');await expect(page.locator('#download-log')).toHaveAttribute('href',`/api/mini-symphony/log?project=fixture&session=${id}`);
 await page.locator('#show-heartbeats').check();await expect(page.locator('#event-list')).toContainText('Synthetic heartbeat fixture');
 fail=true;await page.locator('#refresh-button').click();await expect(page.locator('#notice')).toContainText('last successful snapshot');await expect(page.locator('#goal-verdict')).toHaveText('Runtime only · no coding');
});
