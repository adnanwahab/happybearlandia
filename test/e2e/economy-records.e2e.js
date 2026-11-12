import {test,expect} from '@playwright/test';
test('viewer lists, inspects, searches and exports a collected economic record',async({page,request})=>{
 const runId=`population_browser_${Date.now()}`,payload={runId,tick:48,minute:1440,modelVersion:'test',metrics:{employmentRate:.8},economy:{totalTax:12},people:[{id:'person-browser',income:42000,employmentStatus:'employed'}],businesses:[{id:'business-browser',revenue:120}],districts:[],events:[{id:'event-browser',type:'JOB_FOUND'}]};
 const result=await request.post('/api/economy-records',{data:payload});expect(result.ok()).toBeTruthy();const {id}=await result.json();
 await page.goto(`/world/economy-records?id=${id}`);await expect(page.locator('#title')).toHaveText('Day 1 · Tick 48');await expect(page.locator('#table')).toContainText('person-browser');
 await page.locator('#kind').selectOption('events');await expect(page.locator('#table')).toContainText('JOB_FOUND');await page.locator('#search').fill('no-match');await expect(page.locator('#table')).toContainText('No matching records');
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toContain(runId);
});
test('follow the money explains savings and opens recorded worker and business details',async({page,request})=>{
 const runId=`population_money_browser_${Date.now()}`,householdId='household-money';
 const source={category:'wages',amount:100,personId:'worker-money',businessId:'employer-money',person:{id:'worker-money',annualContractWage:42000},business:{id:'employer-money',type:'retail'}};
 for(let day=1;day<=2;day++){
 const record={id:`${householdId}:${day}`,householdId,minute:day*1440,openingSavings:1000-(day-1)*50,closingSavings:1000-day*50,entries:[{category:'wages',amount:100},{category:'rent',amount:-120},{category:'food',amount:-30}],sources:[source],events:[{type:'JOB_LOST',minute:day*1440,personId:'worker-money',reason:'Employer closed'}]};
 expect((await request.post('/api/economy-records',{data:{runId,tick:day*48,minute:day*1440,metrics:{},people:[],businesses:[],events:[],households:[{id:householdId,savings:record.closingSavings,moneyHistory:record}]}})).ok()).toBeTruthy();
 }
 await page.goto(`/world/economy-records?run=${runId}&household=${householdId}`);
 const panel=page.locator('#money');await expect(panel).toContainText('reduced savings by $100.00');await expect(panel).toContainText('Rent $240.00');await expect(panel.locator('svg')).toHaveAttribute('role','img');
 await panel.locator('summary').first().click();await expect(panel).toContainText('Employer closed');await panel.getByRole('button',{name:'employer-money',exact:true}).first().click();await expect(page.locator('#money-entity')).toContainText('retail');
 await page.reload();await expect(panel).toContainText('reduced savings by $100.00');
 await page.locator('#kind').selectOption('households');await page.locator('#search').fill('');await page.getByRole('button',{name:'Follow the money',exact:true}).click();await expect(panel).toContainText('daily settlements');await page.screenshot({path:test.info().outputPath('money-history.png'),fullPage:true});
});
test('world collection panel carries household payments into durable history',async({page})=>{
 await page.goto('/world/economy-records');
 const run=`population_collect_${Date.now()}`;
 await page.evaluate(async(run)=>{
  const {mountEconomyPanel}=await import('/world/population/economy-panel.js');
  const root=document.createElement('section');root.id='collection-test';document.body.append(root);const panel=mountEconomyPanel(root);
  panel.update({runtime:{id:run,revision:0},tick:48,minute:1440,metrics:{},visibleAgents:[],events:[],households:[{id:'h-collect',moneyHistory:{id:'h-collect:1',householdId:'h-collect',minute:1440,openingSavings:100,closingSavings:85,entries:[{category:'food',amount:-15}],sources:[],events:[]}}]});
 },run);
 await page.locator('#collection-test').getByRole('button',{name:'Save current snapshot'}).click();await expect(page.locator('#collection-test [role=status]')).toContainText('Saved tick 48');
 await page.goto(`/world/economy-records?run=${run}_0&household=h-collect`);await expect(page.locator('#money')).toContainText('reduced savings by $15.00');
});
