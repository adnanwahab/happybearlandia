import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function collect(request){
 const runId=`population_interventions_${Date.now()}_${Math.random().toString(36).slice(2)}`;let latestId,earlyId;
 for(let day=1;day<=7;day++){
  const record={id:`help:${day}`,householdId:'help',minute:day*1440,periodStartMinute:(day-1)*1440,openingSavings:1000-(day-1)*20,closingSavings:1000-day*20,entries:[{category:'wages',amount:100},{category:'rent',amount:-70},{category:'food',amount:-30},{category:'childcare',amount:-20}],sources:[],events:[]};
  const response=await request.post('/api/economy-records',{data:{runId,tick:day*48,minute:day*1440,metrics:{},people:[],events:[],households:[{id:'help',savings:record.closingSavings,moneyHistory:record},{id:'unknown',savings:400}]}});expect(response.ok()).toBeTruthy();latestId=(await response.json()).id;if(day===6)earlyId=latestId;
 }
 return{runId,latestId,earlyId};
}
test('compare household support, validate controls, export evidence and open actual payments without applying a policy',async({page,request})=>{
 const {runId,latestId,earlyId}=await collect(request),writes=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url())});
 await page.goto(`/world/economy-records?view=risk&run=${runId}&id=${latestId}`);
 const risk=page.locator('#risk');await risk.locator('tr').filter({hasText:'help'}).getByRole('button',{name:'Inspect household'}).click();await risk.locator('[data-intervention-disclosure] > summary').click();
 const calculator=risk.locator('[data-household-interventions]');await expect(calculator.locator('[data-scenario=combined]')).toContainText('$14.00');await expect(calculator.locator('[data-scenario=combined]')).toContainText('$1,280.00');await expect(calculator.getByRole('status')).toContainText('covers recorded expenses');await expect(calculator).toContainText('government childcare subsidy $300.00');await expect(calculator).toContainText('added employer payroll $300.00');await expect(calculator).toContainText('rent forgone by landlords $420.00');
 await calculator.getByLabel('Rent reduction (%)',{exact:true}).fill('101');await expect(calculator.getByRole('status')).toContainText('between 0 and 100');await expect(calculator.getByRole('button',{name:'Export scenario JSON'})).toBeDisabled();await expect(calculator.locator('table')).toHaveCount(0);
 await calculator.getByLabel('Rent reduction (%)',{exact:true}).fill('20');await calculator.getByLabel('Projection days',{exact:true}).fill('90');await expect(calculator.locator('[data-scenario=combined]')).toContainText('$2,120.00');await expect(calculator.locator('svg')).toHaveAttribute('role','img');
 const downloaded=page.waitForEvent('download');await calculator.getByRole('button',{name:'Export scenario JSON'}).click();const download=await downloaded,json=JSON.parse(await readFile(await download.path(),'utf8'));expect(json.householdId).toBe('help');expect(json.context.runId).toBe(runId);expect(String(json.context.snapshotId)).toBe(String(latestId));expect(json.evidence.days).toBe(7);expect(json.scenarios.at(-1).projectedSavings).toBe(2120);
 await page.screenshot({path:test.info().outputPath('household-interventions.png'),fullPage:true});
 await calculator.getByRole('button',{name:'View supporting payments'}).click();await expect(page.locator('#money')).toContainText('reduced savings by $140.00');expect(writes).toEqual([]);
 await page.goto(`/world/economy-records?view=risk&run=${runId}&id=${earlyId}`);await risk.locator('tr').filter({hasText:'help'}).getByRole('button',{name:'Inspect household'}).click();await risk.locator('[data-intervention-disclosure] > summary').click();await expect(calculator.getByRole('status')).toContainText('Estimates unavailable');await expect(calculator.locator('input:disabled')).toHaveCount(4);await expect(calculator.locator('svg')).toHaveCount(0);
});
test('households with no recorded payment history get a clear unavailable state',async({page,request})=>{
 const {runId,latestId}=await collect(request);await page.goto(`/world/economy-records?view=risk&run=${runId}&id=${latestId}`);const risk=page.locator('#risk');await risk.locator('tr').filter({hasText:'unknown'}).getByRole('button',{name:'Inspect household'}).click();await risk.locator('[data-intervention-disclosure] > summary').click();const calculator=risk.locator('[data-household-interventions]');await expect(calculator.getByRole('status')).toContainText('Estimates unavailable');await expect(calculator.getByRole('button',{name:'Export scenario JSON'})).toBeDisabled();await calculator.getByRole('button',{name:'View supporting payments'}).click();await expect(page.locator('#money')).toContainText('No payment history collected');
});
