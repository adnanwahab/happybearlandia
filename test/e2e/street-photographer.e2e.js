import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Real native documents/modules; no GPU engine or upstream provider needed for
// this authored standalone case. World scripts are excluded at the entry page.
test.beforeEach(async({page})=>{
 await page.route('https://hbl.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const local=resolve('.'+(path==='/world' ? '/world/index.html' : path));
  if(!local.startsWith(process.cwd()+'/'))return route.fulfill({status:404,body:'Unavailable'});
  try{let body=await readFile(local);if(path==='/world')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
   return route.fulfill({body,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':path.endsWith('.css')?'text/css':'text/html'});
  }catch{return route.fulfill({status:404,body:'No source'});}
 });
});
for(const mobile of [false,true])test(`World keyboard navigation and three-clue case (${mobile?'mobile':'desktop'})`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world');
 await page.locator('#top').evaluate(e=>e.open=true);
 const link=page.getByRole('link',{name:/Street Photographer Detective/});await link.focus();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/street-photographer\/index.html/);await page.getByRole('button',{name:'Load pinned demo'}).click();
 await expect(page.locator('#clue')).toBeFocused();await page.getByLabel('Checkpoint date').selectOption('street-cp-2');await page.getByRole('button',{name:'Capture clue',exact:true}).click();await expect(page.getByRole('status')).toContainText('Wrong date');await expect(page.locator('#progress')).toHaveText('0 / 3');
 await page.getByText('Reveal investigation hint',{exact:true}).click();await expect(page.locator('#hint')).toContainText('May 1');
 await page.getByLabel('Checkpoint date').selectOption('street-cp-1');await page.getByRole('button',{name:'Capture clue',exact:true}).click();await expect(page.locator('#progress')).toHaveText('1 / 3');
 await page.getByRole('button',{name:'Cancel investigation'}).click();await expect(page.locator('#case')).toBeHidden();await page.getByRole('button',{name:'Resume case'}).click();
 await page.getByLabel('Checkpoint date').selectOption('street-cp-2');await page.getByLabel('Subject',{exact:true}).selectOption('toy:notice');await page.getByRole('button',{name:'Capture clue',exact:true}).click();await expect(page.getByRole('status')).toContainText('outside the camera frame');
 await page.getByLabel('Camera position').focus();for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');await page.getByRole('button',{name:'Capture clue',exact:true}).click();await expect(page.locator('#progress')).toHaveText('2 / 3');
 await page.getByLabel('Checkpoint date').selectOption('street-cp-3');await page.getByLabel('Subject',{exact:true}).selectOption('toy:bench');await page.getByRole('button',{name:'Inspect text record instead'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Case solved');await expect(page.locator('#notebook li')).toHaveCount(3);await expect(page.locator('#notebook')).toContainText('text record inspected');expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/private/tmp/SHE-712-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.getByRole('button',{name:'Restart case'}).click();await expect(page.locator('#progress')).toHaveText('0 / 3');await page.getByRole('link',{name:'Back to World'}).click();await expect(page).toHaveURL(/\/world$/);
});
test('no source and replay mismatch produce no evidence; retry recovers',async({page})=>{
 await page.route('**/scenario.json',route=>route.fulfill({status:404,body:'missing'}));await page.goto('/world/street-photographer/index.html');await page.getByRole('button',{name:'Load pinned demo'}).click();await expect(page.getByRole('status')).toContainText('No source data');await expect(page.locator('#case')).toBeHidden();
 await page.route('**/scenario.json',async route=>{const data=JSON.parse(await readFile('world/street-photographer/scenario.json','utf8'));data.seed=99;return route.fulfill({json:data});});await page.getByRole('button',{name:'Load pinned demo'}).click();await expect(page.getByRole('status')).toContainText('Replay mismatch');await expect(page.locator('#notebook li')).toHaveCount(0);
 await page.unroute('**/scenario.json');await page.getByRole('button',{name:'Load pinned demo'}).click();await expect(page.locator('#case')).toBeVisible();
});
test('cancel pending source read ignores late success and allows retry',async({page})=>{
 let release;const pending=new Promise(r=>release=r);await page.route('**/scenario.json',async route=>{await pending;await route.fulfill({json:JSON.parse(await readFile('world/street-photographer/scenario.json','utf8'))}).catch(()=>{});});
 await page.goto('/world/street-photographer/index.html');await page.getByRole('button',{name:'Load pinned demo'}).click();await page.getByRole('button',{name:'Cancel investigation'}).click();release();await expect(page.getByRole('status')).toContainText('cancelled');await expect(page.locator('#case')).toBeHidden();await expect(page.getByRole('button',{name:'Load pinned demo'})).toBeEnabled();
});
