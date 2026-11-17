import {test, expect} from '@playwright/test';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {injectUniverseBootstrap} from '../../world/universe/html-navigation.js';

// Actual source documents; missing server APIs stay unavailable, never model fixtures.
test.beforeEach(async({context})=>{
  if(process.env.HBL_NAV_STATIC !== '1') return;
  await context.route('http://127.0.0.1:*/**',async route=>{
    const url=new URL(route.request().url());
    let relative=decodeURIComponent(url.pathname).slice(1) || 'index.html';
    let file=path.resolve(relative);
    if(!file.startsWith(process.cwd()+'/'))return route.abort();
    if(existsSync(file)&&statSync(file).isDirectory()) {relative+='/index.html';file=path.resolve(relative);}
    if(!existsSync(file)&&existsSync(file+'.html')) {relative+='.html';file+='.html';}
    if(!existsSync(file)||statSync(file).isDirectory())return route.fulfill({status:404,body:'Unavailable in source transport'});
    const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wasm':'application/wasm'};
    const body=ext==='.html'?injectUniverseBootstrap(readFileSync(file,'utf8'),relative):readFileSync(file);
    return route.fulfill({body,contentType:types[ext]||'application/octet-stream'});
  });
});

for (const mode of ['enabled', 'unsupported', 'reduced', 'storage-blocked']) {
  test(`four native routes and history: ${mode}`, async ({page}) => {
    if (mode === 'reduced') await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(mode => {
      if (mode === 'unsupported') { CSS.supports = () => false; delete window.onpagereveal; }
      if (mode === 'storage-blocked') {
        Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
        Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      }
    }, mode);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/routes');
    for (const path of ['/', '/world?demo=1&synthetic=1&people=16', '/world/future-machine.html']) {
      if (path !== '/') await page.goto('/routes');
      const link = path === '/' ? page.getByRole('link',{name:'HappyBearLandia home',exact:true}) : page.locator(`main.routes a[href="${path.startsWith('/world?')?'/world':path}"]`).first();
      // Use the native World entry with its documented local synthetic preset.
      if (path.startsWith('/world?')) await link.evaluate((el,path)=>el.href=path,path);
      await link.focus();await page.keyboard.press('Enter');
      await page.waitForURL(url=>url.pathname === path.split('?')[0]);
      const target=page.locator('[data-navigation-focus="heading"]');
      await expect(target).toBeFocused();
      await expect(page.locator('.hbl-navigation-status')).toHaveCount(1);
      if (mode !== 'storage-blocked') await expect(page.locator('.hbl-navigation-status')).toHaveText('Destination ready. Focus at page heading.');
      // Duplicate animation lifecycle signals must not announce or steal focus.
      await page.evaluate(()=>{window.announcementChanges=0;new MutationObserver(records=>window.announcementChanges+=records.length).observe(document.querySelector('.hbl-navigation-status'),{childList:true});dispatchEvent(new Event('pagereveal'));dispatchEvent(new Event('pageshow'));});
      expect(await page.evaluate(()=>window.announcementChanges)).toBe(0);
      await expect(page.getByRole('link',{name:'All workspaces — back to directory'})).toBeVisible();
      if(path.startsWith('/world')) {
        const toggle=page.getByRole('button',{name:'Open universe navigation',exact:true});
        await toggle.focus();await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-expanded','false');
      }
      await page.goBack();
      await expect(link).toBeFocused();
      await expect(link).toHaveAttribute('data-navigation-focus','restored');
    }
    // Source-only transport cannot qualify model startup; native-server mode checks errors.
    if(process.env.HBL_NAV_STATIC !== '1') expect(errors).toEqual([]);
  });
}

test('mobile directory exit and missing opener fallback',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/routes');
  await page.getByRole('link',{name:'HappyBearLandia home',exact:true}).tap();
  await expect(page.locator('[data-navigation-focus="heading"]')).toBeFocused();
  await page.getByRole('link',{name:'All workspaces — back to directory'}).tap();
  await expect(page).toHaveURL(/\/routes$/);
  await page.evaluate(()=>history.replaceState({...history.state,hblNavigationFocus:{href:'http://missing.invalid',index:0}},''));
  await page.getByRole('link',{name:'HappyBearLandia home',exact:true}).tap();
  // Simulate a removed opener on the returning document without model fixtures.
  await page.addInitScript(()=>{if(location.pathname==='/routes')document.addEventListener('DOMContentLoaded',()=>document.querySelector('nav a')?.remove());});
  await page.goBack();await expect(page.locator('[data-navigation-focus="heading"]')).toBeFocused();

});
