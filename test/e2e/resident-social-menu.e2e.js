import {test,expect} from '@playwright/test';

async function fixture(page){
 await page.route('**/resident-social-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="inspect"></main><canvas width="800" height="500"></canvas></body></html>'}));
 await page.goto('/resident-social-fixture');
 await page.evaluate(async()=>{
  const {mountPersonCommands}=await import('/world/people/person-command-menu.js');
  window.socialCalls=[];window.socialReads=0;window.socialFailure=false;window.socialEmpty=false;window.socialActor={id:'actual-a',label:'Avery',mode:'legacy',householdId:'home-a'};
  window.residentMenu=mountPersonCommands({container:document.body,canvas:document.querySelector('canvas'),getSelection:()=>socialActor,toGround:()=>null,onWalk:()=>{},getSocial:async actor=>{socialReads++;if(socialFailure)throw Error('Resident inspection unavailable');return {personId:actor.id,adult:true,radius:40,meetingAvailable:true,nearby:socialEmpty?[]:[{id:'actual-b',name:'Blair',adult:true,householdId:'home-b',distance:8},{id:'actual-child',name:'Charlie',adult:false,householdId:'home-b',distance:12}]};},onSocial:async(actor,target,action)=>{socialCalls.push({actor:actor.id,target,action});return{text:'Avery and Blair caught up. A shared memory was recorded.'};}});
 });
}
test('Social button offers actual nearby residents and retains encounter feedback',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Social…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Person actions'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox',{name:'Nearby resident'})).toContainText('Blair · 8 m');
 await dialog.getByRole('combobox',{name:'Nearby resident'}).selectOption('actual-child');await expect(dialog.getByRole('button',{name:'Flirt',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Promise a park meetup',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Talk',exact:true})).toBeEnabled();
 await dialog.getByRole('combobox',{name:'Nearby resident'}).selectOption('actual-b');await dialog.getByRole('button',{name:'Talk',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('Avery and Blair caught up');expect(await page.evaluate(()=>socialCalls)).toEqual([{actor:'actual-a',target:'actual-b',action:'talk'}]);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:'Social…',exact:true})).toBeFocused();
});
test('empty and failed inspections offer refresh and retry without sending an action',async({page})=>{
 await fixture(page);await page.evaluate(()=>{socialEmpty=true;});await page.getByRole('button',{name:'Social…',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Person actions'});await expect(dialog.getByRole('status')).toContainText('Nobody nearby');await expect(dialog.getByRole('button',{name:'Refresh nearby residents'})).toBeEnabled();
 await page.evaluate(()=>{socialFailure=true;});await dialog.getByRole('button',{name:'Refresh nearby residents'}).click();await expect(dialog.getByRole('status')).toHaveText('Resident inspection unavailable');await page.evaluate(()=>{socialFailure=false;socialEmpty=false;});await dialog.getByRole('button',{name:'Try again'}).click();await expect(dialog.getByRole('combobox',{name:'Nearby resident'})).toBeVisible();expect(await page.evaluate(()=>socialCalls)).toEqual([]);
});
test('a late social inspection cannot reopen a dismissed menu',async({page})=>{
 await fixture(page);await page.evaluate(()=>{socialFailure=false;residentMenu.destroy();});
 await page.evaluate(async()=>{const{mountPersonCommands}=await import('/world/people/person-command-menu.js');window.lateMenu=mountPersonCommands({container:document.body,canvas:document.querySelector('canvas'),getSelection:()=>socialActor,getSocial:()=>new Promise(resolve=>window.resolveSocial=resolve)});});
 await page.getByRole('button',{name:'Social…',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Person actions'});await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.evaluate(()=>resolveSocial({personId:'actual-a',nearby:[]}));await expect(dialog).toBeHidden();
});
test('failed encounter is visible and allows retry using refreshed eligibility',async({page})=>{
 await fixture(page);await page.evaluate(()=>{residentMenu.destroy();});
 await page.evaluate(async()=>{const{mountPersonCommands}=await import('/world/people/person-command-menu.js');window.retryMenu=mountPersonCommands({container:document.body,canvas:document.querySelector('canvas'),getSelection:()=>socialActor,getSocial:async()=>({personId:'actual-a',adult:true,radius:40,meetingAvailable:false,nearby:[{id:'actual-child',name:'Charlie',adult:false,distance:2}]}),onSocial:async()=>{throw Error('Give them five game minutes before another encounter.');}});});
 await page.getByRole('button',{name:'Social…',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Person actions'});await dialog.getByRole('button',{name:'Talk',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('five game minutes');await expect(dialog.getByRole('button',{name:'Flirt',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Promise a park meetup',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Talk',exact:true})).toBeEnabled();
});
