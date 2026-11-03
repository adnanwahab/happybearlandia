import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';
test('cached page transitions retain the full household and preserve paused state',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await openPairHouse(page);
 const before=await page.evaluate(()=>({minute:hblHouseSession.getRuntime().getSnapshot().minute,household:hblHouseSession.getHouseholdId()}));
 for(let n=0;n<4;n++){await page.evaluate(value=>window.testPersisted=value,n%2===0);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:window.testPersisted})));
  await expect(page.getByRole('button',{name:'Personality and relationships',exact:true})).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:window.testPersisted})));
  await expect.poll(()=>page.evaluate(()=>hblHouseSession.getRuntime().getSnapshot().runtime.paused)).toBe(true);
  await page.setViewportSize({width:n%2?1280:560,height:900});
  await expect(page.locator('[data-house-canvas]')).toBeVisible();
 }
 expect(await page.evaluate(()=>({minute:hblHouseSession.getRuntime().getSnapshot().minute,household:hblHouseSession.getHouseholdId()}))).toEqual(before);
 await page.evaluate(()=>hblHouseSession.getRuntime().resume());
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:window.testPersisted})));
 expect(await page.evaluate(()=>hblHouseSession.getRuntime().getSnapshot().runtime.paused)).toBe(true);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:window.testPersisted})));
 await expect.poll(()=>page.evaluate(()=>hblHouseSession.getRuntime().getSnapshot().runtime.paused)).toBe(false);
 await page.evaluate(()=>hblHouseSession.getRuntime().pause());await expect(page.locator('[data-house-canvas]')).toBeVisible();expect(errors).toEqual([]);
});
