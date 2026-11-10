import { test, expect } from '@playwright/test';
test('research facilities retain context and export honest display metadata',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/research/index.html?runId=run:research:browser&entityId=building:hbl:lab&tick=12');
 await expect(page.locator('#facilities article')).toHaveCount(9);
 await expect(page.locator('#facilities a').first()).toHaveAttribute('href',/runId=run%3Aresearch%3Abrowser/);
 await page.goto('/tools/webgpu/monte-carlo.html?runId=run:research:browser&tick=12');
 await page.locator('#research-context summary').click();
 await expect(page.locator('#research-context a').first()).toHaveAttribute('href',/tick=12/);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export current display snapshot'}).click();const download=await pending;
 let data='';for await(const part of await download.createReadStream())data+=part;
 const record=JSON.parse(data);expect(record.context.runId).toBe('run:research:browser');expect(record.kind).toBe('display-snapshot');expect(record.cityEffects).toBe(false);expect(record.modelHash).toMatch(/^sha256:[a-f0-9]{64}$/);expect(errors).toEqual([]);
});

test('each standalone lab exposes contextual facility controls',async({page})=>{
 for(const route of ['/tools/riskuniverse/','/tools/webgpu/monte-carlo.html','/tools/webgpu/evolutionary-algorithms.html','/tools/webgpu/epidemic-ensembles.html','/tools/webgpu/particle-simulations.html','/tools/webgpu/molecular-docking.html','/tools/webgpu/astronomy-signal-search.html','/tools/webgpu/climate-ensembles.html','/tools/security-viz-lab']){
 await page.goto(route+'?branchId=branch:research:inspection&tick=9');
 await expect(page.locator('#research-context summary')).toContainText('World context');
 await page.locator('#research-context summary').click();
 await expect(page.locator('#research-context a').first()).toHaveAttribute('href',/branchId=branch%3Aresearch%3Ainspection/);
 }
});
