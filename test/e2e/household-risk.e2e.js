import {test,expect} from '@playwright/test';
test('household risk identifies pressure, explains weekly changes and opens supporting payments',async({page,request})=>{
 const runId=`population_risk_browser_${Date.now()}`,balances={struggling:800,buffered:10000,unknown:500};let earlyId;
 for(let day=1;day<=14;day++){
  const households=Object.keys(balances).map(id=>{
   const wages=id==='struggling'?(day>7?40:100):200,rent=id==='struggling'?(day>7?80:50):20,childcare=id==='struggling'&&day>7?20:0,entries=[{category:'wages',amount:wages},{category:'rent',amount:-rent},{category:'food',amount:-20},{category:'childcare',amount:-childcare}],openingSavings=balances[id];balances[id]+=entries.reduce((sum,e)=>sum+e.amount,0);
   return{id,savings:balances[id],moneyHistory:id==='unknown'?null:{id:`${id}:${day}`,householdId:id,minute:day*1440,periodStartMinute:(day-1)*1440,openingSavings,closingSavings:balances[id],entries,sources:[],events:[]}};
  });
  const response=await request.post('/api/economy-records',{data:{runId,tick:day*48,minute:day*1440,metrics:{},people:[],events:[],households}});expect(response.ok()).toBeTruthy();if(day===6)earlyId=(await response.json()).id;
 }
 await page.goto(`/world/economy-records?view=risk&run=${runId}`);const panel=page.locator('#risk');await expect(panel).toContainText('High pressure: 1');await expect(panel).toContainText('Buffered: 1');await expect(panel).toContainText('Insufficient history: 1');
 const row=panel.locator('tr').filter({hasText:'struggling'});await expect(row).toContainText('5.6 days');await expect(row).toContainText('worsening');await row.getByRole('button',{name:'Inspect household'}).click();const detail=panel.locator('[data-risk-detail]');await expect(detail).toContainText('Wages fell by $60.00/day');await expect(detail).toContainText('Rent rose by $30.00/day');await expect(detail).toContainText('Childcare costs rose by $20.00/day');
 await detail.getByRole('button',{name:'Follow the money',exact:true}).click();await expect(page.locator('#money')).toContainText('Follow the money · struggling');await expect(page.locator('#money')).toContainText('14 daily settlements');
 await panel.getByLabel('Household risk filter').selectOption('unknown');await expect(panel.locator('table')).toContainText('unknown');await expect(panel.locator('table')).not.toContainText('struggling');
 await page.goto(`/world/economy-records?view=risk&run=${runId}&id=${earlyId}&household=struggling`);await expect(page.locator('#title')).toHaveText('Day 6 · Tick 288');await expect(panel).toContainText('Insufficient history: 3');await expect(page.locator('#money')).toContainText('6 daily settlements');await panel.locator('tr').filter({hasText:'struggling'}).getByRole('button',{name:'Inspect household'}).click();await expect(panel.locator('[data-risk-detail]')).toContainText('Need seven consecutive');
 await page.screenshot({path:test.info().outputPath('household-risk.png'),fullPage:true});
});
test('city risk lens and household inspector read the same live worker payments',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/outcomes',route=>route.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',route=>route.fulfill({json:{ok:true}}));
 await page.goto('/world?demo=1&living=1&people=20&seed=42&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>window.hblLivingWorld?.getRuntime()?.getSnapshot(),null,{timeout:90000});
 const expected=await page.evaluate(async()=>{const runtime=window.hblLivingWorld.getRuntime();runtime.pause();await runtime.updateConfig({...runtime.getSnapshot().config,population:10});await runtime.stepToTime(8*1440);const snapshot=runtime.getSnapshot(),person=snapshot.visibleAgents[0],household=snapshot.households.find(h=>h.id===person.householdId);return{personId:person.id,status:household.financialRisk.status,days:household.financialRisk.consecutiveDays}});
 expect(expected.days).toBe(7);await page.locator('[data-lc-layer]').selectOption('risk');await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRenderStats().layer)).toBe('risk');await expect(page.locator('[data-lc-layer-note]')).toContainText('gray: insufficient history');await page.evaluate(id=>window.hblLivingWorld.selectPerson(id),expected.personId);await expect(page.locator('[data-lc-risk-note]')).toContainText('7 consecutive daily payments');
 await page.getByRole('button',{name:'Show household',exact:true}).click();await expect(page.locator('[data-lc-household-panel]')).toContainText('Follow the money');expect(errors).toEqual([]);
});
