import {test,expect} from '@playwright/test';
test('keyboard opt-in captions retain evidence in reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/life-caption-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/world/house/house.css"><main></main>'}));
 await page.goto('/life-caption-fixture');
 await page.evaluate(async()=>{
  const {mountHouseUI}=await import('/world/house/house-ui.js');
  window.captionData={home:{householdId:'fixture-h0',members:[],rooms:[],objects:[],completedActions:[{id:'action-1',type:'clean',completedMinute:40}]},members:[],minute:40,paused:true,events:[{id:'fixture-event-1',type:'HOUSEHOLD_ACTION_COMPLETED',synthetic:true,schemaVersion:'event.v2',modelVersion:'fixture.v1',tick:40,householdId:'fixture-h0',actionId:'action-1',actionType:'clean',minute:40,actualPersonMinutes:10}]};
  window.captionUI=mountHouseUI(document.querySelector('main'),{});captionUI.update(captionData);
 });
 await page.getByRole('button',{name:'Open household activity'}).click();
 const toggle=page.getByRole('checkbox',{name:'Lighthearted captions'}),output=page.locator('[data-life-captions]');
 await expect(toggle).not.toBeChecked();await expect(output).toBeEmpty();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-553-captions-before.png'});
 await toggle.focus();await page.keyboard.press('Space');
 await expect(output).toContainText('Dust has left the chat');await expect(output).toContainText('Narrative color · synthetic household · Event fixture-event-1');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-553-captions-after.png'});
 await page.evaluate(()=>{captionData.events=[];captionUI.update(captionData);});
 await expect(output).toContainText('No supported completed actions');
 await page.keyboard.press('Space');await expect(output).toBeEmpty();
});
