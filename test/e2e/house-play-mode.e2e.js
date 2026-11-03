import {test,expect} from '@playwright/test';

// Exercise the actual WebGL scene and population worker. Only persistence uses
// an isolated record, so gameplay checks never alter a user's saved household.
test('house play mode renders real residents, accepts requests, and preserves pause and needs',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/routes');
 const fixture=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');
  const runtime=createPopulationRuntime({config:{population:20,householdSize:4,employmentRate:0,seed:42},initialMinute:540,stepMinutes:1,clockMode:'minutes-per-second'});
  try{await runtime.ready;const householdId=runtime.getSnapshot().households[0].id,household=await runtime.inspectHousehold(householdId),checkpoint=await runtime.exportCheckpoint();return{householdId,members:household.members,record:{schemaVersion:'world-experiment-record.v1',id:'houseplay001',url:'/world?experiment=houseplay001',save:{schemaVersion:'world-experiment-save.v1',label:'House play fixture',mode:'living',checkpoint,view:{origin:{lat:29.7286,lng:-95.4746},playback:{paused:true,speed:1}},geometry:{area:{source:'none'}}}}};}finally{runtime.destroy();}
 });
 await page.route('**/api/world-experiments/houseplay001',route=>route.fulfill({json:fixture.record}));
 await page.goto('/world/house/'+fixture.householdId+'?experiment=houseplay001');
 await expect(page.locator('canvas[data-house-canvas]')).toBeVisible();
 await page.waitForFunction(()=>{const scene=document.querySelector('.house-stage-3d')?.houseScene;return scene?.getDebugState().frameCount>0;});
 const original=await page.evaluate(async()=>{const session=window.hblHouseSession,runtime=session.getRuntime(),household=await runtime.inspectHousehold(session.getHouseholdId());return{minute:runtime.getSnapshot().minute,household,scene:document.querySelector('.house-stage-3d').houseScene.getDebugState()};});
 expect(original.scene.renderer).toBe('three-webgl');expect(original.scene.visiblePersonIds.sort()).toEqual([...fixture.members].sort());expect(original.scene.paused).toBe(true);await expect(page.locator('[data-open-drawer="details"]')).toHaveCount(0);await expect(page.locator('[data-drawer-section="details"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
 const second=original.scene.personScreenPositions.find(row=>row.id!==fixture.members[0]);expect(second).toBeTruthy();await page.mouse.click(second.x,second.y);
 await expect(page.locator('[data-context-menu]')).toBeVisible();await expect(page.locator('[data-inspector]')).toContainText('Energy');
 await page.waitForFunction(id=>document.querySelector('[data-house-person="'+id+'"]')?.textContent.startsWith('◆ '),second.id);
 await page.locator('[data-menu-close]').click();
 const books=await page.evaluate(()=>document.querySelector('.house-stage-3d').houseScene.getDebugState().objectScreenPositions.find(row=>row.id==='books'));
 await page.mouse.click(books.x,books.y);
 await expect(page.locator('[data-menu-title]')).toHaveText(/^books$/i);await expect(page.locator('[data-menu-activity]')).toContainText('Request for');
 await page.locator('[data-menu-actions]').getByRole('button',{name:/Read/}).click();
 const admitted=await page.evaluate(async()=>{const session=window.hblHouseSession,runtime=session.getRuntime();return{minute:runtime.getSnapshot().minute,household:await runtime.inspectHousehold(session.getHouseholdId())};});
 expect(admitted.minute).toBe(original.minute);expect(admitted.household.house.actions.some(row=>row.type==='read')).toBe(true);
 await page.locator('[data-resume]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblHouseSession.getRuntime().getSnapshot().minute)).toBeGreaterThan(original.minute);
 await page.locator('[data-pause]').click();
 const paused=await page.evaluate(()=>window.hblHouseSession.getRuntime().getSnapshot().minute);
 await page.waitForTimeout(400);expect(await page.evaluate(()=>window.hblHouseSession.getRuntime().getSnapshot().minute)).toBe(paused);
 const final=await page.evaluate(async()=>{const s=window.hblHouseSession;return s.getRuntime().inspectHousehold(s.getHouseholdId());});
 expect(final.members).toEqual(fixture.members);const target=final.memberDetails.find(row=>row.id===second.id),before=original.household.memberDetails.find(row=>row.id===second.id);expect(target.needs.fun).toBeGreaterThan(before.needs.fun);
 // Let the actual reading transition reach its seat before replacing it.
 await page.locator('[data-resume]').click();
 await expect.poll(()=>page.evaluate(id=>{const actor=document.querySelector('.house-stage-3d').houseScene.getDebugState().personScreenPositions.find(row=>row.id===id);return actor?.visualPose==='read'&&actor.motion===null;},second.id),{timeout:30000}).toBe(true);
 await page.locator('[data-pause]').click();
 const beforeSit=await page.evaluate(()=>window.hblHouseSession.getRuntime().getSnapshot().minute);
 const chair=await page.evaluate(()=>document.querySelector('.house-stage-3d').houseScene.getDebugState().seatScreenPositions[0]);
 await page.mouse.click(chair.x,chair.y);await expect(page.locator('[data-menu-title]')).toHaveText(/dining chair/i);
 await page.locator('[data-menu-actions]').getByRole('button',{name:/Sit here/}).click();
 const sitting=await page.evaluate(async()=>{const s=window.hblHouseSession;return{minute:s.getRuntime().getSnapshot().minute,household:await s.getRuntime().inspectHousehold(s.getHouseholdId())};});
 expect(sitting.minute).toBe(beforeSit);const seated=sitting.household.memberDetails.find(row=>row.id===second.id);expect(seated.interaction.objectId).toBe(chair.objectId);expect(seated.interaction.seatIndex).toBe(chair.seatIndex);
 expect(sitting.household.house.actions.some(row=>row.type==='sit')).toBe(true);expect(sitting.household.house.interruptedActions.some(row=>row.type==='read'&&row.personId===second.id)).toBe(true);
 const frozen=await page.evaluate(id=>{const debug=document.querySelector('.house-stage-3d').houseScene.getDebugState();return{time:debug.animationTime,position:debug.personScreenPositions.find(row=>row.id===id).worldPosition};},second.id);
 await page.waitForTimeout(300);expect(await page.evaluate(id=>{const debug=document.querySelector('.house-stage-3d').houseScene.getDebugState();return{time:debug.animationTime,position:debug.personScreenPositions.find(row=>row.id===id).worldPosition};},second.id)).toEqual(frozen);
 await page.locator('[data-resume]').click();
 await expect.poll(()=>page.evaluate(id=>document.querySelector('.house-stage-3d').houseScene.getDebugState().personScreenPositions.find(row=>row.id===id)?.motion,second.id)).not.toBe(null);
 await expect.poll(()=>page.evaluate(id=>{const actor=document.querySelector('.house-stage-3d').houseScene.getDebugState().personScreenPositions.find(row=>row.id===id);return actor?.visualPose==='sit'&&actor.motion===null;},second.id),{timeout:30000}).toBe(true);
 await page.locator('[data-pause]').click();expect(errors).toEqual([]);
});
