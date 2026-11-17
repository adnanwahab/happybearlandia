import {test,expect} from '@playwright/test';
import {costAtlasFixture} from '../fixtures/household-cost-atlas.js';
test('normal decision entry opens exact cost source, retains missing eligibility and fits mobile',async({page})=>{
 await page.goto('/world/decision.html');
 await page.locator('#try-example').click();await page.locator('#auto-preview').uncheck();
 await page.locator('#run-count').selectOption('10');await page.locator('#run-experiment').click();
 const best=page.locator('[data-control=best]');await expect(best).toBeVisible({timeout:60000});
 await best.click();
 const atlas=page.getByTestId('household-cost-atlas');
 await expect(atlas).toContainText('Supported total');
 await expect(atlas).toContainText('Eligible count: unavailable');
 const href=await atlas.getByRole('link',{name:'Open exact aggregate source (run JSON)'}).getAttribute('href');
 const response=await page.request.get(href);expect(response.ok()).toBe(true);
 const data=await response.json();const run=data.run||data;
 expect(await atlas.innerText()).toContain(run.id);
 expect(run.accounting.subsidySpent+run.accounting.voucherSpent+run.accounting.projectPublicSpent).toBeCloseTo(run.metrics.public_expenditure,4);
 await atlas.screenshot({path:'.mini-symphony-evidence/SHE-752-atlas-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 expect(await atlas.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await atlas.screenshot({path:'.mini-symphony-evidence/SHE-752-atlas-mobile.png'});
 // Exercise missing and replacement behavior through the production renderer.
 const state=await page.evaluate(async({experiment,run})=>{
  const {renderHouseholdCostAtlas}=await import('/world/decision/cost-atlas.js');
  const host=document.createElement('section');document.body.append(host);
  renderHouseholdCostAtlas(host,experiment,{...run,accounting:null},'/source');const missing=host.textContent;
  renderHouseholdCostAtlas(host,experiment,null,null);const cleared=host.textContent;host.remove();
  return {missing,cleared};
 },costAtlasFixture());
 expect(state.missing).toContain('missing or inconsistent');expect(state.cleared).toContain('Select a completed future');
});
