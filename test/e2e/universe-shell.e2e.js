import { test, expect } from '@playwright/test';
import { EXPERIENCES } from '../../world/universe/registry.js';
const query='universeId=universe%3Atest%3Amain&worldId=world%3Atest%3Acity&scenarioId=scenario%3Atest%3Abaseline&experimentId=experiment%3Atest%3Aone&runId=run%3Atest%3Aone&branchId=branch%3Atest%3Afork&tick=17&entityId=person%3Atest%3Aada';
test.beforeEach(async({page})=>{
 // Deterministic app fixtures avoid GPU/network work unrelated to shell behavior.
 await page.route('**/*',route=>{
  const request=route.request();
  if(request.resourceType()==='document' && request.frame().parentFrame()) return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Experience fixture</title><h1>Experience fixture</h1>'});
  return route.continue();
 });
});
test('directory, contextual transitions, iframe selection and history preserve scope',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?'+query);
 const shell=page.locator('#universe-shell');
 await expect(shell.locator('.universe-card')).toHaveCount(EXPERIENCES.length);
 expect((await shell.locator('.universe-card [data-app]').evaluateAll(links=>links.map(link=>link.dataset.app))).sort()).toEqual(EXPERIENCES.map(app=>app.id).sort());
 await shell.getByRole('searchbox').fill('/world/house');
 await expect(shell.locator('.universe-card')).toHaveCount(1);
 const standalone=shell.getByRole('link',{name:'Standalone ↗'});
 expect(await standalone.getAttribute('href')).toContain('branchId=branch%3Atest%3Afork');
 await shell.locator('.universe-card').getByRole('link',{name:'Enter',exact:true}).click();
 await expect(page).toHaveURL(/app=house/);
 const stage=page.locator('#universe-stage');await expect(stage.locator('iframe')).toHaveCount(1);
 expect(await stage.locator('iframe').getAttribute('src')).toContain('tick=17');
 const child=page.frames().find(frame=>frame.parentFrame() && frame.url().includes('/world/house'));
 await child.evaluate(async()=>{
  const {contextFromURL,navigationMessage}=await import('/world/universe/navigation.js');
  parent.postMessage(navigationMessage('select',contextFromURL(location.href),{entityId:'person:test:bob'}),location.origin);
 });
 await expect(page).toHaveURL(/entityId=person%3Atest%3Abob/);
 await shell.getByRole('link',{name:'Explore Worldline',exact:true}).click();
 await expect(page).toHaveURL(/app=worldline/);await expect(stage.locator('iframe')).toHaveCount(1);
 expect(await stage.locator('iframe').getAttribute('src')).toContain('runId=run%3Atest%3Aone');
 await page.goBack();await expect(page).toHaveURL(/app=house/);
 await expect(stage.locator('iframe')).toHaveAttribute('src',/entityId=person%3Atest%3Abob/);
 expect(errors).toEqual([]);
 await page.screenshot({path:'/tmp/hbl-universe-shell.png',fullPage:false});
});
test('invalid scope is visible, reduced motion and narrow screens remain usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.goto('/?app=house&tick=-1');
 await expect(page.locator('#universe-context-error')).toContainText('Invalid context');
 await expect(page.locator('#universe-stage iframe')).toHaveCount(0);
 await page.locator('#universe-search').fill('climate');
 await expect(page.locator('.universe-card')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('new demo shortcuts preserve canonical scope and open the real Time Machine UI',async({page})=>{
 await page.goto('/?'+query);
 const demoNav=page.getByRole('navigation',{name:'Demo shortcuts'});
 const destinations=[
   ['Time Machine','/world/causal.html'],
   ['Living City challenge','/world/living-city/'],
   ['Riverside Bakery mystery','/world/journeys/bakery.html'],
   ['Living Newspaper','/world/newspaper/index.html'],
   ['Surprising Discoveries','/world/discoveries/index.html'],
   ['Causal inspector','/world/causality/inspect.html']
 ];
 await expect(demoNav.getByRole('link')).toHaveCount(destinations.length);
 const original=new URLSearchParams(query);
 for(const [name,path] of destinations){
   const href=await demoNav.getByRole('link',{name,exact:true}).getAttribute('href');
   const target=new URL(href,page.url());
   expect(target.pathname).toBe(path);
   for(const [key,value] of original)expect(target.searchParams.get(key),name+' '+key).toBe(value);
 }
 await demoNav.getByRole('link',{name:'Time Machine',exact:true}).click();
 await expect(page).toHaveURL(/\/world\/causal\.html/);
 await expect(page.getByRole('heading',{name:'World Time Machine'})).toBeVisible();
});

test('mission cards are accessible before iframe activation and preserve scope on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?' + query);
  await expect(page.getByRole('heading', { name: 'Choose Your First Adventure' })).toBeVisible();
  const cards = page.locator('.universe-missions article');
  await expect(cards).toHaveCount(3);
  await expect(cards.getByText('Synthetic demo')).toHaveCount(3);
  const link = page.getByRole('link', { name: 'Start Time Machine' });
  const url = new URL(await link.getAttribute('href'), page.url());
  expect(url.pathname).toBe('/world/causal.html');
  expect(url.searchParams.get('runId')).toBe(new URLSearchParams(query).get('runId'));
  await link.focus();
  await expect(link).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
