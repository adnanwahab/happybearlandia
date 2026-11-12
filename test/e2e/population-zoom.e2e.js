import {test,expect} from '@playwright/test';
test.use({video:'on'});
test('City Deck zoom freezes evidence, reverses and inspects actual identity',async({page})=>{
 await page.goto('/world/bench/people');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main style="width:420px;margin:20px"></main>';
  const {createPopulationRuntime}=await import('/world/population/runtime.js');
  const {mountCityDeck}=await import('/world/population/city-deck.js');
  const runtime=createPopulationRuntime({config:{population:80,representedPopulation:1000000,seed:42}});await runtime.ready;runtime.pause();window.zoomRuntime=runtime;
  window.zoomFrame=runtime.getSnapshot();window.zoomDeck=mountCityDeck({container:document.querySelector('main'),getRuntime:()=>runtime,getRows:()=>zoomFrame.visibleAgents,onInspect:async id=>{window.inspected=(await runtime.inspectPerson(id)).id;},onLayer(){},onFilter(){},onOverview(){},onDistrict(){}});zoomDeck.setActive(true);zoomDeck.update(zoomFrame);
 });
 await page.screenshot({path:'/private/tmp/she-162-before.png'});
 await page.getByText('City → district → resident',{exact:true}).click();
 const count=page.locator('[data-zoom-count]');await expect(count).toContainText('1,000,000 represented');
 await page.getByRole('button',{name:'District',exact:true}).click();await expect(count).toContainText('Home district');
 await page.getByRole('button',{name:'Resident',exact:true}).click();await expect(count).toContainText('1 simulated resident');await page.waitForTimeout(1000);
 const resident=await count.textContent();
 await page.evaluate(()=>zoomDeck.update({...zoomFrame,metrics:{representedPopulation:2},visibleAgents:[]}));await expect(count).toHaveText(resident);
 await page.locator('[data-zoom-inspect]').click();expect(await page.evaluate(()=>inspected)).toBe(await page.evaluate(async()=>{const {zoomEvidence}=await import('/world/population/zoom.js');return zoomEvidence(zoomFrame).person.id;}));
 await page.screenshot({path:'/private/tmp/she-162-after.png'});
 await page.getByRole('button',{name:'City',exact:true}).click();await expect(count).toContainText('City · 1,000,000');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Resident',exact:true}).click();await expect(page.getByRole('slider',{name:'Population zoom'})).toHaveValue('2');
 await page.evaluate(async()=>{zoomDeck.destroy();zoomRuntime.destroy();HTMLCanvasElement.prototype.getContext=()=>null;const {mountPopulationZoom}=await import('/world/population/zoom.js');window.fallback=mountPopulationZoom({container:document.querySelector('main'),onInspect(){}});fallback.update(zoomFrame);});
 await page.getByText('City → district → resident',{exact:true}).click();await expect(count).toContainText('1,000,000 represented');await expect(page.locator('.lc-zoom canvas')).toBeHidden();
});
