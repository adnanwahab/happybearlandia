import {test,expect} from '@playwright/test';
test('house need chip opens unknown history and keyboard source inspection in reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/need-ui-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('/need-ui-fixture');
 await page.evaluate(async()=>{
  const {mountHouseUI}=await import('/world/house/house-ui.js');
  const host=document.createElement('main');document.body.append(host);
  window.ui=mountHouseUI(host,{householdId:'fixture-h0'});
  const person={id:'fixture-p0',name:'Sam',atHome:true,needs:{hunger:40,energy:80,fun:80,social:80},needRates:{hunger:-.1}};
  window.state={selectedPersonId:person.id,household:{id:'fixture-h0'},members:[person],home:{members:[person],rooms:[],objects:[],actions:[]},actions:[],minute:360,paused:true};ui.update(state);
 });
 const chip=page.getByRole('button',{name:'Why Food?',exact:true});
 await chip.focus();await page.keyboard.press('Enter');
 await expect(page.locator('[data-why]')).toContainText('Unknown: retained history');
 const source=page.getByRole('link',{name:'Inspect current rate source'});
 await source.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#house-need-source-hunger')).toHaveAttribute('open','');
 await expect(page.locator('#house-need-source-hunger')).toContainText('fixture-p0');
 await page.evaluate(()=>ui.update(state));
 await expect(page.locator('[data-why]')).toContainText('Unknown: retained history');
 await page.getByRole('button',{name:'Browse actions for Food'}).click();
 await expect(page.locator('[data-drawer-title]')).toHaveText('Give a request');
});
