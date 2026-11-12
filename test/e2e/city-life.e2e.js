import {test,expect} from '@playwright/test';
test('household fan renders 60 sequential replays and variance evidence',async({page})=>{
 await page.goto('/world/city-lab.html');
 await page.evaluate(async()=>{
  const {mountLife}=await import('/world/city/life.js');
  const manifest={version:'test-model',runs:30,months:120,initial:{month:0,seed:42,households:[{id:'h'}]},scenarios:[{id:'baseline'},{id:'plan'}]};
  window.fetch=async(url,options)=>{
   const {scenarioId,runIndex}=JSON.parse(options.body);
   return new Response(JSON.stringify({state:{seed:42+runIndex,month:120,households:[{id:'h',unitId:'u',income:100,savings:runIndex+(scenarioId==='plan'?10:0)}],units:[{id:'u',householdId:'h',rent:30}]}}));
  };
  mountLife(document.getElementById('many-worlds')).update({manifest},'fixture');
  document.getElementById('many-worlds').scrollIntoView();
 });
 // The panel lives in the Enter future tab.
 await page.locator('[data-tab="trace"]').click();
 await page.getByRole('button',{name:'Follow 30 seeds'}).click();
 await expect(page.locator('#many-worlds')).toContainText('N = 30 seeds per arm');
 await expect(page.locator('#many-worlds')).toContainText('within-arm (luck) variance');
 await expect(page.locator('#many-worlds table tr')).toHaveCount(61);
 await expect(page.locator('#many-worlds canvas')).toHaveCount(2);
});
