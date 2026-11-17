import {test,expect} from '@playwright/test';
test('seed 42 resident dialogue renders only real replay-log IDs and opens their exact records',async({page})=>{
 await page.route('**/event-dialogue-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/world/house/house.css"></head><body></body></html>'}));
 await page.goto('/event-dialogue-fixture');
 await page.evaluate(async()=>{
  const {createPopulationModel,stepPopulation,inspectHousehold}=await import('/world/population/model.js');
  const {configureHouseLife,applyHouseholdAction}=await import('/world/house/model.js');
  const {mountHouseUI}=await import('/world/house/house-ui.js');
  const model=createPopulationModel({population:8,householdSize:4,seed:42},{},{initialMinute:1080,initialTick:1080}),householdId=model.prefix+'-h0';
  configureHouseLife(model,{householdId,autonomy:false});
  for(let i=0;i<4;i++){model.people.ageYears[i]=30;model.people.current[i]=model.people.home[i];model.people.x[i]=model.people.homeX[i];model.people.z[i]=model.people.homeZ[i];model.people.remaining[i]=0;model.people.employed[i]=0;}
  const action=applyHouseholdAction(model,{householdId,personId:model.prefix+'-p0',type:'rest'});
  for(let i=0;i<120&&!model.houses.homes[0].completedActions.some(a=>a.id===action.actionId);i++)stepPopulation(model,{minutes:1});
  const household=inspectHousehold(model,0),host=document.createElement('main');document.body.append(host);
  window.dialogueUI=mountHouseUI(host,{});window.dialogueData={household,home:household.house,members:household.house.members,minute:model.minute,paused:true};
  dialogueUI.update(dialogueData);
 });
 await page.getByRole('button',{name:'Open household activity'}).click();
 const lines=page.locator('[data-dialogue-event-id]');expect(await lines.count()).toBeGreaterThan(0);
 const initial=await lines.allTextContents();
 const invalid=await page.evaluate(()=>[...document.querySelectorAll('[data-dialogue-event-id]')].filter(node=>!dialogueData.home.systems.story.events.some(event=>event.id===node.dataset.dialogueEventId)).length);
 expect(invalid).toBe(0);
 await lines.first().click();
 const id=await lines.first().getAttribute('data-dialogue-event-id');
 await expect(page.locator('[data-dialogue-source-id="'+id+'"]')).toBeVisible();
 await page.evaluate(()=>dialogueUI.update(dialogueData));expect(await lines.allTextContents()).toEqual(initial);
 await expect(page.locator('[data-dialogue-source-id="'+id+'"]')).toBeVisible();
 await page.evaluate(()=>{for(const event of dialogueData.home.systems.story.events)delete event.id;dialogueUI.update(dialogueData);});
 await expect(lines).toHaveCount(0);
});
