import {test,expect} from '@playwright/test';

test('100 futures link exact persisted receipts and replay recorded observations without GPU',async({page},testInfo)=>{
 test.setTimeout(120000);
 await page.goto('/world/decision.html');
 await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await page.locator('#try-example').click();
 await page.locator('#auto-preview').uncheck();
 await page.locator('.decision-viz .dv-panel').first().screenshot({path:testInfo.outputPath('before.png')});
 await page.locator('#run-count').selectOption('100');
 await page.locator('#run-experiment').click();
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state?.experiment?.status),{timeout:90000}).toBe('completed');
 const result=await page.evaluate(()=>structuredClone(window.hblDecisionStudio.state.results));
 const scenario=result.experiment.scenarios[0].id;
 await page.getByLabel('Filter scenario').selectOption(scenario);
 const points=page.locator('[data-viz="landscape"] [data-run-id]');
 await expect(points).toHaveCount(100);
 const id=await points.nth(73).getAttribute('data-run-id');
 await points.nth(73).focus();await points.nth(73).press('Enter');
 const link=page.locator('[data-run-receipt]');await expect(link).toBeVisible();
 const response=await page.request.get(await link.getAttribute('href'));expect(response.ok()).toBe(true);
 const payload=await response.json(),run=payload.run||payload;
 expect(run.id).toBe(id);expect(run.scenarioId).toBe(scenario);
 expect(run.experimentId).toBe(result.experiment.id);
 const slider=page.getByLabel('Replay year',{exact:true});await expect(slider).toBeVisible();
 await slider.fill(await slider.getAttribute('max'));await slider.dispatchEvent('input');
 const rows=run.monthlyTimeline?.length?run.monthlyTimeline:run.timeline;
 const terminal=rows.at(-1);
 await expect(page.locator('[data-replay-year]')).toHaveText(String(Number((terminal.year??terminal.month/12).toFixed(3))));
 await expect(page.locator('[data-run-summary]')).toContainText(id);
 await page.locator('[data-control="replay-start"]').click();
 await page.getByRole('button',{name:'Play future replay',exact:true}).click();
 await expect.poll(()=>slider.inputValue()).not.toBe('0');
 await page.getByRole('button',{name:'Pause future replay',exact:true}).click();
 await page.locator('[data-viz="landscape"]').screenshot({path:testInfo.outputPath('after.png')});
 // Exercise the production view's missing depth path with one altered observation.
 await page.evaluate(async data=>{
  const {mountDecisionVisualizations}=await import('/world/decision/visualizations.js');
  const host=document.createElement('div');host.id='missing-depth-fixture';document.body.append(host);
  const rows=data.runs.filter(r=>r.scenarioId===data.experiment.scenarios[0].id).slice(0,2);
  const key=data.model.metrics.find(m=>/supply|housing_stock|housing_units/.test(m.id))?.id||data.model.metrics[2].id;
  rows[0]={...rows[0],metrics:{...rows[0].metrics,[key]:null}};
  mountDecisionVisualizations(host).update({...data,runs:rows});
 },result);
 const fixture=page.locator('#missing-depth-fixture');
 await fixture.locator('[data-control="projection"]').click();
 await expect(fixture.locator('[data-filter-note]')).toContainText('1 omitted for missing axes');
 await expect(fixture.locator('[data-viz="landscape"] [data-run-id]')).toHaveCount(1);
});
