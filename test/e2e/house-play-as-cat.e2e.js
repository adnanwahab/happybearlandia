import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';
test('cat can walk, jump, switch to first person and exit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await openPairHouse(page);
 await page.getByRole('button',{name:'🐈 Cat first-person',exact:true}).click();
 const panel=page.locator('[data-cat-play]');await expect(panel).toBeVisible();
 const debug=()=>page.evaluate(()=>document.querySelector('.house-stage-3d').houseScene.getDebugState());
 const before=await debug();
 await expect.poll(async()=>(await debug()).catPlay.firstPerson).toBe(true);
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
 await panel.getByRole('button',{name:'Jump',exact:true}).click();await expect.poll(async()=>(await debug()).catPlay.height).toBeGreaterThan(.1);
 await expect.poll(async()=>(await debug()).catPlay.height).toBe(0);
 await panel.getByRole('button',{name:'Meow',exact:true}).click();await expect(panel).toContainText('investigates');
 await page.keyboard.press('Escape');await expect(panel).toBeHidden();expect((await debug()).camera.mode).toBe('dollhouse');expect(before.catPlay.active).toBeTruthy();expect(errors).toEqual([]);
});
