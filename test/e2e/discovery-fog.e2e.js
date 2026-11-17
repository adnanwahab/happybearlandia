import {test, expect} from '@playwright/test';

for(const fallback of [false,true]){
test(`normal World entry offers local fog and unmasked evidence (city-only ${fallback})`,async({page})=>{
 if(fallback)await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,get:()=>undefined}));
 await page.goto('/world/?demo=1&synthetic=1&people=16&renderer=webgl');
 const root=page.locator('#discoveryFog'); await expect(root).toBeAttached();
 if(await page.locator('#top').count())await page.locator('#top > summary').click();
 await root.locator(':scope > summary').click();
 const first=root.locator('article').first();
 await expect(first).toHaveAttribute('data-masked','false');
 await root.getByRole('checkbox').check(); await expect(first).toHaveAttribute('data-masked','true');
 await first.getByRole('button').click(); await expect(first).toHaveAttribute('data-masked','false');
 await expect(page.locator(fallback?'#details':'#inspect')).toBeVisible();
 await root.getByRole('button',{name:'Reset inspected places',exact:true}).click();
 await expect(first).toHaveAttribute('data-masked','true');
 await root.getByText('Flat list · all building evidence',{exact:true}).click();
 await expect(root.locator('li').first()).toContainText(await first.locator('.discovery-content').textContent());
 await page.reload(); await expect(root.getByRole('checkbox')).not.toBeChecked();
});
}

for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
 test(`component failures, unsupported evidence, focus and cleanup ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport); await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/world/discovery-fog.css');
  await page.evaluate(async()=>{
   document.body.replaceChildren();
   const style=document.createElement('link');style.rel='stylesheet';style.href='/world/discovery-fog.css';document.head.append(style);
   const {mountDiscoveryFog}=await import('/world/discovery-fog.js');
   window.fog=mountDiscoveryFog({container:document.body,buildings:[{id:'real-id',name:'Existing building',kind:'home',area:23}],source:'fixture',onInspect:()=>{throw Error('fixture failure');}});
  });
  const root=page.locator('#discoveryFog');await root.locator(':scope > summary').click();
  await root.getByRole('checkbox').check(); const card=root.locator('article');
  const inspect=card.getByRole('button');await page.keyboard.press('Tab');await inspect.focus();
  expect(await inspect.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(await inspect.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await root.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(viewport.width);
  expect(await card.locator('.discovery-content').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('Enter');await expect(root.getByRole('status')).toContainText('Could not inspect');
  await expect(card).toHaveAttribute('data-masked','true');
  await root.getByText('Flat list · all building evidence',{exact:true}).click();
  await expect(root.locator('li')).toContainText('23 m²');
  await page.waitForFunction(()=>window.fog.getMetrics().lastFrameGapMs!==null);
  const metrics=await page.evaluate(()=>{const metrics=window.fog.getMetrics();window.fog.dispose();return {metrics,disposed:window.fog.getMetrics()};});
  expect(metrics.metrics.updates).toBeGreaterThan(0);expect(metrics.disposed.pendingFrame).toBe(false);await expect(root).toHaveCount(0);
  await page.evaluate(async()=>{const {mountDiscoveryFog}=await import('/world/discovery-fog.js');window.empty=mountDiscoveryFog({container:document.body,buildings:[]});});
  await page.locator('#discoveryFog > summary').click();await expect(page.getByRole('status')).toContainText('No supported building');await expect(page.getByRole('checkbox')).toBeDisabled();
 });
}
