import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import bundle from '../../world/racetrack/representative.json';

// Serve the unchanged normal entry and modules through browser interception.
// This keeps the check runnable where local TCP listeners are disallowed.
test.beforeEach(async({page})=>{
 await page.route('http://localhost:39886/**',async route=>{
  const path=resolve(process.cwd(),'.'+new URL(route.request().url()).pathname);
  if(!path.startsWith(process.cwd()+'/'))return route.fulfill({status:403});
  try {await route.fulfill({body:await readFile(path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream'});}
  catch {await route.fulfill({status:404,body:'Not found'});}
 });
});

test('normal entry: aligned lanes, scrub, exact receipt, playback, mobile and disposal',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/worlds.html');
 await expect(page.locator('.race-lane')).toHaveCount(100);
 await expect(page.locator('#race-status')).toContainText('pinned seed 42. 0 excluded');
 await expect(page.locator('iframe')).toHaveCount(0);
 await page.locator('#race-month').fill('30');
 await expect(page.locator('#race-time')).toHaveText('Month 30 · 2028-07');
 await page.locator('.race-lane').first().click();
 const opened=JSON.parse(await page.locator('#race-receipt-text').textContent());
 expect(opened.receipt).toEqual(bundle.tracks[0]);expect(opened.selectedMonth).toBe(30);
 expect(opened.recordedValue).toBe(bundle.tracks[0].values[30]);
 await page.getByRole('button',{name:'Close receipt'}).click();
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect(page.locator('#race-time')).not.toContainText('Month 30 ·');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.locator('#race-month').fill('0');
 await page.screenshot({path:'test-results/racetrack-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/racetrack-mobile.png',fullPage:true});
 // Exercise the disposal handler rather than inferring cleanup from navigation.
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
 await expect(page.locator('.race-lane')).toHaveCount(0);
 const time=await page.locator('#race-time').textContent();
 await page.waitForTimeout(700);expect(await page.locator('#race-time').textContent()).toBe(time);
 expect(errors).toEqual([]);
});
test('missing recording and unsupported receipts remain explicit',async({page})=>{
 await page.route('**/representative.json',route=>route.fulfill({status:404,body:'Missing'}));
 await page.goto('/world/worlds.html');
 await expect(page.locator('#race-status')).toContainText('Recorded lanes unavailable');
 const tracks=structuredClone(bundle.tracks.slice(0,2));tracks[1].modelVersion='old';
 await page.locator('#race-import').setInputFiles({name:'recording.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...bundle,tracks}))});
 await expect(page.locator('.race-lane')).toHaveCount(1);
 await expect(page.locator('#race-status')).toContainText('Unsupported model/rules version');
});
