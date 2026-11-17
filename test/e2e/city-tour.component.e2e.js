import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
for(const mobile of [false,true])test(`tour builder and read-only guest ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://tour.test/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/panel.js')||path.endsWith('/core.js'))return route.fulfill({contentType:'text/javascript',body:readFileSync('world/city-tour/'+path.split('/').at(-1),'utf8')});return route.fulfill({contentType:'text/html',body:'<main></main>'});});
 await page.goto('https://tour.test/');
 await page.evaluate(async()=>{
  const {mountCityTour}=await import('/panel.js');let n=0;window.navigations=[];window.denied=false;
  window.record={schemaVersion:'world-experiment-record.v1',id:'TourSave001',save:{schemaVersion:'world-experiment-save.v1',checkpoint:{schemaVersion:'legacy-checkpoint.v1',modelVersion:'neighborhood-activity.v2'},geometry:{area:{source:'synthetic'}},view:{camera:{position:[1,40,3],target:[0,0,0]}}}};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record.save)));record.checksum='sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  window.panel=mountCityTour({container:document.querySelector('main'),fetchImpl:async()=>denied?new Response('',{status:403}):Response.json(record),navigate:url=>navigations.push(url)});
 });
 await page.locator('summary').click();await page.getByLabel('Saved experiment ID',{exact:true}).fill('TourSave001');
 for(const label of ['A','B','<script>window.injected=true</script>']){await page.getByLabel('Description (your interpretation)',{exact:true}).fill(label);await page.getByRole('button',{name:'Add saved checkpoint',exact:true}).click();await expect(page.getByRole('status')).toContainText('added');}
 await page.getByRole('button',{name:'Move up step 2',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('li').first()).toContainText('B');expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 await expect(page.getByRole('button',{name:'Export read-only recipe',exact:true})).toBeDisabled();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Export read-only recipe',exact:true}).click();await expect(page.getByRole('status')).toContainText('No publication');
 await page.getByRole('button',{name:'Open as read-only guest',exact:true}).click();await expect(page.getByRole('button',{name:'Add saved checkpoint',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Play',exact:true}).click();expect(await page.evaluate(()=>navigations.length)).toBe(1);
 await page.getByRole('button',{name:'Skip / next',exact:true}).click();expect(await page.evaluate(()=>navigations.length)).toBe(2);
 await page.evaluate(()=>window.denied=true);await page.getByRole('button',{name:'Skip / next',exact:true}).click();await expect(page.getByRole('status')).toContainText('Invalid step 3: Access denied');
 await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByRole('status')).toContainText('Invalid step 2');
 await page.getByRole('button',{name:'Reverse route',exact:true}).click();await expect(page.locator('li').first()).toContainText('<script>');await expect(page.locator('li').first()).toContainText('synthetic');
 await page.screenshot({path:test.info().outputPath(`tour-${mobile?'mobile':'desktop'}.png`)});
 await page.getByRole('button',{name:'Delete local tour',exact:true}).click();await expect(page.locator('li')).toHaveCount(0);await expect(page.getByLabel('Recipe JSON',{exact:true})).toHaveValue('');
});
