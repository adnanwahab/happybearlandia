import {test,expect} from '@playwright/test';
test('resident profile shows a personal wish and its saved completion',async({page})=>{
 await page.route('**/wishes-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><main id="fixture"></main></body></html>'}));
 await page.goto('/wishes-fixture');
 await page.evaluate(async()=>{
  const {createPopulationModel,inspectHousehold,stepPopulation}=await import('/world/population/model.js');
  const {configureHouseLife,applyHouseholdAction}=await import('/world/house/model.js');
  const {mountHouseUI}=await import('/world/house/house-ui.js');
  const m=createPopulationModel({population:4,householdSize:4,seed:42},{buildings:[{id:'home',kind:'home',center:[0,0]}]},{initialMinute:600,initialTick:600});
  for(let i=0;i<4;i++){m.people.ageYears[i]=30;m.people.age[i]=1;m.people.employed[i]=0;m.people.remaining[i]=0;m.people.current[i]=m.people.home[i];m.people.x[i]=m.people.homeX[i];m.people.z[i]=m.people.homeZ[i];m.people.energy[i]=m.people.hunger[i]=90;m.people.parent1[i]=m.people.parent2[i]=-1;}m.social.ties={};
  const h=m.prefix+'-h0',personId=m.prefix+'-p0';configureHouseLife(m,{householdId:h,enabled:true,autonomy:false});const ui=mountHouseUI(document.querySelector('#fixture'),{});
  const repaint=()=>{const hh=inspectHousehold(m,0);ui.update({household:hh,home:hh.house,members:hh.house.members,selectedPersonId:personId,minute:m.minute,paused:true});};
  window.finishWish=()=>{applyHouseholdAction(m,{householdId:h,personId,type:'read'});stepPopulation(m,{minutes:30});repaint();};repaint();
 });
 await page.getByRole('button',{name:'Personality and relationships',exact:true}).click();
 await expect(page.locator('[data-household-wish]')).toContainText('Get lost in a good book');
 await page.evaluate(()=>finishWish());
 await expect(page.locator('[data-household-wish]')).toContainText('Wish fulfilled');
 await expect(page.locator('[data-household-wish]')).toContainText('Feeling accomplished');
});
