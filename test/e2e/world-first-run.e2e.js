import {test,expect} from '@playwright/test';
import {EXPERIENCES} from '../../world/universe/registry.js';

test('directory uses the same catalog as home and Play Demo opens the flagship',async({page},info)=>{
 await page.goto('/routes.html');
 await expect(page.locator('.routes article')).toHaveCount(EXPERIENCES.length);
 await expect(page.locator('#result-count')).toHaveText(`${EXPERIENCES.length} of ${EXPERIENCES.length} workspaces`);
 const routes=await page.locator('.routes article > a:first-of-type').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
 expect(routes).toEqual(EXPERIENCES.map(row=>row.route));
 await page.getByRole('searchbox').fill('houston');
 await expect(page.locator('.routes article:visible')).toHaveCount(1);
 await expect(page.locator('.routes article:visible')).toContainText('Houston Neighborhood Map');
 await page.screenshot({path:info.outputPath('directory-filter.png'),fullPage:true});
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 await expect(page).toHaveURL(/\/world\/future-machine\.html\?demo=1/);
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 test(`World Activity reopens with focus and current playback facts at ${viewport.width}px`,async({page},info)=>{
  await page.setViewportSize(viewport);
  // World legacy mode uses the geographic authority seed, independently of the
  // flagship's numeric monthly City seed. Preserve both route and mode explicitly.
  await page.goto('/world/?demo=1&synthetic=1&people=30&renderer=canvas2d');
  await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:60000}).toBe(true);
  const trigger=page.getByRole('button',{name:'Activity dashboard',exact:true});
  const panel=page.getByRole('dialog',{name:'Activity history dashboard'});
  await expect(page.locator('#world-playback-facts')).toContainText(/Mood: \d+ \/ 100 · Seed: /);
  await page.screenshot({path:info.outputPath(`world-${viewport.width}-before.png`)});
  for(let visit=0;visit<2;visit++){
   await trigger.click();await expect(panel).toBeVisible();
   await expect(panel.getByRole('status')).toHaveAttribute('data-state',/ready|empty|error/);
   await page.screenshot({path:info.outputPath(`world-${viewport.width}-activity-${visit}.png`)});
   await panel.getByRole('button',{name:'Close',exact:true}).click();
   await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
  }
  const observed=await page.evaluate(()=>({snapshot:window.hblWorldActivity.getSnapshot(),facts:document.querySelector('#world-playback-facts').textContent}));
  await info.attach('runtime-authority',{body:JSON.stringify({mode:observed.snapshot.mode,seed:observed.snapshot.seed,modelVersion:observed.snapshot.modelVersion,facts:observed.facts}),contentType:'application/json'});
 });
}
