import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test('local World cycle starts while optional plans load and late plans preserve current selection',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let release;const delayed=new Promise(resolve=>release=resolve);
 await page.route(/\/api\/(plan$|dear-congress\/(packages|package-results)\?)/,async route=>{
  await delayed;try{await route.fulfill({json:{packages:[{id:'balanced',name:'Remote Balanced',items:[{id:'t_bus'}]}]}});}catch{}
 });
 try{
  await page.goto('/world/?demo=1&synthetic=1&people=80&renderer=canvas');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
  expect(await page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('loading');
  await expect(page.locator('#policy')).toBeEnabled({timeout:2000});
  await page.locator('#top>summary').click();
  await page.locator('#policy').selectOption('balanced');
  await page.locator('#runCycleBtn').click();
  await expect(page.locator('#runCycleBtn')).toBeDisabled();
  expect(await page.locator('#policy').inputValue()).toBe('balanced');
  // Deliver while the real job runs, within the bounded optional-fetch deadline.
  release();
  await expect(page.locator('#cycleStatus')).toContainText('Cycle 1:',{timeout:30000});
  await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('ready');
  expect(await page.locator('#policy').inputValue()).toBe('balanced');
  expect(await page.locator('#policy option:checked').textContent()).toBe('Balanced');
  const registry=await page.evaluate(async()=>{const {getWorkerRegistry}=await import('/world/workers/worker-registry.js');return getWorkerRegistry().getSnapshot();});
  expect(registry.workers.some(worker=>worker.ownership?.system==='legacy-cycle'&&worker.tasksCompleted===1)).toBe(true);
  await writeFile(info.outputPath('local-cycle.json'),JSON.stringify({startup:await page.evaluate(()=>window.hblWorldStartup),status:await page.locator('#cycleStatus').textContent(),policy:await page.locator('#policy').inputValue(),registry,errors},null,2));
  expect(errors).toEqual([]);
 }finally{release();}
});

test('late optional packages cannot enable controls owned by an active local job',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let releasePlans,releaseWorker;
 const planGate=new Promise(resolve=>releasePlans=resolve),workerGate=new Promise(resolve=>releaseWorker=resolve);
 await page.route(/\/api\/(plan$|dear-congress\/(packages|package-results)\?)/,async route=>{
  await planGate;try{await route.fulfill({json:{packages:[{id:'balanced',name:'Remote Balanced',items:[{id:'t_bus'}]}]}});}catch{}
 });
 // Hold module delivery, not simulation messages or results, to deterministically
 // exercise readiness ownership while the real worker is starting.
 await page.route('**/world/cycle.worker.js',async route=>{await workerGate;try{await route.continue();}catch{}});
 try{
  await page.goto('/world/?demo=1&synthetic=1&people=80&renderer=canvas');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
  await page.locator('#top>summary').click();await page.locator('#policy').selectOption('balanced');
  await page.locator('#runCycleBtn').click();await expect(page.locator('#runCycleBtn')).toBeDisabled();
  releasePlans();await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('ready');
  await expect(page.locator('#runCycleBtn')).toBeDisabled();
  expect(await page.locator('#policy').inputValue()).toBe('balanced');
  await expect(page.locator('#policy option[value="remote-balanced"]')).toContainText('remote');
  releaseWorker();await expect(page.locator('#cycleStatus')).toContainText('Cycle 1:',{timeout:30000});
  await expect(page.locator('#runCycleBtn')).toBeEnabled();expect(errors).toEqual([]);
 }finally{releasePlans();releaseWorker();}
});

test('failed optional requests retain working local presets and report fallback',async({page})=>{
 await page.route(/\/api\/(plan$|dear-congress\/(packages|package-results)\?)/,route=>route.fulfill({status:503,json:{error:'Injected optional service failure'}}));
 await page.goto('/world/?demo=1&synthetic=1&people=40&renderer=canvas');
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('local-fallback');
 await expect(page.locator('#policy')).toBeEnabled();await expect(page.locator('#runCycleBtn')).toBeEnabled();
 expect(await page.locator('#policy option[value="balanced"]').textContent()).toBe('Balanced');
 await expect(page.locator('#policyNote')).toContainText('remote packages unavailable');
});

