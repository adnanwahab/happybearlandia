import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {EXPERIENCES} from '../../world/universe/registry.js';
test.beforeEach(async({page})=>{
 await page.route('http://hbl.test/**',async route=>{
  let path=new URL(route.request().url()).pathname.slice(1);
  if(path==='routes-before')return route.fulfill({contentType:'text/html',body:execFileSync('git',['show','HEAD:routes.html'],{encoding:'utf8'})});
  if(path==='routes')path='routes.html';
  if(resolve(path).startsWith(process.cwd()+'/'))try{return await route.fulfill({body:await readFile(path),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});}catch{}
  return route.fulfill({status:404,body:'Not in fixture'});
 });
});
test('all canonical routes are searchable and keyboard focusable; list shares exact cards',async({page})=>{
 await page.goto('/routes');await expect(page.locator('article')).toHaveCount(EXPERIENCES.length);
 for(const app of EXPERIENCES){
  await page.locator('#search').fill(app.route);
  const link=page.locator('article:not([hidden]) a').filter({hasText:'Open '+app.title+' →'});
  await expect(link).toHaveAttribute('href',app.route);await link.focus();await expect(link).toBeFocused();
 }
 await page.locator('#search').fill('');
 await page.getByRole('button',{name:'Flat list',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.map-window')).toBeHidden();
 expect(await page.locator('article a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))).toEqual(EXPERIENCES.map(a=>a.route));
 await page.getByRole('button',{name:'Worlds & people',exact:true}).click();
 expect(await page.locator('article:visible').count()).toBeGreaterThan(0);
 await page.locator('#search').fill('no such workspace xyz');await expect(page.locator('.empty')).toBeVisible();
 await page.getByRole('button',{name:'Show all workspaces'}).click();await expect(page.locator('#search')).toBeFocused();
});
for(const mobile of [false,true])test(`zoom, reduced motion and captures ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/routes-before');await expect(page.locator('article')).toHaveCount(EXPERIENCES.length);
 await page.screenshot({path:`.mini-symphony-evidence/SHE-439-routes-before-${mobile?'mobile':'desktop'}.png`});
 await page.goto('/routes');await expect(page.locator('.map-window article')).toHaveCount(EXPERIENCES.length);
 await page.locator('.view-tools').scrollIntoViewIfNeeded();
 await page.screenshot({path:`.mini-symphony-evidence/SHE-439-routes-after-${mobile?'mobile':'desktop'}.png`});
 for(let i=0;i<3;i++)if(await page.getByRole('button',{name:'Zoom in',exact:true}).isEnabled())await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await expect(page.locator('#zoom-level')).toHaveText('150%');await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Reset zoom'}).click();await expect(page.locator('#zoom-level')).toHaveText('100%');
 await page.locator('article a').last().focus();await expect(page.locator('article a').last()).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
