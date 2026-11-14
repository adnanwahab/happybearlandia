import {test,expect} from '@playwright/test';
test('saved ties support keyboard navigation, touch fallback and missing data',async({page})=>{
 await page.goto('/world/house/house.css');
 await page.setContent('<link rel="stylesheet" href="/world/house/house.css"><main style="max-width:420px;padding:20px;background:#fff;color:#203f38"><h2>Resident profile</h2><div id="map"></div><p id="destination" tabindex="-1"></p></main>');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-550-profile-before.png'});
 await page.evaluate(async()=>{
  const {mountRelationshipConstellation}=await import('/world/house/relationship-constellation.js');window.mountMap=mountRelationshipConstellation;
  window.person={id:'a',name:'Alex',relationships:[{personId:'b',name:'Bee',recordedTie:true,lastEncounterMinute:80,label:'Friend'},{personId:'c',name:'Casey',friendship:100},{personId:'d',name:'Dee',recordedTie:true}]};window.before=JSON.stringify(person);
  mountMap(document.querySelector('#map'),{person,minute:100,supportedPersonIds:['b'],onInspect:id=>{const destination=document.querySelector('#destination');destination.textContent='Profile '+id;destination.focus();}});
 });
 await expect(page.getByRole('region',{name:'Relationship constellation'})).toContainText('20 modeled min ago');await expect(page.getByText('Casey')).toHaveCount(0);
 const button=page.getByRole('button',{name:'Bee',exact:true});await button.focus();await page.keyboard.press('Enter');await expect(page.locator('#destination')).toHaveText('Profile b');await expect(page.locator('#destination')).toBeFocused();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-550-profile-after-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('svg')).toBeHidden();await button.dispatchEvent('click');await expect(page.locator('#destination')).toHaveText('Profile b');await expect(page.getByText('Profile unavailable in this house scene.')).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-550-profile-after-mobile.png'});
 expect(await page.evaluate(()=>JSON.stringify(person)===before)).toBe(true);
 await page.evaluate(()=>{document.querySelector('#map').replaceChildren();mountMap(document.querySelector('#map'),{person:{id:'a'}});});await expect(page.getByRole('status')).toContainText('No recorded relationship ties');
});
