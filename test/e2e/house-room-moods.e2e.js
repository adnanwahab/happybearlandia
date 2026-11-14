import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
test('keyboard mood selection persists, resets and exposes unavailable lighting and muted sound',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/room-mood-fixture',r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/world/house/house.css"></head><body><main id="fixture"></main></body></html>'}));
 await page.route('**/world/house/room-moods*.js',r=>r.fulfill({path:resolve('world/house',new URL(r.request().url()).pathname.split('/').at(-1)),contentType:'text/javascript'}));
 await page.route('**/world/house/house.css',r=>r.fulfill({path:resolve('world/house/house.css'),contentType:'text/css'}));
 await page.goto('/room-mood-fixture');
 await page.evaluate(async()=>{const {mountRoomMoods}=await import('/world/house/room-moods-ui.js');window.mount=()=>mountRoomMoods(document.querySelector('main'),{getScene:()=>null,getRooms:()=>[{id:'living',label:'Living room'},{id:'bedroom',label:'Bedroom'}],scope:'disposable-test',previewSound:async()=>false});window.moods=window.mount();});
 await page.screenshot({path:testInfo.outputPath('before.png')});
 const button=page.getByRole('button',{name:'Room moods',exact:true});await button.focus();await page.keyboard.press('Enter');
 const select=page.getByRole('combobox',{name:'Living room mood'});await select.focus();await page.keyboard.press('c');await page.keyboard.press('Tab');await expect(select).toHaveValue('cozy');
 await page.getByRole('button',{name:'Preview room sound'}).click();await expect(page.getByRole('status')).toContainText('muted');
 await page.screenshot({path:testInfo.outputPath('after.png')});await page.keyboard.press('Escape');await expect(button).toBeFocused();
 await page.evaluate(()=>{moods.destroy();moods=mount();});await button.click();await expect(select).toHaveValue('cozy');await expect(page.getByRole('combobox',{name:'Bedroom mood'})).toHaveValue('default');await expect(page.getByRole('status')).toContainText('Lighting unavailable');
 await page.getByRole('button',{name:'Restore all room defaults'}).click();await expect(select).toHaveValue('default');
});
