import {test,expect} from '@playwright/test';
test('offsite date removes the resident from the selectable house scene while home dates stay present',async({page})=>{
 await page.setViewportSize({width:1200,height:850});
 await page.route('**/presence-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><main style="height:850px"></main></body></html>'}));
 await page.goto('/presence-fixture');await page.evaluate(async()=>{
  const {mountHouseRenderer}=await import('/world/house/house-renderer.js');
  window.scene=mountHouseRenderer(document.querySelector('main'));
  window.person={id:'p0',name:'Ama',ageYears:30,atHome:true,roomId:'living'};
  window.view={paused:true,members:[person],home:{rooms:[{id:'living',label:'Living',capacity:3}],objects:[],actions:[]}};
  scene.update(view,{selectedPersonId:'p0'});await scene.ready;
 });
 await expect.poll(()=>page.evaluate(()=>scene.getDebugState().visiblePersonIds)).toEqual(['p0']);
 await page.evaluate(()=>{person.date={id:'date0',venue:{kind:'restaurant'}};view.paused=false;scene.update(view,{selectedPersonId:'p0'});});
 await expect.poll(()=>page.evaluate(()=>scene.getDebugState().visiblePersonIds)).toEqual([]);
 await expect(page.locator('[data-house-person="p0"]')).toHaveCount(0);
 await page.evaluate(()=>{person.date={id:'date1',venue:{kind:'home'}};scene.update(view,{selectedPersonId:'p0'});});
 await expect.poll(()=>page.evaluate(()=>scene.getDebugState().visiblePersonIds)).toEqual(['p0']);
 await expect(page.locator('[data-house-person="p0"]')).toBeVisible();
 await page.evaluate(()=>{view.paused=true;view.home.systems={evening:{active:{id:'episode-visible',evidence:[],lastReaction:null}}};scene.update(view);const episode=view.home.systems.evening.active;episode.evidence=[{actionId:'real-joke',type:'conversation',exchangeKind:'joke',personIds:['p0','p1'],durationMinutes:15,attendedPersonMinutes:30,relationshipEvent:'shared-interest'}];episode.lastReaction={sourceActionId:'real-joke',status:'completed',relationshipEvent:'shared-interest',text:'They found something in common.'};scene.update(view);});
 expect(await page.evaluate(()=>scene.getDebugState().personScreenPositions[0].eveningReaction)).toMatchObject({kind:'laugh',actionId:'real-joke'});
 await page.evaluate(()=>scene.update(view));
 expect(await page.evaluate(()=>scene.getDebugState().personScreenPositions[0].eveningReaction.id)).toBe('episode-visible:real-joke');
});
