import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';

test('original household toolbar exposes actions and opens existing panels',async({page})=>{
 await page.setViewportSize({width:1896,height:1100});
 await openPairHouse(page);
 const nav=page.locator('.house-top-actions');
 for(const label of ['Saved houses','Furnish','Edit house','Watch a day','Invite Sims','Party','Create household','Cause trouble','Tonight','More','Family','Progression','Save','City','Sound: Off','Soundboard','Moments','Wants & stories','Resident plans']){
  await expect(nav.getByText(label,{exact:false}).first()).toBeVisible();
 }
 await expect(nav.locator('.house-main-menu')).toHaveCount(0);
 for(const selector of ['[data-progression]','[data-family]','[data-resident-plans]']){
  await nav.locator(selector).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.locator('dialog[open]').evaluate(dialog=>dialog.close());
 }
 await page.screenshot({path:'/private/tmp/hbl-restored-toolbar.png'});
});
