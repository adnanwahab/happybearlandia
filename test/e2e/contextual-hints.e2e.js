import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { injectUniverseBootstrap } from '../../world/universe/html-navigation.js';

// Serve repository documents through Playwright when sandbox listen() is unavailable.
// No API/model responses are fabricated; these journeys use local-only controls.
test.use({hasTouch:true});
test.beforeEach(async ({page}) => {
  await page.route('http://hbl.test/**', async route => {
    let path = new URL(route.request().url()).pathname.slice(1);
    path = ({routes:'routes.html','world/bar':'world/bar/index.html'})[path] || path;
    if (path === 'routes-before') return route.fulfill({contentType:'text/html',body:execFileSync('git',['show','HEAD:routes.html'],{encoding:'utf8'})});
    if (path === 'hint-fixture') return route.fulfill({contentType:'text/html',body:'<!doctype html><main><button disabled>Unavailable</button><button hidden>Hidden</button><button id="action">Inspect evidence</button></main><aside id="hints"></aside>'});
    if (resolve(path).startsWith(process.cwd() + '/')) {
      try {
        const body = await readFile(path);
        const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'image/svg+xml';
        return route.fulfill({contentType,body:path.endsWith('.html') ? injectUniverseBootstrap(body.toString(),path) : body});
      } catch {}
    }
    return route.fulfill({status:404,body:'Unavailable in local static harness'});
  });
});
const hint = page => page.getByRole('button',{name:/^Show Me a hint/});
const reveal = async page => { await hint(page).click(); await page.getByRole('button',{name:'Show the control',exact:true}).click(); };

test('directory newcomer finds a workspace without hint changing input or navigating',async({page})=>{
 await page.goto('/routes-before');
 await expect(page.locator('article').first()).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-476-routes-before.png',fullPage:false});
 await page.goto('/routes');
 const url=page.url();await hint(page).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Try'})).toContainText('Search workspaces');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-476-routes-after-desktop.png',fullPage:false});
 await page.getByRole('button',{name:'Show the control',exact:true}).click();
 await expect(page.locator('#search')).toBeFocused();await expect(page.locator('#search')).toHaveValue('');expect(page.url()).toBe(url);
 await page.keyboard.type('Social Bear');await expect(page.locator('article:visible')).toHaveCount(1);
 await page.getByRole('link',{name:'Open The Social Bear →'}).click();await expect(page.locator('#open-menu')).toBeVisible();
});

test('bar newcomer opens an authored drinks menu only after choosing the focused action',async({page})=>{
 await page.goto('/world/bar');await page.getByRole('button',{name:'Open universe navigation'}).click();
 const before=await page.evaluate(()=>localStorage.getItem('happybearlandia:bar:v1'));
 await reveal(page);await expect(page.locator('#open-menu')).toBeFocused();
 expect(await page.evaluate(()=>localStorage.getItem('happybearlandia:bar:v1'))).toBe(before);
 await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Close drinks menu',exact:true})).toBeVisible();
});

test('touch journey, dismissal reload, reduced motion and singleton',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/routes');
 await page.getByRole('button',{name:'Play & discover',exact:true}).tap();await reveal(page);
 await page.locator('#search').fill('Social Bear');await expect(page.locator('article:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'Save The Social Bear to favorites',exact:true}).tap();
 await page.getByRole('button',{name:'Favorites',exact:true}).tap();await expect(page.locator('article:visible')).toHaveCount(1);
 await hint(page).click();await page.getByRole('button',{name:'Dismiss hints for this workspace'}).click();await page.reload();
 await expect(hint(page)).toHaveText('Show Me a hint (dismissed)');await expect(page.getByRole('button',{name:'Show the control',exact:true})).toBeHidden();
 await page.evaluate(async()=>{const {mountContextualHints}=await import('/world/universe/contextual-hints.js');mountContextualHints(document.body,{workspaceId:'routes'});});
 await expect(page.locator('[data-hbl-hints]')).toHaveCount(1);
 await hint(page).click();await page.screenshot({path:'.mini-symphony-evidence/SHE-476-routes-after-mobile.png',fullPage:false});
 await page.keyboard.press('Escape');await expect(hint(page)).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('component empty, stale, blocked storage and discovery benchmark',async({page})=>{
 await page.goto('/hint-fixture');
 await page.evaluate(async()=>{const {mountContextualHints}=await import('/world/universe/contextual-hints.js');Storage.prototype.setItem=()=>{throw new Error('blocked')};mountContextualHints(document.querySelector('#hints'),{workspaceId:'fixture'});});
 await hint(page).click();await expect(page.getByRole('status')).toContainText('Inspect evidence');
 await page.locator('#action').evaluate(b=>b.disabled=true);await page.getByRole('button',{name:'Show the control',exact:true}).click();await expect(page.getByRole('status')).toContainText('no longer available');
 await page.getByRole('button',{name:'Close hint',exact:true}).click();await hint(page).click();await expect(page.getByRole('status')).toContainText('No available actions');
 await page.getByRole('button',{name:'Dismiss hints for this workspace'}).click();await expect(hint(page)).toHaveText(/dismissed/);
 const measurement=await page.evaluate(async()=>{const {availableHintActions}=await import('/world/universe/contextual-hints.js');for(let i=0;i<500;i++){const b=document.createElement('button');b.textContent='Action '+i;document.querySelector('main').append(b);}const samples=[];for(let i=0;i<30;i++){const start=performance.now();availableHintActions(document,document.querySelector('#hints'));samples.push(performance.now()-start);}return {controls:500,samplesMs:samples};});
 await test.info().attach('discovery-benchmark',{body:JSON.stringify(measurement),contentType:'application/json'});
 console.log('SHE-476 discovery benchmark',JSON.stringify(measurement));
});
