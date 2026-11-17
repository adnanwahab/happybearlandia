import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {test,expect} from '@playwright/test';
// Optional filesystem transport exercises real documents/modules when local listening is blocked.
if(process.env.HBL_PALETTE_STATIC==='1')test.beforeEach(async({page})=>{
 await page.route('http://127.0.0.1:3197/**',async route=>{
  const url=new URL(route.request().url());let file=path.join(process.cwd(),decodeURIComponent(url.pathname));
  if(existsSync(file)&&statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!existsSync(file)&&existsSync(file+'.html'))file+='.html';
  if(!file.startsWith(process.cwd()+'/')||!existsSync(file)||statSync(file).isDirectory())return route.fulfill({status:404,body:'Unavailable in filesystem transport'});
  const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
  return route.fulfill({body:readFileSync(file),contentType:types[ext]||'application/octet-stream'});
 });
});
for(const reduced of [false,true])test(`normal home keyboard and focus reduced=${reduced}`,async({page})=>{
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.goto('/?runId=run:test:one&tick=12');
 const trigger=page.getByRole('button',{name:'Search routes and actions',exact:true});await trigger.focus();
 await page.keyboard.press('Control+k');const input=page.getByRole('combobox',{name:'Travel and actions',exact:true});
 await expect(input).toBeFocused();await expect(input).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#hbl-command-results [role=option]')).toHaveCount(33);
 await input.fill('not-a-real-route');await expect(page.locator('#hbl-command-results [role=option]')).toHaveCount(0);await expect(input).not.toHaveAttribute('aria-activedescendant');
 await input.fill('/world/decision');await page.keyboard.press('ArrowDown');
 const id=await input.getAttribute('aria-activedescendant');await expect(page.locator('#'+id)).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('Tab');await expect(page.getByRole('dialog',{name:'Travel and actions'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
 await page.keyboard.press('Meta+k');await expect(input).toBeFocused();
 await input.fill('houston neighborhood');
 await page.screenshot({path:`.mini-symphony-evidence/SHE-444-after-${reduced?'reduced':'desktop'}-palette.png`});
 await page.keyboard.press('Enter');await page.waitForURL(/tools\/houston-map/);expect(new URL(page.url()).searchParams.get('tick')).toBe('12');expect(new URL(page.url()).searchParams.get('runId')).toBe('run:test:one');
});
test('action stale selection, disabled guard and native handler',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.calls=0;const b=document.createElement('button');b.textContent='Actual selected person';b.dataset.paletteAction='follow';b.onclick=()=>window.calls++;document.body.append(b);});
 await page.keyboard.press('Control+k');const input=page.getByRole('combobox',{name:'Travel and actions'});await input.fill('follow selection');await expect(page.getByRole('option')).toHaveCount(1);
 await page.evaluate(()=>document.querySelector('[data-palette-action]').disabled=true);await input.press('Enter');await expect(page.locator('#hbl-command-status')).toContainText('unavailable');expect(await page.evaluate(()=>window.calls)).toBe(0);
 await page.evaluate(()=>document.querySelector('[data-palette-action]').disabled=false);await input.fill('follow selection ');await input.press('Enter');expect(await page.evaluate(()=>window.calls)).toBe(1);
 await page.keyboard.press('Control+k');await input.fill('follow selection');await page.evaluate(()=>document.querySelector('[data-palette-action]').remove());await input.press('Enter');expect(await page.evaluate(()=>window.calls)).toBe(1);
});
test('mobile palette fits and closes',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Search routes and actions',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Travel and actions'});const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);await page.screenshot({path:'.mini-symphony-evidence/SHE-444-after-mobile-palette.png'});await page.getByRole('button',{name:'Close command palette'}).click();await expect(dialog).not.toBeVisible();});
