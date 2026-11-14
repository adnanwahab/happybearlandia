import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({hasTouch:true});
test('keyboard and touch picker use authority and a static reduced-motion cue without WebGL',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('http://discovery.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/world/house/house.css"><main style="position:relative;height:500px"></main><div class="house-discovery-marker" style="left:200px;top:200px" hidden></div>'});
  return route.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:await readFile('.'+path,'utf8')});
 });
 await page.goto('http://discovery.test/');
 await page.evaluate(async()=>{
  const {mountObjectDiscovery}=await import('/world/house/discovery.js');
  const objects=[{id:'couch',type:'couch',roomId:'living'},{id:'table',type:'diningTable',roomId:'kitchen'},{id:'plant',type:'plant',decorative:true}],marker=document.querySelector('.house-discovery-marker');
  window.commands=[];window.context={objects,home:{objects,actionCatalog:{rest:{durationMinutes:20},eat:{durationMinutes:20}}},person:{id:'adult',ageYears:30,atHome:true},enabled:true};
  window.discovery=mountObjectDiscovery(document.querySelector('main'),{check:async entry=>({available:entry.command.type==='rest'}),show:id=>{marker.hidden=!id;marker.dataset.objectId=id??'';},open:object=>window.commands.push(object.id)});discovery.update(context);
 });
 const picker=page.getByRole('combobox',{name:'Explore objects'}),marker=page.locator('.house-discovery-marker');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-546-picker-before.png'});
 await picker.focus();await picker.press('ArrowDown');await expect(picker).toHaveValue('couch');await expect(marker).toBeVisible();
 expect(await marker.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');await expect(page.getByRole('status')).toHaveText('Available to interact');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-546-picker-after.png'});
 await picker.press('ArrowDown');await expect(picker).toHaveValue('table');await expect(marker).toBeHidden();
 await picker.selectOption('plant');await expect(marker).toBeHidden();
 await picker.selectOption('couch');await expect(marker).toBeVisible();
 await page.evaluate(()=>discovery.update({...context,person:{...context.person,id:'other'}}));await expect(marker).toBeHidden();
 const button=await page.getByRole('button',{name:'Inspect object'}).boundingBox();await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);expect(await page.evaluate(()=>commands)).toEqual(['couch']);
 await page.evaluate(()=>discovery.update({...context,enabled:false}));await expect(picker).toBeDisabled();await expect(marker).toBeHidden();
 await page.evaluate(()=>discovery.destroy());await expect(picker).toHaveCount(0);
});
