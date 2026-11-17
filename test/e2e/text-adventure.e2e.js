import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
for(const width of [1280,390])test(`no-canvas keyboard resident → event → WHY at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const scripts=[];page.on('request',r=>{if(r.resourceType()==='script')scripts.push(new URL(r.url()).pathname);});
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=function(){throw Error('Canvas forbidden by text-mode test');};});
 await page.goto('/world?text=1');await expect(page.getByRole('heading',{name:'Nearby residents',exact:true})).toBeFocused();
 await expect(page.locator('canvas')).toHaveCount(0);
 const resident=page.getByRole('button',{name:/^Inspect /}).first();await resident.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:/^Resident ·/})).toBeFocused();await expect(page.getByText('No retained decision events',{exact:false})).toBeVisible();
 for(let i=0;i<48;i++){
  const advance=page.getByRole('button',{name:'Advance 30 modeled minutes'});await advance.focus();await page.keyboard.press('Enter');
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy','true');
 }
 const event=page.getByRole('button',{name:/^Event /}).first();await expect(event).toBeVisible();await event.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:/^Event ·/})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'WHY this event?'})).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'WHY · Recorded decision evidence'})).toBeFocused();
 await page.getByText('Recorded event and inputs',{exact:true}).click();await expect(page.locator('pre').first()).toContainText('actorId');await expect(page.locator('pre').first()).toContainText('inputs');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(scripts.some(p=>/render\.js|world-gpu|three/.test(p))).toBe(false);
 mkdirSync('docs/evidence/SHE-781',{recursive:true});await page.screenshot({path:`docs/evidence/SHE-781/why-${width}.png`,fullPage:true});
 writeFileSync(`docs/evidence/SHE-781/browser-${width}.json`,JSON.stringify({width,reducedMotion:true,canvasCount:await page.locator('canvas').count(),graphicsScripts:scripts.filter(p=>/render\.js|world-gpu|three/.test(p)),heading:await page.locator('h2').textContent(),event:await page.locator('pre').first().textContent()},null,2)+'\n');
 await page.getByRole('button',{name:'Back to event'}).click();await expect(page.getByRole('heading',{name:/^Event ·/})).toBeFocused();
 await page.getByRole('button',{name:'Clear this local run'}).click();await expect(page.getByRole('heading',{level:1})).toBeFocused();await expect(page.getByText('Nothing was shared or saved.',{exact:false})).toBeVisible();
});
test('unsupported saved context is explicit and starts no worker',async({page})=>{
 let workers=0;page.on('worker',()=>workers++);await page.goto('/world?text=1&worldId=restricted');
 await expect(page.getByRole('main')).toContainText('Saved or restricted run data has not been loaded');expect(workers).toBe(0);await expect(page.locator('canvas')).toHaveCount(0);
});
test('worker failure reports missing data with no invented results',async({page})=>{
 await page.addInitScript(()=>{window.Worker=class {constructor(){throw Error('Worker unavailable');}};});await page.goto('/world?text=1');
 await expect(page.getByRole('main')).toContainText('Population data unavailable',{timeout:10000});await expect(page.getByRole('button',{name:/Inspect/})).toHaveCount(0);
});
