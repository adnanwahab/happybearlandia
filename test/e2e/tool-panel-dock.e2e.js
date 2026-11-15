import {test,expect} from '@playwright/test';
for(const width of [320,1440])for(const reducedMotion of ['reduce','no-preference']){
 test(`panel dock ${width} ${reducedMotion}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion});
  await page.goto('/world?renderer=canvas2d&demo=1&synthetic=1&people=16&seed=263');
  await page.keyboard.press('Escape');
  const top=page.locator('#top');await top.locator(':scope > summary').click();
  const collapse=top.getByRole('button',{name:'Collapse Timeline and controls',exact:true});await expect(collapse).toBeVisible();
  await top.getByRole('button',{name:'Undock',exact:true}).click();
  const slider=top.getByRole('slider',{name:'Timeline and controls panel width'});
  await slider.focus();await page.keyboard.press('ArrowRight');await expect(slider).toHaveValue('380');
  const bounds=[];
  for(const node of [top.locator('.tool-dock-bar'),page.locator('#world-quick-toolbar')]){
   bounds.push(await node.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  }
  for(const r of bounds){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.bottom).toBeLessThanOrEqual(900);}
  const buttons=top.locator('.tool-dock-bar button');
  for(const button of await buttons.all()){
   await expect(button).toBeInViewport();
   expect(await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);})).toBe(true);
  }
  for(const button of await page.locator('#world-quick-toolbar button').all()){
   if(!await button.isVisible())continue;
   expect(await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);})).toBe(true);
  }
  if(reducedMotion==='reduce')expect(await top.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.keyboard.press('Escape');await expect(collapse).toHaveAttribute('aria-expanded','false');await expect(collapse).toBeFocused();
  await page.reload();if(!await top.evaluate(el=>el.open))await top.locator(':scope > summary').click();
  const expand=top.getByRole('button',{name:'Expand Timeline and controls',exact:true});await expect(expand).toBeVisible();
  await expand.click();await expect(top.getByRole('slider')).toHaveValue('380');
  await info.attach('panel bounds',{body:JSON.stringify(bounds),contentType:'application/json'});
  await page.screenshot({path:info.outputPath('dock.png')});
 });
}
