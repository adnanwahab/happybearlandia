import {test,expect} from '@playwright/test';
const canonical='/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline';
const feature=(id,name)=>({id,osmType:'way',osmId:id.slice(1),kind:'building',version:2,timestamp:'2019-01-01T00:00:00Z',tags:{building:'yes',name},geometry:{type:'Polygon',coordinates:[[[139.7,35.659],[139.7002,35.659],[139.7002,35.6592],[139.7,35.659]]]}});
const first=feature('w123','Historical recovery fixture A');
const second=feature('w456','Historical recovery fixture B');
const snapshot=(id='snapshot-A',date='2020-01-01',features=[first])=>({id,date:date+'T00:00:00.000Z',origin:{lat:35.6595,lng:139.7005},radiusM:200,bounds:{west:139.698,east:139.703,south:35.657,north:35.662},features,coverage:{status:'query-complete'},provenance:{historicalGeometry:true,source:'Controlled verification response; not a live public-source observation'}});
const errors=new WeakMap(),diagnostics=new WeakMap();
test.beforeEach(async({page})=>{errors.set(page,[]);diagnostics.set(page,[]);page.on('pageerror',error=>{errors.get(page).push(error.message);diagnostics.get(page).push({type:'pageerror',name:error.name,message:error.message,stack:error.stack});});page.on('console',message=>{if(['warning','error'].includes(message.type()))diagnostics.get(page).push({type:message.type(),text:message.text(),location:message.location()});});});
test.afterEach(async({page},info)=>{
 const found=errors.get(page),runtime=diagnostics.get(page);
 const gpu=runtime.filter(entry=>entry.type==='error'&&/webgpu|GPUValidationError|GPUOutOfMemoryError|gpu device.*lost/i.test(entry.text)).map(entry=>entry.text);
 console.log(JSON.stringify({temporalCase:info.title,pageErrors:found,webgpuErrors:gpu,url:page.url()}));
 await info.attach('javascript-errors',{body:JSON.stringify(found),contentType:'application/json'});
 await info.attach('webgpu-errors',{body:JSON.stringify(gpu),contentType:'application/json'});
 await info.attach('runtime-diagnostics',{body:JSON.stringify(runtime,null,2),contentType:'application/json'});
 expect(found,'uncaught JavaScript errors remain failures').toEqual([]);
 expect(gpu,'WebGPU console errors remain failures').toEqual([]);
});
async function world(page){
 await page.goto(canonical,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.hblTemporalCity&&window.hblWorldStartup?.readyMs),null,{timeout:90000});
 expect(new URL(page.url()).pathname).toBe('/world');await page.getByRole('button',{name:'Time',exact:true}).click();await page.getByRole('button',{name:'Open Time Machine',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'City Time Machine',exact:true});await expect(panel).toBeVisible();return panel;
}
async function fixture(page){
 await page.route('**/__temporal-verification',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__temporal-verification');
 await page.evaluate(async()=>{const{mountTemporalCity}=await import('/world/temporal/panel.js');window.temporalVerification=mountTemporalCity({origin:{lat:35.6595,lng:139.7005}});});await page.getByTestId('temporal-launch').click();return page.getByTestId('temporal-city');
}
// The fixture footprint is a triangle; its bounding-box center is on an edge.
// Resolve a painted interior hit before making a normal native pointer click.
async function clickPaintedFeature(panel,id){
 const path=panel.locator(`[data-feature-id="${id}"] path`).first();
 const position=await path.evaluate(node=>{
  const bounds=node.getBoundingClientRect();
  for(const fy of[.75,.25,.5])for(const fx of[.75,.25,.5]){
   const x=Math.round(bounds.left+bounds.width*fx),y=Math.round(bounds.top+bounds.height*fy);
   if(document.elementFromPoint(x,y)===node)return{x:x-bounds.left,y:y-bounds.top};
  }
  throw Error('No painted pointer target for historical feature');
 });
 await path.click({position});
}
test('normal World canonical entry retries a failed fetch and retains loaded evidence through a later failure',async({page},info)=>{
 let attempt=0;await page.route('**/api/world-history/snapshot?*',route=>{attempt++;if(attempt===1)return route.abort('failed');if(attempt===3)return route.fulfill({status:502,json:{error:'Controlled historical source unavailable'}});return route.fulfill({json:attempt===2?snapshot():snapshot('snapshot-B','2021-01-01',[second])});});
 const panel=await world(page);await expect(panel.locator('[data-map]')).toContainText('Choose a date');await panel.getByLabel('Historical snapshot date').fill('2020-01-01');await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-status]')).toContainText('Check your connection');await expect(panel.locator('[data-map]')).toContainText('Historical map unavailable');await page.screenshot({path:info.outputPath('normal-entry-failed-fetch.png')});
 await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-feature-id="w123"]')).toBeVisible();await clickPaintedFeature(panel,'w123');await expect(panel.locator('[data-detail]')).toContainText(first.tags.name);
 await panel.getByLabel('Historical snapshot date').fill('2021-01-01');await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-status]')).toContainText('Controlled historical source unavailable');await expect(panel.locator('[data-status]')).toContainText('The previous snapshot is still shown');await expect(panel.locator('[data-feature-id="w123"]')).toBeVisible();await expect(panel.locator('[data-counts]')).toContainText('2020-01-01');await expect(panel.locator('[data-detail]')).toContainText(first.tags.name);expect(await page.evaluate(()=>window.hblTemporalCity.getSnapshot().id)).toBe('snapshot-A');await page.screenshot({path:info.outputPath('normal-entry-retained-snapshot.png')});
 await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-feature-id="w456"]')).toBeVisible();await expect(panel.locator('[data-feature-id="w123"]')).toHaveCount(0);await expect(panel.locator('[data-counts]')).toContainText('2021-01-01');expect(attempt).toBe(4);await page.screenshot({path:info.outputPath('normal-entry-retry-recovered.png')});
});
test('normal World close aborts an in-flight snapshot and the reopened retry succeeds',async({page})=>{
 let pending,entered;const intercepted=new Promise(resolve=>entered=resolve);await page.route('**/api/world-history/snapshot?*',route=>{pending=route;entered();});const panel=await world(page);await panel.getByRole('button',{name:'Load date',exact:true}).click();await intercepted;await expect(panel.getByRole('button',{name:'Load date',exact:true})).toBeDisabled();
 const cancelled=page.waitForEvent('requestfailed',{predicate:request=>request.url().includes('/api/world-history/snapshot?')});await panel.getByRole('button',{name:'Close City Time Machine',exact:true}).click();await cancelled;await expect(panel).toBeHidden();expect(await page.evaluate(()=>window.hblTemporalCity.getSnapshot())).toBeNull();await pending.abort('aborted').catch(()=>{});
 await page.unroute('**/api/world-history/snapshot?*');await page.route('**/api/world-history/snapshot?*',route=>route.fulfill({json:snapshot()}));await page.getByRole('button',{name:'Time',exact:true}).click();await page.getByRole('button',{name:'Open Time Machine',exact:true}).click();await expect(panel.getByRole('button',{name:'Load date',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-feature-id="w123"]')).toBeVisible();
});
test('browser API error cases remain actionable and each visible retry recovers',async({page})=>{
 let failure=null;await page.route('**/api/world-history/snapshot?*',route=>failure?route.fulfill(failure):route.fulfill({json:snapshot()}));const panel=await fixture(page);
 for(const [response,message]of [[{status:404,contentType:'text/plain',body:'Not found'},'API is unavailable'],[{status:502,contentType:'text/html',body:'<html>Bad gateway</html>'},'non-JSON response'],[{status:200,contentType:'application/json',body:'not-json'},'invalid JSON'],[{status:200,json:[]},'invalid response']]){
  failure=response;await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-status]')).toContainText(message);await expect(panel.locator('[data-status]')).toHaveAttribute('data-error','true');await expect(panel.getByRole('button',{name:'Load date',exact:true})).toBeEnabled();failure=null;await panel.getByRole('button',{name:'Load date',exact:true}).click();await expect(panel.locator('[data-status]')).toContainText('Loaded');await expect(panel.locator('[data-status]')).toHaveAttribute('data-error','false');
 }
});
test('object-history failure retries through the visible control without changing the loaded snapshot',async({page})=>{
 let attempt=0;await page.route('**/api/world-history/snapshot?*',route=>route.fulfill({json:snapshot()}));await page.route('**/api/world-history/feature?*',route=>++attempt===1?route.abort('failed'):route.fulfill({json:{osmFirstSeen:'2018-01-01',versions:[{version:1,timestamp:'2018-01-01',visible:true}]}}));const panel=await fixture(page);await panel.getByRole('button',{name:'Load date',exact:true}).click();await clickPaintedFeature(panel,'w123');await panel.getByRole('button',{name:'Load full OSM object history',exact:true}).click();await expect(panel.locator('[data-versions]')).toContainText('Check your connection');await expect(panel.getByRole('button',{name:'Load full OSM object history',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'Load full OSM object history',exact:true}).click();await expect(panel.locator('[data-versions]')).toContainText('First mapped version 1: 2018-01-01');expect(await page.evaluate(()=>window.temporalVerification.getSnapshot().id)).toBe('snapshot-A');expect(attempt).toBe(2);
});
