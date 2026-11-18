import {test,expect} from '@playwright/test';
import {tideFixture} from '../fixtures/uncertainty-tides/batch.js';
test('worlds entry shows matching tide records, playback, missing data and mobile layout',async({page})=>{
 await page.route('**/api/dear-congress/simulation-snapshots/**',r=>r.fulfill({json:{snapshot:{location:{lat:0,lng:0},plan:{label:'Fixture'}}}}));
 await page.route('**/world?**',r=>r.fulfill({body:'<p>Isolated tile fixture</p>',contentType:'text/html'}));
 await page.addInitScript(batch=>{
  const key='hbl:lab:fixture:fixture:3:60:1::';
  localStorage.setItem('hbl:lab-latest:fixture:fixture',key);
  localStorage.setItem(key,JSON.stringify(batch));
 },tideFixture());
 await page.goto('/world/worlds.html?simulation=fixture&seed=fixture&years=3&people=60&runs=10&live=1');
 const tides=page.getByRole('region',{name:'Uncertainty Tide Lines'});
 await expect(tides).toContainText('100 valid matched pairs / 100');
 await page.getByLabel('Tide sample size').selectOption('10');
 await expect(tides).toContainText('10 valid matched pairs / 10');
 await page.getByRole('button',{name:'Play recorded years'}).click();
 await expect(tides).toContainText('Modeled year +3:',{timeout:5000});
 await expect(page.getByRole('button',{name:'Play recorded years'})).toBeVisible();
 expect(await tides.locator('svg path, svg polyline').count()).toBe(0);
 await page.screenshot({path:'/private/tmp/SHE-742-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/private/tmp/SHE-742-mobile.png'});
 await page.evaluate(async()=>{
  const {mountTides}=await import('/world/uncertainty-tides.js');
  const el=document.createElement('section'); document.body.append(el);
  const dispose=mountTides(el,null,'fixture');
  if (!el.textContent.includes('unavailable')) throw Error('missing state');
  dispose(); if(el.children.length) throw Error('dispose retained nodes'); el.remove();
 });
});
