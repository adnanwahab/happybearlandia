import {test,expect} from '@playwright/test';

test('business-mode legacy person shows actual needs, sleep restores energy and pause holds values',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 // A controlled starting activity in the actual legacy model. Only world.step
 // changes needs; the fixture never writes the needs-bar DOM or animates numbers.
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__actualLegacyNeeds={prepare(){const p=world.people[0];p.mode='doing';p.action='sleep';p.doing='sleeping';p.until=world.t+120;p.target=p.home;p.needs.energy=20;select({type:'person',id:0});return structuredClone(p.needs);},step(minutes){world.step(minutes);renderInspector();return structuredClone(world.people[0].needs);},get(){return {minute:world.t,needs:structuredClone(world.people[0].needs)};}};`});});
 await page.goto('/world?demo=1&people=10&renderer=webgl&quality=LOW&business_mode=true');
 await page.waitForFunction(()=>Boolean(window.__actualLegacyNeeds),null,{timeout:60000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const initial=await page.evaluate(()=>window.__actualLegacyNeeds.prepare());
 const panel=page.locator('#inspect'),needs=panel.locator('[data-person-needs]');
 await expect(panel).toBeVisible();await expect(needs).toBeVisible();
 await expect(needs.getByRole('meter')).toHaveCount(4);
 await expect(needs.locator('[data-need-value="energy"]')).toHaveText('20');
 const paused=await page.evaluate(()=>window.__actualLegacyNeeds.get());await page.waitForTimeout(350);
 expect(await page.evaluate(()=>window.__actualLegacyNeeds.get())).toEqual(paused);
 const changed=await page.evaluate(()=>window.__actualLegacyNeeds.step(20));
 expect(changed.energy).toBeGreaterThan(initial.energy);
 await expect(needs.locator('[data-need-value="energy"]')).toHaveText(String(Math.round(changed.energy)));
 expect(await needs.getByRole('meter',{name:'Energy',exact:true}).getAttribute('aria-valuenow')).toBe(String(Math.round(changed.energy)));
 await page.screenshot({path:'/private/tmp/hbl-legacy-person-needs.png'});
});

test('living worker needs use modeled activities and deterministic detail replay',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/__living-needs-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__living-needs-test');
 const result=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');const {defaultPopulationConfig}=await import('/world/population/contracts.js');const {mountPersonNeeds}=await import('/world/person-needs.js');
  const config={...defaultPopulationConfig,population:100,seed:42};const runtime=createPopulationRuntime({config,worldContext:{districts:[{id:'actual-synthetic-district',x:0,z:0}]}});
  try{
   await runtime.ready;runtime.pause();const id=runtime.getSnapshot().visibleAgents[0].id;
   const initial=await runtime.inspectPerson(id);const ui=mountPersonNeeds({container:document.querySelector('main'),person:initial,paused:true});
   const paused=await runtime.inspectPerson(id);await new Promise(r=>setTimeout(r,300));const held=await runtime.inspectPerson(id);
   await runtime.stepToTime(60);const after=await runtime.inspectPerson(id);ui.update(after,{paused:true});
   await runtime.updateConfig(config);await runtime.stepToTime(60);const replay=await runtime.inspectPerson(id);
   return{initial:initial.needs,paused:paused.needs,held:held.needs,after:after.needs,replay:replay.needs,values:[...document.querySelectorAll('[data-need-value]')].map(n=>({id:n.dataset.needValue,value:n.textContent})),activity:after.needActivity||after.currentActivity};
  }finally{runtime.destroy();}
 });
 expect(Object.keys(result.initial).sort()).toEqual(['energy','fun','hunger','social']);
 expect(result.held).toEqual(result.paused);expect(result.replay).toEqual(result.after);
 expect(result.after.energy).toBeGreaterThan(result.initial.energy);
 for(const row of result.values)expect(Number(row.value)).toBe(Math.round(result.after[row.id]));
 for(const value of Object.values(result.after)){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(100);}
 console.log('ACTUAL_WORKER_NEEDS_REPLAY',JSON.stringify(result));
});