test('remote amendments stay scoped to the selected remote plan and labels remain literal',async({page})=>{
 const label='<img src=x onerror=window.badPlan=true>Balanced';
 const rows=[{id:'balanced',name:label,items:[{id:'t_bus'}]}];
 await page.route('**/api/plan',route=>route.fulfill({json:{real:rows,blended:rows,diff:{balanced:{addedBySimulated:['t_bus'],removedBySimulated:[],pending:[]}}}}));
 await page.goto('/world/?demo=1&synthetic=1&people=40&renderer=canvas');
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('ready');
 await page.locator('#top>summary').click();await page.locator('#policy').selectOption('balanced');
 await expect(page.locator('#policyNote')).not.toContainText('Simulated residents changed');
 await page.locator('#policy').selectOption('remote-balanced');
 await expect(page.locator('#policyNote')).toContainText(`Simulated residents changed ${label}: +1 −0`);
 await expect(page.locator('#policy option:checked')).toHaveText(label+' · remote');
 expect(await page.locator('#policy img').count()).toBe(0);expect(await page.evaluate(()=>window.badPlan===true)).toBe(false);
});

test('frozen reality still waits for its packages and applies its recorded snapshot plan',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let release,seen;const delayed=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>seen=resolve);
 const order=[];
 await page.route('**/api/plan',async route=>{order.push('packages-requested');seen();await delayed;try{await route.fulfill({json:{packages:[{id:'a',name:'Frozen remote package',items:[{id:'t_bus'}]}]}});}catch{}});
 await page.route('**/api/dear-congress/simulation-snapshots/**',route=>{order.push('snapshot-requested');return route.fulfill({json:{snapshot:{plan:{label:'Frozen fixture',proposalIds:['t_brt']}}}});});
 try{
  await page.goto('/world/?demo=1&synthetic=1&people=40&renderer=canvas&simulation=fixture&reality=0&seed=42',{waitUntil:'domcontentloaded'});
  await requested;
  expect(await page.evaluate(()=>window.hblWorldStartup?.readyMs??null)).toBeNull();await expect(page.locator('#policy')).toBeDisabled();
  release();await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
  expect(order).toEqual(['packages-requested','snapshot-requested']);
  expect(await page.locator('#policy').inputValue()).toBe('snapshot');
  await expect(page.locator('#policyNote')).toContainText('Frozen fixture (frozen plan)');
  await expect(page.locator('#policy option[value="balanced"]')).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{release();}
});

test('saved remote policy restores its exact selector without reloading optional packages',async({page})=>{
 let requests=0;
 await page.route('**/api/plan',route=>{requests++;return route.fulfill({json:{packages:[{id:'balanced',name:'Saved remote plan',items:[{id:'t_bus'}]}]}});});
 await page.goto('/world/?demo=1&synthetic=1&people=40&renderer=canvas');
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup.policyStatus)).toBe('ready');
 await page.locator('#top>summary').click();await page.locator('#policy').selectOption('remote-balanced');
 await page.locator('#worldAdvanced>summary').click();
 await page.locator('#planYear').fill('7');await page.locator('#planYear').dispatchEvent('input');
 await page.locator('#speeds [data-s="0"]').click();
 const saved=await page.evaluate(async()=>{
  const save=await window.hblCaptureWorldExperiment({keepPaused:true});
  const response=await fetch('/api/world-experiments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(save)});
  const record=await response.json();if(!response.ok)throw new Error(record.error);
  return {id:record.id,policy:save.view.policy,checkpoint:save.checkpoint};
 });
 const before=requests;
 await page.goto(`/world/?experiment=${saved.id}&renderer=canvas`);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs))).toBe(true);
 expect(await page.evaluate(()=>window.hblWorldStartup.restoreError??null)).toBeNull();
 expect(requests).toBe(before);expect(await page.locator('#policy').inputValue()).toBe(saved.policy);
 await expect(page.locator('#policy option:checked')).toHaveText('Saved remote plan · remote');
 await expect(page.locator('#policyNote')).toContainText('Saved remote plan · year 7');
 await expect(page.locator('#planYearN')).toHaveText('Year 7');
 const restored=await page.evaluate(async()=>(await window.hblCaptureWorldExperiment({keepPaused:true})).checkpoint);
 expect(restored).toEqual(saved.checkpoint);
});
