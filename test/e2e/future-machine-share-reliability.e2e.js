import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function snapshot(page){return page.evaluate(async()=>{const h=window.futureMachine.history;const {stateHash}=await import('/world/future-machine/data/core.js');return {id:h.experimentId,recipe:h.recipe,hash:h.initialHash,baselineHash:await stateHash(h.baseline),planHash:await stateHash(h.plan),month:window.futureMachine.state.month,metrics:window.futureMachine.state.diff.metrics,provenance:h.provenance};});}
async function selectMonth(page,month){await page.getByTestId('future-machine-timeline').fill(String(month));await page.getByTestId('future-machine-timeline').dispatchEvent('input');}
test('actual saved replay retains selected month, identity and exact histories after refresh',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await selectMonth(page,16);
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();const url=await page.getByRole('link',{name:'Open comparison link'}).getAttribute('href');const before=await snapshot(page);await page.goto(url);await ready(page);const after=await snapshot(page);expect(after).toEqual(before);expect(after.month).toBe(16);expect(after.metrics.housingUnits.delta).toBe(24);
 await page.getByRole('button',{name:/building-project-policy-1-0 · schematic/}).last().click();await expect(page.getByRole('region',{name:'Visual WHY evidence trail'})).toContainText('event 16-0');expect(errors).toEqual([]);
 const path=info.outputPath('saved-replay.json');await writeFile(path,JSON.stringify({url,before,after},null,2));await info.attach('saved-replay',{path,contentType:'application/json'});
});
test('missing saved record recomputes actual recipe with visible disclosure at ready',async({page},info)=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await selectMonth(page,120);const original=await snapshot(page),url=new URL(page.url());url.searchParams.set('experiment','city_unavailable_share_reliability');await page.goto(url.href);await ready(page);const recomputed=await snapshot(page);
 expect(recomputed.id).not.toBe(original.id);expect(recomputed.recipe).toEqual(original.recipe);expect(recomputed.hash).toBe(original.hash);expect(recomputed.baselineHash).toBe(original.baselineHash);expect(recomputed.planHash).toBe(original.planHash);expect(recomputed.month).toBe(120);expect(recomputed.provenance.shareFallback).toContain('Saved record unavailable');
 await page.screenshot({path:info.outputPath('missing-record-ready.png'),fullPage:true});const path=info.outputPath('missing-record-recomputed.json');await writeFile(path,JSON.stringify({original,recomputed,status:await page.locator('.fm-status').innerText()},null,2));await info.attach('missing-record-recomputed',{path,contentType:'application/json'});
 await expect(page.locator('.fm-status')).toContainText(/Saved record unavailable|recomputed from recipe|reran the versioned recipe/i);
});
test('wrong recipe or model and corrupt links fail explicitly, then ordinary retry succeeds',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);const saved=new URL(page.url());
 const mismatch=await page.evaluate(url=>{const u=new URL(url);const recipe=JSON.parse(atob(u.searchParams.get('fm').replaceAll('-','+').replaceAll('_','/')));recipe.seed=0;u.searchParams.set('fm',btoa(JSON.stringify(recipe)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''));return u.href;},saved.href);
 await page.goto(mismatch);await expect(page.getByRole('alert')).toContainText('does not match');expect(await page.evaluate(()=>window.futureMachine.history)).toBe(null);
 const obsolete=await page.evaluate(url=>{const u=new URL(url);const recipe=JSON.parse(atob(u.searchParams.get('fm').replaceAll('-','+').replaceAll('_','/')));recipe.modelVersion='unsupported';u.searchParams.set('fm',btoa(JSON.stringify(recipe)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''));return u.href;},saved.href);
 await page.goto(obsolete);await expect(page.getByRole('alert')).toContainText('model version is unavailable');
 await page.goto('/world/future-machine.html?renderer=canvas2d&fm=corrupt&month=16');await expect(page.getByRole('alert')).toContainText('Invalid shared comparison');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);expect((await snapshot(page)).recipe.seed).toBe(42);
});

for(const seed of [0,4294967295])test(`zero-control share at boundary seed ${seed} preserves exact zero outcomes`,async({page},info)=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 const url=await page.evaluate(async seed=>{const {DEFAULT_RECIPE}=await import('/world/future-machine/contracts.js');const {createShareURL}=await import('/world/future-machine/share/index.js');return createShareURL({recipe:{...DEFAULT_RECIPE,seed,intervention:null},month:120},location.href);},seed);
 await page.goto(url);await ready(page);const before=await snapshot(page);
 expect(before.recipe.seed).toBe(seed);expect(before.recipe.intervention).toBe(null);expect(before.baselineHash).toBe(before.planHash);expect(before.month).toBe(120);expect(Object.values(before.metrics).every(metric=>metric.delta===0)).toBe(true);
 expect(await page.evaluate(()=>window.futureMachine.history.baseline.every(s=>s.state.seed===window.futureMachine.history.seed)&&window.futureMachine.history.plan.every(s=>s.state.seed===window.futureMachine.history.seed))).toBe(true);
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();const saved=await page.getByRole('link',{name:'Open comparison link'}).getAttribute('href');await page.goto(saved);await ready(page);const reopened=await snapshot(page);expect(reopened).toEqual(before);
 const path=info.outputPath(`zero-control-seed-${seed}.json`);await writeFile(path,JSON.stringify({url:saved,before,reopened},null,2));await info.attach('boundary-zero-share',{path,contentType:'application/json'});
});
