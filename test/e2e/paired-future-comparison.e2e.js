import {test,expect} from '@playwright/test';
test('Worldline reports absent recorded comparison data and renders calculated deltas safely',async({page})=>{
 await page.route('**/api/world-experiments',route=>route.fulfill({json:{experiments:[{id:'fixture001',label:'Saved fixture'}]}}));
 await page.route('**/api/world-experiments/fixture001',route=>route.fulfill({json:{id:'fixture001',createdAt:'2026-11-10',save:{label:'Saved fixture',mode:'legacy',checkpoint:{world:{t:10}}}}}));
 await page.goto('/tools/worldline.html');
 await expect(page.locator('[data-worldline-comparison]')).toContainText('no recorded causal run ID');
 await page.evaluate(async()=>{
  const {mountPairedComparison}=await import('/tools/paired-comparison.js');
  const root=document.querySelector('[data-worldline-comparison]');
  await mountPairedComparison(root,{runId:'run:test:baseline',fetcher:async url=>({ok:true,json:async()=>url.includes('child=')?{compatibility:{compatible:true,reasons:[]},notice:'Fixture recorded calculation',baseline:{manifest:{model:'fixture'}},child:{},interventions:[],metrics:[{label:'<img src=x onerror=alert(1)>',metricId:'metric:test:rent',entityId:'entity:test:home',unit:'USD/month',baseline:100,child:125,delta:25,distribution:{status:'unavailable'}}],graph:{status:'available',added:[],removed:[],changed:[]}}:{candidates:[{runId:'run:test:child',compatible:true,reasons:[]},{runId:'run:test:incompatible',compatible:false,reasons:['Model manifests differ']}]}})});
 });
 await page.getByLabel('Compare child run').selectOption('run:test:child');
 await expect(page.locator('[data-worldline-comparison] table')).toContainText('USD/month');
 await expect(page.locator('[data-worldline-comparison] table')).toContainText('25');
 await expect(page.locator('[data-worldline-comparison] img')).toHaveCount(0);
 await expect(page.locator('option[value="run:test:incompatible"]')).toBeDisabled();
});
