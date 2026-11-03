import {test,expect} from '@playwright/test';
import {openEditableHouse,houseState} from './house-edit-fixture.js';

test('live radial buttons retain identity across clock ticks and queue the clicked object',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const fixture=await openEditableHouse(page,{withTV:true});
 await page.locator(`[data-roster] [data-person-id="${fixture.personId}"]`).click();
 const autonomy=page.getByRole('button',{name:'Toggle autonomy',exact:true});
 if(await autonomy.getAttribute('aria-pressed')==='true')await autonomy.click();
 const before=await houseState(page),couch=before.household.house.objects.find(object=>object.type==='couch');
 await page.locator('[data-resume]').click();
 const point=await page.evaluate(id=>hblHouseSession.getSceneDebug().objectScreenPositions.find(point=>point.id===id),couch.id);
 await page.mouse.click(point.x,point.y);
 const menu=page.getByRole('dialog',{name:'Household requests'}),sit=menu.getByRole('button',{name:'Sit here',exact:true});
 await expect(menu.locator('[data-request-execution]')).toHaveValue('queue');
 await expect(sit).toBeEnabled();
 const original=await sit.elementHandle();
 await expect.poll(async()=>(await houseState(page)).snapshot.minute).toBeGreaterThan(before.snapshot.minute+2);
 expect(await sit.evaluate((node,original)=>node===original,original)).toBe(true);
 await expect(sit).toBeEnabled();
 await expect(menu).not.toContainText('Checking…');
 // Hold the mouse down through another live refresh: pointer-up must reach the same button.
 await sit.hover();await page.mouse.down();
 const minute=(await houseState(page)).snapshot.minute;
 await expect.poll(async()=>(await houseState(page)).snapshot.minute).toBeGreaterThan(minute);
 await page.mouse.up();
 await expect(menu).toBeHidden();
 await expect.poll(async()=>{const state=await houseState(page);return state.household.house.actions.some(action=>action.type==='sitAtSeat'&&action.objectId===couch.id);}).toBe(true);
 expect(errors).toEqual([]);
});

test('simultaneous hug and cuddle checks share a checkpoint and both reach consent',async({page})=>{
 const {openPairHouse}=await import('./house-pair-fixture.js');
 const fixture=await openPairHouse(page),menu=page.getByRole('dialog',{name:'Household requests'}),consent=page.locator('.house-consent-dialog');
 await page.locator(`[data-roster] [data-person-id="${fixture.ids[0]}"]`).click();
 await page.evaluate(()=>{
  const runtime=hblHouseSession.getRuntime(),original=runtime.exportCheckpoint.bind(runtime);
  window.pairedCheckpointQA={started:0,pending:0,maxPending:0,errors:[]};
  runtime.exportCheckpoint=async(...args)=>{const qa=window.pairedCheckpointQA;qa.started++;qa.pending++;qa.maxPending=Math.max(qa.maxPending,qa.pending);try{const result=await original(...args);await new Promise(resolve=>setTimeout(resolve,30));return result;}catch(error){qa.errors.push(error.message);throw error;}finally{qa.pending--;}};
 });
 const point=await page.evaluate(id=>hblHouseSession.getSceneDebug().personScreenPositions.find(point=>point.id===id),fixture.ids[1]);
 await page.mouse.click(point.x,point.y);
 const hug=menu.getByRole('button',{name:'Share a hug',exact:true}),cuddle=menu.getByRole('button',{name:'Cuddle together',exact:true});
 await expect(hug).toBeVisible();await expect(cuddle).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>pairedCheckpointQA.started>0&&pairedCheckpointQA.pending===0)).toBe(true);
 await expect(hug).toBeEnabled();await expect(cuddle).toBeEnabled();
 await expect(menu).not.toContainText('checkpoint operation is pending');
 expect(await page.evaluate(()=>pairedCheckpointQA.errors)).toEqual([]);
 expect(await page.evaluate(()=>pairedCheckpointQA.maxPending)).toBe(1);
 await hug.click();await expect(consent).toBeVisible();await consent.locator('[data-consent-cancel]').click();
 // Open the same pair again; the independently available cuddle must also reach consent.
 const again=await page.evaluate(id=>hblHouseSession.getSceneDebug().personScreenPositions.find(point=>point.id===id),fixture.ids[1]);
 await page.mouse.click(again.x,again.y);await cuddle.click();await expect(consent).toBeVisible();
 await consent.locator('[data-consent-cancel]').click();
 expect((await houseState(page)).household.house.actions).toHaveLength(0);
 expect(await page.evaluate(()=>pairedCheckpointQA.errors)).toEqual([]);
});
