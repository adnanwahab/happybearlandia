import {test,expect} from '@playwright/test';
test('Bladder shortcut targets the installed toilet and explains a missing fixture',async({page})=>{
 await page.setViewportSize({width:1600,height:1100});
 await page.route('**/toilet-ui-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('/toilet-ui-fixture');
 await page.evaluate(async()=>{
  const {mountHouseUI}=await import('/world/house/house-ui.js');
  const host=document.createElement('main');document.body.append(host);
  window.calls=[];window.ui=mountHouseUI(host,{householdId:'h0',onAction:(entry,request)=>calls.push({type:entry.command.type,request}),getAvailability:async()=>({available:true})});
  const person={id:'p0',name:'Sam',atHome:true,ageYears:30,needs:{hunger:80,energy:80,fun:80,social:80,bladder:15}};
  window.state={selectedPersonId:'p0',household:{id:'h0'},members:[person],home:{rooms:[{id:'bathroom',label:'Bathroom'}],objects:[{id:'installed-wc',type:'toilet',roomId:'bathroom'}],members:[person],actions:[]},actions:[{id:'toilet',label:'Use the toilet',supported:true,command:{type:'toilet'}}],minute:360,paused:true};ui.update(state);
 });
 const button=page.getByRole('button',{name:'Use toilet to relieve bladder',exact:true});
 await expect(button).toBeEnabled();await button.click();
 expect(await page.evaluate(()=>calls)).toEqual([{type:'toilet',request:{execution:'now',personId:'p0',roomId:'bathroom',objectId:'installed-wc'}}]);
 await page.evaluate(()=>{state.home.objects=[];ui.update(state);});
 await expect(button).toBeDisabled();await expect(page.getByText('Furnish → Bathroom → Toilet',{exact:true})).toBeVisible();
});
