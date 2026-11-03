import {test,expect} from '@playwright/test';
import {openPairHouse} from './house-pair-fixture.js';
test('lost graphics retain controls and restore without reloading the household',async({page})=>{
 await openPairHouse(page);const before=await page.evaluate(()=>hblHouseSession.getRuntime().getSnapshot().minute);
 await page.evaluate(()=>document.querySelector('[data-house-canvas]').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.locator('[data-house-scene-recovery]')).toBeVisible();await expect(page.getByRole('button',{name:'Personality and relationships',exact:true})).toBeVisible();
 await page.evaluate(()=>document.querySelector('[data-house-canvas]').dispatchEvent(new Event('webglcontextrestored')));
 await expect(page.locator('[data-house-scene-recovery]')).toBeHidden();expect(await page.evaluate(()=>hblHouseSession.getRuntime().getSnapshot().minute)).toBe(before);
});
test('an interrupted empty page offers recovery instead of a blank screen',async({page})=>{
 await page.route('**/screen-guard-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main id="house-app"><p>Loading</p></main>'}));await page.goto('/screen-guard-fixture');await page.evaluate(async()=>{const {guardHouseScreen}=await import('/world/house/screen-guard.js');guardHouseScreen(document.querySelector('#house-app'));document.querySelector('#house-app').replaceChildren();});await expect(page.getByRole('button',{name:'Restore saved household'})).toBeVisible();await expect(page.getByRole('link',{name:'Saved homes',exact:true})).toBeVisible();
});
test('startup module failure has an independent visible recovery shell',async({page})=>{
 await page.route('**/world/house/app.js',route=>route.abort());await page.goto('/world/house');await expect(page.getByRole('button',{name:'Restore saved household'})).toBeVisible();await expect(page.getByText('The household could not finish loading. Your saved progress has not been replaced.')).toBeVisible();
});
