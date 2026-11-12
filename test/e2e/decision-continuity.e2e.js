import { test, expect } from '@playwright/test';
const query='universeId=universe:hbl:main&worldId=world:hbl:chicago&scenarioId=scenario:hbl:baseline&entityId=building:osm:123';
test('recorded Decision future returns through Optimization with canonical context',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/decision.html?'+query);
 await expect(page.locator('#parameter-permitting_months')).toBeVisible();
 await page.locator('#auto-preview').uncheck();
 await page.locator('#try-example').click();
 await page.evaluate(async()=>{const h=window.hblDecisionStudio;await h.runExperiment({preview:true});});
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state?.experiment?.status)).toBe('completed');
 await page.evaluate(async()=>{const h=window.hblDecisionStudio;await h.enterFuture(h.state.results.runs[0],{month:3});});
 await page.locator('#decision-continuity').evaluate(node=>node.open=true);
 const link=page.locator('#decision-continuity a').filter({hasText:'Optimization'});
 const href=await link.getAttribute('href'),url=new URL(href,'http://127.0.0.1:3100');
 expect(url.searchParams.get('worldId')).toBe('world:hbl:chicago');expect(url.searchParams.get('entityId')).toBe('building:osm:123');
 expect(url.searchParams.get('runId')).toMatch(/^run:decision:/);expect(url.searchParams.get('month')).toBe('3');
 await page.goto(href);
 await expect.poll(()=>page.evaluate(()=>window.hblDecisionStudio?.state?.experiment?.status)).toBe('completed');
 expect(await page.evaluate(()=>window.hblDecisionStudio.state.selectedRun?.id)).toBe(url.searchParams.get('run'));
 expect(errors).toEqual([]);
});
test('lab and proposal bridge expose context links and malformed context is reported',async({page})=>{
 for(const route of ['/world/experiment-lab.html','/world/constitution-city.html','/world/reality-compiler.html']){
  await page.goto(route+'?'+query);
  await page.locator('#decision-continuity').evaluate(node=>node.open=true);
  await expect(page.locator('#decision-continuity a').first()).toHaveAttribute('href',/worldId=world%3Ahbl%3Achicago/);
 }
 await page.goto('/world/decision.html?runId=local');
 await expect(page.getByRole('alert').filter({hasText:'Invalid shared decision context'})).toBeVisible();
});
test('Constitution context reports an actual isolated paired run and selected month',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/area?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto('/world/constitution-city.html?'+query+'&experimentId=experiment:decision:origin');
 await page.waitForFunction(()=>Boolean(window.hblConstitutionCity?.studio));
 await page.locator('[data-cc-runs]').selectOption('2');await page.locator('[data-cc-years]').fill('1');
 await page.evaluate(async()=>{await window.hblConstitutionCity.studio.run();});
 await page.evaluate(async()=>{const h=window.hblConstitutionCity;const r=h.studio.getState().result.runs.find(r=>r.scenarioId==='proposal-a');await h.studio.selectFuture(r.id,6);});
 const snapshot=await page.locator('#decision-continuity pre').evaluate(node=>JSON.parse(node.textContent));
 expect(snapshot.context.runId).toMatch(/^run:constitution:/);expect(snapshot.context.tick).toBe(6);
 expect(snapshot.context.experimentId).toBeUndefined();expect(snapshot.context.worldId).toBe('world:hbl:chicago');
 expect(snapshot.results.month).toBe(6);expect(snapshot.worldMutation).toBe(false);expect(snapshot.persistence).toContain('no saved experiment ID');
 expect(errors).toEqual([]);
});
test('Reality compiler retains the executed branch and actual period',async({page})=>{
 await page.route('**/api/area?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto('/world/reality-compiler.html?'+query);
 await page.waitForFunction(()=>Boolean(window.hblRealityCompiler?.studio));
 await page.locator('[data-r-proposal]').fill('Allow more housing near transit');
 await page.locator('[data-r-compile]').click();
 await page.locator('[data-r-runs]').fill('1');await page.locator('[data-r-horizon]').fill('2');
 await page.evaluate(async()=>{await window.hblRealityCompiler.studio.run();});
 const snapshot=await page.locator('#decision-continuity pre').evaluate(node=>JSON.parse(node.textContent));
 expect(snapshot.context.runId).toMatch(/^run:reality:/);expect(snapshot.context.branchId).toMatch(/^branch:reality:/);
 expect(snapshot.context.tick).toBe(2);expect(snapshot.worldMutation).toBe(false);expect(snapshot.results.status).toBe('completed');
});
