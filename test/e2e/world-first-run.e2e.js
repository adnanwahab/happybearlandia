import {test,expect} from '@playwright/test';
import {EXPERIENCES} from '../../world/universe/registry.js';

test('directory renders every registry entry and filters without changing its total',async({page})=>{
 await page.goto('/routes');
 await expect(page.locator('.routes article')).toHaveCount(EXPERIENCES.length);
 expect(await page.locator('.routes article > a:first-of-type').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))).toEqual(EXPERIENCES.map(row=>row.route));
 await page.getByRole('searchbox').fill('future-machine');
 await expect(page.locator('.routes article:visible')).toHaveCount(1);
 await expect(page.locator('#result-count')).toHaveText(`1 of ${EXPERIENCES.length} workspaces`);
});

test('stalled Activity history exposes a bounded error and can retry',async({page})=>{
 await page.goto('/routes');
 await page.evaluate(async()=>{
  const {mountActivityDashboard}=await import('/world/activity-dashboard.js');
  window.testActivity=mountActivityDashboard({container:document.body,getSnapshot:()=>({mode:'legacy',runId:'timeout-test'}),getHistory:()=>new Promise(()=>{})});
  void window.testActivity.open();
 });
 const status=page.locator('.activity-dashboard [role=status]');
 await expect(status).toHaveAttribute('data-state','error',{timeout:12000});
 await expect(status).toContainText('Apply filters or reopen Activity to retry');
 await page.waitForTimeout(600);
 await expect(status).toHaveAttribute('data-state','error');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect(status).toHaveAttribute('data-state','loading');
});

test('provenance survives a blocked graphics entry point',async({page})=>{
 await page.route('**/world/render.js',route=>route.abort());
 await page.goto('/world/?demo=1&people=30&renderer=webgl');
 await expect.poll(()=>page.evaluate(()=>window.hblSimulationModel?.status)).toBe('definitions-ready');
 await page.locator('#simulationModelDisclosure').evaluate(node=>node.open=true);
 await expect(page.locator('#simulationModelMetadata')).toContainText('loaded independently of graphics');
 await expect(page.locator('#simulationModelMetadata pre')).toContainText('Declared synthetic modeling assumption');
});

test('desktop and mobile Activity reopen with focus, actual history and reproducible seed',async({page},info)=>{
 await page.goto('/world/?demo=1&people=30&renderer=webgl');
 await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup?.readyMs),{timeout:60000}).toBeTruthy();
 const measurements=[];
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const button=page.getByRole('button',{name:'Activity dashboard',exact:true});
  for(let i=0;i<2;i++){
   await button.click();
   const panel=page.getByRole('dialog',{name:'Activity history dashboard'});
   await expect(panel).toBeVisible();
   await expect(panel.getByRole('status')).toHaveAttribute('data-state',/ready|empty/);
   if(!i)await page.screenshot({path:info.outputPath(`activity-${viewport.width}.png`)});
   await panel.getByRole('button',{name:'Close',exact:true}).click();
   await expect(panel).toBeHidden();await expect(button).toBeFocused();
  }
  const top=page.locator('#top');await top.evaluate(node=>node.open=true);
  await expect(page.locator('#experimentSeedInput')).not.toHaveValue('');
  measurements.push(await page.evaluate(()=>({mode:window.hblWorldActivity.getSnapshot().mode,seed:document.querySelector('#experimentSeedInput').value,mood:document.querySelector('#moodN').textContent,viewport:innerWidth})));
  await page.screenshot({path:info.outputPath(`controls-${viewport.width}.png`)});
 }
 await info.attach('runtime-values',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
});


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
