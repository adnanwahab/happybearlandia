import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Real directory source only. No simulated outcomes or API responses are served.
// This tests the itinerary, not the required uncut cross-surface acceptance.
test.beforeEach(async({page})=>{
 await page.route('http://hbl.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const file=resolve('.'+(path==='/routes'?'/routes.html':path));
  if(!file.startsWith(process.cwd()+'/'))return route.fulfill({status:403,body:'Denied'});
  try{const body=await readFile(file);return route.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{return route.fulfill({status:404,body:'Unavailable'});}
 });
});
for(const mobile of [false,true])test(`itinerary keyboard/history/invalid bookmark ${mobile?'mobile reduced motion':'desktop'}`,async({page})=>{
 if(mobile){await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});}
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/routes#tour=arrive');const tour=page.locator('#magic-tour');
 await expect(tour.locator('h3')).toHaveText('1 · Arrive in the world');
 const fork=tour.getByRole('button',{name:'3 · Try one policy fork'});
 await fork.focus();await page.keyboard.press('Enter');await expect(tour.locator('h3')).toHaveText('3 · Try one policy fork');
 const href=await tour.locator('a').getAttribute('href');expect(href).toContain('fm=');expect(href).toContain('month=0');
 await tour.getByRole('button',{name:'4 · Compare the futures'}).click();await page.goBack();
 await expect(tour.locator('h3')).toHaveText('3 · Try one policy fork');await page.reload();await expect(tour.locator('h3')).toHaveText('3 · Try one policy fork');
 await page.goto('/routes#tour=unavailable');await expect(tour.locator('h3')).toHaveText('Tour stop unavailable');await expect(tour.locator('a')).toBeHidden();
 await tour.getByRole('button',{name:'2 · Play a household moment'}).click();await expect(tour).toContainText('denied save');await expect(tour.getByRole('status')).toContainText('Not verified complete');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/she788-${mobile?'mobile':'desktop'}.png`,fullPage:false});expect(errors).toEqual([]);
});
