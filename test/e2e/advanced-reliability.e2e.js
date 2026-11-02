import { test, expect } from '@playwright/test';
test.use({ actionTimeout: 15000 });
async function harness(page, mode='robustness') {
  await page.route('**/world/reliability-harness.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:12px;background:#0d1915"><main id="harness"></main></body></html>'}));
  await page.goto('/world/reliability-harness.html');
  await page.evaluate(async mode=>{
    const pack=await import('/world/models/housing/index.js');
    const input={schemaVersion:'decision-experiment.v1',name:'Reliability matrix',decision:'Housing policy comparison',modelId:pack.housingModel.id,modelVersion:pack.housingModel.version,seed:42,runs:10,years:10,scenarios:pack.createHousingScenarios(),metadata:{}};
    const root=document.querySelector('#harness');
    if(mode==='robustness'){
      const {mountRobustness}=await import('/world/decision/robustness.js');
      const view=mountRobustness(root,{getInput:()=>input,onApplyInput:()=>{throw Error('A stress diagnostic must not mutate source input')}});
      window.reliabilityHarness={input,view,before:JSON.stringify(input)};view.update({input});
    }else{
      const {mountDemoFallback}=await import('/world/decision/demo-fallback.js');
      window.reliabilityHarness={input,loaded:null};
      mountDemoFallback(root,{onLoadSavedResults:results=>{window.reliabilityHarness.loaded=results},onRunPinnedInput:()=>{throw Error('Explicit simulated offline failure')}});
    }
  },mode);
}
test('real robustness matrix: paired runs, explicit denominator, immutable input and exact-input restore',async({page})=>{
  await harness(page);
  await page.getByRole('button',{name:'Run stress sequence',exact:true}).click();
  await expect(page.locator('[data-rb-status]')).toContainText('Stress sequence complete',{timeout:60000});
  const report=await page.evaluate(()=>window.reliabilityHarness.view.getReport());
  expect(report.cells).toHaveLength(12);
  expect(report.cells.every(cell=>cell.status==='completed'&&cell.eligible===10)).toBe(true);
  expect(await page.evaluate(()=>JSON.stringify(window.reliabilityHarness.input)===window.reliabilityHarness.before)).toBe(true);
  const ids=[...new Set(report.cells.map(cell=>cell.experimentId))];
  expect(ids).toHaveLength(4);
  const records=[];for(const id of ids){const response=await page.request.get(`/api/decision-experiments/${id}/results`);expect(response.ok()).toBe(true);records.push(await response.json())}
  expect(records.every(record=>record.experiment.seed===42&&record.experiment.metadata.preview===true)).toBe(true);
  expect(records[0].runs.map(row=>row.seed)).toEqual(records[1].runs.map(row=>row.seed));
  for(const cell of report.cells){const record=records.find(record=>record.experiment.id===cell.experimentId);const eligible=record.runs.filter(row=>row.scenarioId===cell.scenarioId&&row.status==='completed'&&Number.isFinite(row.metrics.affordability));expect(cell.success).toBe(eligible.filter(row=>row.metrics.affordability>=60).length)}
  await harness(page);
  await expect(page.locator('[data-rb-status]')).toContainText('Saved matrix restored');
  expect((await page.evaluate(()=>window.reliabilityHarness.view.getReport())).cells.map(cell=>cell.success)).toEqual(report.cells.map(cell=>cell.success));
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.locator('[data-testid="robustness"]').boundingBox();expect(bounds.width).toBeLessThanOrEqual(390);
  expect(await page.locator('.rb-table-wrap').evaluate(node=>getComputedStyle(node).overflowX)).toBe('auto');
  await page.locator('[data-testid="robustness"]').screenshot({path:'/private/tmp/hbl-robustness-mobile.png'});
});
test('stress cancellation never scores unrun cells and reports a partial matrix',async({page})=>{
  await harness(page);
  await page.locator('[data-rb-runs]').selectOption('50');
  for(const checkbox of await page.locator('[data-rb-stress]').all())await checkbox.check();
  await page.getByRole('button',{name:'Run stress sequence',exact:true}).click();
  await page.getByRole('button',{name:'Cancel stress sequence',exact:true}).press('Enter');
  await expect(page.locator('[data-rb-status]')).toContainText('cancelled',{timeout:30000});
  const report=await page.evaluate(()=>window.reliabilityHarness.view.getReport());
  expect(report.status).toBe('cancelled');expect(report.cells.length).toBeLessThan(24);
  expect(await page.evaluate(()=>JSON.stringify(window.reliabilityHarness.input)===window.reliabilityHarness.before)).toBe(true);
});
test('saved fallback is explicit, versioned, read-only and never substituted for a fresh run error',async({page})=>{
  await harness(page,'fallback');
  expect(await page.evaluate(()=>window.reliabilityHarness.loaded)).toBeNull();
  await page.getByRole('button',{name:'Run pinned inputs through the server'}).click();
  await expect(page.locator('[data-df-status]')).toContainText('Saved results have not replaced it');
  expect(await page.evaluate(()=>window.reliabilityHarness.loaded)).toBeNull();
  await page.getByRole('button',{name:'Inspect saved model results'}).click();
  const loaded=await page.evaluate(()=>({label:window.reliabilityHarness.loaded.label,readOnly:window.reliabilityHarness.loaded.readOnly,count:window.reliabilityHarness.loaded.runs.length}));
  expect(loaded).toEqual({label:'SAVED MODEL RESULTS · not a fresh experiment',readOnly:true,count:40});
});
