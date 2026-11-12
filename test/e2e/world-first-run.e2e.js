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
