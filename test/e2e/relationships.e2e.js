import {test,expect} from '@playwright/test';
test('real population worker retains reciprocal encounters across selection replay and renders actions',async({page})=>{
 await page.route('**/__relationships-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__relationships-test');
 const result=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');const {renderRelationships}=await import('/world/relationships/panel.js');
  const runtime=createPopulationRuntime({config:{population:40,seed:42},stepMinutes:1});
  window.socialTestRuntime=runtime;
   await runtime.ready;const a=await runtime.inspectPerson(runtime.getSnapshot().visibleAgents[0].id),b=a.social.nearby[0];const encounter=await runtime.socialAction(a.id,b.id,'gossip');
   await runtime.step();const other=await runtime.inspectPerson(b.id);const again=await runtime.inspectPerson(a.id);
   renderRelationships(document.querySelector('main'),again.social,{onInteract:(target,action)=>runtime.socialAction(a.id,target,action)});
   return{a:a.id,b:b.id,encounter,other:other.social,again:again.social};
 });
 expect(result.other.relationships.find(r=>r.id===result.a).memories[0].text).toBe(result.encounter.text);
 expect(result.again.relationships.find(r=>r.id===result.b).memories).toHaveLength(1);
 await expect(page.getByRole('heading',{name:'Relationships',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Nearby character'})).toBeVisible();
 await page.getByRole('button',{name:'Share gossip',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('five game minutes');
 await page.screenshot({path:'/private/tmp/hbl-relationships.png'});
 await page.evaluate(()=>window.socialTestRuntime.destroy());
});

test('clicking a legacy city resident opens relationships and nearby social actions',async({page})=>{
 test.setTimeout(120000);
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.prepareSocialCity=()=>{const a=world.people[0],b=world.people[1];b.x=a.x;b.z=a.z;a.mode='doing';b.mode='doing';select({type:'person',id:0});};`});});
 await page.goto('/world?demo=1&people=10&renderer=webgl&quality=LOW&business_mode=true');
 await page.waitForFunction(()=>Boolean(window.prepareSocialCity),null,{timeout:60000});await page.getByRole('button',{name:'Pause',exact:true}).click();await page.evaluate(()=>window.prepareSocialCity());
 const panel=page.locator('#inspect');await expect(panel.getByRole('heading',{name:'Relationships',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Talk',exact:true}).click();await expect(panel.locator('section').last().getByRole('status').first()).toContainText(/caught up|misunderstood|awkward moment/);
 await page.screenshot({path:'/private/tmp/hbl-city-relationships.png'});
});
