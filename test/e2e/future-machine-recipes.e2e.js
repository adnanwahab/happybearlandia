import { test, expect } from '@playwright/test';
import { PLAYABLE_RECIPES } from '../../world/future-machine/recipes.js';
const ready = page => expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function evidence(page) {
  return page.evaluate(async()=>{
    const h=window.futureMachine.history;
    const {stateHash}=await import('/world/future-machine/data/core.js');
    return {recipe:h.recipe,initialHash:h.initialHash,provenance:h.provenance,
      initialEqual:JSON.stringify(h.baseline[0])===JSON.stringify(h.plan[0]),
      baselineHash:await stateHash(h.baseline),planHash:await stateHash(h.plan),
      metrics:window.futureMachine.state.diff.metrics,
      completion:h.plan.flatMap(s=>s.events).filter(e=>e.eventType==='PROJECT_COMPLETE')};
  });
}
for (const entry of PLAYABLE_RECIPES) test(`${entry.title}: Canvas play, evidence, share and saved reload`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/world/future-machine.html?renderer=canvas');
  await page.getByText('Three playable what-if recipes',{exact:true}).click();
  await expect(page.getByRole('link').filter({hasText:/^(Small infill|District expansion|Housing after a wait)$/})).toHaveCount(3);
  await page.getByRole('link',{name:entry.title,exact:true}).click();await ready(page);
  expect(new URL(page.url()).searchParams.get('renderer')).toBe('canvas');
  expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
  const before=await evidence(page);
  expect(before.recipe).toEqual(entry.recipe);expect(before.initialEqual).toBe(true);
  expect(before.provenance.datasetVersion).toBe(entry.datasetVersion);
  expect(before.provenance.modelManifest).toBeTruthy();
  expect(before.metrics.housingUnits.delta).toBe(entry.recipe.intervention.amount);
  expect(before.completion).toEqual(expect.arrayContaining([expect.objectContaining({geographyId:entry.recipe.intervention.districtId,payload:expect.objectContaining({units:entry.recipe.intervention.amount})})]));
  const slider=page.getByTestId('future-machine-timeline');await slider.fill('0');await slider.dispatchEvent('input');
  expect(await page.evaluate(()=>window.futureMachine.state.diff.physicalCount)).toBe(0);
  await slider.fill('120');await slider.dispatchEvent('input');
  expect(await page.evaluate(()=>window.futureMachine.state.diff.physicalCount)).toBeGreaterThan(0);
  await page.getByRole('button',{name:/^Blink: Future/}).click();
  await page.getByRole('button',{name:'Share comparison',exact:true}).click();
  const shared=await page.getByRole('link',{name:'Open comparison link'}).getAttribute('href');
  expect(new URL(shared).searchParams.get('experiment')).toBeTruthy();
  await page.goto(shared);await ready(page);expect(await evidence(page)).toEqual(before);
  await page.reload();await ready(page);expect(await evidence(page)).toEqual(before);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export evidence',exact:true}).click();
  const download=await downloadPromise;await download.saveAs(info.outputPath(`${entry.id}-evidence.json`));
  await page.getByText('Three playable what-if recipes',{exact:true}).click();
  await expect(page.getByText(entry.limitations,{exact:false}).first()).toBeVisible();
  await page.screenshot({path:info.outputPath(`${entry.id}.png`),fullPage:true});
  await info.attach('recorded-results',{body:JSON.stringify(before,null,2),contentType:'application/json'});
  expect(errors).toEqual([]);
});
