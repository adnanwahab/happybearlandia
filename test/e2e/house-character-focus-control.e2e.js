import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';
test('focus remains usable after real worker saves and live profile refreshes',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await openPairHouse(page);
 await page.getByRole('button',{name:'Personality and relationships',exact:true}).click();const focus=page.getByLabel('Character focus');
 for(const value of ['creativity','learning','love','fitness','career','friendship','home','relaxation','balanced']){
  await expect(focus).toBeEnabled();await focus.selectOption(value);await expect(focus).toBeEnabled();await expect(focus).toHaveValue(value);
  expect(await page.evaluate(async()=>{const s=hblHouseSession,h=await s.getRuntime().inspectHousehold(s.getHouseholdId());return h.house.systems['character-focus'].members[h.members[0]].focus;})).toBe(value);
 }
 await focus.focus();await focus.evaluate(node=>window.originalFocusControl=node);await page.evaluate(()=>hblHouseSession.refresh());expect(await focus.evaluate(node=>node===window.originalFocusControl)).toBe(true);await expect(focus).toBeEnabled();
 await focus.blur();await page.getByRole('button',{name:'Close household panel',exact:true}).click();await page.getByRole('button',{name:'Personality and relationships',exact:true}).click();await expect(focus).toHaveValue('balanced');await expect(focus).toBeEnabled();expect(errors).toEqual([]);
});
