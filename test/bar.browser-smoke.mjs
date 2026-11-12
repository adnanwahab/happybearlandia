import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.HBL_BAR_SMOKE_URL||'http://127.0.0.1:3395';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:original.call(this,kind,...args);};});
 const failures=[];page.on('pageerror',error=>failures.push(error.message));
 for(const route of ['/world/bar','/world/bar/','/world/bar/app.js','/world/bar/bar.css','/vendor/three/three.module.js','/world/house']) {
  const response=await page.request.get(base+route);assert.equal(response.status(),200,route);
 }
 await page.goto(base+'/routes');await page.locator('#search').fill('Social Bear');
 assert.equal(await page.locator('article:not([hidden])').count(),1);
 await page.locator('article:not([hidden]) a').click();
 await page.locator('#guest-roster [data-person]').first().waitFor();
 assert.equal(await page.locator('#guest-roster [data-person]').count(),6);
 assert.equal(await page.locator('#group-roster [data-group]').count(),3);
 await page.locator('#open-menu').click();await page.locator('[data-drink="cocktail"]').click();
 const budget=await page.locator('#budget').textContent();assert.notEqual(budget,'$60');
 await page.locator('#guest-roster [data-person="nova"]').click();
 await page.locator('#panel-content [data-action="talk"]').first().click();
 const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('happybearlandia:bar:v1')).patrons.nova.history.length);assert.equal(history,1);
 await page.keyboard.press('Escape');await page.locator('#group-roster [data-group]').first().click();
 await page.locator('#panel-content [data-action="group-talk"]').first().click();
 assert.equal(await page.locator('#panel-content .group-reaction').count(),2);
 await page.reload();await page.locator('#guest-roster [data-person]').first().waitFor();assert.equal(await page.locator('#budget').textContent(),budget);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('happybearlandia:bar:v1')).patrons.nova.history.length),1);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);}
 await page.goto(base+'/world/bar?returnTo='+encodeURIComponent('/world/house/family_qa?experimentId=qa'));
 assert.equal(await page.locator('#return-home').getAttribute('href'),'/world/house/family_qa?experimentId=qa');
 await page.screenshot({path:'/private/tmp/hbl-pr5-mobile.png',fullPage:true});
 assert.deepEqual(failures,[]);
 console.log(JSON.stringify({passed:true,routes:6,guests:6,groups:3,conversationPersisted:true,budgetPersisted:true,groupReplies:2,widths:[390,320],webgl:'disabled to exercise fallback'}));
} finally {await browser.close();}
