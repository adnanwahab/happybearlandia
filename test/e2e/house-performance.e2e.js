import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';

test('saved-home links reuse their record and paused scenes stop doing frame work',async({page})=>{
 const fixture=await openPairHouse(page),homeId='home_01234567890123456789';
 let originalFetches=0;
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/world-experiments/pairqa01')originalFetches++;});
 await page.route('**/api/world-homes/'+homeId,route=>route.fulfill({json:{home:{householdId:fixture.householdId},record:{schemaVersion:'world-experiment-record.v1',id:'pairqa01',save:fixture.save}}}));
 await page.goto('/world/house/'+fixture.householdId+'?home='+homeId);
 await page.waitForFunction(()=>window.hblHouseSession?.getSceneDebug()?.frameCount>0);
 expect(originalFetches).toBe(0);
 await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>hblHouseSession.getSceneDebug().frameCount);
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>hblHouseSession.getSceneDebug().frameCount)).toBe(before);
 await page.getByRole('button',{name:'Family',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Family tree and life'})).toBeVisible();
});

test('checkpoint validation runs in a worker while UI timers keep responding',async({page})=>{
 const fixture=await openPairHouse(page);
 const result=await page.evaluate(async fixture=>{
  const {houseCheckpointTask}=await import('/world/house/checkpoint-client.js');
  let pulses=0;const timer=setInterval(()=>pulses++,0);
  try{
   const prepared=await houseCheckpointTask({kind:'prepare',save:fixture.save,householdId:fixture.householdId});
   let rejected=false;try{await houseCheckpointTask({kind:'prepare',save:fixture.save,householdId:'wrong-city-h0'});}catch{rejected=true;}
   return{pulses,rejected,members:prepared.entry.members,hasModel:Object.hasOwn(prepared,'model')};
  }finally{clearInterval(timer);}
 },fixture);
 expect(result.pulses).toBeGreaterThan(0);expect(result.rejected).toBe(true);
 expect(result.members).toEqual(fixture.ids);expect(result.hasModel).toBe(false);
});
