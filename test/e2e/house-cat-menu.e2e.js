import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';

test('cat radial menu starts real petting, treat, play and brushing activities',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await openPairHouse(page);
 const menu=page.getByRole('dialog',{name:'Household requests'});
 for(const [label,type,kind]of [['Pet cat','petPet','pet'],['Feed a treat','petTreat','treat'],['Play with cat','petPlay','play'],['Brush cat','petBrush','brush']]){
  await page.locator('[data-house-pet]').click();await expect(menu).toBeVisible();
  await expect(menu.locator('.house-radial-action')).toHaveCount(4);await expect(menu.locator('[data-menu-actions]')).not.toContainText('Add to queue');
  await menu.getByRole('button',{name:label,exact:true}).click();await expect(menu).toBeHidden();
  await expect.poll(()=>page.evaluate(async type=>{const s=hblHouseSession,h=await s.getRuntime().inspectHousehold(s.getHouseholdId());return h.house.actions.some(a=>a.type===type);},type)).toBe(true);
  await page.evaluate(async type=>{const s=hblHouseSession,r=s.getRuntime(),h=await r.inspectHousehold(s.getHouseholdId()),action=h.house.actions.find(a=>a.type===type);await r.observeHousehold({householdId:s.getHouseholdId(),minutes:action.until-r.getSnapshot().minute});await s.refresh();},type);
  const pet=await page.evaluate(async()=>{const s=hblHouseSession;return(await s.getRuntime().inspectHousehold(s.getHouseholdId())).house.pets[0];});
  if(kind==='pet')expect(pet.pettingMinutes).toBe(15);else expect(pet.interactions[kind].count).toBe(1);
 }
 await page.locator('[data-house-pet]').click();await page.screenshot({path:'/private/tmp/hbl-cat-radial-menu.png'});await page.keyboard.press('Escape');await expect(menu).toBeHidden();
 expect(errors).toEqual([]);await page.screenshot({path:'/private/tmp/hbl-cat-actions.png'});
});
