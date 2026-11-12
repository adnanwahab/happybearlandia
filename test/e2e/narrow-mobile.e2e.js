import {test,expect} from '@playwright/test';
for(const viewport of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]){
 test(`World controls remain uncovered at ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.goto('/world/?demo=1&synthetic=1&people=30&renderer=canvas2d&seed=42');
  await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready)).toBe(true);
  const measurements=[];
  async function reachable(locator){
   await locator.scrollIntoViewIfNeeded();await page.keyboard.press('Tab');await locator.focus();
   const box=await locator.evaluate(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,uncovered:[.1,.5,.9].every(f=>{const hit=document.elementFromPoint(r.x+r.width*f,r.y+r.height/2);return hit===n||n.contains(hit);}),outline:getComputedStyle(n).outlineStyle};});
   measurements.push(box);expect(box.visible,JSON.stringify(box)).toBe(true);expect(box.uncovered,JSON.stringify(box)).toBe(true);expect(box.outline).not.toBe('none');
  }
  await reachable(page.locator('#top > summary'));
  await reachable(page.locator('#world-guide-button'));
  await reachable(page.locator('#activity-dashboard-button'));
  await page.locator('#top > summary').click();
  await reachable(page.getByRole('button',{name:'Pause',exact:true}));
  await reachable(page.locator('#top > summary'));
  await page.locator('#activity-dashboard-button').click();
  await reachable(page.getByRole('dialog',{name:'Activity history dashboard'}).getByRole('button',{name:'Close',exact:true}));
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`world-${viewport.width}.png`)});
  await info.attach('bounding-boxes',{body:JSON.stringify({viewport,measurements},null,2),contentType:'application/json'});
 });
}
